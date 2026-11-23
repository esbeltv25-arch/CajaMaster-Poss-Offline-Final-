#!/bin/bash
# ==============================================================================
# CajaMaster - Generador de Claves de Licencia para macOS / Linux
# Uso:
#   ./scripts/generate-license.sh [ID_DISPOSITIVO]
#   O ejecuta ./scripts/generate-license.sh para modo interactivo
# ==============================================================================

SECRET="CAJAMASTER_2026"

DEVICE_ID="$1"

if [ -z "$DEVICE_ID" ]; then
  echo ""
  echo "======================================================="
  echo "   🏪 CajaMaster - Generador de Claves de Licencia     "
  echo "======================================================="
  echo -n "Introduce el ID del dispositivo (ej. CM-ABCD-EFGH-1234): "
  read DEVICE_ID
fi

# Limpiar espacios y pasar a mayúsculas
DEVICE_ID=$(echo "$DEVICE_ID" | tr -d '[:space:]' | tr '[:lower:]' '[:upper:]')

if [ -z "$DEVICE_ID" ]; then
  echo "❌ Error: El ID del dispositivo no puede estar vacío."
  exit 1
fi

INPUT="${DEVICE_ID}${SECRET}"
HASH=""

# Intentar openssl primero (100% nativo y estándar en macOS)
if command -v openssl >/dev/null 2>&1; then
  HASH=$(printf "%s" "$INPUT" | openssl dgst -sha256 | awk '{print $NF}')
elif command -v sha256sum >/dev/null 2>&1; then
  HASH=$(printf "%s" "$INPUT" | sha256sum | awk '{print $1}')
elif command -v shasum >/dev/null 2>&1; then
  HASH=$(printf "%s" "$INPUT" | shasum -a 256 2>/dev/null | awk '{print $1}')
elif command -v python3 >/dev/null 2>&1; then
  HASH=$(python3 -c "import hashlib; print(hashlib.sha256('$INPUT'.encode('utf-8')).hexdigest())")
fi

if [ -z "$HASH" ]; then
  echo "❌ Error: No se pudo calcular el hash SHA-256."
  exit 1
fi

# Convertir a mayúsculas y tomar los primeros 16 caracteres
UPPER_HASH=$(echo "$HASH" | tr '[:lower:]' '[:upper:]')
K16="${UPPER_HASH:0:16}"

# Formatear XXXX-XXXX-XXXX-XXXX
P1="${K16:0:4}"
P2="${K16:4:4}"
P3="${K16:8:4}"
P4="${K16:12:4}"
LICENSE_KEY="${P1}-${P2}-${P3}-${P4}"

echo ""
echo "======================================================="
echo "             🔑 CAJAMASTER - LICENCIA GENERADA         "
echo "======================================================="
echo "📱 ID de Dispositivo : $DEVICE_ID"
echo -e "🔐 Clave de Activación: \033[1;32m${LICENSE_KEY}\033[0m"
echo "======================================================="
echo "ℹ️  Esta clave es válida únicamente para este ID."
echo "   El usuario solo debe ingresarla una única vez."
echo "======================================================="

# Si estamos en macOS, copiar al portapapeles con pbcopy
if command -v pbcopy >/dev/null 2>&1; then
  printf "%s" "$LICENSE_KEY" | pbcopy
  echo "📋 ¡Clave copiada automáticamente al portapapeles de tu Mac!"
  echo ""
fi
