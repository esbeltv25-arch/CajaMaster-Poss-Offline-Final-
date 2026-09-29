import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { IconCamera, IconRotate, IconCheck, IconImage } from "./Icons";
import { compressImage } from "../utils/imageUtils";

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
  currentImage?: string;
  productName?: string;
}

export function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  currentImage,
  productName,
}: CameraCaptureModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Start Camera
  useEffect(() => {
    if (!isOpen || previewImage) return;

    let activeStream: MediaStream | null = null;

    async function initCamera() {
      setCameraError(null);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("La cámara no está soportada en este navegador.");
        }

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        activeStream = newStream;
        setStream(newStream);

        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err: unknown) {
        console.warn("Camera init error:", err);
        const msg =
          err instanceof Error
            ? err.message
            : "No se pudo acceder a la cámara. Revisa los permisos.";
        setCameraError(msg);
      }
    }

    initCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isOpen, facingMode, previewImage]);

  // Stop camera helper
  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  };

  const handleFlipCamera = () => {
    stopStream();
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

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
      console.error("Error capturing frame", err);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 600, 600, 0.85);
      setPreviewImage(compressed);
      stopStream();
    } catch (err) {
      console.error("Error processing file", err);
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
  };

  const handleClose = () => {
    stopStream();
    setPreviewImage(null);
    setCameraError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-pop"
      onClick={handleClose}
    >
      <div
        className="bg-slate-950 text-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-slate-900/90 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
              <IconCamera size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white leading-tight">
                Cámara de Producto
              </h3>
              <p className="text-[11px] text-white/60 truncate max-w-[200px]">
                {productName || "Capturar foto para la ficha de inventario"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Viewfinder / Preview Body */}
        <div className="relative flex-1 bg-black min-h-[340px] flex items-center justify-center overflow-hidden">
          {previewImage ? (
            /* Frozen Snapshot Preview */
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <img
                src={previewImage}
                alt="Vista previa"
                className="max-h-[380px] w-auto max-w-full rounded-2xl object-contain shadow-2xl border border-white/20"
              />
              <div className="absolute top-6 left-6 px-3 py-1 bg-emerald-500/90 text-white font-bold text-xs rounded-full shadow-lg flex items-center gap-1.5 backdrop-blur-xs">
                <IconCheck size={14} /> Foto Capturada
              </div>
            </div>
          ) : cameraError ? (
            /* Camera Permission / Error Fallback */
            <div className="p-6 text-center max-w-sm space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
                <IconCamera size={32} />
              </div>
              <div>
                <h4 className="font-bold text-base text-white">Acceso a Cámara</h4>
                <p className="text-xs text-white/70 mt-1 leading-relaxed">
                  {cameraError}
                </p>
                <p className="text-[11px] text-amber-300 mt-2 font-medium">
                  Puedes subir una foto desde tus archivos o tomarla con el disparador de tu móvil.
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 rounded-2xl bg-amber-400 text-slate-950 font-extrabold text-xs shadow-lg hover:bg-amber-300 transition flex items-center justify-center gap-2 mx-auto cursor-pointer"
              >
                <IconImage size={16} /> Seleccionar de Galería / Archivo
              </button>
            </div>
          ) : (
            /* Live Camera Feed */
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover max-h-[420px]"
              />

              {/* Target Focus Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                <div className="w-64 h-64 border-2 border-dashed border-amber-400/80 rounded-3xl relative shadow-[0_0_20px_rgba(245,184,46,0.3)]">
                  <span className="absolute top-2 left-2 text-[10px] font-bold text-amber-400 uppercase tracking-widest bg-black/40 px-2 py-0.5 rounded-md">
                    Encuadre de Producto
                  </span>
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-amber-400 rounded-tl-xl -mt-1 -ml-1" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-amber-400 rounded-tr-xl -mt-1 -mr-1" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-amber-400 rounded-bl-xl -mb-1 -ml-1" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-amber-400 rounded-br-xl -mb-1 -mr-1" />
                </div>
              </div>

              {/* Camera Switcher */}
              <button
                onClick={handleFlipCamera}
                className="absolute top-4 right-4 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/10 transition cursor-pointer"
                title="Cambiar Cámara (Trasera / Frontal)"
              >
                <IconRotate size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Action Controls Footer */}
        <div className="p-4 bg-slate-900 border-t border-white/10 shrink-0">
          {previewImage ? (
            <div className="flex gap-3">
              <button
                onClick={handleRetake}
                className="flex-1 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <IconRotate size={16} /> Tomar Otra Foto
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg transition cursor-pointer"
              >
                <IconCheck size={16} /> Usar Esta Foto
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                title="Subir desde galería"
              >
                <IconImage size={18} />
                <span className="hidden sm:inline">Galería</span>
              </button>

              {/* Shutter Button */}
              <button
                onClick={handleTakeSnapshot}
                disabled={isCapturing || !!cameraError}
                className="w-16 h-16 rounded-full border-4 border-white/40 bg-amber-400 hover:bg-amber-300 active:scale-95 transition shadow-2xl flex items-center justify-center disabled:opacity-40 cursor-pointer"
                title="Capturar Foto"
              >
                <div className="w-11 h-11 rounded-full bg-slate-950 text-amber-400 flex items-center justify-center">
                  <IconCamera size={22} />
                </div>
              </button>

              {currentImage ? (
                <button
                  onClick={() => {
                    onCapture("");
                    handleClose();
                  }}
                  className="text-xs text-rose-400 hover:underline font-bold cursor-pointer"
                >
                  Quitar foto
                </button>
              ) : (
                <div className="w-14 text-right text-[11px] text-white/50 font-medium">
                  {facingMode === "environment" ? "Trasera" : "Frontal"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
