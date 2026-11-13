import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/vm/AppShell";
import { Logo } from "@/components/vm/Logo";
import { actions, useAuthStatus, useCurrentUser, useHydrated } from "@/lib/store";

export const Route = createFileRoute("/_rede")({
  component: RedeLayout,
});

function RedeLayout() {
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const auth = useAuthStatus();

  if (auth === "erro") {
    return (
      <div className="concrete flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <Logo size="lg" />
        <h1 className="text-3xl">Não conseguimos carregar seu perfil.</h1>
        <p className="max-w-sm text-muted-foreground">Confira sua internet e tente de novo.</p>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <Button variant="spray" size="lg" onClick={() => actions.retryAuth()}>
            Tentar de novo
          </Button>
          <Button variant="sand" size="lg" onClick={() => void actions.signOut()}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  if (!hydrated || auth === "carregando") {
    return (
      <div className="concrete flex min-h-screen items-center justify-center" aria-busy="true">
        <div className="animate-pulse">
          <Logo size="lg" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="concrete flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <Logo size="lg" />
        <h1 className="text-4xl">Entre para ver o muro</h1>
        <p className="max-w-sm text-muted-foreground">
          Crie uma conta ou entre para curtir, comentar, seguir artistas e publicar sua arte.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <Button asChild variant="spray" size="lg">
            <Link to="/entrar">Entrar</Link>
          </Button>
          <Button asChild variant="sand" size="lg">
            <Link to="/cadastro">Criar conta</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
