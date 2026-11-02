import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

const COLOR: Record<User["color"], string> = {
  spray: "bg-primary text-primary-foreground",
  violet: "bg-secondary text-secondary-foreground",
  lime: "bg-accent text-accent-foreground",
  sand: "bg-foreground text-background",
};

const SIZE = {
  xs: "size-6 text-[10px]",
  sm: "size-9 text-sm",
  md: "size-11 text-base",
  lg: "size-20 text-3xl",
  xl: "size-28 text-4xl",
};

export function UserAvatar({
  user,
  size = "sm",
  className,
}: {
  user: Pick<User, "name" | "avatar" | "color"> | null | undefined;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const initials = (user?.name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display ring-2 ring-background",
        SIZE[size],
        user ? COLOR[user.color] : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {user?.avatar ? (
        <img src={user.avatar} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </span>
  );
}
