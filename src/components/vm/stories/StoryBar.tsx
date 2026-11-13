import { Plus } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { UserAvatar } from "@/components/vm/UserAvatar";
import { storyGroups, type StoryGroup } from "@/lib/logic";
import { useAppState, useCurrentUser } from "@/lib/store";
import { cn } from "@/lib/utils";
import { StoryComposer } from "./StoryComposer";

const CameraCapture = lazy(() => import("../camera/CameraCapture").then((m) => ({ default: m.CameraCapture })));

const StoryViewer = lazy(() => import("./StoryViewer").then((m) => ({ default: m.StoryViewer })));

/** Fileira de stories no topo do feed: "Seu story", Reels e quem você segue. */
export function StoryBar() {
  const me = useCurrentUser();
  const stories = useAppState((s) => s.stories);
  const follows = useAppState((s) => s.follows);
  const blocks = useAppState((s) => s.blocks);
  const users = useAppState((s) => s.users);
  const groups = useMemo(
    () => (me ? storyGroups({ stories, follows, blocks, users }, me.id) : []),
    [me, stories, follows, blocks, users],
  );
  const [open, setOpen] = useState<{ groups: StoryGroup[]; index: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  if (!me) return null;
  const mineIndex = groups.findIndex((g) => g.user.id === me.id);
  const others = groups.filter((g) => g.user.id !== me.id);

  return (
    <>
      <div className="scrollbar-none flex gap-4 overflow-x-auto px-4 pt-4 sm:px-0" aria-label="Stories">
        <div className="relative w-16 shrink-0">
          <button
            type="button"
            onClick={() => (mineIndex >= 0 ? setOpen({ groups, index: mineIndex }) : setCameraOpen(true))}
            className="flex w-16 flex-col items-center gap-1"
            aria-label={mineIndex >= 0 ? "Ver seu story" : "Criar story"}
          >
            <span className={cn("flex rounded-full p-[5px]", mineIndex >= 0 ? "bg-[image:var(--gradient-spray)]" : "bg-border")}>
              <UserAvatar user={me} size="md" className="size-[52px]" />
            </span>
            <span className="w-full truncate text-center text-[11px] text-muted-foreground">Seu story</span>
          </button>
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            aria-label="Adicionar ao seu story"
            className="absolute right-0 top-11 flex size-5 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground"
          >
            <Plus className="size-3" strokeWidth={3} />
          </button>

        </div>


        {others.map((g) => (
          <button
            key={g.user.id}
            type="button"
            onClick={() => setOpen({ groups, index: groups.indexOf(g) })}
            className="flex w-16 shrink-0 flex-col items-center gap-1"
            aria-label={`Ver story de ${g.user.username}${g.seen ? " (visto)" : ""}`}
          >
            <span className={cn("flex rounded-full p-[5px]", g.seen ? "bg-border" : "bg-[image:var(--gradient-spray)]")}>
              <UserAvatar user={g.user} size="md" className="size-[52px]" />
            </span>
            <span className={cn("w-full truncate text-center text-[11px]", g.seen ? "text-muted-foreground/70" : "text-foreground")}>
              {g.user.username}
            </span>
          </button>
        ))}
      </div>

      {cameraOpen && (
        <Suspense fallback={null}>
        <CameraCapture
          multiple={false}
          onFiles={(files) => {
            setCameraOpen(false);
            setFile(files[0] ?? null);
          }}
          onClose={() => setCameraOpen(false)}
        />
        </Suspense>
      )}
      <StoryComposer file={file} onClose={() => setFile(null)} />
      {open && (
        <Suspense fallback={null}>
          <StoryViewer groups={open.groups} startIndex={open.index} onClose={() => setOpen(null)} />
        </Suspense>
      )}
    </>
  );
}
