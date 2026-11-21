import io
import os
import hmac
import threading
import subprocess
from typing import Optional

import numpy as np
import soundfile as sf
import torch
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from qwen_tts import Qwen3TTSModel

MODEL_ID = os.getenv("QWEN_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice")
SERVICE_TOKEN = os.getenv("SAGI_TTS_TOKEN", "")
ATTN = os.getenv("QWEN_ATTN", "sdpa")
TARGET_TEMPO_MIN = float(os.getenv("SAGI_TARGET_TEMPO_MIN", "0.70"))
TARGET_TEMPO_MAX = float(os.getenv("SAGI_TARGET_TEMPO_MAX", "1.42"))
_model = None
_model_lock = threading.Lock()
_infer_lock = threading.Lock()

app = FastAPI(title="SAGI Qwen3-TTS", version="1.0.0")

class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    language: str = "Chinese"
    speaker: str = "Uncle_Fu"
    instruct: str = Field(default="", max_length=2500)
    style: str = "football_pro"
    speed: float = Field(default=1.0, ge=0.7, le=1.42)
    target_duration: Optional[float] = Field(default=None, ge=0.5, le=120.0)
    intensity: int = Field(default=65, ge=0, le=100)
    segment_index: int = Field(default=0, ge=0)
    segment_count: int = Field(default=1, ge=1, le=8)

def authorize(value: Optional[str]):
    if not SERVICE_TOKEN:
        raise HTTPException(status_code=503, detail="service_not_configured")
    expected = "Bearer " + SERVICE_TOKEN
    if not value or not hmac.compare_digest(value, expected):
        raise HTTPException(status_code=401, detail="unauthorized")

def tempo_for_target(raw_duration: float, target_duration: Optional[float], fallback_speed: float) -> float:
    if target_duration is None:
        return max(0.7, min(1.42, float(fallback_speed or 1.0)))
    raw = float(raw_duration or 0.0)
    target = float(target_duration or 0.0)
    if raw <= 0 or target <= 0:
        raise HTTPException(status_code=422, detail="invalid_duration")
    speed = raw / target
    if speed < TARGET_TEMPO_MIN or speed > TARGET_TEMPO_MAX:
        lo = raw / TARGET_TEMPO_MAX
        hi = raw / TARGET_TEMPO_MIN
        raise HTTPException(
            status_code=422,
            detail={
                "code": "target_duration_out_of_safe_range",
                "raw_duration": round(raw, 4),
                "target_duration": round(target, 4),
                "safe_target_min": round(lo, 4),
                "safe_target_max": round(hi, 4),
                "tempo": round(speed, 6),
            },
        )
    return speed

def wav_duration(data: bytes) -> float:
    try:
        info = sf.info(io.BytesIO(data))
        if not info.samplerate:
            return 0.0
        return float(info.frames) / float(info.samplerate)
    except Exception:
        return 0.0

def apply_tempo(data: bytes, speed: float) -> bytes:
    speed = max(0.7, min(1.42, float(speed or 1.0)))
    if abs(speed - 1.0) < 0.01:
        return data
    proc = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-i", "pipe:0",
            "-filter:a", f"atempo={speed:.6f}",
            "-f", "wav", "pipe:1",
        ],
        input=data,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
        timeout=30,
    )
    if proc.returncode != 0 or len(proc.stdout) < 800:
        detail = proc.stderr.decode("utf-8", errors="ignore")[:220]
        raise HTTPException(status_code=502, detail="tempo_failed:" + detail)
    # Normalize streaming WAV headers before sending to Safari or measuring frames.
    samples, rate = sf.read(io.BytesIO(proc.stdout), dtype="float32")
    output = io.BytesIO()
    sf.write(output, samples, rate, format="WAV", subtype="PCM_16")
    return output.getvalue()

def load_model():
    global _model
    if _model is not None:
        return _model
    with _model_lock:
        if _model is not None:
            return _model
        use_cuda = torch.cuda.is_available()
        kwargs = {
            "device_map": "cuda:0" if use_cuda else "cpu",
            "dtype": torch.bfloat16 if use_cuda else torch.float32,
            "attn_implementation": ATTN,
        }
        _model = Qwen3TTSModel.from_pretrained(MODEL_ID, **kwargs)
    return _model

@app.get("/health")
def health():
    return {
        "ok": True,
        "engine": "qwen3-tts",
        "model": MODEL_ID,
        "cuda": torch.cuda.is_available(),
        "loaded": _model is not None,
        "attn": ATTN,
    }

@app.post("/v1/tts")
def tts(req: TTSRequest, authorization: Optional[str] = Header(default=None)):
    authorize(authorization)
    model = load_model()
    with _infer_lock:
        wavs, sr = model.generate_custom_voice(
            text=req.text,
            language=req.language,
            speaker=req.speaker,
            instruct=req.instruct,
        )
    audio = np.asarray(wavs[0], dtype=np.float32)
    if audio.ndim > 1:
        audio = np.mean(audio, axis=-1)
    audio = np.clip(audio, -1.0, 1.0)
    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV", subtype="PCM_16")
    data = buf.getvalue()
    if len(data) < 800:
        raise HTTPException(status_code=502, detail="empty_audio")
    raw_duration = float(len(audio)) / float(sr) if sr else 0.0
    tempo = tempo_for_target(raw_duration, req.target_duration, req.speed)
    data = apply_tempo(data, tempo)
    final_duration = wav_duration(data)
    if final_duration <= 0:
        raise HTTPException(status_code=502, detail="invalid_output_duration")
    if req.target_duration is not None and abs(final_duration - req.target_duration) > 0.25:
        raise HTTPException(status_code=422, detail="target_duration_tolerance_exceeded")
    headers = {
        "Cache-Control": "no-store",
        "X-Qwen-Model": MODEL_ID,
        "X-Qwen-Speaker": req.speaker,
        "X-SAGI-Style": req.style,
        "X-SAGI-Sample-Rate": str(sr),
        "X-SAGI-Tempo": f"{tempo:.6f}",
        "X-SAGI-Raw-Duration": f"{raw_duration:.4f}",
        "X-SAGI-Target-Duration": "" if req.target_duration is None else f"{req.target_duration:.4f}",
        "X-SAGI-Final-Duration": f"{final_duration:.4f}",
    }
    return Response(content=data, media_type="audio/wav", headers=headers)
