# SAGI VOICE Stability Policy

SAGI VOICE is now managed as a stability-first product.

## Channels

- `main` = **Stable / Production**. Only fully verified code belongs here.
- `beta` = **Experiment / Candidate**. New voices, styles, routing, UI changes, and provider experiments start here.
- `stable-r3.2` = **Certified rollback point** for the current production architecture.

Production URL:

`https://sagi-voice-edge-relay.sg3544225.workers.dev/`

## Promotion rule

A change may move from Beta to Stable only when all of the following are green:

1. Worker syntax / Wrangler dry-run.
2. Sec-MS-GEC v2 reference vectors.
3. SAGI VOICE Golden regression suite.
4. Real Microsoft Edge Neural audio is returned.
5. Provider header is `Microsoft Edge Neural Direct`.
6. No case returns an empty or implausibly short/long audio file.
7. iPhone/PWA shell remains reachable.

## Golden suite

`stability/golden-cases.json` is the fixed regression corpus.

It intentionally covers:
- professional football commentary
- passionate attack/defence
- goal / high-energy finish
- warm football story
- emotional story
- documentary memory
- natural female narration

The corpus should change slowly. Product changes should adapt to the corpus; the corpus should not be weakened to make a failing build pass.

## Rollback rule

If Stable regresses after a deployment:

1. Stop promotion.
2. Keep the failing code in `beta`.
3. Restore from `stable-r3.2` (or the next certified stable rollback branch).
4. Re-run the full golden suite.
5. Only re-promote after the root cause is fixed.

## Priority order

1. Reliability
2. Complete audio / no missing text
3. Mobile usability
4. Voice quality
5. New features

Visual or feature upgrades must never outrank live usability.
