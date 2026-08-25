FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential python3 python3-pip python3-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements-model.txt requirements.txt ./
RUN python3 -m pip install --upgrade pip \
    && python3 -m pip install -r requirements-model.txt

COPY run.sh ./run.sh
RUN chmod +x ./run.sh

EXPOSE 8012
CMD ["bash", "-lc", "PYTHON_BIN=/usr/bin/python3 ./run.sh"]
