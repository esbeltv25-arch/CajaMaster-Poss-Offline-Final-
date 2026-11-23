import React, { useState, useEffect } from "react";
import { IconUsers, IconServer, IconSmartphone } from "./Icons";
import { syncService } from "../services/multiDeviceSync";
import type { SyncConfig, ConnectedDevice } from "../types";

export function SyncStatusBadge({ onOpenModal }: { onOpenModal: () => void }) {
  const [config, setConfig] = useState<SyncConfig>(() => syncService.getConfig());
  const [status, setStatus] = useState(syncService.getStatus());
  const [devices, setDevices] = useState<ConnectedDevice[]>(() =>
    syncService.getDevices()
  );

  useEffect(() => {
    const unsubStatus = syncService.onStatusChange((s) => setStatus(s));
    const unsubDevices = syncService.onDevicesChange((devs) => setDevices(devs));

    // Periodic check
    const interval = setInterval(() => {
      setConfig(syncService.getConfig());
    }, 2000);

    return () => {
      unsubStatus();
      unsubDevices();
      clearInterval(interval);
    };
  }, []);

  if (!config.enabled) {
    return (
      <button
        type="button"
        onClick={onOpenModal}
        title="Sincronización Multidispositivo Desactivada - Toca para configurar"
        aria-label="Sincronización Multidispositivo"
        className="w-7 h-7 sm:w-auto sm:px-2.5 sm:py-1.5 rounded-xl text-[11px] font-bold neu-sm text-slate-600 hover:text-slate-900 transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
      >
        <IconUsers size={14} className="text-slate-400 shrink-0" />
        <span className="hidden sm:inline">Multidispositivo</span>
      </button>
    );
  }

  const isServer = config.role === "primary";
  const isConnected = status === "connected";
  const count = devices.length;

  return (
    <button
      type="button"
      onClick={onOpenModal}
      title={`Sincronización Activa (${isServer ? "Servidor" : "Camarero"}) - ${
        isConnected ? "Conectado" : "Reconectando..."
      }`}
      aria-label="Estado de sincronización"
      className={`w-7 h-7 sm:w-auto sm:px-2.5 sm:py-1.5 rounded-xl text-[11px] font-extrabold transition cursor-pointer border shadow-xs flex items-center justify-center gap-1.5 shrink-0 ${
        isConnected
          ? isServer
            ? "bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100"
            : "bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100"
          : "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 animate-pulse"
      }`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {isConnected && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isServer ? "bg-emerald-400" : "bg-blue-400"
            }`}
          />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isConnected ? (isServer ? "bg-emerald-500" : "bg-blue-500") : "bg-amber-500"
          }`}
        />
      </span>

      <span className="shrink-0">
        {isServer ? <IconServer size={13} /> : <IconSmartphone size={13} />}
      </span>

      <span className="hidden sm:inline">
        {isServer ? "Servidor" : "Camarero"}
      </span>

      {count > 0 && (
        <span className="bg-slate-900 text-white px-1 sm:px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-black shrink-0">
          {count}
        </span>
      )}
    </button>
  );
}
