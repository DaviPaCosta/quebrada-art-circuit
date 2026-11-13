import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout, FieldError } from "@/components/vm/AuthLayout";
import * as Auth from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/nova-senha")({
  head: () => ({ meta: [{ title: "Nova senha — Vozes do Muro" }] }),
  component: NewPassword,
});

function NewPassword() {
  const navigate = useNavigate();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return setHasSession(false);
    const supabase = getSupabase();
    // O link do e-mail cria uma sessão de recuperação; damos um tempo para ela chegar.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setHasSession(true);
    });
    const otp = Auth.otpFromUrl(window.location.search);
    if (otp?.type === "recovery") {
      // Link com token: funciona mesmo abrindo o e-mail em outro aparelho.
      void Auth.verifyEmailLink(otp).then((r) => setHasSession(r.ok));
    } else {
      void supabase.auth.getSession().then(({ data: d }) => {
        if (d.session) setHasSession(true);
      });
    }
    const t = window.setTimeout(() => setHasSession((v) => v ?? false), 5000);
    return () => {
      data.subscription.unsubscribe();
      window.clearTimeout(t);
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError("");
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não são iguais.");
    setSaving(true);
    const r = await Auth.updatePassword(password);
    setSaving(false);
    if (!r.ok) return setError(r.error);
    toast.success("Senha alterada!");
    navigate({ to: "/feed" });
  };

  if (hasSession === false) {
    return (
      <AuthLayout title="Link expirado" subtitle="O link expirou. Peça um novo.">
        <Button asChild variant="spray" size="lg" className="w-full">
          <Link to="/recuperar-senha">Pedir novo link</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Nova senha" subtitle="Escolha uma senha nova para sua conta.">
      {hasSession === null ? (
        <p className="text-muted-foreground" aria-busy="true">
          Abrindo o link...
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pw">Nova senha</Label>
            <Input id="pw" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw2">Repita a nova senha</Label>
            <Input id="pw2" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-12" />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" variant="spray" size="lg" className="w-full" disabled={saving}>
            {saving ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
