import { createFileRoute, Link } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/vm/AuthLayout";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({
    meta: [
      { title: "Recuperar acesso — Vozes do Muro" },
      { name: "description", content: "Recupere o acesso à sua conta do Vozes do Muro." },
      { property: "og:title", content: "Recuperar acesso — Vozes do Muro" },
      { property: "og:description", content: "Esqueceu a senha? Recupere seu acesso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Recover,
});

function Recover() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <AuthLayout title="Recuperar acesso" subtitle="Informe o e-mail da sua conta.">
      {sent ? (
        <div className="rounded-lg border border-accent/60 bg-card p-6 text-center">
          <MailCheck className="mx-auto size-10 text-accent" />
          <p className="mt-3 font-bold">Pedido recebido!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Se existir uma conta com <strong>{email}</strong>, enviaríamos um link de recuperação. Como este é um
            protótipo escolar, nenhum e-mail real é enviado — use a conta de demonstração na tela de login.
          </p>
          <Button asChild variant="spray" className="mt-5">
            <Link to="/entrar">Voltar para o login</Link>
          </Button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
          </div>
          <Button type="submit" variant="spray" size="lg" className="w-full">
            Enviar link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
