import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className, size = "md" }: { className?: string; size?: "md" | "lg" | "xl" }) {
  const text = size === "xl" ? "text-6xl" : size === "lg" ? "text-4xl" : "text-2xl";
  return (
    <span className={cn("inline-flex items-baseline gap-1 font-display uppercase leading-none", text, className)}>
      <span className="text-foreground">Vozes</span>
      <span className="font-marker text-[0.6em] normal-case text-accent -rotate-6 inline-block">do</span>
      <span className="text-primary drip">Muro</span>
    </span>
  );
}

export function LogoLink() {
  return (
    <Link to="/feed" aria-label="Vozes do Muro — início" className="shrink-0">
      <Logo />
    </Link>
  );
}
