import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/vm/AuthLayout";
import * as Auth from "@/lib/auth";
import { useAuthStatus, useCurrentUser } from "@/lib/store";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Confirmando conta — Vozes do Muro" }] }),
  component: AuthCallback,
});

/** Destino do link de confirmação do e-mail. O cliente Supabase troca o código da URL pela sessão. */
function AuthCallback() {
  const navigate = useNavigate();
  const me = useCurrentUser();
  const status = useAuthStatus();
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search + window.location.hash.replace("#", "&"));
    if (params.get("error_description") || params.get("error")) return setExpired(true);
    // Link com token (template do e-mail): confirma aqui mesmo, em qualquer aparelho.
    const otp = Auth.otpFromUrl(window.location.search);
    if (otp) {
      void Auth.verifyEmailLink(otp).then((r) => {
        if (!r.ok) setExpired(true);
      });
    }
    const t = window.setTimeout(() => setExpired(true), 10000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (me && status === "pronto") void navigate({ to: "/feed" });
  }, [me, status, navigate]);

  if (status === "erro") {
    return (
      <AuthLayout title="Conta confirmada" subtitle="Não conseguimos carregar seu perfil.">
        <Button asChild variant="spray" size="lg" className="w-full">
          <Link to="/feed">Tentar de novo</Link>
        </Button>
      </AuthLayout>
    );
  }

  if (expired && !me) {
    return (
      <AuthLayout title="Link expirado" subtitle="O link expirou. Peça um novo.">
        <p className="text-muted-foreground">Entre com seu e-mail e senha: se a conta ainda não foi confirmada, você pode pedir outro e-mail.</p>
        <Button asChild variant="spray" size="lg" className="mt-6 w-full">
          <Link to="/entrar">Ir para o login</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Quase lá" subtitle="Confirmando sua conta...">
      <p className="animate-pulse text-muted-foreground" aria-busy="true">
        Só um instante.
      </p>
    </AuthLayout>
  );
}
