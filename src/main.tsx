import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

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
