export const CATEGORIES = [
  "Grafite",
  "Pichação",
  "Muralismo",
  "Lambe-lambe",
  "Rap",
  "Fotografia",
  "Poesia",
  "Dança",
  "Outros",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Role = "usuario" | "moderador";

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  /** Protótipo escolar: senha guardada só no aparelho, sem servidor. */
  password: string;
  avatar?: string | undefined;
  color: "spray" | "violet" | "lime" | "sand";
  bio: string;
  bairro: string;
  showBairro: boolean;
  styles: Category[];
  role: Role;
  createdAt: string;
}

export interface Post {
  id: string;
  authorId: string;
  image: string;
  alt: string;
  title: string;
  description: string;
  category: Category;
  credits: string;
  tags: string[];
  likes: string[];
  createdAt: string;
  removed?: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export type NotificationType = "like" | "comment" | "follow" | "moderacao";

export interface AppNotification {
  id: string;
  userId: string;
  actorId: string;
  type: NotificationType;
  postId?: string;
  text?: string;
  createdAt: string;
  read: boolean;
}

export type ReportTarget = "post" | "user" | "comment";
export type ReportStatus = "pendente" | "removido" | "arquivado";

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  reason: string;
  details: string;
  createdAt: string;
  status: ReportStatus;
}

export interface CulturalEvent {
  id: string;
  title: string;
  kind: "Oficina" | "Exposição" | "Batalha" | "Sarau" | "Mutirão";
  date: string;
  time: string;
  place: string;
  description: string;
  free: boolean;
}

export interface Settings {
  fontSize: number;
  highContrast: boolean;
  reduceMotion: boolean;
}

export interface AppState {
  version: number;
  sessionUserId: string | null;
  users: User[];
  posts: Post[];
  comments: Comment[];
  notifications: AppNotification[];
  reports: Report[];
  follows: Record<string, string[]>;
  blocks: Record<string, string[]>;
  saved: Record<string, string[]>;
  eventInterest: Record<string, string[]>;
  settings: Settings;
}
