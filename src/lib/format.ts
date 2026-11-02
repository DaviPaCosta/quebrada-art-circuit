import { formatDistanceToNowStrict, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function timeAgo(iso: string) {
  try {
    return formatDistanceToNowStrict(new Date(iso), { locale: ptBR, addSuffix: true });
  } catch {
    return "";
  }
}

export function eventDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return {
    day: format(d, "dd"),
    month: format(d, "MMM", { locale: ptBR }).replace(".", ""),
    weekday: format(d, "EEEE", { locale: ptBR }),
  };
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}
