import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initDeviceIdentity } from './utils/licenseSecurity';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { Capacitor } from '@capacitor/core';
import { listenForRestoredCameraPhoto } from './services/productDraft';

// Photo taken while Android had closed the app for the camera (see services/productDraft)
void listenForRestoredCameraPhoto();

// Diagnóstico de entorno y contexto seguro (exigido para WebRTC)
console.info('[CajaMaster Boot] Entorno de ejecución:');
console.info(' - window.isSecureContext:', window.isSecureContext);
console.info(' - window.location.protocol:', window.location.protocol);
console.info(' - window.location.origin:', window.location.origin);
console.info(' - typeof navigator.mediaDevices:', typeof navigator?.mediaDevices);
console.info(' - getUserMedia disponible:', Boolean(navigator?.mediaDevices?.getUserMedia));

// Service Worker:
// - Web/PWA: register it for offline support.
// - Android APK (Capacitor): files are already local and updates are applied by
//   switching the native bundle folder. A Service Worker here would keep serving
//   the OLD precached bundle after an OTA update, so remove any existing one.
if (Capacitor.isNativePlatform()) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then(async (regs) => {
        if (regs.length === 0) return;
        await Promise.all(regs.map((r) => r.unregister()));
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        console.info('[PWA] Service Worker eliminado en la app nativa; recargando bundle actual.');
        window.location.reload();
      })
      .catch(() => {});
  }
} else {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[PWA] Nueva versión de CajaMaster disponible.');
    },
    onOfflineReady() {
      console.log('[PWA] CajaMaster listo para funcionar 100% offline.');
    },
  });
}

// The device identity (used by licensing and multi-device sync) must be resolved
// BEFORE the app modules load, so App is imported only afterwards.
initDeviceIdentity()
  .catch(() => undefined)
  .then(() => import('./App.tsx'))
  .then(({ default: App }) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
