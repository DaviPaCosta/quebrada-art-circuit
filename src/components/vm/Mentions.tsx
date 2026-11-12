import { Link } from "@tanstack/react-router";
import { forwardRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isBlockedBetween } from "@/lib/logic";
import { useAppState } from "@/lib/store";
import { UserAvatar } from "./UserAvatar";

export function MentionText({ text }: { text: string }) {
  const state = useAppState((s) => s);
  return <>{text.split(/((?<![a-z0-9._@])@[a-z0-9._]{3,20}(?![a-z0-9._]))/gi).map((part, i) => {
    const user = part.startsWith("@") ? state.users.find((u) => u.username === part.slice(1).toLowerCase()) : undefined;
    if (!user || (state.sessionUserId && isBlockedBetween(state, state.sessionUserId, user.id))) return part;
    return <Link key={i} to="/u/$username" params={{ username: user.username }} className="font-semibold text-accent hover:underline">{part}</Link>;
  })}</>;
}

type Props = { value: string; onChange: (value: string) => void; id?: string; placeholder?: string; "aria-label"?: string; maxLength?: number; multiline?: boolean; className?: string };
export const MentionInput = forwardRef<HTMLInputElement, Props>(function MentionInput({ value, onChange, multiline, ...props }, ref) {
  const state = useAppState((s) => s);
  const [cursor, setCursor] = useState(value.length);
  const [focused, setFocused] = useState(false);
  const match = value.slice(0, cursor).match(/(?:^|\s)@([a-z0-9._]*)$/i);
  const candidates = match ? state.users.filter((u) => u.username.startsWith((match[1] ?? "").toLowerCase()) && u.id !== state.sessionUserId && (!state.sessionUserId || !isBlockedBetween(state, state.sessionUserId, u.id))).slice(0, 5) : [];
  const common = { ...props, value, onFocus: () => setFocused(true), onBlur: () => setFocused(false), onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { onChange(e.target.value); setCursor(e.target.selectionStart ?? e.target.value.length); }, onSelect: (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => setCursor(e.currentTarget.selectionStart ?? value.length) };
  return <div className="relative min-w-0 flex-1">
    {multiline ? <Textarea {...common} rows={4} /> : <Input {...common} ref={ref} />}
    {focused && candidates.length > 0 && <div aria-label="Contas para mencionar" className="absolute bottom-full left-0 z-30 mb-2 max-h-60 w-full min-w-48 overflow-y-auto rounded-md border border-border bg-popover p-1">
      {candidates.map((u) => <Button key={u.id} type="button" variant="ghost" className="h-auto w-full justify-start py-2" onMouseDown={(e) => e.preventDefault()} onClick={() => {
        const start = value.slice(0, cursor).lastIndexOf("@");
        const next = `${value.slice(0, start)}@${u.username} ${value.slice(cursor)}`;
        onChange(next.slice(0, props.maxLength)); setCursor(start + u.username.length + 2);
      }}><UserAvatar user={u} /><span className="min-w-0 text-left"><span className="block truncate">@{u.username}</span><span className="block truncate text-xs text-muted-foreground">{u.name}</span></span></Button>)}
    </div>}
  </div>;
});