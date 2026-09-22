#!/bin/bash
set -e

CREDENTIALS_DIR="$HOME/.config/map-narrator"
CREDENTIALS_FILE="$CREDENTIALS_DIR/backend.env"

# Crear directorio si no existe
mkdir -p "$CREDENTIALS_DIR"
chmod 700 "$CREDENTIALS_DIR" 2>/dev/null || true

echo "=== Guardado seguro de credenciales de OpenAI ==="
echo ""
echo "Pega la clave de una sola vez. No verás los caracteres mientras la escribes."
echo ""

# Leer la clave (sin mostrar caracteres)
read -rs KEY
echo ""

# Validaciones
if [ -z "$KEY" ]; then
    echo "ERROR: La clave está vacía."
    exit 1
fi

if [[ ! "$KEY" =~ ^sk- ]]; then
    echo "ERROR: La clave debe empezar por 'sk-'."
    exit 1
fi

# Contar prefijos sk- (debe ser exactamente 1)
SK_COUNT=$(echo "$KEY" | grep -o 'sk-' | wc -l)
if [ "$SK_COUNT" -ne 1 ]; then
    echo "ERROR: La clave tiene $SK_COUNT prefijos 'sk-'. Debe tener exactamente 1."
    echo "Esto suele indicar que la clave se pegó dos veces."
    exit 1
fi

# Verificar duplicación (mitades iguales)
LEN=${#KEY}
if [ $((LEN % 2)) -eq 0 ]; then
    MITAD1=${KEY:0:$((LEN/2))}
    MITAD2=${KEY:$((LEN/2))}
    if [ "$MITAD1" = "$MITAD2" ]; then
        echo "ERROR: La clave parece estar duplicada (las dos mitades son iguales)."
        exit 1
    fi
fi

# Verificar que no contiene caracteres problemáticos
if echo "$KEY" | grep -qP '[\x00-\x1f\x7f]'; then
    echo "ERROR: La clave contiene caracteres de control."
    exit 1
fi

# Guardar la clave
echo "$KEY" > "$CREDENTIALS_FILE"
chmod 600 "$CREDENTIALS_FILE"

echo "Clave guardada correctamente en $CREDENTIALS_FILE"
echo "Permisos: $(stat -c '%a' "$CREDENTIALS_FILE")"
echo "Longitud: ${#KEY} caracteres"
echo ""
echo "Ahora puedes ejecutar: bash scripts/start-all.sh"
