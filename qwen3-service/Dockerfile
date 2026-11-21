FROM nvidia/cuda:12.8.1-cudnn-runtime-ubuntu24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/models/hf

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip libsndfile1 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY qwen3-service/requirements.txt /app/requirements.txt

RUN python3 -m pip install --break-system-packages \
    torch torchaudio --index-url https://download.pytorch.org/whl/cu128 && \
    python3 -m pip install --break-system-packages -r /app/requirements.txt

COPY qwen3-service/app.py /app/app.py

ENV QWEN_MODEL=Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice \
    QWEN_ATTN=sdpa \
    PORT=8000

EXPOSE 8000
CMD ["python3","-m","uvicorn","app:app","--host","0.0.0.0","--port","8000","--workers","1"]
