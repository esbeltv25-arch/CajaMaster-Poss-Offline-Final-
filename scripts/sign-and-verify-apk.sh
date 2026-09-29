#!/usr/bin/env bash
# ==============================================================================
# Script de Alineación y Firma Manual de APK con Esquemas V2 y V3
# Compatible con apksigner y zipalign del Android SDK Build-Tools
# ==============================================================================

set -e

if [ "$#" -lt 1 ]; then
    echo "Uso: $0 <ruta-del-apk-sin-firmar.apk> [ruta-del-keystore] [alias-clave]"
    echo "Ejemplo: $0 app-release-unsigned.apk android/app/release.keystore cajamaster_key"
    exit 1
fi

INPUT_APK="$1"
KEYSTORE="${2:-android/app/release.keystore}"
ALIAS="${3:-cajamaster_key}"

if [ ! -f "$INPUT_APK" ]; then
    echo "❌ Error: El archivo APK '$INPUT_APK' no existe."
    exit 1
fi

if [ ! -f "$KEYSTORE" ]; then
    echo "❌ Error: El archivo Keystore '$KEYSTORE' no existe. Ejecuta primero scripts/generate-release-keystore.sh"
    exit 1
fi

ALIGNED_APK="${INPUT_APK%.apk}-aligned.apk"
FINAL_APK="${INPUT_APK%.apk}-signed.apk"

echo "================================================================="
echo " 1. Optimizando alineación de 4 bytes con zipalign..."
echo "================================================================="
if command -v zipalign &> /dev/null; then
    zipalign -v -p 4 "$INPUT_APK" "$ALIGNED_APK"
else
    echo "⚠️  zipalign no encontrado en PATH, usando APK original..."
    ALIGNED_APK="$INPUT_APK"
fi

echo ""
echo "================================================================="
echo " 2. Firmando APK con apksigner (Esquemas V1, V2 y V3)..."
echo "================================================================="
if command -v apksigner &> /dev/null; then
    apksigner sign \
        --ks "$KEYSTORE" \
        --ks-key-alias "$ALIAS" \
        --v1-signing-enabled true \
        --v2-signing-enabled true \
        --v3-signing-enabled true \
        --out "$FINAL_APK" \
        "$ALIGNED_APK"

    echo ""
    echo "================================================================="
    echo " 3. Verificando esquema de firma para Google Play Protect..."
    echo "================================================================="
    apksigner verify --verbose --print-certs "$FINAL_APK"

    echo ""
    echo "✅ ¡APK firmado de producción generado con éxito en: $FINAL_APK!"
else
    echo "❌ apksigner no está en el PATH. Asegúrate de tener Android Build Tools instalado."
fi
