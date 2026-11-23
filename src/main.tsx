import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Diagnóstico de entorno y contexto seguro (exigido para WebRTC)
console.info('[CajaMaster Boot] Entorno de ejecución:');
console.info(' - window.isSecureContext:', window.isSecureContext);
console.info(' - window.location.protocol:', window.location.protocol);
console.info(' - window.location.origin:', window.location.origin);
console.info(' - typeof navigator.mediaDevices:', typeof navigator?.mediaDevices);
console.info(' - getUserMedia disponible:', Boolean(navigator?.mediaDevices?.getUserMedia));

// Auto-register and update service worker for offline PWA desktop & mobile
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] Nueva versión de CajaMaster disponible.');
  },
  onOfflineReady() {
    console.log('[PWA] CajaMaster listo para funcionar 100% offline.');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
