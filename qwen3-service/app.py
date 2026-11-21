import io
import os
import hmac
import threading
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
    intensity: int = Field(default=65, ge=0, le=100)
    segment_index: int = Field(default=0, ge=0)
    segment_count: int = Field(default=1, ge=1, le=8)

def authorize(value: Optional[str]):
    if not SERVICE_TOKEN:
        return
    expected = "Bearer " + SERVICE_TOKEN
    if not value or not hmac.compare_digest(value, expected):
        raise HTTPException(status_code=401, detail="unauthorized")

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
    headers = {
        "Cache-Control": "no-store",
        "X-Qwen-Model": MODEL_ID,
        "X-Qwen-Speaker": req.speaker,
        "X-SAGI-Style": req.style,
        "X-SAGI-Sample-Rate": str(sr),
    }
    return Response(content=data, media_type="audio/wav", headers=headers)
