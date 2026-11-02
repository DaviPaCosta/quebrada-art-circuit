import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout, FieldError } from "@/components/vm/AuthLayout";
import { actions } from "@/lib/store";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — Vozes do Muro" },
      { name: "description", content: "Crie sua conta e compartilhe sua arte periférica." },
      { property: "og:title", content: "Criar conta — Vozes do Muro" },
      { property: "og:description", content: "Junte-se à rede de grafite, rap, poesia e cultura urbana." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignUp,
});

function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "" });
  const [rules, setRules] = useState(false);
  const [error, setError] = useState("");

  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!rules) return setError("Você precisa aceitar as regras de convivência.");
    const r = actions.signUp(form);
    if (!r.ok) return setError(r.error);
    toast.success("Conta criada! Complete seu perfil quando quiser.");
    navigate({ to: "/feed" });
  };

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Mostre sua arte e conheça artistas de todas as quebradas."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/entrar" className="font-bold text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome de exibição</Label>
          <Input id="name" required value={form.name} onChange={upd("name")} className="h-12" maxLength={40} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Usuário</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
            <Input id="username" required value={form.username} onChange={upd("username")} className="h-12 pl-7" autoCapitalize="none" maxLength={20} />
          </div>
          <p className="text-xs text-muted-foreground">Letras minúsculas, números, ponto ou _.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" required autoComplete="email" value={form.email} onChange={upd("email")} className="h-12" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" required autoComplete="new-password" value={form.password} onChange={upd("password")} className="h-12" minLength={6} />
          <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres. Não use uma senha real: é um protótipo.</p>
        </div>
        <Label className="flex items-start gap-3 font-normal leading-snug">
          <Checkbox checked={rules} onCheckedChange={(v) => setRules(v === true)} className="mt-0.5" />
          <span>
            Li e aceito as{" "}
            <Link to="/regras" className="font-semibold text-accent underline">
              regras de convivência
            </Link>
            : sem racismo, preconceito, assédio ou incentivo a dano ao patrimônio.
          </span>
        </Label>
        <FieldError>{error}</FieldError>
        <Button type="submit" variant="spray" size="lg" className="w-full">
          Criar conta
        </Button>
      </form>
    </AuthLayout>
  );
}
