# Map Narrator API

A minimal Node.js service for the Experience Builder `map-narrator` widget.

## Local verification

```sh
npm test
```

Expected result: all Node tests pass.

## Run locally

Set `OPENAI_API_KEY` in your terminal or deployment secret manager (never in the widget, app item, source control, or chat), then optionally configure `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, and `ELEVENLABS_MODEL` to enable speech:

```sh
OPENAI_API_KEY="$OPENAI_API_KEY" npm start
curl http://127.0.0.1:8787/healthz
```

Expected health response: `{"status":"ok"}`.

The widget must be configured with the deployed HTTPS endpoint ending in `/api/map-description`. It sends only bounded map metadata: map title, extent, scale, basemap, and up to twelve layer metadata records. Visual mode additionally sends an explicit user-requested JPEG screenshot (quality 75) up to 4 MiB (the complete JSON request is capped at 6 MiB). It never sends features, attributes, geometries, or browser credentials.

Visual requests may include an optional `customPrompt` focus of up to 500 characters. The service appends the protected accessibility, privacy, uncertainty, and safety instructions to every visual prompt; attempts to override those instructions are rejected with `400 INVALID_REQUEST`. Omitting the field preserves the default prompt and existing behavior.

When ElevenLabs is configured, `POST /api/speech` accepts a bounded JSON body
such as `{"text":"Descripción del mapa"}` and returns `audio/mpeg`. The API key
and voice ID remain server-side; the widget only receives the generated audio.

## Forensic diagnostics

Each narration response carries an `x-request-id` header and a sanitized `diagnostic` object. The widget's diagnostic window displays that ID, HTTP status, processing stage, and error code so a failed browser request can be correlated with the API event.

The API appends one sanitized JSON record per request to `logs/forensics.jsonl` (owner-only permissions, not committed). It includes timestamp, request ID, stage (`authorization`, `rate-limit`, `validation`, `cache`, `upstream`, or `completed`), status, sanitized code, cache state, visual-mode flag, and duration. It intentionally excludes API keys, authorization headers, map context, prompts, screenshots, base64 data, and model output. The current file is capped at 1 MiB and retains one previous rotation (`forensics.jsonl.1`).

To inspect failures while testing locally:

```sh
tail -f logs/forensics.jsonl
```

Set `MAP_NARRATOR_FORENSICS_LOG` to an absolute path only when the runtime needs a different secure log location.

## Production prerequisites

Place the service behind an HTTPS reverse proxy/gateway that enforces ArcGIS organization authentication and rate limits before it reaches this service. Store `OPENAI_API_KEY` solely in that runtime's secret manager. Configure the widget with the HTTPS endpoint after the gateway is live.
