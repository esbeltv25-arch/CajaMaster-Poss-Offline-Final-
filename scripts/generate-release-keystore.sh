#!/usr/bin/env bash
# ==============================================================================
# Script de Generación de Release Keystore de Producción para CajaMaster POS
# Genera certificado RSA de 2048 bits con validez de 25 años (10,000 días)
# ==============================================================================

set -e

KEYSTORE_PATH="android/app/release.keystore"
KEY_ALIAS="cajamaster_key"
VALIDITY_DAYS=10000
KEY_SIZE=2048

echo "================================================================="
echo " Generando Certificado de Firma de Producción (Release Keystore)"
echo "================================================================="

if [ -f "$KEYSTORE_PATH" ]; then
    echo "⚠️  ADVERTENCIA: Ya existe un archivo keystore en $KEYSTORE_PATH"
    read -p "¿Deseas sobreescribirlo? (s/N): " confirm
    if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
        echo "Operación cancelada. El keystore existente se ha conservado."
        exit 0
    fi
    rm -f "$KEYSTORE_PATH"
fi

mkdir -p "android/app"

echo ""
echo "Ingrese los datos del desarrollador para registrar la identidad en el certificado:"
read -p "Nombre del Desarrollador / Empresa [CajaMaster POS]: " D_NAME
D_NAME=${D_NAME:-"CajaMaster POS"}

read -p "Unidad Organizacional [Desarrollo Software]: " D_OU
D_OU=${D_OU:-"Desarrollo Software"}

read -p "Organización / Negocio [CajaMaster Inc]: " D_ORG
D_ORG=${D_ORG:-"CajaMaster Inc"}

read -p "Ciudad o Localidad [La Habana]: " D_CITY
D_CITY=${D_CITY:-"La Habana"}

read -p "Estado o Provincia [La Habana]: " D_STATE
D_STATE=${D_STATE:-"La Habana"}

read -p "Código de País (2 letras) [CU]: " D_COUNTRY
D_COUNTRY=${D_COUNTRY:-"CU"}

read -s -p "Contraseña para el Keystore (mínimo 6 caracteres): " KEY_PASSWORD
echo ""
if [ -z "$KEY_PASSWORD" ]; then
    echo "❌ Error: La contraseña no puede estar vacía."
    exit 1
fi

DNAME="CN=${D_NAME}, OU=${D_OU}, O=${D_ORG}, L=${D_CITY}, ST=${D_STATE}, C=${D_COUNTRY}"

echo ""
echo "Generando certificado criptográfico..."

keytool -genkeypair \
    -v \
    -keystore "$KEYSTORE_PATH" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize $KEY_SIZE \
    -validity $VALIDITY_DAYS \
    -storepass "$KEY_PASSWORD" \
    -keypass "$KEY_PASSWORD" \
    -dname "$DNAME"

echo ""
echo "✅ ¡Keystore de producción generado exitosamente en: $KEYSTORE_PATH!"
echo "================================================================="
echo "INFORMACIÓN DEL CERTIFICADO Y HASH SHA-256:"
keytool -list -v -keystore "$KEYSTORE_PATH" -alias "$KEY_ALIAS" -storepass "$KEY_PASSWORD" | grep -E "(SHA1|SHA256|Propietario|Owner|Válido|Valid)"

echo ""
echo "================================================================="
echo "Configuración lista para compilación Release con Esquema V2/V3."
echo "IMPORTANTE: Guarda una copia de seguridad de '$KEYSTORE_PATH' y tu contraseña."
