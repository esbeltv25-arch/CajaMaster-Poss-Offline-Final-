# 🔐 Sistema de Control y Generación de Licencias - CajaMaster

Este sistema te permite controlar al 100% quién tiene acceso a la aplicación desde tu Mac de forma completamente offline y segura.

---

## 🚀 ¿Cómo funciona el flujo de activación?

1. **El cliente instala y abre CajaMaster**:
   - Al abrir la app por primera vez, verá la pantalla de **Activación de Licencia**.
   - La pantalla le muestra su **ID de Dispositivo único** (ejemplo: `CM-9K2L-M4N8-8F2Q`).
   - El cliente presiona el botón **"💬 Enviar ID por WhatsApp al Administrador"** o **"Copiar ID"** y te lo envía.

2. **Tú generas la clave desde tu Mac**:
   - Introduces el ID del dispositivo en tu script o herramienta en tu Mac.
   - El script genera la clave única correspondiente (ejemplo: `A8F1-3C90-D42E-7B11`) y la copia automáticamente a tu portapapeles.

3. **Le envías la clave al cliente**:
   - El cliente pega o escribe la clave en la app y pulsa **"ACTIVAR PERMANENTEMENTE"**.
   - **¡Listo!** La app queda desbloqueada para siempre en ese dispositivo. No vuelve a pedir clave a menos que borre la app por completo.

---

## 🛠️ Opciones para generar claves desde tu Mac

Puedes usar cualquiera de los siguientes métodos según lo que te sea más cómodo:

---

### Opción 1: Script en Bash/Zsh de macOS (Sin instalar nada)

Abre la aplicación **Terminal** en tu Mac y ejecuta:

```bash
./scripts/generate-license.sh
```

O si ya tienes el ID del cliente copiado:
```bash
./scripts/generate-license.sh CM-9K2L-M4N8-8F2Q
```
*(El script copiará la clave generada automáticamente a tu portapapeles con `pbcopy`).*

---

### Opción 2: Script en Python 3

En la Terminal de tu Mac:

```bash
python3 scripts/generate-license.py
```

O directamente con el ID como argumento:
```bash
python3 scripts/generate-license.py CM-9K2L-M4N8-8F2Q
```

---

### Opción 3: Script en Node.js

En la Terminal:

```bash
node scripts/generate-license.js
```

O con el ID:
```bash
node scripts/generate-license.js CM-9K2L-M4N8-8F2Q
```

---

### Opción 4: Herramienta Gráfica Web Offline (Doble Clic)

Si prefieres no usar la Terminal, puedes abrir el archivo:

📂 `public/generador-licencias.html`

Haciendo doble clic para abrirlo en **Safari** o **Google Chrome** en tu Mac.
- Pegas el ID del dispositivo.
- Presionas **"Generar Clave de Activación"**.
- Presionas **"Copiar Clave"** y se la envías por WhatsApp/Telegram.
- Funciona 100% offline, sin necesidad de servidores.

---

## 🔒 Seguridad del Algoritmo
- La clave se genera mediante el algoritmo criptográfico estándar **SHA-256** combinando el ID único del dispositivo con una clave maestra secreta (`CAJAMASTER_2026`).
- Cada dispositivo genera una clave completamente distinta.
- Una clave generada para el teléfono A jamás funcionará en el teléfono B.
- No requiere base de datos ni conexión a internet: tanto el script en tu Mac como la app en el dispositivo cliente calculan la correspondencia matemáticamente.
