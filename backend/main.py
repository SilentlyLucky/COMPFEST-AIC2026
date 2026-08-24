from __future__ import annotations

import asyncio
import inspect
import os
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, NoReturn
from urllib.parse import urlsplit

from ai.category import (
    DEFAULT_ARTIFACT_PATH,
    DEFAULT_ENCODER_PATH,
    OpenClipCategoryClassifier,
)
from ai.listing import SulinganVlmGenerator
from ai.pricing import CatalogPricingService
from errors import ApiError
from fastapi import Depends, FastAPI, File, Form, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from image_processing import process_uploaded_image
from orchestrator import ListingOrchestrator
from pydantic import ValidationError
from schemas import (
    BaseResponseMeta,
    ErrorDetail,
    ErrorResponse,
    GenerateDescriptionRequest,
    GenerateListingResponse,
    GenerateTitleRequest,
    HealthResponse,
    ListingMetadata,
    PredictCategoryRequest,
    PredictPriceRequest,
)
from services import ListingServices
from starlette.exceptions import HTTPException

API_VERSION = "v1"
REQUEST_TIMEOUT_SECONDS = 45
MAX_CONCURRENT_GENERATIONS = 5
CORS_ALLOWED_ORIGINS_ENV = "CORS_ALLOWED_ORIGINS"
DEFAULT_CORS_ORIGINS = ("http://localhost:3000",)

ADAPTER_PATH = Path(__file__).resolve().parent / "ai" / "listing" / "model"
CATEGORY_SERVICE = OpenClipCategoryClassifier(
    artifact_path=DEFAULT_ARTIFACT_PATH,
    encoder_path=DEFAULT_ENCODER_PATH,
)
MARKET_SERVICE = CatalogPricingService()
DEFAULT_SERVICES = ListingServices(
    generator=SulinganVlmGenerator(ADAPTER_PATH),
    classifier=CATEGORY_SERVICE,
    market=MARKET_SERVICE,
)


class GenerationCapacity:
    def __init__(self, limit: int) -> None:
        self._semaphore = asyncio.Semaphore(limit)

    @asynccontextmanager
    async def reserve(self) -> AsyncIterator[None]:
        try:
            await asyncio.wait_for(self._semaphore.acquire(), timeout=0.01)
        except TimeoutError:
            raise ApiError(
                status_code=429,
                code="GENERATION_CAPACITY_EXCEEDED",
                message="Kapasitas generasi sedang penuh.",
                retryable=True,
            ) from None
        try:
            yield
        finally:
            self._semaphore.release()


generation_capacity = GenerationCapacity(MAX_CONCURRENT_GENERATIONS)


def get_services() -> ListingServices:
    return DEFAULT_SERVICES


def parse_cors_origins(raw_origins: str | None = None) -> tuple[str, ...]:
    configured = (
        os.getenv(CORS_ALLOWED_ORIGINS_ENV) if raw_origins is None else raw_origins
    )
    if configured is None or not configured.strip():
        return DEFAULT_CORS_ORIGINS

    origins: list[str] = []
    for item in configured.split(","):
        origin = item.strip().rstrip("/")
        if not origin:
            continue
        parsed = urlsplit(origin)
        try:
            _ = parsed.port
        except ValueError:
            valid = False
        else:
            valid = True
        if (
            not valid
            or origin == "*"
            or parsed.scheme not in {"http", "https"}
            or parsed.hostname is None
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path
            or parsed.query
            or parsed.fragment
            or any(character.isspace() for character in origin)
            or parsed.netloc.endswith(":")
        ):
            raise RuntimeError(f"{CORS_ALLOWED_ORIGINS_ENV} contains an invalid origin")
        if origin not in origins:
            origins.append(origin)

    if not origins:
        raise RuntimeError(f"{CORS_ALLOWED_ORIGINS_ENV} contains no origins")
    return tuple(origins)


async def _startup_services(application: FastAPI) -> ListingServices:
    provider = application.dependency_overrides.get(get_services, get_services)
    services = provider()
    if inspect.isawaitable(services):
        services = await services
    return services


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    services = await _startup_services(application)
    await services.warmup()
    yield


CORS_ORIGINS = parse_cors_origins()
app = FastAPI(title="LAPAKIN API", version=API_VERSION, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(CORS_ORIGINS),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def attach_request_id(request: Request, call_next):
    request.state.request_id = f"req_{uuid.uuid4().hex}"
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


@app.exception_handler(ApiError)
async def handle_api_error(request: Request, error: ApiError) -> JSONResponse:
    return _error_response(request, error)


@app.exception_handler(RequestValidationError)
async def handle_request_validation(
    request: Request, error: RequestValidationError
) -> JSONResponse:
    first = error.errors()[0] if error.errors() else {}
    location = first.get("loc", ())
    field = str(location[-1]) if location else None
    return _error_response(
        request,
        ApiError(
            status_code=422,
            code="REQUEST_INVALID",
            message="Form request tidak valid.",
            field=field,
            details={"errors": _safe_validation_errors(error.errors())},
        ),
    )


@app.exception_handler(HTTPException)
async def handle_http_error(request: Request, error: HTTPException) -> JSONResponse:
    return _error_response(
        request,
        ApiError(
            status_code=error.status_code,
            code="HTTP_ERROR",
            message=str(error.detail),
            retryable=error.status_code >= 500,
        ),
    )


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, _: Exception) -> JSONResponse:
    return _error_response(
        request,
        ApiError(
            status_code=500,
            code="INTERNAL_ERROR",
            message="Terjadi kesalahan internal.",
            retryable=True,
        ),
    )


@app.get("/health/live", response_model=HealthResponse)
async def health_live() -> HealthResponse:
    return HealthResponse(status="live")


@app.get("/health/ready", response_model=HealthResponse)
async def health_ready(
    services: Annotated[ListingServices, Depends(get_services)],
) -> HealthResponse | JSONResponse:
    readiness = services.readiness()
    health = HealthResponse(
        status="ready"
        if all(item.ready for item in readiness.values())
        else "not_ready",
        services=readiness,
    )
    if health.status == "not_ready":
        return JSONResponse(status_code=503, content=health.model_dump(mode="json"))
    return health


@app.post(
    "/v1/listings/generate",
    response_model=GenerateListingResponse,
    responses={
        status: {"model": ErrorResponse}
        for status in (400, 413, 415, 422, 429, 500, 503, 504)
    },
)
async def generate_listing(
    request: Request,
    image: Annotated[UploadFile, File(...)],
    metadata: Annotated[str, Form(...)],
    services: Annotated[ListingServices, Depends(get_services)],
) -> GenerateListingResponse:
    try:
        parsed_metadata = _parse_metadata(metadata)
        processed_image = await process_uploaded_image(image)
    finally:
        await image.close()
    orchestrator = ListingOrchestrator(services)

    async with generation_capacity.reserve():
        try:
            return await asyncio.wait_for(
                orchestrator.generate(
                    processed_image,
                    parsed_metadata,
                    request.state.request_id,
                ),
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
        except TimeoutError:
            raise ApiError(
                status_code=504,
                code="GENERATION_TIMEOUT",
                message="Generasi listing melewati batas waktu.",
                retryable=True,
            ) from None


def _parse_metadata(raw_metadata: str) -> ListingMetadata:
    try:
        return ListingMetadata.model_validate_json(raw_metadata)
    except ValidationError as error:
        validation_errors = error.errors()
        invalid_json = any(
            item.get("type") == "json_invalid" for item in validation_errors
        )
        first_location = (
            validation_errors[0].get("loc", ()) if validation_errors else ()
        )
        field = str(first_location[0]) if first_location else "metadata"
        raise ApiError(
            status_code=400 if invalid_json else 422,
            code="INVALID_METADATA_JSON" if invalid_json else "METADATA_INVALID",
            message=(
                "Metadata bukan JSON yang valid."
                if invalid_json
                else "Satu atau lebih field metadata tidak valid."
            ),
            field="metadata" if invalid_json else field,
            details={"errors": _safe_validation_errors(validation_errors)},
        ) from None


def _safe_validation_errors(errors: list[dict]) -> list[dict[str, str]]:
    safe_errors: list[dict[str, str]] = []
    for item in errors:
        location = ".".join(str(part) for part in item.get("loc", ()))
        safe_errors.append(
            {
                "field": location or "metadata",
                "message": str(item.get("msg", "invalid value")),
                "type": str(item.get("type", "validation_error")),
            }
        )
    return safe_errors


def _error_response(request: Request, error: ApiError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", f"req_{uuid.uuid4().hex}")
    envelope = ErrorResponse(
        meta=BaseResponseMeta(request_id=request_id),
        error=ErrorDetail(
            code=error.code,
            message=error.message,
            field=error.field,
            retryable=error.retryable,
            details=error.details,
        ),
    )
    return JSONResponse(
        status_code=error.status_code,
        content=envelope.model_dump(mode="json"),
        headers=error.headers,
    )


def _legacy_deprecated() -> NoReturn:
    raise ApiError(
        status_code=503,
        code="LEGACY_ENDPOINT_DEPRECATED",
        message="Endpoint lama sudah dinonaktifkan; gunakan POST /v1/listings/generate.",
        retryable=False,
        headers={"Deprecation": "true"},
    )


@app.post("/predict-category", deprecated=True, response_model=None)
async def predict_category(_: PredictCategoryRequest) -> NoReturn:
    _legacy_deprecated()


@app.post("/generate-description", deprecated=True, response_model=None)
async def generate_description(_: GenerateDescriptionRequest) -> NoReturn:
    _legacy_deprecated()


@app.post("/generate-title", deprecated=True, response_model=None)
async def generate_title(_: GenerateTitleRequest) -> NoReturn:
    _legacy_deprecated()


@app.post("/predict-price", deprecated=True, response_model=None)
async def predict_price(_: PredictPriceRequest) -> NoReturn:
    _legacy_deprecated()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
