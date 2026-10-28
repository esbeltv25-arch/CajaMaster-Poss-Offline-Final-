#!/bin/bash
set -e

TOKEN="$1"
REPO="${2:-esbeltv25-arch/CajaMaster-Poss-Offline-Final-}"

if [ -z "$TOKEN" ]; then
  echo "=========================================================="
  echo "🚀 CajaMaster POS - Envío de Código al Repositorio GitHub"
  echo "=========================================================="
  echo "Error: Se requiere un GitHub Personal Access Token (PAT)."
  echo "Uso:"
  echo "  bash scripts/push-codebase.sh <TU_GITHUB_TOKEN> [nombre_repo]"
  echo ""
  echo "Ejemplo:"
  echo "  bash scripts/push-codebase.sh ghp_xxxx esbeltv25-arch/CajaMaster-Poss-Offline-Final-"
  echo "=========================================================="
  exit 1
fi

echo "Configurando credenciales para git..."
git config --global user.name "esbeltv25-arch" || true
git config --global user.email "esbeltv25@gmail.com" || true

if [ ! -d ".git" ]; then
  echo "Inicializando repositorio git local..."
  git init
  git config user.name "esbeltv25-arch"
  git config user.email "esbeltv25@gmail.com"
  git branch -M main
fi

git add -A
git commit -m "fix(accounting): implement Accounting Sentinel, eliminate IPVE formatting overlap and unify accounting masks" || echo "Sin cambios nuevos para commit"

echo "Enviando todos los cambios a https://github.com/${REPO}..."
git push "https://oauth2:${TOKEN}@github.com/${REPO}.git" main --force

echo "✅ ¡Repositorio https://github.com/${REPO} actualizado con éxito!"
