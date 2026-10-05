#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_DIR="$REPO_ROOT/services/map-narrator-api"
WIDGET_SOURCE="$REPO_ROOT/client/your-extensions/widgets/map-narrator"
CREDENTIALS_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/map-narrator/backend.env"
EXPERIENCE_BUILDER_ROOT="${EXPERIENCE_BUILDER_ROOT:-}"
ALLOWED_ORIGIN="${MAP_NARRATOR_ALLOWED_ORIGIN:-}"
SKIP_TAILSCALE=false
FUNNEL_MODE=""
STOP_ONLY=false
LOG_DIR="${TMPDIR:-/tmp}/map-narrator"

usage() {
  cat <<'EOF'
Uso: bash scripts/start-all.sh [opciones]

  --experience-builder-root RUTA  Ruta de Experience Builder
  --skip-tailscale                No publicar mediante Tailscale
  --funnel                        Activar Tailscale Funnel sin preguntar
  --no-funnel                     Usar Tailscale Serve sin preguntar
  --stop                          Detener los procesos locales del proyecto
  -h, --help                      Mostrar esta ayuda
EOF
}

while (($#)); do
  case "$1" in
    --experience-builder-root)
      [[ $# -ge 2 ]] || { echo "ERROR: falta la ruta de Experience Builder." >&2; exit 2; }
      EXPERIENCE_BUILDER_ROOT="$2"
      shift 2
      ;;
    --skip-tailscale) SKIP_TAILSCALE=true; shift ;;
    --funnel)
      [[ -z "$FUNNEL_MODE" ]] || { echo "ERROR: --funnel y --no-funnel son incompatibles." >&2; exit 2; }
      FUNNEL_MODE=true
      shift
      ;;
    --no-funnel)
      [[ -z "$FUNNEL_MODE" ]] || { echo "ERROR: --funnel y --no-funnel son incompatibles." >&2; exit 2; }
      FUNNEL_MODE=false
      shift
      ;;
    --stop) STOP_ONLY=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: opción desconocida: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if $SKIP_TAILSCALE && [[ -n "$FUNNEL_MODE" ]]; then
  echo "ERROR: --skip-tailscale no se puede combinar con --funnel o --no-funnel." >&2
  exit 2
fi

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: $1 no está disponible en PATH." >&2
    exit 1
  }
}

wait_for_http() {
  local url="$1" name="$2" attempts="$3" pid="$4" error_log="$5"
  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "ERROR: $name terminó antes de estar listo." >&2
      [[ -f "$error_log" ]] && cat "$error_log" >&2
      return 1
    fi
    if curl --fail --silent --show-error --max-time 2 "$url" >/dev/null; then
      echo "  $name listo"
      return 0
    fi
    sleep 1
  done
  echo "ERROR: $name no respondió en $url tras $attempts segundos." >&2
  echo "Consulta $error_log para ver el error." >&2
  return 1
}

resolve_experience_builder_root() {
  local candidate
  local candidates=()
  [[ -n "$EXPERIENCE_BUILDER_ROOT" ]] && candidates+=("$EXPERIENCE_BUILDER_ROOT")
  candidates+=(
    "$HOME/arcgis-experience-builder-1.21"
    "$HOME/arcgis-experience-builder"
    "$HOME/Downloads/arcgis-experience-builder-1.21"
  )
  for candidate in "${candidates[@]}"; do
    if [[ -d "$candidate/server" && -d "$candidate/client" ]]; then
      EXPERIENCE_BUILDER_ROOT="$(cd "$candidate" && pwd)"
      return
    fi
  done
  if [[ -n "${EXPERIENCE_BUILDER_ROOT:-}" ]]; then
    echo "ERROR: EXPERIENCE_BUILDER_ROOT no contiene server y client: $EXPERIENCE_BUILDER_ROOT" >&2
  else
    echo "ERROR: define EXPERIENCE_BUILDER_ROOT con una instalación de Experience Builder." >&2
  fi
  exit 1
}

load_credentials() {
  [[ -f "$CREDENTIALS_FILE" ]] || return
  if grep -q '^OPENAI_API_KEY=' "$CREDENTIALS_FILE"; then
    while IFS='=' read -r name value; do
      if [[ "$name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
        if [[ -z "${!name+x}" ]]; then
          export "$name=$value"
        fi
      fi
    done <"$CREDENTIALS_FILE"
  elif [[ -z "${OPENAI_API_KEY:-}" ]]; then
    export OPENAI_API_KEY
    OPENAI_API_KEY="$(<"$CREDENTIALS_FILE")"
  fi
  echo "Configuración cargada desde $CREDENTIALS_FILE"
}

stop_pid_tree() {
  local pid="$1" child
  [[ "$pid" =~ ^[0-9]+$ && "$pid" -gt 1 ]] || return 0
  while read -r child; do
    [[ -n "$child" ]] && stop_pid_tree "$child"
  done < <(pgrep -P "$pid" 2>/dev/null || true)
  kill "$pid" 2>/dev/null || true
}

stop_processes_on_ports() {
  local port pid
  for port in 8787 3000 3001; do
    if command -v lsof >/dev/null 2>&1; then
      while read -r pid; do
        [[ -n "$pid" ]] && stop_pid_tree "$pid"
      done < <(lsof -ti "TCP:$port" -sTCP:LISTEN 2>/dev/null | sort -u)
    elif command -v fuser >/dev/null 2>&1; then
      while read -r pid; do
        [[ -n "$pid" ]] && stop_pid_tree "$pid"
      done < <(fuser -n tcp "$port" 2>/dev/null | tr ' ' '\n' | sort -u)
    else
      echo "ADVERTENCIA: no se puede limpiar el puerto $port (instala lsof o fuser)." >&2
    fi
  done
}

if $STOP_ONLY; then
  stop_processes_on_ports
  echo "Procesos de Map Narrator detenidos."
  exit 0
fi

get_tailscale_dns_name() {
  require_command tailscale
  local status
  status="$(tailscale status --json)" || {
    echo "ERROR: no se pudo consultar Tailscale." >&2
    exit 1
  }
  if ! node -e 'let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s); if(v.BackendState!=="Running" || !v.Self?.DNSName) process.exit(1); process.stdout.write(v.Self.DNSName.replace(/\.$/,""));})' <<<"$status"; then
    echo "Tailscale no está conectado. Activando la conexión..."
    tailscale up
    status="$(tailscale status --json)" || {
      echo "ERROR: no se pudo consultar Tailscale después de activarlo." >&2
      exit 1
    }
    node -e 'let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s); if(v.BackendState!=="Running" || !v.Self?.DNSName) process.exit(1); process.stdout.write(v.Self.DNSName.replace(/\.$/,""));})' <<<"$status" || {
      echo "ERROR: Tailscale no está conectado o no tiene DNS disponible." >&2
      exit 1
    }
  fi
}

resolve_funnel_choice() {
  [[ -n "$FUNNEL_MODE" ]] && return
  local answer
  while true; do
    read -r -p "¿Quieres activar Tailscale Funnel para acceso público? (S/N) " answer
    case "${answer,,}" in
      s|si|sí) FUNNEL_MODE=true; return ;;
      n|no) FUNNEL_MODE=false; return ;;
    esac
  done
}

configure_tailscale() {
  local command="$1" dns_name="$2"
  tailscale "$command" --https=443 --bg http://127.0.0.1:3000
  tailscale "$command" --https=8443 --bg http://127.0.0.1:8787
  APP_URL="https://$dns_name"
  API_URL="https://$dns_name:8443/api/map-description"
}

require_command node
require_command npm
require_command pnpm
require_command curl
load_credentials
[[ -n "${OPENAI_API_KEY:-}" ]] || { echo "ERROR: configura OPENAI_API_KEY o ejecuta bash scripts/save-api-key.sh." >&2; exit 1; }
resolve_experience_builder_root

[[ -f "$WIDGET_SOURCE/manifest.json" ]] || { echo "ERROR: no se encontró el widget fuente en $WIDGET_SOURCE." >&2; exit 1; }
WIDGET_TARGET="$EXPERIENCE_BUILDER_ROOT/client/your-extensions/widgets/map-narrator"
mkdir -p "$WIDGET_TARGET"
cp -R "$WIDGET_SOURCE"/. "$WIDGET_TARGET"/
echo "Widget sincronizado en $WIDGET_TARGET"

stop_processes_on_ports
mkdir -p "$LOG_DIR"
API_LOG="$LOG_DIR/api.log"
API_ERROR="$LOG_DIR/api.err.log"
CLIENT_LOG="$LOG_DIR/experience-builder-client.log"
CLIENT_ERROR="$LOG_DIR/experience-builder-client.err.log"
BUILDER_LOG="$LOG_DIR/experience-builder.log"
BUILDER_ERROR="$LOG_DIR/experience-builder.err.log"

if $SKIP_TAILSCALE; then
  ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-http://localhost:3001}"
  APP_URL="$ALLOWED_ORIGIN"
  API_URL="http://127.0.0.1:8787/api/map-description"
else
  DNS_NAME="$(get_tailscale_dns_name)"
  resolve_funnel_choice
  ALLOWED_ORIGIN="https://$DNS_NAME"
  APP_URL="$ALLOWED_ORIGIN"
  API_URL="https://$DNS_NAME:8443/api/map-description"
fi

echo "=== Map Narrator - Arranque completo ==="
MAP_NARRATOR_ALLOWED_ORIGIN="$ALLOWED_ORIGIN" npm start --prefix "$API_DIR" >"$API_LOG" 2>"$API_ERROR" &
API_PID=$!
echo "$API_PID" >"$LOG_DIR/api.pid"
echo "  Backend PID: $API_PID"

cleanup() {
  stop_pid_tree "${BUILDER_PID:-0}"
  stop_pid_tree "${CLIENT_PID:-0}"
  stop_pid_tree "${API_PID:-0}"
}
trap cleanup EXIT INT TERM

wait_for_http "http://127.0.0.1:8787/healthz" "Backend" 30 "$API_PID" "$API_ERROR"
(
  cd "$EXPERIENCE_BUILDER_ROOT/client"
  pnpm start >"$CLIENT_LOG" 2>"$CLIENT_ERROR"
) &
CLIENT_PID=$!
echo "$CLIENT_PID" >"$LOG_DIR/experience-builder-client.pid"
echo "  Experience Builder client PID: $CLIENT_PID"
sleep 5
kill -0 "$CLIENT_PID" 2>/dev/null || { echo "ERROR: Experience Builder client terminó." >&2; cat "$CLIENT_ERROR" >&2; exit 1; }

(
  cd "$EXPERIENCE_BUILDER_ROOT/server"
  node src/server --dev_edition --http_only >"$BUILDER_LOG" 2>"$BUILDER_ERROR"
) &
BUILDER_PID=$!
echo "$BUILDER_PID" >"$LOG_DIR/experience-builder.pid"
echo "  Experience Builder PID: $BUILDER_PID"
wait_for_http "http://127.0.0.1:3000" "Experience Builder" 60 "$BUILDER_PID" "$BUILDER_ERROR"

if ! $SKIP_TAILSCALE; then
  configure_tailscale "$([[ "$FUNNEL_MODE" == true ]] && echo funnel || echo serve)" "$DNS_NAME"
  wait_for_http "$APP_URL" "Experience Builder via Tailscale" 30 "$BUILDER_PID" "$BUILDER_ERROR"
fi

echo ""
echo "=== Listo ==="
echo "App: $APP_URL"
echo "API: $API_URL"
if ! $SKIP_TAILSCALE; then
  echo "Acceso público (Funnel): $FUNNEL_MODE"
fi
echo "Logs: $LOG_DIR"
wait "$CLIENT_PID" "$BUILDER_PID"
