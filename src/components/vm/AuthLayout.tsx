import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="concrete min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-6">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="Voltar" className="rounded-full p-2 hover:bg-muted">
            <ArrowLeft className="size-5" />
          </Link>
          <Logo />
          <span className="w-9" />
        </div>
        <div className="mt-10">
          <h1 className="text-5xl">{title}</h1>
          {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-auto pt-8 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}
