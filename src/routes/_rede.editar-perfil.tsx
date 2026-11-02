import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageTitle } from "@/components/vm/AppShell";
import { FieldError } from "@/components/vm/AuthLayout";
import { UserAvatar } from "@/components/vm/UserAvatar";
import { fileToResizedDataUrl } from "@/lib/images";
import { actions, useCurrentUser } from "@/lib/store";
import { CATEGORIES, type Category } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_rede/editar-perfil")({
  head: () => ({
    meta: [
      { title: "Editar perfil — Vozes do Muro" },
      { name: "description", content: "Atualize foto, biografia e estilos de arte." },
      { property: "og:title", content: "Editar perfil — Vozes do Muro" },
      { property: "og:description", content: "Personalize seu perfil de artista." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditProfile,
});

function EditProfile() {
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: user.name,
    username: user.username,
    bio: user.bio,
    bairro: user.bairro,
    showBairro: user.showBairro,
    styles: user.styles,
    avatar: user.avatar,
  });
  const [error, setError] = useState("");

  const toggleStyle = (c: Category) =>
    setForm((f) => ({ ...f, styles: f.styles.includes(c) ? f.styles.filter((s) => s !== c) : [...f.styles, c] }));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Informe seu nome.");
    const r = actions.updateProfile({ ...form, name: form.name.trim(), bio: form.bio.trim(), bairro: form.bairro.trim() });
    if (!r.ok) return setError(r.error);
    toast.success("Perfil atualizado");
    navigate({ to: "/u/$username", params: { username: form.username.trim().toLowerCase().replace(/^@/, "") } });
  };

  return (
    <div className="mx-auto max-w-xl pb-10">
      <PageTitle>Editar perfil</PageTitle>
      <form onSubmit={save} className="space-y-5 px-4 sm:px-0">
        <div className="flex items-center gap-4">
          <UserAvatar user={{ ...user, avatar: form.avatar, name: form.name || user.name }} size="lg" />
          <div className="flex flex-col gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-primary hover:underline">
              <Camera className="size-4" /> Trocar foto
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const url = await fileToResizedDataUrl(f, 320, 0.85);
                    setForm((s) => ({ ...s, avatar: url }));
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
              />
            </label>
            {form.avatar && (
              <button type="button" onClick={() => setForm((s) => ({ ...s, avatar: undefined }))} className="text-left text-xs text-muted-foreground hover:text-foreground">
                Remover foto
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Nome / apelido</Label>
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={40} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Usuário</Label>
          <Input id="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} maxLength={20} autoCapitalize="none" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">Biografia</Label>
          <Textarea id="bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={200} rows={3} />
          <p className="text-right text-xs text-muted-foreground">{form.bio.length}/200</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bairro">Bairro ou cidade (opcional)</Label>
          <Input id="bairro" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} maxLength={40} placeholder="Ex.: Zona Leste, SP" />
          <p className="text-xs text-muted-foreground">Nunca coloque endereço, nome de escola ou rua.</p>
        </div>
        <Label className="flex items-center justify-between rounded-lg border border-border bg-card p-4 font-normal">
          <span>Mostrar bairro/cidade no perfil</span>
          <Switch checked={form.showBairro} onCheckedChange={(v) => setForm({ ...form, showBairro: v })} />
        </Label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Estilos de arte</legend>
          <div className="flex flex-wrap gap-2 pt-1">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c}
                aria-pressed={form.styles.includes(c)}
                onClick={() => toggleStyle(c)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-semibold",
                  form.styles.includes(c) ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>
        <FieldError>{error}</FieldError>
        <div className="flex gap-3">
          <Button type="button" variant="following" className="flex-1" onClick={() => navigate({ to: "/u/$username", params: { username: user.username } })}>
            Cancelar
          </Button>
          <Button type="submit" variant="spray" className="flex-1">
            Salvar
          </Button>
        </div>
      </form>
    </div>
  );
}
