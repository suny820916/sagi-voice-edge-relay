# SAGI VOICE Edge Relay

Overseas-only relay for SAGI VOICE PRO when a mobile network cannot directly reach `onrender.com`.

- Platform: Cloudflare Workers
- Public hostname: Cloudflare-provided `*.workers.dev`
- No SAGI domestic server required
- No SAGI custom domain required
- Backend remains Render Singapore

## One-click deployment

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fsuny820916%2Fsagi-voice-edge-relay%2Ftree%2Ffeature%2Ffree-engine-discovery)

Direct deployment URL:

https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fsuny820916%2Fsagi-voice-edge-relay%2Ftree%2Ffeature%2Ffree-engine-discovery

Cloudflare will clone this isolated Worker directory, create a Worker, configure Workers Builds, and provide a `workers.dev` URL.

## Files

- `worker.js`: restricted reverse proxy to SAGI Cloud `/health` and `/api/*`
- `wrangler.toml`: Workers deployment config

After deployment, use the generated `https://<name>.<account>.workers.dev` URL as the SAGI VOICE primary cloud endpoint; Render remains fallback.


## Build settings

- Root directory: `/`
- Build command: leave blank
- Deploy command: `npx wrangler deploy`
- Wrangler pinned in package.json: `4.165.0`

## Deployment verification (FREE V1.6 candidate)

The deployment button above targets the isolated development branch, not `main`. Cloudflare account authorization and deployment must succeed before any `workers.dev` URL is advertised as live. The button URL alone is not deployment evidence. Use `npm ci && npm run check` for a local Wrangler dry-run, then inspect Cloudflare build/deployment logs for the exact failure. Do not treat public demo TTS endpoints as guaranteed production capacity.
