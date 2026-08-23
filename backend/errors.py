from __future__ import annotations

from collections.abc import Mapping
from typing import Any


class ApiError(Exception):
    def __init__(
        self,
        *,
        status_code: int,
        code: str,
        message: str,
        field: str | None = None,
        retryable: bool = False,
        details: dict[str, Any] | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.field = field
        self.retryable = retryable
        self.details = details or {}
        self.headers = dict(headers or {})
