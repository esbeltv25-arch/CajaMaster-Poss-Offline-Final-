import { useState, useRef, useEffect, useCallback, type ChangeEvent, type FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import jsQR from "jsqr";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import {
  IconCamera,
  IconRotate,
  IconCheck,
  IconX,
  IconAlert,
  IconZap,
  IconScan,
  IconQrCode,
  IconSmartphone,
  IconServer,
  IconImage,
  IconRefreshCw,
} from "./Icons";
import { syncService } from "../services/multiDeviceSync";
import { requestCameraPermission } from "../utils/nativeBridge";
import type { DeviceRole, SyncConfig } from "../types";

export interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (details: {
    roomKey: string;
    serverHost?: string;
    role: DeviceRole;
    deviceName?: string;
  }) => void;
  title?: string;
  description?: string;
}

export function QrScannerModal({
  isOpen,
  onClose,
  onSuccess,
  title = "Lector QR de Vinculación",
  description = "Apunta la cámara al código QR de la Caja Central o Terminal Servidor para sincronizar al instante.",
}: QrScannerModalProps) {
  const isMobile =
    typeof navigator !== "undefined" &&
    /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const isInIframe = typeof window !== "undefined" && window.self !== window.top;
  const isNative = Capacitor.isNativePlatform();

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Success state
  const [scannedResult, setScannedResult] = useState<{
    roomKey: string;
    serverHost?: string;
    role: DeviceRole;
    deviceName?: string;
  } | null>(null);

  // Manual PIN input toggle
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileQrCaptureInputRef = useRef<HTMLInputElement | null>(null);

  // Confirmación sonora sutil usando Web Audio API
  const playSuccessChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([80, 40, 100]);
      }
    } catch {}
  }, []);

  // Detención completa del stream
  const stopCamera = useCallback(() => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      activeStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setTorchOn(false);
  }, []);

  // Procesamiento de datos decodificados (declarado antes de su uso)
  const handleDecodedData = useCallback(
    (decodedString: string) => {
      if (!decodedString) return;

      try {
        const pairRes = syncService.pairFromQrCode(decodedString);
        if (pairRes.success && pairRes.details) {
          playSuccessChime();
          setIsScanning(false);
          stopCamera();

          const result = {
            roomKey: pairRes.details.roomKey,
            serverHost: pairRes.details.serverHost,
            role: pairRes.details.role,
            deviceName: pairRes.details.deviceName,
          };

          setScannedResult(result);

          setTimeout(() => {
            if (onSuccess) {
              onSuccess(result);
            }
            onClose();
          }, 1400);
        } else {
          setCameraError(pairRes.message || "Código QR no reconocido para vinculación.");
        }
      } catch (e) {
        console.error("Error al procesar payload QR:", e);
      }
    },
    [onSuccess, onClose, playSuccessChime, stopCamera]
  );

  // Procesar código QR a partir de DataURL
  const processQrFromDataUrl = useCallback(
    (dataUrl: string) => {
      setIsProcessingFile(true);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setIsProcessingFile(false);
          return;
        }
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: "attemptBoth",
        });
        setIsProcessingFile(false);
        if (code && code.data) {
          handleDecodedData(code.data);
        } else {
          setCameraError(
            "No se detectó un código QR legible en la foto. Intenta enfocar más cerca con buena iluminación o escribe el PIN de la sala."
          );
        }
      };
      img.onerror = () => {
        setIsProcessingFile(false);
        setCameraError("Error al cargar la imagen seleccionada.");
      };
      img.src = dataUrl;
    },
    [handleDecodedData]
  );

  // Iniciar stream con manejo estricto de WebRTC y diagnóstico de entorno
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setTechnicalError(null);

    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      activeStreamRef.current = null;
    }

    if (isInIframe) {
      setCameraError(
        "El simulador de AI Studio se ejecuta en un marco (iframe) seguro que bloquea la webcam por seguridad. Usa 'Tomar Foto al QR', 'Subir Captura' o ingresa la clave de sala abajo."
      );
      setShowManualInput(true);
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "La API de cámara no está disponible en este entorno. Puedes tomar una foto al QR o ingresar la clave manualmente."
      );
      setShowManualInput(true);
      return;
    }

    // Request Android runtime permission first via native bridge if running on native device
    if (isNative) {
      try {
        await requestCameraPermission();
      } catch (permErr) {
        console.warn("[QrScannerModal] Native camera permission request notice:", permErr);
      }
    }

    try {
      let newStream: MediaStream;
      try {
        const constraints: MediaStreamConstraints = {
          video: isMobile
            ? {
                facingMode: { ideal: facingMode },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : {
                facingMode: { ideal: "user" },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
          audio: false,
        };
        newStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (errConstraint) {
        console.warn("[QrScannerModal] Constraints ideales fallaron, intentando fallback:", errConstraint);
        newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      activeStreamRef.current = newStream;
      setStream(newStream);

      // Comprobar soporte de linterna/torch
      const track = newStream.getVideoTracks()[0];
      if (track && typeof track.getCapabilities === "function") {
        const caps = track.getCapabilities() as any;
        setTorchAvailable(Boolean(caps?.torch));
      } else {
        setTorchAvailable(false);
      }

      const video = videoRef.current;
      if (video) {
        video.srcObject = newStream;
        video.muted = true;
        (video as any).defaultMuted = true;
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.setAttribute("muted", "true");

        const playVideo = () => {
          const p = video.play();
          if (p !== undefined) {
            p.catch(console.warn);
          }
        };

        video.onloadedmetadata = () => {
          playVideo();
        };
        playVideo();
      }

      // Enumerar cámaras solo tras el grant
      if (navigator.mediaDevices.enumerateDevices) {
        navigator.mediaDevices
          .enumerateDevices()
          .then((devices) => {
            const videoInputs = devices.filter((d) => d.kind === "videoinput");
            setHasMultipleCameras(videoInputs.length > 1);
          })
          .catch(() => {});
      }
    } catch (err: any) {
      console.warn("[QrScannerModal] Camera access failed:", err);
      let msg = "No se pudo iniciar la cámara en vivo.";

      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        if (isInIframe) {
          msg = "El simulador de AI Studio bloquea la cámara por política de iframe. Usa 'Tomar Foto al QR' o ingresa la clave de sala.";
        } else if (Capacitor.isNativePlatform()) {
          msg = "Permiso de cámara denegado en Android. Usa 'Tomar Foto al QR' o activa el permiso en los Ajustes del sistema.";
        } else {
          msg = "Permiso de cámara bloqueado en el navegador. Concede acceso a la cámara o ingresa la clave de sala.";
        }
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        msg = "No se detectó ninguna cámara física disponible.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        msg = "La cámara está en uso por otra app. Ciérrala y pulsa Reintentar.";
      } else if (err.name === "SecurityError") {
        msg = "Acceso bloqueado por política de contexto de seguridad.";
      } else {
        msg = "No se pudo iniciar la cámara (" + (err.message || "error desconocido") + ").";
      }

      setCameraError(msg);
      setTechnicalError(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
      setShowManualInput(true);
    }
  }, [facingMode, isInIframe, isMobile]);

  // Captura Directa con Cámara Hardware (100% Infalible en Móviles y Android)
  const handleDirectCameraScan = useCallback(async () => {
    try {
      if (isNative) {
        try {
          const perm = await Camera.checkPermissions();
          if (perm.camera !== "granted") {
            const req = await Camera.requestPermissions();
            if (req.camera !== "granted") {
              setCameraError("Permiso de cámara denegado en el sistema operativo.");
              return;
            }
          }
        } catch (permErr) {
          console.warn("[QrScannerModal] Check native permissions error:", permErr);
        }

        const photo = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
        });

        if (photo?.dataUrl) {
          processQrFromDataUrl(photo.dataUrl);
          return;
        }
      }

      // En móviles o web: Abrir cámara mediante capture="environment"
      if (mobileQrCaptureInputRef.current) {
        mobileQrCaptureInputRef.current.click();
      } else if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    } catch (err: any) {
      console.warn("[QrScannerModal] Native camera scan fallback to input:", err);
      if (mobileQrCaptureInputRef.current) {
        mobileQrCaptureInputRef.current.click();
      } else {
        fileInputRef.current?.click();
      }
    }
  }, [isNative, processQrFromDataUrl]);

  // Manejo de linterna
  const toggleTorch = async () => {
    if (!activeStreamRef.current) return;
    const track = activeStreamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn("Error toggling torch:", e);
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Bucle de escaneo continuo con jsQR
  const scanFrame = useCallback(() => {
    if (!isScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data) {
          handleDecodedData(code.data);
          return;
        }
      }
    }

    if (isScanning) {
      animationFrameIdRef.current = requestAnimationFrame(scanFrame);
    }
  }, [isScanning, handleDecodedData]);

  // Procesar imagen estática (galería o captura de pantalla)
  const handleProcessImageFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setCameraError(null);

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            setIsProcessingFile(false);
            return;
          }

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth",
          });

          setIsProcessingFile(false);

          if (code && code.data) {
            handleDecodedData(code.data);
          } else {
            setCameraError(
              "No se detectó ningún código QR legible en la imagen. Enfoca más cerca y con buena iluminación o escribe el PIN."
            );
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsProcessingFile(false);
      setCameraError("Error al procesar el archivo de imagen.");
    } finally {
      e.target.value = "";
    }
  };

  // Manejo de entrada manual
  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    setManualError(null);

    const cleanCode = manualCode.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 3) {
      setManualError("El código o PIN debe tener al menos 3 caracteres.");
      return;
    }

    const payload = JSON.stringify({
      app: "cajamaster",
      action: "pair",
      roomKey: cleanCode,
      role: "waiter",
    });

    try {
      const pairRes = syncService.pairFromQrCode(payload);
      if (pairRes.success && pairRes.details) {
        playSuccessChime();
        stopCamera();
        const result = {
          roomKey: pairRes.details.roomKey,
          serverHost: pairRes.details.serverHost,
          role: pairRes.details.role,
          deviceName: pairRes.details.deviceName,
        };
        setScannedResult(result);
        setTimeout(() => {
          if (onSuccess) onSuccess(result);
          onClose();
        }, 1200);
      } else {
        setManualError(pairRes.message || "Código inválido o terminal no encontrada.");
      }
    } catch (err: any) {
      setManualError("Error al verificar la clave de vinculación.");
    }
  };

  // Ciclo de vida
  useEffect(() => {
    if (isOpen) {
      setIsScanning(true);
      setScannedResult(null);
      setManualError(null);
      setManualCode("");
      setShowManualInput(false);
      if (!isInIframe) {
        startCamera();
      } else {
        setCameraError(
          "El simulador de AI Studio se ejecuta en un iframe donde el navegador bloquea la cámara directa. Usa 'Tomar Foto al QR' o ingresa el PIN de la sala."
        );
        setShowManualInput(true);
      }
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, isInIframe, startCamera, stopCamera]);

  // Iniciar bucle de render cuando el stream está listo
  useEffect(() => {
    if (stream && isScanning) {
      animationFrameIdRef.current = requestAnimationFrame(scanFrame);
    }
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [stream, isScanning, scanFrame]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-md">
              <IconQrCode size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm tracking-tight">{title}</h3>
              <p className="text-[11px] text-slate-400 leading-tight">CajaMaster Multi-Dispositivo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isInIframe && (
              <button
                type="button"
                onClick={() => window.open(window.location.href, "_blank")}
                className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-[10px] font-bold text-amber-300 transition cursor-pointer flex items-center gap-1"
                title="Abrir en pestaña nueva para acceder a la webcam de Mac"
              >
                <span>Pestaña nueva</span>
                <span className="text-xs">↗</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
              aria-label="Cerrar"
            >
              <IconX size={16} />
            </button>
          </div>
        </div>

        {/* Visor de Cámara y Overlay de Escaneo */}
        <div className="relative bg-black flex-1 min-h-[300px] flex items-center justify-center overflow-hidden">
          <video
            ref={(el) => {
              videoRef.current = el;
              if (el && stream && el.srcObject !== stream) {
                el.srcObject = stream;
                el.muted = true;
                el.playsInline = true;
                el.play().catch(() => {});
              }
            }}
            playsInline
            muted
            autoPlay
            className="w-full h-full object-cover select-none pointer-events-none"
            onLoadedMetadata={(e) => {
              (e.currentTarget as HTMLVideoElement).play().catch(() => {});
            }}
          />

          {/* Canvas oculto para jsQR */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Feedback de Éxito al Leer el QR */}
          {scannedResult && (
            <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white z-30 animate-pop">
              <div className="w-16 h-16 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center mb-4 shadow-xl shadow-emerald-500/30">
                <IconCheck size={36} />
              </div>
              <h4 className="font-black text-lg text-emerald-300">¡Dispositivo Vinculado!</h4>
              <p className="text-xs text-white/80 mt-1 max-w-xs">
                Conectado con éxito a la sala: <strong className="font-mono text-emerald-200">{scannedResult.roomKey}</strong>
              </p>
              <div className="mt-4 px-3 py-1.5 rounded-xl bg-white/10 text-[11px] font-mono text-emerald-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Sincronizando estado en tiempo real...</span>
              </div>
            </div>
          )}

          {/* Pantalla Informativa / Error de Cámara */}
          {cameraError && !scannedResult && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                <IconQrCode size={26} />
              </div>
              <p className="text-xs text-amber-200 font-semibold max-w-sm leading-relaxed mb-3">
                {cameraError}
              </p>
              {technicalError && (
                <p className="text-[10px] font-mono text-rose-400/80 bg-rose-950/40 px-2 py-1 rounded-md mb-3 max-w-xs break-all">
                  {technicalError}
                </p>
              )}
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  type="button"
                  onClick={handleDirectCameraScan}
                  className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-amber-400/20 active:scale-95"
                >
                  <IconCamera size={16} /> Tomar Foto al QR
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <IconImage size={15} /> Subir Imagen QR
                </button>
                {!isInIframe && (
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <IconRefreshCw size={14} /> Reintentar
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Cuadro de Enfoque con Animación Láser de Escaneo */}
          {!cameraError && !scannedResult && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
              <div className="relative w-56 h-56 sm:w-64 sm:h-64 border-2 border-amber-400/80 rounded-3xl shadow-[0_0_30px_rgba(251,191,36,0.25)] flex items-center justify-center">
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-xl" />
                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#fbbf24] animate-[scan_2s_ease-in-out_infinite]" />
              </div>
              <p className="text-[11px] font-bold text-amber-300 mt-4 bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs shadow-md">
                Enfoca el código QR de sincronización
              </p>
            </div>
          )}

          {/* Controles Flotantes Superiores */}
          {!cameraError && !scannedResult && (
            <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
              <button
                type="button"
                onClick={handleDirectCameraScan}
                className="px-3 py-1.5 rounded-full bg-black/75 hover:bg-black/90 text-amber-400 backdrop-blur-md border border-amber-400/40 transition text-[11px] font-extrabold flex items-center gap-1.5 shadow-lg cursor-pointer"
                title="Tomar foto con la cámara del dispositivo"
              >
                <IconCamera size={14} />
                <span>Foto QR</span>
              </button>

              {torchAvailable && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-2.5 rounded-full backdrop-blur-md border transition cursor-pointer ${
                    torchOn
                      ? "bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-400/40"
                      : "bg-black/60 text-white border-white/10 hover:bg-black/80"
                  }`}
                  title={torchOn ? "Apagar Linterna" : "Encender Linterna"}
                >
                  <IconZap size={16} />
                </button>
              )}
              {hasMultipleCameras && (
                <button
                  type="button"
                  onClick={switchCamera}
                  className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/10 transition cursor-pointer"
                  title="Cambiar Cámara"
                >
                  <IconRotate size={16} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Input de Archivo Oculto para selector normal */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleProcessImageFile}
          className="hidden"
        />

        {/* Input de Cámara Hardware con capture="environment" */}
        <input
          ref={mobileQrCaptureInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleProcessImageFile}
          className="hidden"
        />

        {/* Formulario de Entrada Manual de Código / PIN */}
        {showManualInput && !scannedResult && (
          <div className="p-4 bg-slate-950 border-t border-slate-800 animate-slide-up">
            <form onSubmit={handleManualSubmit} className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-extrabold text-slate-300">
                  Código de Sala o PIN de Vinculación:
                </label>
                <button
                  type="button"
                  onClick={() => setShowManualInput(false)}
                  className="text-amber-400 text-[11px] hover:underline cursor-pointer"
                >
                  Ocultar entrada manual
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Ej: POS-7821 o SALA-01"
                  autoFocus
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-mono text-sm placeholder:text-slate-500 uppercase focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition cursor-pointer"
                >
                  Vincular
                </button>
              </div>
              {manualError && (
                <p className="text-[11px] text-rose-400 font-semibold">{manualError}</p>
              )}
            </form>
          </div>
        )}

        {/* Barra de Acciones Inferior */}
        {!scannedResult && (
          <div className="p-4 bg-slate-900 border-t border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDirectCameraScan}
                className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-md active:scale-95"
              >
                <IconCamera size={15} />
                <span>Tomar Foto al QR</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingFile}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
              >
                <IconImage size={15} />
                <span>{isProcessingFile ? "Analizando..." : "Subir Captura"}</span>
              </button>
            </div>

            {!showManualInput && (
              <button
                type="button"
                onClick={() => setShowManualInput(true)}
                className="px-3 py-2 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 text-xs font-bold transition cursor-pointer border border-amber-400/20"
              >
                Escribir PIN
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
