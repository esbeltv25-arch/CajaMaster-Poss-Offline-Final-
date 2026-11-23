import { useState, useRef, useEffect, useCallback, type ChangeEvent } from "react";
import {
  IconCamera,
  IconRotate,
  IconCheck,
  IconImage,
  IconAlert,
  IconRefreshCw,
  IconX,
} from "./Icons";
import { compressImage } from "../utils/imageUtils";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { requestCameraPermission } from "../utils/nativeBridge";

export interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
  currentImage?: string;
  productName?: string;
}

interface VideoDeviceInfo {
  deviceId: string;
  label: string;
}

interface CameraDiagnosticState {
  isSecure: boolean;
  hasMediaDevices: boolean;
  hasGetUserMedia: boolean;
  isInIframe: boolean;
  protocol: string;
  origin: string;
  isLanHttp: boolean;
}

export function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  currentImage,
  productName,
}: CameraCaptureModalProps) {
  const isMobile =
    typeof navigator !== "undefined" &&
    /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isNative = Capacitor.isNativePlatform();
  const isInIframe = typeof window !== "undefined" && window.self !== window.top;

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    isMobile ? "environment" : "user"
  );
  const [devices, setDevices] = useState<VideoDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [blackStreamWarning, setBlackStreamWarning] = useState(false);

  // Diagnóstico estricto de entorno
  const [diag, setDiag] = useState<CameraDiagnosticState>({
    isSecure: typeof window !== "undefined" ? window.isSecureContext : true,
    hasMediaDevices: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices),
    hasGetUserMedia: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
    isInIframe: typeof window !== "undefined" && window.self !== window.top,
    protocol: typeof window !== "undefined" ? window.location.protocol : "https:",
    origin: typeof window !== "undefined" ? window.location.origin : "",
    isLanHttp:
      typeof window !== "undefined" &&
      window.location.protocol === "http:" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1",
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);

  // Parada limpia y exhaustiva de todos los tracks de vídeo
  const stopStream = useCallback(() => {
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
    setIsVideoActive(false);
    setBlackStreamWarning(false);
  }, []);

  // Enumerar dispositivos de cámara
  const updateDeviceList = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices
        .filter((d) => d.kind === "videoinput")
        .map((d, index) => {
          let fallbackLabel = `Cámara ${index + 1}`;
          if (isMobile) {
            fallbackLabel = index === 0 ? "Cámara Trasera" : "Cámara Frontal";
          } else {
            fallbackLabel = index === 0 ? "Cámara Principal" : `Cámara Secundaria ${index + 1}`;
          }
          return {
            deviceId: d.deviceId,
            label: d.label || fallbackLabel,
          };
        });
      setDevices(videoInputs);
    } catch (err) {
      console.warn("[CameraCaptureModal] enumerateDevices error:", err);
    }
  }, [isMobile]);

  // Conexión del stream al elemento de vídeo
  const attachStreamToVideo = useCallback((mediaStream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = mediaStream;
    video.muted = true;
    (video as any).defaultMuted = true;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.setAttribute("muted", "true");

    const playVideo = () => {
      const p = video.play();
      if (p !== undefined) {
        p.catch((err) => {
          console.warn("[CameraCaptureModal] video.play() notice:", err);
        });
      }
    };

    video.onloadedmetadata = () => {
      playVideo();
      if (video.videoWidth > 0) {
        setIsVideoActive(true);
        setBlackStreamWarning(false);
      }
    };

    video.onplaying = () => {
      if (video.videoWidth > 0) {
        setIsVideoActive(true);
        setBlackStreamWarning(false);
      }
    };

    playVideo();
  }, []);

  // Sincronizar stream de vídeo y monitorear si llegan fotogramas
  useEffect(() => {
    if (stream) {
      if (videoRef.current) {
        attachStreamToVideo(stream);
      }
      const timer = setTimeout(() => {
        const v = videoRef.current;
        if (v && (v.videoWidth === 0 || v.paused)) {
          setBlackStreamWarning(true);
        }
      }, 2200);
      return () => clearTimeout(timer);
    } else {
      setIsVideoActive(false);
      setBlackStreamWarning(false);
    }
  }, [stream, attachStreamToVideo]);

  // Inicialización de la cámara WebRTC
  const initCamera = useCallback(
    async (targetDeviceId?: string, targetFacingMode?: "user" | "environment") => {
      if (previewImage) return;

      setIsInitializing(true);
      setCameraError(null);
      setTechnicalError(null);
      setErrorType(null);

      const isSec = typeof window !== "undefined" ? window.isSecureContext : true;
      const hasGum = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
      const isLan =
        typeof window !== "undefined" &&
        window.location.protocol === "http:" &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1";

      setDiag({
        isSecure: isSec,
        hasMediaDevices: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices),
        hasGetUserMedia: hasGum,
        isInIframe: typeof window !== "undefined" && window.self !== window.top,
        protocol: typeof window !== "undefined" ? window.location.protocol : "",
        origin: typeof window !== "undefined" ? window.location.origin : "",
        isLanHttp: isLan,
      });

      // Si estamos en un iframe de simulador (AI Studio), advertir amistosamente
      if (isInIframe) {
        setIsInitializing(false);
        setCameraError(
          "El simulador de AI Studio se ejecuta en un marco seguro (iframe) que bloquea el acceso directo a la cámara por política del navegador. Puedes abrir la aplicación en una Pestaña Nueva o tomar/subir una foto."
        );
        setErrorType("IframeRestriction");
        return;
      }

      // Detener tracks previos
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        activeStreamRef.current = null;
      }

      if (!hasGum) {
        setErrorType("NotSupportedError");
        setCameraError(
          "La API getUserMedia no está disponible en este navegador. Usa el botón 'Tomar Foto con Cámara' o sube un archivo."
        );
        setIsInitializing(false);
        return;
      }

      // Explicitly request Android OS camera permission first when running in native APK
      if (isNative) {
        try {
          await requestCameraPermission();
        } catch (permErr) {
          console.warn("[CameraCaptureModal] Native camera permission request notice:", permErr);
        }
      }

      try {
        let newStream: MediaStream | null = null;
        const useDeviceId = targetDeviceId || selectedDeviceId;
        const useFacing = targetFacingMode || facingMode;

        // Estrategia 1: Con deviceId específico si el usuario seleccionó una cámara
        if (useDeviceId) {
          try {
            newStream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { ideal: useDeviceId } },
              audio: false,
            });
          } catch (devErr) {
            console.warn("[CameraCaptureModal] deviceId específico falló, usando ideal:", devErr);
          }
        }

        // Estrategia 2: Constraints estándar adaptados a móvil o Mac/escritorio
        if (!newStream) {
          try {
            const constraints: MediaStreamConstraints = {
              video: isMobile
                ? {
                    facingMode: { ideal: useFacing },
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
            console.warn("[CameraCaptureModal] Constraints ideales fallaron, intentando fallback simple:", errConstraint);
          }
        }

        // Estrategia 3: Fallback mínimo { video: true, audio: false }
        if (!newStream) {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        activeStreamRef.current = newStream;
        setStream(newStream);
        attachStreamToVideo(newStream);

        // Enumerar cámaras
        await updateDeviceList();
      } catch (err: unknown) {
        console.error("[CameraCaptureModal] Error al obtener stream:", err);

        let userMsg = "No se pudo acceder a la cámara en vivo.";
        let tech = "";
        let eType = "UnknownError";

        if (err instanceof Error) {
          tech = `${err.name}: ${err.message}`;
          eType = err.name;

          switch (err.name) {
            case "NotAllowedError":
            case "PermissionDeniedError":
              userMsg =
                "Permiso de cámara denegado. Concede permisos de cámara en tu navegador o sistema operativo.";
              break;
            case "NotFoundError":
            case "DevicesNotFoundError":
              userMsg = "No se detectó ninguna cámara física conectada en este equipo.";
              break;
            case "NotReadableError":
            case "TrackStartError":
              userMsg =
                "La cámara ya está siendo utilizada por otra aplicación. Ciérrala y reintenta.";
              break;
            case "OverconstrainedError":
              userMsg = "La configuración de resolución solicitada no es compatible con el sensor.";
              break;
            case "SecurityError":
              userMsg = "Acceso a la cámara bloqueado por política de contexto de seguridad.";
              break;
            default:
              userMsg = `Error al conectar con la cámara: ${err.message}`;
          }
        } else {
          tech = String(err);
        }

        setCameraError(userMsg);
        setTechnicalError(tech);
        setErrorType(eType);
        stopStream();
      } finally {
        setIsInitializing(false);
      }
    },
    [previewImage, selectedDeviceId, facingMode, isMobile, isInIframe, attachStreamToVideo, updateDeviceList, stopStream]
  );

  // Inicializar al abrir modal
  useEffect(() => {
    if (isOpen) {
      // Siempre iniciamos con la cámara activa para tomar una nueva foto (no congelar en foto antigua)
      setPreviewImage(null);
      if (!isInIframe) {
        initCamera();
      } else {
        setCameraError(
          "El simulador de AI Studio se ejecuta en un iframe donde el navegador bloquea la cámara por seguridad. Abre la app en una Pestaña Nueva o toma una foto desde tu móvil."
        );
        setErrorType("IframeRestriction");
      }
    } else {
      stopStream();
      setPreviewImage(null);
      setCameraError(null);
      setTechnicalError(null);
      setShowDiagnostic(false);
    }

    return () => {
      stopStream();
    };
  }, [isOpen, isInIframe, initCamera, stopStream]);

  // Captura Directa con Cámara del Dispositivo (100% Infalible en Móvil y Android)
  const handleDirectCameraCapture = useCallback(async () => {
    // 1. Si es app nativa Capacitor Android
    if (isNative) {
      try {
        try {
          const perm = await Camera.checkPermissions();
          if (perm.camera !== "granted") {
            const req = await Camera.requestPermissions();
            if (req.camera !== "granted") {
              setCameraError("Permiso de cámara denegado en el sistema operativo Android.");
              return;
            }
          }
        } catch (permErr) {
          console.warn("[CameraCaptureModal] Check permissions advertencia:", permErr);
        }

        const photo = await Camera.getPhoto({
          quality: 85,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
        });

        if (photo.dataUrl) {
          const compressed = await compressImage(
            await (await fetch(photo.dataUrl)).blob(),
            600,
            600,
            0.85
          );
          setPreviewImage(compressed);
          stopStream();
          return;
        }
      } catch (err: any) {
        console.warn("[CameraCaptureModal] Camera.getPhoto falló o cancelado, usando selector de cámara:", err);
      }
    }

    // 2. En Navegador Móvil o fallback Web: Disparar input con capture="environment"
    // Esto abre de inmediato la cámara nativa del teléfono en Android e iOS
    if (mobileCameraInputRef.current) {
      mobileCameraInputRef.current.click();
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [isNative, stopStream]);

  // Alternar entre cámaras (Frontal / Trasera)
  const handleFlipCamera = () => {
    if (devices.length > 1) {
      const currentIndex = devices.findIndex((d) => d.deviceId === selectedDeviceId);
      const nextIndex = (currentIndex + 1) % devices.length;
      const nextDeviceId = devices[nextIndex].deviceId;
      setSelectedDeviceId(nextDeviceId);
      initCamera(nextDeviceId);
    } else {
      const nextFacing = facingMode === "user" ? "environment" : "user";
      setFacingMode(nextFacing);
      initCamera(undefined, nextFacing);
    }
  };

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    initCamera(deviceId);
  };

  // Capturar fotograma congelado del elemento de vídeo en vivo
  const handleTakeSnapshot = async () => {
    if (!videoRef.current) return;
    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const rawData = canvas.toDataURL("image/jpeg", 0.9);
        const compressed = await compressImage(
          await (await fetch(rawData)).blob(),
          600,
          600,
          0.85
        );
        setPreviewImage(compressed);
        stopStream();
      }
    } catch (err) {
      console.error("[CameraCaptureModal] Error capturando fotograma:", err);
    } finally {
      setIsCapturing(false);
    }
  };

  // Subida desde archivo local o selector de foto
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 600, 600, 0.85);
      setPreviewImage(compressed);
      stopStream();
    } catch (err) {
      console.error("[CameraCaptureModal] Error procesando archivo de imagen:", err);
    } finally {
      e.target.value = "";
    }
  };

  const handleConfirm = () => {
    if (previewImage) {
      onCapture(previewImage);
      handleClose();
    }
  };

  const handleRetake = () => {
    setPreviewImage(null);
    if (!isInIframe) {
      initCamera();
    }
  };

  const handleClose = () => {
    stopStream();
    setPreviewImage(null);
    setCameraError(null);
    setTechnicalError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-pop"
      onClick={handleClose}
    >
      <div
        className="bg-slate-950 text-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="p-4 bg-slate-900/90 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
              <IconCamera size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white leading-tight">
                Cámara / Foto de Producto
              </h3>
              <p className="text-[11px] text-white/60 truncate max-w-[240px]">
                {productName || "Captura con tu cámara o selecciona una imagen"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isInIframe && (
              <button
                type="button"
                onClick={() => window.open(window.location.href, "_blank")}
                className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-[10.5px] font-bold text-amber-300 transition cursor-pointer flex items-center gap-1"
                title="Abrir en pestaña nueva para acceder a la webcam de Mac sin bloqueo de iframe"
              >
                <span>Pestaña nueva</span>
                <span className="text-xs">↗</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowDiagnostic((prev) => !prev)}
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-mono text-white/70 transition cursor-pointer"
              title="Ver Diagnóstico Técnico"
            >
              Info
            </button>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs cursor-pointer"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Panel de Diagnóstico Expansible */}
        {showDiagnostic && (
          <div className="px-4 py-2.5 bg-slate-900/95 border-b border-amber-400/20 text-[11px] font-mono text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span>Contexto Seguro (isSecureContext):</span>
              <span className={diag.isSecure ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                {diag.isSecure ? "SÍ" : "NO"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Marco iFrame (Simulador):</span>
              <span className={diag.isInIframe ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                {diag.isInIframe ? "SÍ (iFrame embebido)" : "NO (Ventana directa)"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Plataforma:</span>
              <span className="text-amber-400 font-bold">{isNative ? "Nativo Android (Capacitor)" : isMobile ? "Móvil Web" : "Escritorio / Mac"}</span>
            </div>
          </div>
        )}

        {/* Selector de cámara si hay más de 1 y no hay preview */}
        {!previewImage && !cameraError && devices.length > 1 && (
          <div className="px-4 py-2 bg-slate-900/60 border-b border-white/5 flex items-center justify-between text-xs">
            <span className="text-white/60 text-[11px]">Cámara activa:</span>
            <select
              value={selectedDeviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="bg-slate-800 text-white text-[11px] rounded-lg px-2.5 py-1 border border-white/10 focus:outline-none focus:border-amber-400"
            >
              <option value="">Predeterminada (Auto)</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Visor de Cámara / Vista previa */}
        <div className="relative flex-1 bg-black min-h-[320px] flex items-center justify-center overflow-hidden">
          {previewImage ? (
            /* Foto congelada lista */
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <img
                src={previewImage}
                alt="Vista previa de producto"
                className="max-h-[380px] w-auto max-w-full rounded-2xl object-contain shadow-2xl border border-white/20"
              />
              <div className="absolute top-6 left-6 px-3 py-1 bg-emerald-500/90 text-white font-bold text-xs rounded-full shadow-lg flex items-center gap-1.5 backdrop-blur-xs">
                <IconCheck size={14} /> Foto Lista
              </div>
            </div>
          ) : cameraError ? (
            /* Pantalla informativa y opciones directas */
            <div className="p-6 text-center max-w-sm space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-400/20 text-amber-400 mx-auto flex items-center justify-center">
                <IconCamera size={32} />
              </div>
              <div>
                <h4 className="font-bold text-base text-white">
                  {isInIframe ? "Simulador de Desarrollo" : "Cámara del Dispositivo"}
                </h4>
                <p className="text-xs text-white/80 mt-1.5 leading-relaxed">
                  {cameraError}
                </p>
                {technicalError && (
                  <p className="text-[10px] font-mono text-rose-300 bg-rose-950/40 px-2.5 py-1.5 rounded-lg mt-2 border border-rose-500/30 break-all text-left">
                    {technicalError}
                  </p>
                )}
              </div>

              {/* Botones de acción directa */}
              <div className="flex flex-col gap-2 pt-1">
                {/* 1. Botón para Tomar Foto con Cámara (Móvil / Android / iOS) */}
                <button
                  type="button"
                  onClick={handleDirectCameraCapture}
                  className="px-4 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <IconCamera size={18} />
                  <span>Tomar Foto con la Cámara</span>
                </button>

                {/* 2. Si está en iFrame de Mac: Abrir en pestaña nueva */}
                {isInIframe && (
                  <button
                    type="button"
                    onClick={() => window.open(window.location.href, "_blank")}
                    className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <span>Abrir en Pestaña Nueva (Webcam Mac)</span> ↗
                  </button>
                )}

                {/* 3. Subir archivo desde dispositivo */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <IconImage size={16} /> Seleccionar Imagen / Galería
                </button>

                {!isInIframe && (
                  <button
                    type="button"
                    onClick={() => initCamera()}
                    disabled={isInitializing}
                    className="px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <IconRefreshCw size={14} /> Reintentar Webcam en Vivo
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Stream en Vivo WebRTC (Mac/PC en pestaña real o Android si está activo) */
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={(el) => {
                  videoRef.current = el;
                  if (el && stream && el.srcObject !== stream) {
                    attachStreamToVideo(stream);
                  }
                }}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover max-h-[420px]"
                onLoadedMetadata={(e) => {
                  const el = e.currentTarget;
                  el.play().catch(() => {});
                  if (el.videoWidth > 0) setIsVideoActive(true);
                }}
              />

              {/* Advertencia si el stream conecta pero no produce fotogramas */}
              {blackStreamWarning && !isVideoActive && (
                <div className="absolute inset-0 z-20 bg-black/85 backdrop-blur-sm p-5 flex flex-col items-center justify-center text-center text-white space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-400/20 text-amber-400 flex items-center justify-center">
                    <IconAlert size={26} />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-amber-300">
                      Sin señal de vídeo en el visor
                    </h5>
                    <p className="text-[11px] text-white/80 mt-1 max-w-xs leading-relaxed">
                      El navegador no transmite imagen a este marco. Puedes tomar la foto directamente o subir una imagen.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 w-full max-w-xs pt-1">
                    <button
                      type="button"
                      onClick={handleDirectCameraCapture}
                      className="w-full py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg"
                    >
                      <IconCamera size={16} />
                      <span>Tomar Foto con Cámara</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <IconImage size={15} />
                      <span>Seleccionar Archivo de Imagen</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Overlay de Enfoque */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                <div className="w-64 h-64 border-2 border-dashed border-amber-400/80 rounded-3xl relative shadow-[0_0_20px_rgba(245,184,46,0.3)]">
                  <span className="absolute top-2 left-2 text-[10px] font-bold text-amber-400 uppercase tracking-widest bg-black/50 px-2 py-0.5 rounded-md">
                    Encuadre de Producto
                  </span>
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-amber-400 rounded-tl-xl -mt-1 -ml-1" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-amber-400 rounded-tr-xl -mt-1 -mr-1" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-amber-400 rounded-bl-xl -mb-1 -ml-1" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-amber-400 rounded-br-xl -mb-1 -mr-1" />
                </div>
              </div>

              {/* Controles flotantes en vivo */}
              <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                <button
                  type="button"
                  onClick={handleDirectCameraCapture}
                  className="px-3 py-1.5 rounded-full bg-black/75 hover:bg-black/90 text-amber-400 backdrop-blur-md border border-amber-400/40 transition text-[11px] font-extrabold flex items-center gap-1.5 shadow-lg cursor-pointer"
                  title="Abrir cámara del sistema"
                >
                  <IconCamera size={14} />
                  <span>Cámara Directa</span>
                </button>

                {devices.length > 1 && (
                  <button
                    type="button"
                    onClick={handleFlipCamera}
                    className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/10 transition cursor-pointer"
                    title="Alternar Cámara"
                  >
                    <IconRotate size={16} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Input oculto para subida de archivo normal */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Input oculto con capture="environment" para disparar la cámara del sistema en móviles */}
        <input
          ref={mobileCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Barra inferior de acciones */}
        <div className="p-4 bg-slate-900 border-t border-white/10 shrink-0">
          {previewImage ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <IconRotate size={16} /> Tomar Otra Foto
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg transition cursor-pointer"
              >
                <IconCheck size={16} /> Usar Esta Foto
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2.5 px-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                title="Seleccionar archivo de imagen"
              >
                <IconImage size={18} />
                <span>Galería / Archivos</span>
              </button>

              {/* Botón Obturador Central */}
              <button
                type="button"
                onClick={cameraError || !isVideoActive ? handleDirectCameraCapture : handleTakeSnapshot}
                disabled={isCapturing}
                className="w-16 h-16 rounded-full border-4 border-white/40 bg-amber-400 hover:bg-amber-300 active:scale-95 transition shadow-2xl flex items-center justify-center disabled:opacity-40 cursor-pointer"
                title={cameraError || !isVideoActive ? "Tomar Foto con Cámara" : "Capturar Fotograma"}
              >
                <div className="w-11 h-11 rounded-full bg-slate-950 text-amber-400 flex items-center justify-center">
                  <IconCamera size={22} />
                </div>
              </button>

              {currentImage ? (
                <button
                  type="button"
                  onClick={() => {
                    onCapture("");
                    handleClose();
                  }}
                  className="text-xs text-rose-400 hover:underline font-bold cursor-pointer"
                >
                  Quitar foto
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDirectCameraCapture}
                  className="py-2.5 px-3.5 rounded-2xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 text-xs font-black flex items-center gap-1.5 transition cursor-pointer border border-amber-400/30"
                  title="Tomar foto con la cámara del dispositivo"
                >
                  <IconCamera size={16} />
                  <span>Tomar Foto</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
