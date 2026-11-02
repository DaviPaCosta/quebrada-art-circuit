import { cn } from "@/lib/utils";
import { CATEGORIES, type Category } from "@/lib/types";

export function CategoryChips({
  value,
  onChange,
  allLabel = "Tudo",
}: {
  value: Category | null;
  onChange: (c: Category | null) => void;
  allLabel?: string;
}) {
  const items: (Category | null)[] = [null, ...CATEGORIES];
  return (
    <div role="radiogroup" aria-label="Filtrar por categoria" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {items.map((c) => {
        const active = value === c;
        return (
          <button
            key={c ?? "all"}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(c)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
              active
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {c ?? allLabel}
          </button>
        );
      })}
    </div>
  );
}

export function CategoryTag({ category }: { category: Category }) {
  return (
    <span className="tape text-xs">{category}</span>
  );
}
