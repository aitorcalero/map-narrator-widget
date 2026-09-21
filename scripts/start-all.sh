#!/bin/bash
set -e

echo "=== Map Narrator - Arranque completo ==="

# Detener procesos existentes
echo "Deteniendo procesos anteriores..."
pkill -f '/home/aitor/work/arcgis-experience-builder/services/map-narrator-api/src/index.js' 2>/dev/null || true
pkill -f 'cross-env.*webpack.*development.*watch' 2>/dev/null || true
pkill -f '/home/aitor/work/arcgis-experience-builder/server/src/server' 2>/dev/null || true
sleep 2

# Credenciales: primero variable de entorno, luego archivo local
CREDENTIALS_FILE="$HOME/.config/map-narrator/backend.env"
if [ -z "$OPENAI_API_KEY" ] && [ -f "$CREDENTIALS_FILE" ]; then
    export OPENAI_API_KEY=$(cat "$CREDENTIALS_FILE")
    echo "  Credenciales cargadas desde $CREDENTIALS_FILE"
elif [ -z "$OPENAI_API_KEY" ]; then
    echo "ERROR: OPENAI_API_KEY no está configurada."
    echo "Guarda la clave en: $CREDENTIALS_FILE  (con chmod 600)"
    echo "O exporta: export OPENAI_API_KEY='tu_clave'"
    exit 1
fi

# 1. Arrancar backend API
echo "Arrancando backend API..."
cd /home/aitor/work/arcgis-experience-builder/services/map-narrator-api
export MAP_NARRATOR_ALLOWED_ORIGIN="https://omarchy.taild71000.ts.net"
env OPENAI_API_KEY="$OPENAI_API_KEY" MAP_NARRATOR_ALLOWED_ORIGIN="$MAP_NARRATOR_ALLOWED_ORIGIN" npm start > /tmp/map-narrator-api.log 2>&1 &
API_PID=$!
echo "  Backend PID: $API_PID"

# 2. Esperar a que el backend esté listo
echo "Esperando backend..."
for i in {1..30}; do
    if curl -s --max-time 2 http://127.0.0.1:8787/healthz > /dev/null 2>&1; then
        echo "  Backend listo"
        break
    fi
    sleep 1
done

# 3. Arrancar Experience Builder
echo "Arrancando Experience Builder..."
cd /home/aitor/work/arcgis-experience-builder/server
NODE_ENV=production pnpm start > /tmp/experience-builder.log 2>&1 &
EB_PID=$!
echo "  Experience Builder PID: $EB_PID"

# 4. Esperar a que EB esté listo
echo "Esperando Experience Builder..."
for i in {1..60}; do
    if curl -s --max-time 2 http://127.0.0.1:3001 > /dev/null 2>&1; then
        echo "  Experience Builder listo"
        break
    fi
    sleep 1
done

# 5. Verificar Tailscale serve
echo "Verificando Tailscale..."
TAILSCALE_API=$(tailscale serve status --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print('configurado' if d.get('Web') else 'no_configurado')" 2>/dev/null || echo "no_configurado")
echo "  Tailscale API: $TAILSCALE_API"

# 6. Verificaciones finales
echo ""
echo "=== Verificaciones ==="
echo -n "Backend (local): "
if curl -s --max-time 2 http://127.0.0.1:8787/healthz | grep -q '"status":"ok"'; then echo "OK"; else echo "FALLO"; fi

echo -n "Backend (Tailscale): "
if curl -s --max-time 5 https://omarchy.taild71000.ts.net:8443/healthz | grep -q '"status":"ok"'; then echo "OK"; else echo "FALLO"; fi

echo -n "Experience Builder (local): "
if curl -s --max-time 2 http://127.0.0.1:3001 > /dev/null 2>&1; then echo "OK"; else echo "FALLO"; fi

echo -n "Experience Builder (Tailscale): "
if curl -s --max-time 5 https://omarchy.taild71000.ts.net > /dev/null 2>&1; then echo "OK"; else echo "FALLO"; fi

echo ""
echo "=== Listo ==="
echo "App: https://omarchy.taild71000.ts.net"
echo "API: https://omarchy.taild71000.ts.net:8443/api/map-description"
