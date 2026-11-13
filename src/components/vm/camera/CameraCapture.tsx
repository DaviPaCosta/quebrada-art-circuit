import { CameraOff, Image as ImageIcon, RefreshCcw, X, Zap, ZapOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PHOTO_PRESS_MS, pickRecorderMime, recordProgress, shouldStopRecording } from "@/lib/camera";
import { cn } from "@/lib/utils";

const GALLERY_ACCEPT = "image/*,video/mp4,video/webm,video/quicktime";

type Facing = "environment" | "user";
type CamError = { title: string; text: string } | null;

function cameraError(e: unknown): CamError {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return {
      title: "Câmera bloqueada",
      text: "Para usar a câmera, toque no cadeado (ou nos três pontinhos) do navegador, vá em Permissões e libere Câmera e Microfone. Enquanto isso, use a galeria.",
    };
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return { title: "Câmera não encontrada", text: "Este aparelho não tem câmera disponível. Use a galeria." };
  return { title: "Não foi possível abrir a câmera", text: "Feche outros apps que estejam usando a câmera e tente de novo, ou use a galeria." };
}

/**
 * Câmera em tela cheia: toque = foto, segurar = vídeo (até 60 s).
 * Galeria ao lado. Entrega os arquivos em `onFiles`.
 */
export function CameraCapture({
  onFiles,
  onClose,
  multiple = true,
}: {
  onFiles: (files: File[]) => void;
  onClose: () => void;
  multiple?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const pressStart = useRef(0);
  const pressTimer = useRef<number | undefined>(undefined);
  const recordStart = useRef(0);
  const raf = useRef<number | undefined>(undefined);
  const galleryRef = useRef<HTMLInputElement>(null);
  const recordingRef = useRef(false);

  const [facing, setFacing] = useState<Facing>("environment");
  const [error, setError] = useState<CamError>(null);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torch, setTorch] = useState(false);
  const [flash, setFlash] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Liga a câmera (e o microfone, se der) sempre que muda frente/trás.
  useEffect(() => {
    let alive = true;
    setReady(false);
    setTorch(false);
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError({ title: "Câmera indisponível", text: "Este navegador não permite usar a câmera aqui. Use a galeria." });
        return;
      }
      const video = { facingMode: { ideal: facing }, width: { ideal: 1080 }, height: { ideal: 1920 } };
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
      } catch (e) {
        // Sem microfone liberado: ainda dá para tirar foto e gravar sem som.
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
        } catch {
          if (alive) setError(cameraError(e));
          return;
        }
      }
      if (!alive) return stream.getTracks().forEach((t) => t.stop());
      stopStream();
      streamRef.current = stream;
      const el = videoRef.current;
      if (el) {
        el.srcObject = stream;
        await el.play().catch(() => {});
      }
      const track = stream.getVideoTracks()[0];
      const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      setTorchSupported(Boolean(caps.torch));
      setError(null);
      setReady(true);
    }
    void start();
    return () => {
      alive = false;
    };
  }, [facing, stopStream]);

  // Desliga tudo ao sair da tela.
  useEffect(
    () => () => {
      window.clearTimeout(pressTimer.current);
      if (raf.current) cancelAnimationFrame(raf.current);
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stopStream();
    },
    [stopStream],
  );

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch((t) => !t);
    } catch {
      setTorchSupported(false);
    }
  };

  const takePhoto = () => {
    const el = videoRef.current;
    if (!el || !el.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = el.videoWidth;
    canvas.height = el.videoHeight;
    canvas.getContext("2d")?.drawImage(el, 0, 0);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 150);
    canvas.toBlob(
      (blob) => {
        if (blob) onFiles([new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" })]);
      },
      "image/jpeg",
      0.92,
    );
  };

  const stopRecording = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recordingRef.current = false;
    setRecording(false);
    setProgress(0);
  }, []);

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") return takePhoto();
    const mime = pickRecorderMime((t) => MediaRecorder.isTypeSupported(t));
    if (!mime) return takePhoto();
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = () => {
      const type = mime.split(";")[0] ?? "video/webm";
      const blob = new Blob(chunks, { type });
      if (blob.size > 0) onFiles([new File([blob], `video-${Date.now()}.${type.endsWith("mp4") ? "mp4" : "webm"}`, { type })]);
    };
    recorderRef.current = recorder;
    recorder.start(500);
    recordStart.current = performance.now();
    recordingRef.current = true;
    setRecording(true);
    const tick = () => {
      const elapsed = performance.now() - recordStart.current;
      setProgress(recordProgress(elapsed));
      if (shouldStopRecording(elapsed)) return stopRecording();
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const onPressStart = (e: React.PointerEvent) => {
    if (!ready) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pressStart.current = performance.now();
    pressTimer.current = window.setTimeout(startRecording, PHOTO_PRESS_MS);
  };

  const onPressEnd = () => {
    if (!ready || !pressStart.current) return;
    window.clearTimeout(pressTimer.current);
    const heldMs = performance.now() - pressStart.current;
    pressStart.current = 0;
    if (recordingRef.current) stopRecording();
    else if (heldMs < PHOTO_PRESS_MS) takePhoto();
    // Senão: a gravação já parou sozinha nos 60 s; soltar o dedo não tira foto.
  };

  const ring = 2 * Math.PI * 36;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" role="dialog" aria-label="Câmera">
      <video
        ref={videoRef}
        playsInline
        muted
        className={cn("absolute inset-0 size-full object-cover", facing === "user" && "-scale-x-100")}
      />
      {flash && <div className="pointer-events-none absolute inset-0 bg-white/70" aria-hidden />}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <CameraOff className="size-12 text-primary" aria-hidden />
          <p className="font-display text-2xl uppercase">{error.title}</p>
          <p className="text-sm text-white/80">{error.text}</p>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="mt-2 rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground"
          >
            Abrir galeria
          </button>
        </div>
      )}

      <div className="relative flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} aria-label="Fechar câmera" className="rounded-full bg-black/40 p-2">
          <X className="size-6" />
        </button>
        {recording && (
          <span className="rounded-full bg-red-600 px-3 py-1 text-sm font-bold" aria-live="polite">
            ● {Math.floor(progress * 60)}s
          </span>
        )}
        {torchSupported && facing === "environment" ? (
          <button type="button" onClick={toggleTorch} aria-label={torch ? "Desligar flash" : "Ligar flash"} className="rounded-full bg-black/40 p-2">
            {torch ? <Zap className="size-6 fill-current" /> : <ZapOff className="size-6" />}
          </button>
        ) : (
          <span className="size-10" />
        )}
      </div>

      <div className="relative mt-auto flex items-center justify-around px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4">
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          aria-label="Abrir galeria"
          className="flex size-12 items-center justify-center rounded-lg border-2 border-white/80 bg-black/40"
        >
          <ImageIcon className="size-6" />
        </button>

        <button
          type="button"
          aria-label="Toque para foto, segure para gravar vídeo"
          disabled={!ready}
          onPointerDown={onPressStart}
          onPointerUp={onPressEnd}
          onPointerCancel={onPressEnd}
          onContextMenu={(e) => e.preventDefault()}
          className="relative flex size-20 touch-none select-none items-center justify-center disabled:opacity-40"
        >
          <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="40" cy="40" r="36" fill="none" stroke="white" strokeWidth="5" opacity="0.9" />
            {recording && (
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="5"
                strokeDasharray={ring}
                strokeDashoffset={ring * (1 - progress)}
              />
            )}
          </svg>
          <span className={cn("rounded-full bg-white transition-all", recording ? "size-8 rounded-md bg-red-600" : "size-14")} />
        </button>

        <button
          type="button"
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          aria-label="Virar câmera"
          disabled={recording}
          className="flex size-12 items-center justify-center rounded-full bg-black/40 disabled:opacity-40"
        >
          <RefreshCcw className="size-6" />
        </button>
      </div>
      <p className="relative pb-4 text-center text-xs text-white/70">Toque para foto · segure para vídeo</p>

      <input
        ref={galleryRef}
        type="file"
        accept={GALLERY_ACCEPT}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}
