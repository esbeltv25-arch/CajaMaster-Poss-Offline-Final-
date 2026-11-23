# 🚀 Guía de Despliegue de Actualizaciones OTA (Over-The-Air) para CajaMaster POS

Esta guía detalla cómo publicar actualizaciones transparentes de la interfaz web (`www`) de **CajaMaster POS** utilizando tu repositorio de GitHub como servidor estático de actualizaciones (*Self-Hosted*) a través de **GitHub Pages**.

- **Repositorio Oficial de Actualizaciones:** [https://github.com/esbeltv25-arch/CajaMaster-Updates](https://github.com/esbeltv25-arch/CajaMaster-Updates)
- **URL Pública del Manifiesto JSON:** [https://esbeltv25-arch.github.io/CajaMaster-Updates/version.json](https://esbeltv25-arch.github.io/CajaMaster-Updates/version.json)
- **Directorio de Paquetes ZIP:** `https://esbeltv25-arch.github.io/CajaMaster-Updates/updates/bundle-vX.Y.Z.zip`

---

## 🛠️ Método Rápido y Automatizado (1 Solo Comando)

En la raíz del proyecto de CajaMaster, ejecuta el script automatizado:

```bash
# Sintaxis:
# npm run release:ota -- [version] [versionCode] [changelog] [mandatory]

# Ejemplo para publicar la versión 1.3.0:
node scripts/package-ota.js 1.3.0 1030 "Soporte completo de modo oscuro, manual en PDF offline y mejoras en calculadora de billetes" false
```

Este script ejecuta automáticamente:
1. Compila la aplicación web con Vite.
2. Comprime todos los archivos web en `updates/bundle-v1.3.0.zip`.
3. Actualiza el manifiesto `version.json` con la nueva versión, código de compilación y URL.

---

## 📋 Método Manual en 3 Pasos

Si prefieres realizar el empaquetado manualmente:

### Paso 1: Compilar la Aplicación Web
```bash
npm run build
```
Esto generará los archivos compilados en la carpeta `dist/`.

### Paso 2: Comprimir y colocar en `/updates/`
Comprime el contenido de la carpeta `dist/` en un archivo `.zip` con la nomenclatura `bundle-vX.Y.Z.zip` y colócalo en la carpeta `updates/`:
```text
CajaMaster-Updates/
├── version.json
└── updates/
    └── bundle-v1.3.0.zip
```

### Paso 3: Actualizar `version.json` y Subir a GitHub
Edita el archivo `version.json` en la raíz de tu repositorio:
```json
{
  "version": "1.3.0",
  "versionCode": 1030,
  "updateUrl": "https://esbeltv25-arch.github.io/CajaMaster-Updates/updates/bundle-v1.3.0.zip",
  "mandatory": false,
  "changelog": "Corrección de errores y mejoras en tickets.",
  "releaseDate": "2026-09-29",
  "minNativeVersionCode": 1000
}
```

Haz commit y sube los cambios a tu repositorio:
```bash
git add version.json updates/bundle-v1.3.0.zip
git commit -m "Release OTA v1.3.0 (Build 1030)"
git push origin main
```

---

## ⚙️ Configuración Inicial de GitHub Pages (Una Sola Vez)

1. Entra a tu repositorio: [https://github.com/esbeltv25-arch/CajaMaster-Updates/settings/pages](https://github.com/esbeltv25-arch/CajaMaster-Updates/settings/pages)
2. En la sección **Build and deployment**:
   - **Source**: Selecciona `Deploy from a branch` (o `GitHub Actions` si utilizas el workflow `.github/workflows/deploy-ota.yml`).
   - **Branch**: Selecciona `main` / `master` y carpeta `/(root)`.
   - Haz clic en **Save**.
3. En pocos segundos tu manifiesto estará accesible públicamente en:
   `https://esbeltv25-arch.github.io/CajaMaster-Updates/version.json`

---

## 🛡️ Reglas de Seguridad y Cuándo Aplica OTA

| Tipo de Cambio | ¿Aplica por OTA? | Requiere Recompilar APK |
| :--- | :---: | :---: |
| **Vistas, componentes React, botones y formularios** | ✅ SÍ | ❌ No |
| **Estilos CSS, colores, tema claro / oscuro** | ✅ SÍ | ❌ No |
| **Lógica de cobros, tasas de divisas, cálculo de billetes** | ✅ SÍ | ❌ No |
| **Reportes contables IPVE, exportaciones PDF y CSV** | ✅ SÍ | ❌ No |
| **Código nativo Android / Java / Kotlin** | ❌ NO | ✅ SÍ (APK firmado) |
| **Nuevos permisos en `AndroidManifest.xml`** | ❌ NO | ✅ SÍ (APK firmado) |
| **Nuevos plugins nativos de Capacitor (C++ / Bluetooth LE)** | ❌ NO | ✅ SÍ (APK firmado) |

---

## 📴 Comportamiento ante Entornos Sin Conexión (Offline)
* CajaMaster comprueba el servidor en segundo plano con un tiempo de espera de 3.5 segundos.
* Si el teléfono no tiene conexión a Internet (entorno local de Cuba o sin datos móviles), la petición falla **silenciosamente sin mostrar errores fatales** ni bloquear la venta en el TPV.
* La app continuará funcionando al 100% de su capacidad con la última versión empaquetada.
