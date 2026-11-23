# Guía de Firma de Producción de APK y Eliminación de Alertas de Google Play Protect

Esta guía detalla la configuración implementada en **CajaMaster POS** para generar archivos APK legítimos, firmados con certificados de producción de larga duración (25 años), con esquemas de firma **V2 (Full APK Signature)** y **V3 (APK Signature Scheme v3)**, permisos depurados y ofuscación R8/ProGuard para eliminar bloqueos o pantallas rojas/amarillas de Google Play Protect.

---

## 1. ¿Por qué ocurre la alerta de Google Play Protect?

Cuando un APK se compila con la clave predeterminada `debug.keystore` de Android SDK:
1. **Firma genérica no confiable**: La clave de depuración tiene una contraseña pública `"android"` y es idéntica en millones de entornos de prueba, lo que el motor heurístico de Play Protect identifica de inmediato como ejecutable no verificado.
2. **Falta de Esquema V2/V3**: Las firmas antiguas basadas únicamente en V1 (JAR signing) permiten manipulación de metadatos del ZIP. Los dispositivos modernos requieren **V2** o **V3** para validar la integridad completa del binario.
3. **Flags de depuración**: El atributo `android:debuggable="true"` en compilaciones debug advierte al usuario que la app puede ser intervenida en memoria.

---

## 2. Configuración Implementada en el Proyecto

### A. Certificado de Producción (`release.keystore`)
Se ha configurado la generación de un certificado criptográfico con:
- **Algoritmo**: RSA 2048 bits
- **Validez**: 10,000 días (~25 años)
- **Alias de clave**: `cajamaster_key`

Para generar tu certificado propio:
```bash
npm run generate:keystore
# o directamente:
bash scripts/generate-release-keystore.sh
```

### B. Esquemas de Firma V2 y V3 en `android/app/build.gradle`
Se configuró explícitamente en el bloque `signingConfigs.release`:
```groovy
signingConfigs {
    release {
        storeFile file('release.keystore')
        storePassword System.getenv("KEYSTORE_PASSWORD") ?: "cajamaster2026"
        keyAlias System.getenv("KEY_ALIAS") ?: "cajamaster_key"
        keyPassword System.getenv("KEY_PASSWORD") ?: "cajamaster2026"

        // Activación de firmas criptográficas completas
        v1SigningEnabled true
        v2SigningEnabled true
        v3SigningEnabled true
    }
}
```

### C. Depuración Estricta de Permisos (`AndroidManifest.xml` y `app.json`)
Se auditaron y removieron permisos invasivos. Solo se conservan los estrictamente requeridos para el TPV/POS:
- `INTERNET` & `ACCESS_NETWORK_STATE`: Conexión de red local, tasas de cambio e impresoras IP/Wi-Fi.
- `BLUETOOTH`, `BLUETOOTH_CONNECT` y `BLUETOOTH_SCAN`: Conexión a impresoras térmicas ESC/POS (58mm/80mm) con la directiva `neverForLocation`.
- `android:allowBackup="false"`: Protege la base de datos local de ventas contra extracciones no autorizadas por ADB.
- `android:debuggable="false"`: Desactiva el modo de depuración en compilaciones Release.

### D. Optimización y Ofuscación R8 / ProGuard (`proguard-rules.pro`)
En `android/app/build.gradle`:
```groovy
buildTypes {
    release {
        signingConfig signingConfigs.release
        debuggable false
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```
Esto elimina código no utilizado, ofusca nombres de clases/métodos y remueve registros `Log.d()` y `Log.v()`, pasando limpiamente el análisis heurístico de antivirus y Play Protect.

---

## 3. Verificación de la Firma del APK

Para verificar que un APK compilado cumple con todos los esquemas requeridos por Google Play Protect:

```bash
apksigner verify --verbose --print-certs ruta/a/tu/app-release.apk
```

**Resultado esperado:**
```text
Verifies
Verified using v1 scheme (JAR signing): true
Verified using v2 scheme (APK Signature Scheme v2): true
Verified using v3 scheme (APK Signature Scheme v3): true
Verified using v4 scheme: false
Number of signers: 1
Signer #1 certificate DN: CN=CajaMaster POS, OU=Desarrollo Software, O=CajaMaster Inc...
Signer #1 certificate SHA-256 digest: [TU_HASH_SHA256_UNICO]
```

---

## 4. Distribución Fuera de Google Play Store (Direct APK / WhatsApp / Sideloading)

Al distribuir el APK directamente a los clientes:

1. **Aviso de "Orígenes desconocidos"**:
   - Es un mensaje estándar de Android en todas las instalaciones manuales que indica: *"Por seguridad, tu teléfono no tiene permitido instalar aplicaciones desconocidas de esta fuente"*.
   - El cliente solo debe tocar **Configuración** y activar el interruptor de permitir para esa fuente (WhatsApp, Chrome o Administrador de Archivos) una sola vez.

2. **Reputación de Firma en Play Protect**:
   - Con la firma fija `release.keystore` y esquemas V2/V3, **Play Protect no mostrará la pantalla roja de advertencia de virus**.
   - A medida que el APK firmado con este mismo certificado se instale en múltiples terminales, el ecosistema de Google Play Protect registrará el hash SHA-256 como firma confiable de desarrollador.
