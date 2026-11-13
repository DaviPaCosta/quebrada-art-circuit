import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseTags } from "@/lib/logic";
import { actions } from "@/lib/store";
import type { Post } from "@/lib/types";
import { FieldError } from "./AuthLayout";

/** Editar título, descrição e hashtags do próprio post. */
export function EditPostDialog({ post, open, onOpenChange }: { post: Post; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [title, setTitle] = useState(post.title);
  const [description, setDescription] = useState(post.description);
  const [tags, setTags] = useState(post.tags.map((t) => `#${t}`).join(" "));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(post.title);
    setDescription(post.description);
    setTags(post.tags.map((t) => `#${t}`).join(" "));
    setError("");
  }, [open, post]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const r = await actions.editPostText(post.id, { title, description, tags: parseTags(tags) });
    setSaving(false);
    if (!r.ok) return setError(r.error);
    toast.success("Legenda atualizada");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">Editar legenda</DialogTitle>
          <DialogDescription>A foto ou o vídeo continuam os mesmos.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Título</Label>
            <Input id="edit-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-desc">Descrição</Label>
            <Textarea id="edit-desc" value={description} maxLength={2000} rows={4} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-tags">Hashtags</Label>
            <Input id="edit-tags" value={tags} placeholder="#grafite #quebrada" onChange={(e) => setTags(e.target.value)} />
          </div>
          <FieldError>{error}</FieldError>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" variant="spray" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
