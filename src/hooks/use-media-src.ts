import { useCallback, useEffect, useState } from "react";
import { resolveSeed, type ResolvedSource } from "@/lib/images";
import { signedChatUrl } from "@/lib/api/chat";
import { getMediaUrl } from "@/lib/media-db";

type State =
  | { status: "ready"; source: ResolvedSource }
  | { status: "loading"; source?: undefined }
  | { status: "error"; source?: undefined };

function syncResolve(src: string | undefined): State | null {
  if (!src) return { status: "error" };
  if (src.startsWith("seed:")) {
    const r = resolveSeed(src.slice(5));
    return r ? { status: "ready", source: r } : { status: "error" };
  }
  if (src.startsWith("idb:") || src.startsWith("chat:")) return null;
  return { status: "ready", source: { src } };
}

/** Transforma "seed:", "idb:", "chat:" (mídia privada de conversa) ou data URL em um endereço que o navegador consegue exibir. */
export function useMediaSrc(src: string | undefined) {
  const initial = syncResolve(src);
  const [state, setState] = useState<State>(initial ?? { status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const sync = syncResolve(src);
    if (sync) {
      setState(sync);
      return;
    }
    let alive = true;
    setState({ status: "loading" });
    (src!.startsWith("chat:") ? signedChatUrl(src!.slice(5)) : getMediaUrl(src!))
      .then((url) => alive && setState({ status: "ready", source: { src: url } }))
      .catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [src, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { ...state, retry };
}
