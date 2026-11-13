import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MentionInput } from "@/components/vm/Mentions";
import { PageTitle } from "@/components/vm/AppShell";
import { FieldError } from "@/components/vm/AuthLayout";
import { ConfirmDialog } from "@/components/vm/ConfirmDialog";
import { fileToDraft, type Draft } from "@/components/vm/media/drafts";
import { MediaPicker } from "@/components/vm/media/MediaPicker";
import { UploadPreview } from "@/components/vm/media/UploadPreview";
import { MAX_MEDIA, parseTags } from "@/lib/logic";
import { extFor, removeUploads, uploadAll } from "@/lib/api/media";
import { captureVideoFrame, renderImage } from "@/lib/media-processing";
import { prepareVideo, unlockAudio } from "@/lib/prepare-media";
import { actions, useCurrentUser } from "@/lib/store";
import { CATEGORIES, type Category, type MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_rede/publicar")({
  head: () => ({
    meta: [
      { title: "Publicar foto ou vídeo — Vozes do Muro" },
      { name: "description", content: "Publique fotos, vídeos ou carrosséis com créditos, categoria e hashtags." },
      { property: "og:title", content: "Publicar foto ou vídeo — Vozes do Muro" },
      { property: "og:description", content: "Envie sua arte para a comunidade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Publish,
});

type Step = "selecionar" | "editar" | "informacoes";
const STEPS: { id: Step; label: string }[] = [
  { id: "selecionar", label: "Escolher" },
  { id: "editar", label: "Editar" },
  { id: "informacoes", label: "Informações" },
];

function Publish() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [step, setStep] = useState<Step>("selecionar");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [credits, setCredits] = useState(user?.name ?? "");
  const [tags, setTags] = useState("");
  const [region, setRegion] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  // Libera a memória das prévias ao sair da tela.
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  useEffect(() => () => draftsRef.current.forEach((d) => URL.revokeObjectURL(d.url)), []);

  const remaining = MAX_MEDIA - drafts.length;

  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    setError("");
    if (files.length > remaining) toast.warning(`Só cabem mais ${remaining} itens nesta publicação.`);
    setLoadingFiles(true);
    const added: Draft[] = [];
    const errors: string[] = [];
    for (const f of files.slice(0, Math.max(0, remaining))) {
      try {
        added.push(await fileToDraft(f));
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    setLoadingFiles(false);
    if (errors.length) setError(errors.join(" "));
    if (added.length) {
      setDrafts((prev) => [...prev, ...added]);
      setSelectedId(added[0]!.id);
      if (step === "selecionar") setStep("editar");
    }
  };

  const updateDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const removeDraft = (id: string) => {
    const d = drafts.find((x) => x.id === id);
    if (d) URL.revokeObjectURL(d.url);
    const next = drafts.filter((x) => x.id !== id);
    setDrafts(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? "");
    if (!next.length) setStep("selecionar");
  };

  const moveDraft = (id: string, dir: -1 | 1) =>
    setDrafts((prev) => {
      const i = prev.findIndex((d) => d.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const copy = prev.slice();
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      return copy;
    });

  const toInfo = () => {
    const missing = drafts.find((d) => !d.alt.trim());
    if (missing) {
      setSelectedId(missing.id);
      return setError("Descreva cada foto ou vídeo para pessoas com deficiência visual.");
    }
    setError("");
    setStep("informacoes");
  };

  const validate = () => {
    if (!drafts.length) return "Adicione pelo menos uma foto ou vídeo.";
    if (!title.trim()) return "Dê um título para a obra.";
    if (!category) return "Escolha uma categoria.";
    if (!credits.trim()) return "Informe os créditos da obra.";
    if (!authorized) return "Confirme que você tem autorização para publicar.";
    return "";
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    setError(v);
    if (!v) setConfirm(true);
  };

  const publish = async () => {
    const audioCtx = drafts.some((d) => d.kind === "video") ? unlockAudio() : undefined;
    let muted = false;
    try {
      // 1. Prepara cada item no aparelho (foto otimizada, vídeo comprimido + capa).
      const files: { blob: Blob; ext: string }[] = [];
      const pending: Omit<MediaItem, "src" | "poster">[] = [];
      for (const [i, d] of drafts.entries()) {
        const label = `${i + 1} de ${drafts.length}`;
        if (d.kind === "image") {
          setProgress(`Otimizando foto ${label}…`);
          const out = await renderImage(d.url, d.aspect, d.pos);
          files.push({ blob: out.blob, ext: extFor(out.blob, "webp") });
          pending.push({ id: d.id, kind: "image", width: out.width, height: out.height, alt: d.alt.trim() });
        } else {
          setProgress(`Preparando vídeo ${label}…`);
          const poster = await captureVideoFrame(d.url, d.coverTime);
          const video = await prepareVideo(
            d.file,
            d.duration ?? 0,
            (r) => setProgress(`Preparando vídeo ${label}… ${Math.round(r * 100)}%`),
            { audioCtx, onMuted: () => (muted = true) },
          );
          files.push({ blob: video, ext: extFor(video, "mp4") }, { blob: poster, ext: extFor(poster, "webp") });
          pending.push({ id: d.id, kind: "video", width: d.width, height: d.height, duration: d.duration, alt: d.alt.trim() });
        }
      }
      // 2. Envia tudo; se algo falhar, nada fica pela metade.
      setProgress("Enviando…");
      const uploaded = await uploadAll(files);
      let k = 0;
      const media: MediaItem[] = pending.map((m) => {
        if (m.kind === "image") return { ...m, src: uploaded[k++]!.url };
        const src = uploaded[k++]!.url;
        return { ...m, src, poster: uploaded[k++]!.url };
      });
      // 3. Cria o post no banco.
      setProgress("Publicando…");
      const id = await actions.createPost({
        media,
        title: title.trim(),
        description: description.trim(),
        category: category as Category,
        credits: credits.trim(),
        tags: parseTags(tags),
        region: region.trim() || undefined,
      });
      if (id) {
        toast.success("Publicado no muro!");
        if (muted) toast.warning("Neste aparelho o vídeo foi preparado sem som.");
        navigate({ to: "/post/$id", params: { id } });
      } else {
        void removeUploads(uploaded.map((u) => u.path));
      }
    } catch (e) {
      setError((e as Error).message || "Não foi possível publicar. Tente de novo.");
    } finally {
      setProgress(null);
      void audioCtx?.close().catch(() => {});
    }
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="mx-auto max-w-xl pb-10">
      <PageTitle kicker="mostre seu trampo">Publicar</PageTitle>

      <ol className="mb-5 flex gap-2 px-4 sm:px-0" aria-label="Etapas">
        {STEPS.map((s, i) => (
          <li
            key={s.id}
            aria-current={s.id === step ? "step" : undefined}
            className={cn(
              "flex-1 border-b-4 pb-1 text-center text-xs font-bold uppercase tracking-wide",
              i <= stepIndex ? "border-primary text-foreground" : "border-border text-muted-foreground",
            )}
          >
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>

      <div className="space-y-5 px-4 sm:px-0">
        {step === "selecionar" && <MediaPicker onFiles={addFiles} remaining={remaining} loading={loadingFiles} />}

        {step === "editar" && (
          <>
            <UploadPreview
              drafts={drafts}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChange={updateDraft}
              onRemove={removeDraft}
              onMove={moveDraft}
              onFiles={addFiles}
              remaining={remaining}
              loading={loadingFiles}
            />
            <FieldError>{error}</FieldError>
            <Button type="button" variant="spray" size="lg" className="w-full" onClick={toInfo}>
              Continuar
            </Button>
          </>
        )}

        {step === "informacoes" && (
          <form onSubmit={onSubmit} className="space-y-5">
            <button
              type="button"
              onClick={() => setStep("editar")}
              className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> Voltar para a edição ({drafts.length} {drafts.length === 1 ? "item" : "itens"})
            </button>
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Ex.: Cores do Bairro" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Legenda e contexto</Label>
              <MentionInput multiline id="desc" value={description} onChange={setDescription} maxLength={1000} placeholder="Conte a história da obra, o contexto e a técnica." />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                  <SelectTrigger aria-label="Categoria" className="h-10">
                    <SelectValue placeholder="Escolha" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="credits">Créditos</Label>
                <Input id="credits" value={credits} onChange={(e) => setCredits(e.target.value)} maxLength={100} placeholder="Artista, coletivo, fotógrafo" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Hashtags</Label>
              <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="#mural #quebrada #memória" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Região (opcional)</Label>
              <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} maxLength={40} placeholder="Ex.: Zona Sul — nunca o endereço exato" />
            </div>

            <div className="rounded-lg border border-border bg-card p-4 text-sm">
              <Label className="flex items-start gap-3 font-normal leading-snug">
                <Checkbox checked={authorized} onCheckedChange={(v) => setAuthorized(v === true)} className="mt-0.5" />
                <span>
                  Confirmo que a obra é minha ou tenho autorização do artista e das pessoas que aparecem, e que as fotos e
                  vídeos não revelam endereços residenciais, rotinas ou localização de menores.
                </span>
              </Label>
            </div>

            <FieldError>{error}</FieldError>
            <Button type="submit" variant="spray" size="lg" className="w-full" disabled={!!progress}>
              {progress ? (
                <>
                  <Loader2 className="size-5 animate-spin" /> {progress}
                </>
              ) : (
                "Publicar no muro"
              )}
            </Button>
          </form>
        )}

        {step === "selecionar" && <FieldError>{error}</FieldError>}
        <p className="text-xs text-muted-foreground">
          Suas fotos e vídeos ficam guardados na internet e qualquer pessoa da rede pode ver. Não poste rostos
          sem autorização, endereços ou nada que você não mostraria para a escola inteira.
        </p>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Publicar agora?"
        description={`"${title}" vai aparecer no feed para toda a comunidade.`}
        confirmLabel="Publicar"
        onConfirm={() => void publish()}
      />
    </div>
  );
}
