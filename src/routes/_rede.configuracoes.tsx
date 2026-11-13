import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, HelpCircle, LogOut, ShieldCheck, Trash2, UserPen } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { PageTitle } from "@/components/vm/AppShell";
import { ConfirmDialog } from "@/components/vm/ConfirmDialog";
import { UserAvatar } from "@/components/vm/UserAvatar";
import { actions, useAppState, useCurrentUser } from "@/lib/store";

export const Route = createFileRoute("/_rede/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Vozes do Muro" },
      { name: "description", content: "Acessibilidade, privacidade, bloqueios e conta." },
      { property: "og:title", content: "Configurações — Vozes do Muro" },
      { property: "og:description", content: "Ajuste o app do seu jeito." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl">{title}</h2>
      <div className="divide-y divide-border rounded-lg border border-border bg-card">{children}</div>
    </section>
  );
}

function SettingsPage() {
  const navigate = useNavigate();
  const me = useCurrentUser()!;
  const settings = useAppState((s) => s.settings);
  const blockedUsers = useAppState((s) => s.users.filter((u) => (s.blocks[me.id] ?? []).includes(u.id)));
  const [confirm, setConfirm] = useState<"sair" | "excluir" | null>(null);

  return (
    <div className="mx-auto max-w-xl space-y-8 px-4 pb-10 sm:px-0">
      <PageTitle>Configurações</PageTitle>

      <Section title="Conta">
        <Link to="/editar-perfil" className="flex items-center gap-3 p-4 hover:bg-muted">
          <UserAvatar user={me} size="sm" />
          <span className="flex-1">
            <span className="block font-bold">{me.name}</span>
            <span className="text-xs text-muted-foreground">{me.email}</span>
          </span>
          <UserPen className="size-4 text-muted-foreground" />
        </Link>
        {me.isModerator && (
          <Link to="/moderacao" className="flex items-center gap-3 p-4 hover:bg-muted">
            <ShieldCheck className="size-5 text-accent" />
            <span className="flex-1 font-semibold">Painel de moderação</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        )}
      </Section>

      <Section title="Acessibilidade">
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="font">Tamanho do texto</Label>
            <span className="text-sm font-bold">{settings.fontSize}px</span>
          </div>
          <Slider id="font" min={14} max={22} step={1} value={[settings.fontSize]} onValueChange={([v]) => v !== undefined && actions.updateSettings({ fontSize: v })} aria-label="Tamanho do texto" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>A</span>
            <span className="text-lg">A</span>
          </div>
        </div>
        <Label className="flex items-center justify-between gap-4 p-4 font-normal">
          <span>
            <span className="block font-semibold">Alto contraste</span>
            <span className="text-xs text-muted-foreground">Cores mais fortes para facilitar a leitura</span>
          </span>
          <Switch checked={settings.highContrast} onCheckedChange={(v) => actions.updateSettings({ highContrast: v })} />
        </Label>
        <Label className="flex items-center justify-between gap-4 p-4 font-normal">
          <span>
            <span className="block font-semibold">Reduzir animações</span>
            <span className="text-xs text-muted-foreground">Desliga efeitos de movimento</span>
          </span>
          <Switch checked={settings.reduceMotion} onCheckedChange={(v) => actions.updateSettings({ reduceMotion: v })} />
        </Label>
      </Section>

      <Section title="Privacidade">
        <Label className="flex items-center justify-between gap-4 p-4 font-normal">
          <span>
            <span className="block font-semibold">Mostrar bairro/cidade</span>
            <span className="text-xs text-muted-foreground">Exibe sua região no perfil</span>
          </span>
          <Switch checked={me.showBairro} onCheckedChange={async (v) => {
            const r = await actions.updateProfile({ showBairro: v });
            if (!r.ok) toast.error(r.error);
          }} />
        </Label>
        <div className="p-4">
          <p className="font-semibold">Perfis bloqueados</p>
          {blockedUsers.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Você não bloqueou ninguém.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {blockedUsers.map((u) => (
                <li key={u.id} className="flex items-center gap-3">
                  <UserAvatar user={u} size="sm" />
                  <span className="flex-1 text-sm">@{u.username}</span>
                  <Button size="sm" variant="following" onClick={() => actions.toggleBlock(u.id)}>
                    Desbloquear
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section title="Ajuda">
        <Link to="/ajuda" className="flex items-center gap-3 p-4 hover:bg-muted">
          <HelpCircle className="size-5" />
          <span className="flex-1 font-semibold">Ajuda e denúncia</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
        <Link to="/regras" className="flex items-center gap-3 p-4 hover:bg-muted">
          <ShieldCheck className="size-5" />
          <span className="flex-1 font-semibold">Regras de convivência</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </Section>

      <div className="space-y-3">
        <Button variant="following" size="lg" className="w-full" onClick={() => setConfirm("sair")}>
          <LogOut /> Sair
        </Button>
        <Button variant="ghost" size="lg" className="w-full text-destructive hover:text-destructive" onClick={() => setConfirm("excluir")}>
          <Trash2 /> Excluir conta
        </Button>
      </div>

      <ConfirmDialog
        open={confirm === "sair"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Sair da conta?"
        description="Você pode entrar de novo quando quiser."
        confirmLabel="Sair"
        onConfirm={async () => {
          await actions.signOut();
          navigate({ to: "/" });
        }}
      />
      <ConfirmDialog
        open={confirm === "excluir"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Excluir conta?"
        description="Seu perfil, publicações, comentários e curtidas serão apagados deste aparelho. Essa ação não pode ser desfeita."
        confirmLabel="Excluir para sempre"
        destructive
        onConfirm={() => {
          actions.deleteAccount();
          toast.success("Conta excluída");
          navigate({ to: "/" });
        }}
      />
    </div>
  );
}
