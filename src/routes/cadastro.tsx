import { createFileRoute, Link } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuthLayout, FieldError } from "@/components/vm/AuthLayout";
import * as Auth from "@/lib/auth";
import { ageOn, isValidUsername, needsRoleChoice, normalizeUsername, validateSignUp, type AccountRole } from "@/lib/logic";

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

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

type UsernameState = "idle" | "checking" | "free" | "taken";

function SignUp() {
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", birthDate: "" });
  const [roleChoice, setRoleChoice] = useState<AccountRole | undefined>();
  const [rules, setRules] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [usernameState, setUsernameState] = useState<UsernameState>("idle");

  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(form.birthDate);
  const showRole = validDate && needsRoleChoice(ageOn(form.birthDate, new Date()));

  useEffect(() => {
    const name = normalizeUsername(form.username);
    if (!isValidUsername(name)) return setUsernameState("idle");
    setUsernameState("checking");
    const t = window.setTimeout(async () => {
      setUsernameState((await Auth.usernameAvailable(name)) ? "free" : "taken");
    }, 400);
    return () => window.clearTimeout(t);
  }, [form.username]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setError("");
    const input = { ...form, roleChoice: showRole ? roleChoice : undefined, acceptedRules: rules };
    const invalid = validateSignUp(input, new Date());
    if (invalid) return setError(invalid);
    if (showRole && !roleChoice) return setError("Escolha se você é professor(a) ou aluno(a).");
    if (usernameState === "taken") return setError("Esse nome de usuário já está em uso.");
    setSending(true);
    const r = await Auth.signUp(input);
    setSending(false);
    if (!r.ok) return setError(r.error);
    setSentTo(form.email.trim().toLowerCase());
  };

  if (sentTo) return <CheckEmail email={sentTo} />;

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
            <Input id="username" required value={form.username} onChange={upd("username")} className="h-12 pl-7" autoCapitalize="none" maxLength={20} aria-describedby="username-hint" />
          </div>
          <p id="username-hint" className="text-xs text-muted-foreground" aria-live="polite">
            {usernameState === "checking" && "Verificando..."}
            {usernameState === "free" && <span className="text-accent">@ disponível</span>}
            {usernameState === "taken" && <span className="text-destructive">Esse nome de usuário já está em uso.</span>}
            {usernameState === "idle" && "Letras minúsculas, números, ponto ou _."}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" required autoComplete="email" value={form.email} onChange={upd("email")} className="h-12" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" required autoComplete="new-password" value={form.password} onChange={upd("password")} className="h-12" minLength={8} />
          <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="birth">Data de nascimento</Label>
          <Input id="birth" type="date" required max={todayIso()} value={form.birthDate} onChange={upd("birthDate")} className="h-12" />
        </div>
        {showRole && (
          <div className="space-y-2">
            <Label htmlFor="role">Você é</Label>
            <Select value={roleChoice ?? ""} onValueChange={(v) => setRoleChoice(v as AccountRole)}>
              <SelectTrigger id="role" className="h-12">
                <SelectValue placeholder="Escolha uma opção" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professor">Professor(a)</SelectItem>
                <SelectItem value="aluno">Aluno(a)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
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
        <Button type="submit" variant="spray" size="lg" className="w-full" disabled={sending}>
          {sending ? "Criando conta..." : "Criar conta"}
        </Button>
      </form>
    </AuthLayout>
  );
}

function CheckEmail({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const resend = async () => {
    setSending(true);
    const r = await Auth.resendConfirmation(email);
    setSending(false);
    if (r.ok) toast.success("E-mail reenviado!");
    else toast.error(r.error);
  };
  return (
    <AuthLayout title="Confira seu e-mail" subtitle="Falta só um passo para entrar no muro.">
      <div className="rounded-lg border border-accent/60 bg-card p-6 text-center">
        <MailCheck className="mx-auto size-10 text-accent" />
        <p className="mt-3">
          Enviamos um link de confirmação para <strong>{email}</strong>.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Abra o e-mail e toque no botão. Se não achar, olhe no spam.</p>
        <Button variant="outline" className="mt-5" onClick={resend} disabled={sending}>
          {sending ? "Reenviando..." : "Reenviar e-mail"}
        </Button>
      </div>
    </AuthLayout>
  );
}
