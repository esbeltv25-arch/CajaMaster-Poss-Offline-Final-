# 🔐 Control de Licencias de CajaMaster POS

CajaMaster usa **firmas digitales Ed25519** para las licencias. Funciona 100 % sin internet y está pensado para venderse a clientes sin que puedan generar claves por su cuenta.

## Cómo funciona (en una frase)

Tienes **dos claves**:

| Clave | Dónde está | Para qué sirve |
| --- | --- | --- |
| 🔒 **Privada** | Solo en tu ordenador: `.license/private-key.json` | **Crear** licencias. Quien la tenga puede emitir licencias: guárdala bien. |
| 🔓 **Pública** | Dentro de la app: `src/utils/licensePublicKey.ts` | **Comprobar** licencias. No sirve para crearlas, aunque alguien desmonte el APK. |

Cada licencia va firmada para **un único dispositivo**: copiarla en otro teléfono no funciona. Puede ser **permanente** o tener **fecha de caducidad** (suscripciones).

---

## 1. Configuración inicial (una sola vez)

**Opción fácil, sin instalar nada:** abre `Generador_CajaMaster_POS.html` en el navegador y pulsa **Crear mis claves**. Se descarga `private-key.json` (tu clave privada: guárdala bien) y se muestra tu clave pública. Copia esa clave pública en `src/utils/licensePublicKey.ts`, o pídeselo a quien compile la app, y vuelve a compilar.

**Opción con terminal:**

```bash
npm install
npm run license:keygen
```

Esto:
- crea tu clave privada en `.license/private-key.json` (excluida de Git, nunca se sube a GitHub);
- escribe tu clave pública en `src/utils/licensePublicKey.ts`.

Después:
1. **Haz copia de seguridad de `.license/private-key.json`** (por ejemplo en un USB y en un gestor de contraseñas). Si la pierdes no podrás emitir licencias para las apps ya instaladas.
2. Haz commit de `src/utils/licensePublicKey.ts` y compila la app (APK y/o OTA).
3. Genera tu herramienta visual: `npm run license:generator` → crea `Generador_CajaMaster_POS.html`.

> El comando se niega a crear una clave nueva si ya existe una, porque eso **invalidaría todas las licencias vendidas**. Solo con `npm run license:keygen -- --force` la reemplaza.

> Las compilaciones de publicación (`npm run cap:build`, `npm run release:ota` y el flujo automático de GitHub) **se detienen** si la app no tiene clave pública, para no publicar nunca una versión que nadie pueda activar.

---

## 2. Vender una licencia

1. El cliente instala la app. En la pantalla de activación ve su **ID de dispositivo** (ej. `CM-B14G-0Q44-V0ZB`) y te lo envía con el botón de WhatsApp o Telegram.
2. Generas la licencia con una de estas dos opciones:

**Opción A — Generador visual** (recomendado; funciona sin internet en cualquier navegador):
- Abre `Generador_CajaMaster_POS.html`.
- La primera vez, carga tu archivo `.license/private-key.json`. Queda guardado solo en ese navegador.
- Escribe el ID del cliente, elige la duración (permanente, 30 días, 1 año, hasta una fecha…) y pulsa **Generar licencia**.
- Envíala con **Enviar por WhatsApp / Telegram** o cópiala.
- El generador guarda un registro de las licencias emitidas, exportable a CSV.

**Opción B — Terminal:**
```bash
npm run license -- sign CM-B14G-0Q44-V0ZB                       # permanente
npm run license -- sign CM-B14G-0Q44-V0ZB --days 365            # un año
npm run license -- sign CM-B14G-0Q44-V0ZB --until 2027-12-31    # hasta una fecha
npm run license -- sign CM-B14G-0Q44-V0ZB --cliente "Bar Pepe"  # anota el cliente en tu registro
npm run license -- verify CM-B14G-0Q44-V0ZB CM1-...             # comprobar una licencia
npm run license -- list                                          # licencias emitidas desde este equipo
```

3. El cliente pulsa **Pegar clave** y luego **ACTIVAR LICENCIA**. La licencia es larga (empieza por `CM1-`): se pega, no se escribe a mano.

---

## 3. Renovaciones y caducidad

- Una licencia con fecha vale hasta el final del día indicado (inclusive). Al caducar, la app vuelve a la pantalla de activación y el cliente te pide una nueva. Sus datos (ventas, productos) **no se borran**.
- Atrasar el reloj del teléfono no alarga la licencia: la app recuerda la fecha más reciente que ha visto.
- Para renovar, genera otra licencia para el mismo ID con la nueva fecha.

---

## 4. El ID del dispositivo

- En Android se calcula a partir del identificador del sistema (`ANDROID_ID`). **Se mantiene** aunque el cliente borre los datos o reinstale la app; solo cambia con un restablecimiento de fábrica del teléfono o si cambias la firma del APK.
- En navegador o PWA el ID es aleatorio y se guarda en el navegador: borrar los datos del navegador genera uno nuevo.

---

## 5. Qué protege y qué no

✅ **Protege contra:**
- generar licencias sin tu clave privada (aunque se desmonte el APK);
- usar una licencia en otro dispositivo;
- alterar una licencia (por ejemplo, convertir una de 30 días en permanente);
- activar la app manipulando su almacenamiento.

⚠️ **No protege al 100 % contra:** alguien con conocimientos técnicos que **modifique el código del APK** para saltarse la comprobación. Eso pasa con cualquier app que funciona sin internet. Reducirlo exigiría validación en un servidor, ofuscación del código o la integridad de Google Play, y no merece la pena para la mayoría de clientes.
