import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { actions, useAppState } from "@/lib/store";
import type { User } from "@/lib/types";
import { UserAvatar } from "./UserAvatar";

export function FollowButton({ targetId, size = "sm" }: { targetId: string; size?: "sm" | "default" }) {
  const meId = useAppState((s) => s.sessionUserId);
  const following = useAppState((s) => (meId ? (s.follows[meId] ?? []).includes(targetId) : false));
  if (!meId || meId === targetId) return null;
  return (
    <Button
      size={size}
      variant={following ? "following" : "follow"}
      onClick={() => actions.toggleFollow(targetId)}
      aria-pressed={following}
    >
      {following ? "Seguindo" : "Seguir"}
    </Button>
  );
}

export function ArtistCard({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <Link to="/u/$username" params={{ username: user.username }} className="flex min-w-0 flex-1 items-center gap-3">
        <UserAvatar user={user} size="md" />
        <span className="min-w-0">
          <span className="block truncate font-bold">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            @{user.username}
            {user.styles.length > 0 && ` · ${user.styles.slice(0, 2).join(", ")}`}
          </span>
        </span>
      </Link>
      <FollowButton targetId={user.id} />
    </div>
  );
}
