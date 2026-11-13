import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageTitle } from "@/components/vm/AppShell";
import { FieldError } from "@/components/vm/AuthLayout";
import { REPORT_REASONS } from "@/components/vm/ReportDialog";
import { actions } from "@/lib/store";

export const Route = createFileRoute("/_rede/ajuda")({
  head: () => ({
    meta: [
      { title: "Ajuda e denúncia — Vozes do Muro" },
      { name: "description", content: "Dúvidas frequentes e formulário de denúncia." },
      { property: "og:title", content: "Ajuda e denúncia — Vozes do Muro" },
      { property: "og:description", content: "Precisa de ajuda ou quer denunciar algo?" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Help,
});

const FAQ = [
  { q: "Meus dados vão para a internet?", a: "Sim. Sua conta, suas publicações, fotos, vídeos e comentários ficam guardados na internet e aparecem para as outras pessoas da rede. Seu e-mail e sua data de nascimento ficam escondidos. Ao excluir a conta, tudo isso é apagado." },
  { q: "Posso postar foto de grafite que vi na rua?", a: "Sim, desde que credite o artista e o local seja público. Evite mostrar endereços residenciais ou pessoas sem autorização." },
  { q: "Como bloqueio alguém?", a: "No perfil ou nos três pontinhos da publicação, toque em Bloquear. Você desbloqueia em Configurações." },
  { q: "Quem analisa as denúncias?", a: "Professores e equipe de moderação, pelo painel de moderação." },
];

function Help() {
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]!);
  const [link, setLink] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim()) return setError("Descreva o que aconteceu.");
    const postId = link.match(/post\/([\w-]+)/)?.[1];
    actions.report({
      targetType: postId ? "post" : "user",
      targetId: postId ?? link.trim().replace(/^@/, ""),
      reason,
      details: details.trim(),
    });
    toast.success("Denúncia enviada para a moderação.");
    setLink("");
    setDetails("");
    setError("");
  };

  return (
    <div className="mx-auto max-w-xl space-y-8 px-4 pb-10 sm:px-0">
      <PageTitle kicker="tamo junto">Ajuda</PageTitle>

      <section>
        <h2 className="text-2xl">Dúvidas frequentes</h2>
        <Accordion type="single" collapsible className="mt-3 rounded-lg border border-border bg-card px-4">
          {FAQ.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left font-semibold">{f.q}</AccordionTrigger>
              <AccordionContent className="text-foreground/90">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="mt-3 text-sm">
          Leia também as{" "}
          <Link to="/regras" className="font-bold text-accent underline">
            regras de convivência
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="text-2xl">Formulário de denúncia</h2>
        <form onSubmit={submit} className="mt-3 space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger aria-label="Motivo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="link">Link da publicação ou @usuário (opcional)</Label>
            <Input id="link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="@usuario ou link do post" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="details">O que aconteceu?</Label>
            <Textarea id="details" value={details} onChange={(e) => setDetails(e.target.value)} rows={4} maxLength={800} />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" className="w-full">
            Enviar denúncia
          </Button>
        </form>
      </section>
    </div>
  );
}
