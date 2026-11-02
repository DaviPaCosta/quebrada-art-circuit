import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageTitle } from "@/components/vm/AppShell";
import { FieldError } from "@/components/vm/AuthLayout";
import { ConfirmDialog } from "@/components/vm/ConfirmDialog";
import { fileToResizedDataUrl } from "@/lib/images";
import { parseTags } from "@/lib/logic";
import { actions, useCurrentUser } from "@/lib/store";
import { CATEGORIES, type Category } from "@/lib/types";

export const Route = createFileRoute("/_rede/publicar")({
  head: () => ({
    meta: [
      { title: "Publicar arte — Vozes do Muro" },
      { name: "description", content: "Compartilhe sua obra com créditos, categoria e etiquetas." },
      { property: "og:title", content: "Publicar arte — Vozes do Muro" },
      { property: "og:description", content: "Envie sua arte para a comunidade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Publish,
});

function Publish() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [loadingImg, setLoadingImg] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [credits, setCredits] = useState(user?.name ?? "");
  const [tags, setTags] = useState("");
  const [alt, setAlt] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Escolha um arquivo de imagem.");
    setError("");
    setLoadingImg(true);
    try {
      setImage(await fileToResizedDataUrl(file));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingImg(false);
    }
  };

  const validate = () => {
    if (!image) return "Adicione uma imagem da obra.";
    if (!title.trim()) return "Dê um título para a obra.";
    if (!category) return "Escolha uma categoria.";
    if (!alt.trim()) return "Descreva a imagem para pessoas com deficiência visual.";
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

  const publish = () => {
    const id = actions.createPost({
      image: image!,
      alt: alt.trim(),
      title: title.trim(),
      description: description.trim(),
      category: category as Category,
      credits: credits.trim(),
      tags: parseTags(tags),
    });
    if (id) {
      toast.success("Arte publicada no muro!");
      navigate({ to: "/post/$id", params: { id } });
    }
  };

  return (
    <div className="mx-auto max-w-xl pb-10">
      <PageTitle kicker="mostre seu trampo">Publicar</PageTitle>
      <form onSubmit={onSubmit} className="space-y-5 px-4 sm:px-0">
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" id="image" onChange={(e) => onFile(e.target.files?.[0])} />
        {image ? (
          <div className="relative overflow-hidden rounded-lg border border-border">
            <img src={image} alt={alt || "Prévia da obra"} className="max-h-[60vh] w-full object-contain bg-muted" />
            <button type="button" onClick={() => setImage(null)} aria-label="Remover imagem" className="absolute right-2 top-2 rounded-full bg-background/80 p-2 hover:bg-background">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <label
            htmlFor="image"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFile(e.dataTransfer.files?.[0]);
            }}
            className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-card text-center hover:border-primary"
          >
            {loadingImg ? <Loader2 className="size-10 animate-spin text-primary" /> : <ImagePlus className="size-12 text-primary" />}
            <span className="font-display text-2xl uppercase">Enviar imagem</span>
            <span className="text-sm text-muted-foreground">Toque para escolher ou arraste aqui</span>
          </label>
        )}

        <div className="space-y-2">
          <Label htmlFor="title">Título</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Ex.: Cores do Bairro" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">Descrição</Label>
          <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={4} placeholder="Conte a história da obra, o contexto e a técnica." />
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
          <Label htmlFor="tags">Etiquetas</Label>
          <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="#mural #quebrada #memória" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="alt">Descrição da imagem (acessibilidade)</Label>
          <Textarea id="alt" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} rows={2} placeholder="Descreva o que aparece na imagem" />
        </div>

        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <Label className="flex items-start gap-3 font-normal leading-snug">
            <Checkbox checked={authorized} onCheckedChange={(v) => setAuthorized(v === true)} className="mt-0.5" />
            <span>
              Confirmo que a obra é minha ou tenho autorização do artista e das pessoas que aparecem, e que a imagem
              não revela endereços residenciais, rotinas ou localização de menores.
            </span>
          </Label>
        </div>

        <FieldError>{error}</FieldError>
        <Button type="submit" variant="spray" size="lg" className="w-full">
          Publicar no muro
        </Button>
      </form>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Publicar agora?"
        description={`"${title}" vai aparecer no feed para toda a comunidade.`}
        confirmLabel="Publicar"
        onConfirm={publish}
      />
    </div>
  );
}
