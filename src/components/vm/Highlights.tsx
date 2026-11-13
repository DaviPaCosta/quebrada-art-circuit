import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { postCover } from "@/lib/logic";
import type { Post, User } from "@/lib/types";
import { MediaImage } from "./media/MediaImage";

/** Faixa "Destaques" no topo do feed: posts recentes de professores, roláveis na horizontal. */
export function Highlights({ posts, users }: { posts: Post[]; users: User[] }) {
  if (posts.length === 0) return null;
  const byId = new Map(users.map((u) => [u.id, u]));
  return (
    <section aria-labelledby="destaques-titulo" className="mt-3 px-4 sm:px-0">
      <h2 id="destaques-titulo" className="flex items-center gap-2 font-display text-lg uppercase tracking-wide">
        <Star className="size-4 fill-accent text-accent" aria-hidden />
        Destaques
      </h2>
      <ul className="-mx-4 mt-2 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {posts.map((p) => {
          const cover = postCover(p);
          const author = byId.get(p.authorId);
          return (
            <li key={p.id} className="w-36 shrink-0 snap-start">
              <Link to="/post/$id" params={{ id: p.id }} className="group block">
                <div className="aspect-[4/5] overflow-hidden rounded-lg border-2 border-accent/60 bg-muted shadow-[3px_3px_0_0_var(--lime)]">
                  <MediaImage
                    src={cover.src}
                    alt={cover.alt}
                    width={cover.width}
                    height={cover.height}
                    sizes="144px"
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <p className="mt-1.5 line-clamp-1 text-sm font-bold">{p.title}</p>
                {author && <p className="line-clamp-1 text-xs text-muted-foreground">@{author.username}</p>}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
