# SAGI Qwen3-TTS GPU Service

Independent GPU inference service for SAGI VOICE. The mobile PWA and Cloudflare Worker never load model weights.

## API

- `GET /health`
- `POST /v1/tts` -> `audio/wav`

The Worker sends the original text plus a SAGI football-director `instruct` prompt. The default model is `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice`.

## Required runtime

Use an NVIDIA GPU container. Qwen3-TTS officially recommends Python 3.12 and supports instruction-controlled CustomVoice generation. This service defaults to SDPA so it does not require FlashAttention to boot.

## Environment

- `SAGI_TTS_TOKEN`: shared bearer secret between Worker and GPU service.
- `QWEN_MODEL`: defaults to the 1.7B CustomVoice model.
- `QWEN_ATTN`: defaults to `sdpa`.
- Worker: `QWEN3_TTS_URL` and matching `QWEN3_TTS_TOKEN`.

## Safety / rollout

Keep the existing Edge Neural route enabled. If this service times out, returns non-audio, or is not configured, SAGI VOICE falls back automatically.
