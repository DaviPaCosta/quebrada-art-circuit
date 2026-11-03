import { ChevronLeft, ChevronRight, Film, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { CROP_RATIOS, type CropAspect } from "@/lib/logic";
import { cn } from "@/lib/utils";
import type { Draft } from "./drafts";
import { MediaPicker } from "./MediaPicker";

const ASPECTS: { value: CropAspect; label: string }[] = [
  { value: "original", label: "Original" },
  { value: "1:1", label: "Quadrado" },
  { value: "4:5", label: "Retrato 4:5" },
  { value: "16:9", label: "Paisagem 16:9" },
];

/** Prévia e editor simples: recorte, posição, capa do vídeo, ordem e descrição. */
export function UploadPreview({
  drafts,
  selectedId,
  onSelect,
  onChange,
  onRemove,
  onMove,
  onFiles,
  remaining,
  loading,
}: {
  drafts: Draft[];
  selectedId: string;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<Draft>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onFiles: (files: File[]) => void;
  remaining: number;
  loading: boolean;
}) {
  const d = drafts.find((x) => x.id === selectedId) ?? drafts[0];
  if (!d) return null;
  const index = drafts.indexOf(d);

  return (
    <div className="space-y-4">
      {d.kind === "image" ? <ImageEditor d={d} onChange={onChange} /> : <VideoEditor d={d} onChange={onChange} />}

      <div className="space-y-2">
        <Label htmlFor={`alt-${d.id}`}>
          Descrição {d.kind === "video" ? "do vídeo" : "da foto"} {drafts.length > 1 && `${index + 1}`} (acessibilidade)
        </Label>
        <Textarea
          id={`alt-${d.id}`}
          value={d.alt}
          onChange={(e) => onChange(d.id, { alt: e.target.value })}
          maxLength={300}
          rows={2}
          placeholder={d.kind === "video" ? "Conte o que acontece no vídeo" : "Descreva o que aparece na imagem"}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">
          {drafts.length} {drafts.length === 1 ? "item" : "itens"}
          {drafts.length > 1 && " · carrossel"}
        </p>
        <ul className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
          {drafts.map((x, i) => (
            <li key={x.id} className="relative shrink-0">
              <button
                type="button"
                onClick={() => onSelect(x.id)}
                aria-label={`Editar item ${i + 1}`}
                aria-current={x.id === d.id}
                className={cn("block size-16 overflow-hidden rounded-md border-2", x.id === d.id ? "border-primary" : "border-transparent")}
              >
                {x.kind === "image" ? (
                  <img src={x.url} alt="" className="size-full object-cover" />
                ) : (
                  <span className="relative block size-full">
                    <video src={x.url} muted preload="metadata" className="size-full object-cover" />
                    <Film className="absolute bottom-1 right-1 size-4" />
                  </span>
                )}
                {!x.alt.trim() && <span className="absolute left-1 top-1 size-2 rounded-full bg-primary" aria-label="Falta descrição" />}
              </button>
              <button
                type="button"
                onClick={() => onRemove(x.id)}
                aria-label={`Remover item ${i + 1}`}
                className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
          <li>
            <MediaPicker compact onFiles={onFiles} remaining={remaining} loading={loading} />
          </li>
        </ul>
        {drafts.length > 1 && (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => onMove(d.id, -1)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold disabled:opacity-40"
            >
              <ChevronLeft className="size-3" /> Mover para trás
            </button>
            <button
              type="button"
              disabled={index === drafts.length - 1}
              onClick={() => onMove(d.id, 1)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold disabled:opacity-40"
            >
              Mover para frente <ChevronRight className="size-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ImageEditor({ d, onChange }: { d: Draft; onChange: (id: string, patch: Partial<Draft>) => void }) {
  const ratio = d.aspect === "original" ? d.width / d.height : CROP_RATIOS[d.aspect];
  const horizontal = d.width / d.height > ratio;
  const croppable = d.aspect !== "original" && Math.abs(d.width / d.height - ratio) > 0.01;
  const p = `${Math.round(d.pos * 100)}%`;

  return (
    <div className="space-y-3">
      <div className="flex justify-center rounded-lg border border-border bg-muted">
        <div className="relative max-h-[55vh] w-full overflow-hidden" style={{ aspectRatio: ratio, maxWidth: `calc(55vh * ${ratio})` }}>
          <img
            src={d.url}
            alt={d.alt || "Prévia da foto"}
            className="size-full object-cover"
            style={{ objectPosition: horizontal ? `${p} 50%` : `50% ${p}` }}
          />
        </div>
      </div>
      <div role="radiogroup" aria-label="Recorte" className="flex flex-wrap gap-2">
        {ASPECTS.map((a) => (
          <button
            key={a.value}
            type="button"
            role="radio"
            aria-checked={d.aspect === a.value}
            onClick={() => onChange(d.id, { aspect: a.value, pos: 0.5 })}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-semibold",
              d.aspect === a.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary",
            )}
          >
            {a.label}
          </button>
        ))}
      </div>
      {croppable && (
        <div className="space-y-2">
          <Label>Posição do recorte ({horizontal ? "esquerda ↔ direita" : "cima ↕ baixo"})</Label>
          <Slider value={[d.pos * 100]} min={0} max={100} step={1} onValueChange={([v]) => onChange(d.id, { pos: (v ?? 50) / 100 })} aria-label="Posição do recorte" />
        </div>
      )}
    </div>
  );
}

function VideoEditor({ d, onChange }: { d: Draft; onChange: (id: string, patch: Partial<Draft>) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const duration = d.duration ?? 0;

  useEffect(() => {
    const v = ref.current;
    if (v && v.paused) v.currentTime = d.coverTime;
  }, [d.coverTime]);

  return (
    <div className="space-y-3">
      <div className="flex justify-center rounded-lg border border-border bg-muted">
        <video
          ref={ref}
          src={d.url}
          controls
          muted
          playsInline
          preload="metadata"
          aria-label={d.alt || "Prévia do vídeo"}
          className="max-h-[55vh] w-auto max-w-full"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {Math.round(duration)} s · {(d.file.size / 1024 / 1024).toFixed(1)} MB · o vídeo não é recortado.
      </p>
      {duration > 0.5 && (
        <div className="space-y-2">
          <Label>Capa do vídeo (quadro em {d.coverTime.toFixed(1)} s)</Label>
          <Slider
            value={[d.coverTime]}
            min={0}
            max={Math.max(0, duration - 0.1)}
            step={0.1}
            onValueChange={([v]) => onChange(d.id, { coverTime: v ?? 0 })}
            aria-label="Escolher capa do vídeo"
          />
        </div>
      )}
    </div>
  );
}
