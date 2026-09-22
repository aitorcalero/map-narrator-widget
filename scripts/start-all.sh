#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_DIR="$REPO_ROOT/services/map-narrator-api"
CREDENTIALS_FILE="$HOME/.config/map-narrator/backend.env"
EXPERIENCE_BUILDER_ROOT="${EXPERIENCE_BUILDER_ROOT:-}"
ALLOWED_ORIGIN="${MAP_NARRATOR_ALLOWED_ORIGIN:-http://localhost:3001}"
LOG_DIR="${TMPDIR:-/tmp}/map-narrator"

wait_for_http() {
  local url="$1"
  local name="$2"
  local attempts="$3"

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if curl --fail --silent --show-error --max-time 2 "$url" >/dev/null; then
      echo "  $name listo"
      return 0
    fi
    sleep 1
  done

  echo "ERROR: $name no respondió en $url tras $attempts segundos." >&2
  return 1
}

if [[ -z "${OPENAI_API_KEY:-}" && -f "$CREDENTIALS_FILE" ]]; then
  export OPENAI_API_KEY
  OPENAI_API_KEY="$(<"$CREDENTIALS_FILE")"
  echo "Credenciales cargadas desde $CREDENTIALS_FILE"
fi

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "ERROR: configura OPENAI_API_KEY o ejecuta bash scripts/save-api-key.sh." >&2
  exit 1
fi

if [[ -z "$EXPERIENCE_BUILDER_ROOT" || ! -d "$EXPERIENCE_BUILDER_ROOT/server" ]]; then
  echo "ERROR: define EXPERIENCE_BUILDER_ROOT con el directorio de ArcGIS Experience Builder." >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
echo "=== Map Narrator - Arranque completo ==="

echo "Arrancando backend API..."
(
  cd "$API_DIR"
  MAP_NARRATOR_ALLOWED_ORIGIN="$ALLOWED_ORIGIN" npm start >"$LOG_DIR/api.log" 2>&1 &
  echo "$!" >"$LOG_DIR/api.pid"
)
API_PID="$(<"$LOG_DIR/api.pid")"
echo "  Backend PID: $API_PID"

if ! wait_for_http "http://127.0.0.1:8787/healthz" "Backend" 30; then
  kill "$API_PID" 2>/dev/null || true
  echo "Consulta $LOG_DIR/api.log para ver el error." >&2
  exit 1
fi

echo "Arrancando Experience Builder..."
(
  cd "$EXPERIENCE_BUILDER_ROOT/server"
  pnpm start >"$LOG_DIR/experience-builder.log" 2>&1 &
  echo "$!" >"$LOG_DIR/experience-builder.pid"
)
EB_PID="$(<"$LOG_DIR/experience-builder.pid")"
echo "  Experience Builder PID: $EB_PID"

if ! wait_for_http "$ALLOWED_ORIGIN" "Experience Builder" 60; then
  kill "$EB_PID" 2>/dev/null || true
  kill "$API_PID" 2>/dev/null || true
  echo "Consulta $LOG_DIR/experience-builder.log para ver el error." >&2
  exit 1
fi

echo ""
echo "=== Listo ==="
echo "App: $ALLOWED_ORIGIN"
echo "API: http://127.0.0.1:8787/api/map-description"
