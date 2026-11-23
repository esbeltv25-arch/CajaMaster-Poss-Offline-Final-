#!/bin/bash
set -e

TOKEN="$1"
if [ -z "$TOKEN" ]; then
  echo "Error: Se requiere un GitHub Personal Access Token con permiso de repo."
  echo "Uso: bash scripts/push-ota.sh <GITHUB_TOKEN>"
  exit 1
fi

REPO_URL="https://oauth2:${TOKEN}@github.com/esbeltv25-arch/CajaMaster-Updates.git"
TEMP_DIR=$(mktemp -d)

echo "Clonando repositorio CajaMaster-Updates..."
git clone --depth 1 "$REPO_URL" "$TEMP_DIR"

VERSION=$(node -p "require('./version.json').version" 2>/dev/null || echo "1.3.6")
BUILD=$(node -p "require('./version.json').versionCode" 2>/dev/null || echo "1060")
CHANGELOG=$(node -p "require('./version.json').changelog" 2>/dev/null || echo "Actualización OTA")

echo "Copiando archivos de la versión v${VERSION}..."
mkdir -p "$TEMP_DIR/updates"
cp version.json "$TEMP_DIR/version.json"
if [ -f "updates/bundle-v${VERSION}.zip" ]; then
  cp "updates/bundle-v${VERSION}.zip" "$TEMP_DIR/updates/bundle-v${VERSION}.zip"
fi

cd "$TEMP_DIR"
git config user.name "esbeltv25-arch"
git config user.email "esbeltv25@gmail.com"

git add version.json updates/
git commit -m "Release OTA v${VERSION} (Build ${BUILD}) - ${CHANGELOG}" || echo "Sin cambios adicionales"

echo "Enviando cambios a GitHub..."
git push origin main || git push origin master

rm -rf "$TEMP_DIR"
echo "✅ ¡Actualización v${VERSION} publicada exitosamente en GitHub!"

