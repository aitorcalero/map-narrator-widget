# Map Narrator API

A minimal Node.js service for the Experience Builder `map-narrator` widget.

## Local verification

```sh
npm test
```

Expected result: all Node tests pass.

## Run locally

Set `OPENAI_API_KEY` in your terminal or deployment secret manager (never in the widget, app item, source control, or chat), then:

```sh
OPENAI_API_KEY="$OPENAI_API_KEY" npm start
curl http://127.0.0.1:8787/healthz
```

Expected health response: `{"status":"ok"}`.

The widget must be configured with the deployed HTTPS endpoint ending in `/api/map-description`. It sends only bounded map metadata: map title, extent, scale, basemap, and up to twelve layer metadata records. It never sends features, attributes, geometries, or screenshots.

## Production prerequisites

Place the service behind an HTTPS reverse proxy/gateway that enforces ArcGIS organization authentication and rate limits before it reaches this service. Store `OPENAI_API_KEY` solely in that runtime's secret manager. Configure the widget with the HTTPS endpoint after the gateway is live.
