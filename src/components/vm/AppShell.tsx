import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Bookmark, BookOpen, CalendarDays, Clapperboard, Compass, Home, MessageCircle, Plus, Settings, ShieldCheck, User as UserIcon } from "lucide-react";
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

  const bottomNav = [
    { to: "/feed", label: "Início", icon: Home },
    { to: "/explorar", label: "Explorar", icon: Compass },
    { to: "/publicar", label: "Publicar", icon: Plus, big: true },
    { to: "/reels", label: "Reels", icon: Clapperboard },
    { to: "/mensagens", label: "Mensagens", icon: MessageCircle },
  ] as const;

  const iconLink = "rounded-full p-2 text-foreground transition-colors hover:bg-muted";

  return (
    <div className="concrete min-h-screen pb-28">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-foreground">
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <LogoLink />
          <div className="ml-auto flex items-center gap-0.5">
            <Link to="/cultura" aria-label="Cultura" className={cn(iconLink, isActive("/cultura") && "text-primary")}>
              <BookOpen className="size-5" />
            </Link>
            <Link to="/agenda" aria-label="Agenda" className={cn(iconLink, isActive("/agenda") && "text-primary")}>
              <CalendarDays className="size-5" />
            </Link>
            <Link to="/notificacoes" aria-label={`Notificações${unread ? `, ${unread} novas` : ""}`} className={cn(iconLink, "relative", isActive("/notificacoes") && "text-primary")}>
              <Bell className="size-5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <Link to="/salvos" aria-label="Salvos" className={cn(iconLink, isActive("/salvos") && "text-primary")}>
              <Bookmark className="size-5" />
            </Link>
            {user?.isModerator && (
              <Link to="/moderacao" aria-label="Painel de moderação" className={cn(iconLink, "text-accent")}>
                <ShieldCheck className="size-5" />
              </Link>
            )}
            <Link to="/configuracoes" aria-label="Configurações" className={cn(iconLink, isActive("/configuracoes") && "text-primary")}>
              <Settings className="size-5" />
            </Link>
          </div>
        </div>
      </header>

      <main id="conteudo" className="mx-auto max-w-5xl px-0 sm:px-4">
        {children}
      </main>

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto max-w-lg rounded-2xl border border-accent/40 bg-background/85 shadow-[0_8px_30px_rgba(0,0,0,0.45),3px_3px_0_0_var(--lime)] backdrop-blur-md"
      >
        <ul className="grid grid-cols-6">
          {bottomNav.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={isActive(item.to) ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground sm:text-[11px]",
                  isActive(item.to) && "text-primary",
                )}
              >
                {"big" in item ? (
                  <span className="-mt-6 flex size-12 items-center justify-center rounded-xl border-2 border-background bg-primary text-primary-foreground shadow-[3px_3px_0_0_var(--lime)]">
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
              aria-current={path.startsWith("/u/") ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground sm:text-[11px]",
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
