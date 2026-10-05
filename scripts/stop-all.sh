#!/usr/bin/env bash
set -euo pipefail

RESET_TAILSCALE=false
CLOSE_WEBPACK=false

usage() {
  cat <<'EOF'
Uso: bash scripts/stop-all.sh [opciones]

  --reset-tailscale  Retirar Serve y Funnel además de detener los servicios
  --close-webpack    Detener también procesos Webpack del cliente
  -h, --help         Mostrar esta ayuda
EOF
}

while (($#)); do
  case "$1" in
    --reset-tailscale) RESET_TAILSCALE=true; shift ;;
    --close-webpack) CLOSE_WEBPACK=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: opción desconocida: $1" >&2; usage >&2; exit 2 ;;
  esac
done

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
      echo "ERROR: instala lsof o fuser para localizar procesos en el puerto $port." >&2
      return 1
    fi
  done
}

stop_webpack_processes() {
  local pid
  command -v pgrep >/dev/null 2>&1 || {
    echo 'ADVERTENCIA: pgrep no está disponible; no se buscarán procesos Webpack.' >&2
    return 0
  }
  while read -r pid; do
    [[ -n "$pid" ]] && stop_pid_tree "$pid"
  done < <(pgrep -f 'webpack|experience-builder.*/client' 2>/dev/null || true)
}

echo 'Deteniendo Map Narrator en los puertos 8787, 3000 y 3001...'
stop_processes_on_ports
if $CLOSE_WEBPACK; then
  stop_webpack_processes
fi

if $RESET_TAILSCALE; then
  command -v tailscale >/dev/null 2>&1 || {
    echo 'ERROR: tailscale no está disponible en PATH.' >&2
    exit 1
  }
  serve_status=0
  funnel_status=0
  tailscale serve reset >/dev/null 2>&1 || serve_status=$?
  tailscale funnel reset >/dev/null 2>&1 || funnel_status=$?
  if ((serve_status != 0 && funnel_status != 0)); then
    echo 'ERROR: no se pudo retirar la configuración de Tailscale Serve/Funnel.' >&2
    exit 1
  fi
  echo 'Configuración de Tailscale Serve/Funnel retirada.'
fi

echo 'Map Narrator detenido.'
