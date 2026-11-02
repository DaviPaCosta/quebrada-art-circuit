import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout, FieldError } from "@/components/vm/AuthLayout";
import { actions } from "@/lib/store";
import { DEMO_LOGIN } from "@/lib/mock-data";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — Vozes do Muro" },
      { name: "description", content: "Entre na sua conta do Vozes do Muro." },
      { property: "og:title", content: "Entrar — Vozes do Muro" },
      { property: "og:description", content: "Acesse a rede de artes periféricas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    window.setTimeout(() => {
      const r = actions.signIn(identifier, password);
      setLoading(false);
      if (!r.ok) return setError(r.error);
      toast.success("Bem-vinde de volta!");
      navigate({ to: "/feed" });
    }, 350);
  };

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Bom te ver de novo na quebrada digital."
      footer={
        <>
          Não tem conta?{" "}
          <Link to="/cadastro" className="font-bold text-primary hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="id">E-mail ou usuário</Label>
          <Input id="id" autoComplete="username" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="h-12" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="pw">Senha</Label>
            <Link to="/recuperar-senha" className="text-xs font-semibold text-accent hover:underline">
              Esqueci a senha
            </Link>
          </div>
          <div className="relative">
            <Input id="pw" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 pr-12" />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar senha" : "Mostrar senha"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-2 text-muted-foreground hover:text-foreground">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" variant="spray" size="lg" className="w-full" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>

      <div className="mt-8 rounded-lg border border-dashed border-accent/60 bg-card p-4 text-sm">
        <p className="font-marker text-accent">Conta de demonstração</p>
        <p className="mt-1 text-muted-foreground">
          Professora/moderadora: <strong className="text-foreground">{DEMO_LOGIN.email}</strong> · senha{" "}
          <strong className="text-foreground">{DEMO_LOGIN.password}</strong>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => {
            setIdentifier(DEMO_LOGIN.email);
            setPassword(DEMO_LOGIN.password);
          }}
        >
          Preencher dados de demonstração
        </Button>
      </div>
    </AuthLayout>
  );
}
