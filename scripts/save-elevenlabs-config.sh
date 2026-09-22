#!/bin/bash
set -euo pipefail

CREDENTIALS_DIR="$HOME/.config/map-narrator"
CREDENTIALS_FILE="$CREDENTIALS_DIR/backend.env"
umask 077
mkdir -p "$CREDENTIALS_DIR"

echo "=== Configuración segura de ElevenLabs ==="
read -rsp "Pega la API key de ElevenLabs: " ELEVENLABS_API_KEY
echo
read -rp "Voice ID de ElevenLabs: " ELEVENLABS_VOICE_ID
read -rp "Modelo [eleven_multilingual_v2]: " ELEVENLABS_MODEL
ELEVENLABS_MODEL="${ELEVENLABS_MODEL:-eleven_multilingual_v2}"

if [[ -z "$ELEVENLABS_API_KEY" || "$ELEVENLABS_API_KEY" =~ [[:cntrl:]] ]]; then
  echo "ERROR: la API key está vacía o contiene caracteres no válidos." >&2
  exit 1
fi
if [[ -z "$ELEVENLABS_VOICE_ID" || "$ELEVENLABS_VOICE_ID" =~ [[:cntrl:]] ]]; then
  echo "ERROR: el Voice ID está vacío o contiene caracteres no válidos." >&2
  exit 1
fi

TEMP_FILE="$(mktemp)"
if [[ -f "$CREDENTIALS_FILE" ]]; then
  grep -vE '^(ELEVENLABS_API_KEY|ELEVENLABS_VOICE_ID|ELEVENLABS_MODEL)=' "$CREDENTIALS_FILE" | grep -E '^[A-Za-z_][A-Za-z0-9_]*=' >"$TEMP_FILE" || true
fi
{
  cat "$TEMP_FILE"
  printf 'ELEVENLABS_API_KEY=%s\n' "$ELEVENLABS_API_KEY"
  printf 'ELEVENLABS_VOICE_ID=%s\n' "$ELEVENLABS_VOICE_ID"
  printf 'ELEVENLABS_MODEL=%s\n' "$ELEVENLABS_MODEL"
} >"$CREDENTIALS_FILE"
rm -f "$TEMP_FILE"
chmod 600 "$CREDENTIALS_FILE"

echo "Configuración de ElevenLabs guardada en $CREDENTIALS_FILE"
echo "Ahora puedes ejecutar el script de arranque del proyecto."
