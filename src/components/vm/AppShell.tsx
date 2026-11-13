import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Bookmark, BookOpen, CalendarDays, Clapperboard, Compass, Home, PlusSquare, Search, Settings, ShieldCheck, User as UserIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAppState, useCurrentUser } from "@/lib/store";
import { LogoLink } from "./Logo";
import { UserAvatar } from "./UserAvatar";

function useUnread() {
  return useAppState((s) => s.notifications.filter((n) => n.userId === s.sessionUserId && !n.read).length);
}

export function AppShell({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const unread = useUnread();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const profilePath = user ? `/u/${user.username}` : "/entrar";

  const isActive = (to: string) => (to === "/feed" ? path === "/feed" : path.startsWith(to));

  const desktopNav = [
    { to: "/feed", label: "Início", icon: Home },
    { to: "/explorar", label: "Explorar", icon: Compass },
    { to: "/reels", label: "Reels", icon: Clapperboard },
    { to: "/cultura", label: "Cultura", icon: BookOpen },
    { to: "/agenda", label: "Agenda", icon: CalendarDays },
  ] as const;

  return (
    <div className="concrete min-h-screen pb-20 md:pb-0">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-foreground">
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <LogoLink />
          <nav aria-label="Menu principal" className="ml-6 hidden items-center gap-1 md:flex">
            {desktopNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground",
                  isActive(item.to) && "text-primary",
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link
              to={profilePath}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground",
                path.startsWith("/u/") && "text-primary",
              )}
            >
              Perfil
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Link to="/explorar" aria-label="Buscar" className="rounded-full p-2 text-foreground hover:bg-muted md:hidden">
              <Search className="size-5" />
            </Link>
            <Link to="/cultura" aria-label="Cultura" className="rounded-full p-2 text-foreground hover:bg-muted md:hidden">
              <BookOpen className="size-5" />
            </Link>
            <Link to="/publicar" className="hidden items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 md:inline-flex">
              <PlusSquare className="size-4" /> Publicar
            </Link>
            <Link to="/notificacoes" aria-label={`Notificações${unread ? `, ${unread} novas` : ""}`} className="relative rounded-full p-2 hover:bg-muted">
              <Bell className="size-5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <Link to="/salvos" aria-label="Salvos" className="rounded-full p-2 hover:bg-muted">
              <Bookmark className="size-5" />
            </Link>
            {user?.isModerator && (
              <Link to="/moderacao" aria-label="Painel de moderação" className="rounded-full p-2 text-accent hover:bg-muted">
                <ShieldCheck className="size-5" />
              </Link>
            )}
            <Link to="/configuracoes" aria-label="Configurações" className="hidden rounded-full p-2 hover:bg-muted md:inline-flex">
              <Settings className="size-5" />
            </Link>
            <Link to={profilePath} aria-label="Meu perfil" className="ml-1 hidden md:inline-flex">
              <UserAvatar user={user} size="sm" />
            </Link>
          </div>
        </div>
      </header>

      <main id="conteudo" className="mx-auto max-w-5xl px-0 sm:px-4">
        {children}
      </main>

      <nav aria-label="Navegação" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {[
            { to: "/feed", label: "Início", icon: Home },
            { to: "/explorar", label: "Explorar", icon: Compass },
            { to: "/publicar", label: "Publicar", icon: PlusSquare, big: true },
            { to: "/reels", label: "Reels", icon: Clapperboard },
          ].map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-muted-foreground",
                  isActive(item.to) && "text-primary",
                )}
              >
                {item.big ? (
                  <span className="-mt-5 flex size-12 items-center justify-center rounded-xl border-2 border-background bg-primary text-primary-foreground shadow-[3px_3px_0_0_var(--lime)]">
                    <item.icon className="size-6" />
                  </span>
                ) : (
                  <item.icon className="size-6" />
                )}
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              to={profilePath}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-muted-foreground",
                (path.startsWith("/u/") || path.startsWith("/editar")) && "text-primary",
              )}
            >
              {user ? <UserAvatar user={user} size="xs" className="size-6" /> : <UserIcon className="size-6" />}
              Perfil
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export function PageTitle({ children, kicker, action }: { children: ReactNode; kicker?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 px-4 pb-4 pt-6 sm:px-0">
      <div>
        {kicker && <p className="font-marker text-sm text-accent">{kicker}</p>}
        <h1 className="text-4xl text-foreground sm:text-5xl">{children}</h1>
      </div>
      {action}
    </div>
  );
}
