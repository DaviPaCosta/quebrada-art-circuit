# Etapa 2 — Rede social online Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Posts, stories, comentários, curtidas, seguir, salvar, bloquear, notificações, denúncias e fotos de perfil passam a viver no Supabase, com o `store.ts` funcionando como cache otimista.

**Architecture:** Uma migration cria tabelas com RLS, triggers de notificação e o bucket `media`. `src/lib/api/*` faz as chamadas ao Supabase e `api/mappers.ts` (puro) converte linhas em tipos do app. O `store.ts` baixa um "snapshot" social ao entrar e aplica ações de forma otimista com as funções puras de `logic.ts`, revertendo em caso de erro. Mídias vão ao bucket (`uploadMedia`); vídeos são comprimidos no aparelho (`compressVideo`).

**Tech Stack:** TanStack Start/Router, React 19, TypeScript, Vitest, `@supabase/supabase-js` 2.119, Postgres/RLS, Supabase Storage, Edge Functions (Deno), pg_cron + pg_net, MediaRecorder.

**Spec:** `docs/superpowers/specs/2026-11-13-etapa2-social-online-design.md`

## Global Constraints

- Textos de interface em português do Brasil.
- Faixa Destaques: autor `role = 'professor'`, post dos últimos 7 dias, não removido, não bloqueado, máx. 10, mais novo primeiro.
- Snapshot: 300 posts mais recentes; recarrega ao entrar e ao voltar para a aba (no máx. 1x/60 s).
- Vídeo: máx. 60 s; comprimir para 480p (lado menor ≤ 480 px) a 1 Mbps; sem `MediaRecorder`/`captureStream` → aceitar só até 15 MB.
- Bucket `media`: público para leitura; caminho `<auth.uid()>/<uuid>.<ext>`; limite 20 MB por arquivo.
- Notificações só pelo banco (triggers/RPC `notify_mentions`); cliente nunca insere em `notifications`.
- `removed` em posts e `status` em reports só por moderador (`is_moderator()`).
- Toda migration nova em `supabase/migrations/`; verificação SQL com `rollback`.
- Estado local: bump `version` para 6 + passo em `migrateState()`.
- Rodar ferramentas com `node node_modules/vitest/vitest.mjs run` e `node node_modules/typescript/bin/tsc --noEmit`.
- Nada de `git push` sem o "pode enviar" do dono.

## Review Focus

1. **Duas abas/aparelhos curtindo ao mesmo tempo** → curtida duplicada: PK composta torna o insert idempotente; o cliente trata `23505` como sucesso. Teste em Task 3 (`isDuplicateError`).
2. **Upload parcial de carrossel** (3ª foto falha) → nenhum post criado e arquivos já enviados apagados. Teste em Task 4 (`uploadAll` com falha no meio chama `remove` com os anteriores).
3. **Ação otimista que falha** (sem internet) → estado volta exatamente ao anterior. Teste em Task 5 (`optimistic` reverte).
4. **Post de quem me bloqueou** aparece por cache antigo → snapshot filtra por `blocked_between` no banco e o cliente reaplica `isBlockedBetween`. Teste em Task 2 (`highlightPosts` exclui bloqueados) e verificação SQL Task 1.
5. **Vídeo com mais de 60 s ou aparelho sem MediaRecorder** → mensagem clara, sem travar a tela. Teste em Task 2 (`videoPlan`).

---

### Task 1: Migration social + bucket + verificação

**Files:**
- Create: `supabase/migrations/20261113000000_social.sql`
- Create: `supabase/tests/social_check.sql`

**Interfaces:**
- Produces (SQL): tabelas e colunas da spec §3; `public.is_moderator() returns boolean`; `public.blocked_between(a uuid, b uuid) returns boolean`; `public.notify_mentions(p_post uuid, p_comment uuid, p_usernames text[]) returns void`; `profiles.pinned_post_id uuid`; view `public_profiles` recriada incluindo `pinned_post_id`; bucket `media` + 3 policies em `storage.objects`; trigger `protect_post_columns` (só moderador muda `removed`; autor muda o resto); triggers de notificação `notify_like`, `notify_comment` (comment/reply), `notify_comment_like`, `notify_follow`, `notify_story_reaction`, `notify_moderation` (quando `removed` vira true).

Regras fixas: funções `security definer` com `set search_path = ''`; triggers de notificação ignoram ator = destinatário e pares bloqueados; `reports` select/update só `is_moderator()`, insert só `reporter_id = auth.uid()`; `notifications` sem policy de insert.

- [ ] **Step 1:** Escrever `social_check.sql` (bloco `begin … rollback`) criando 2 usuários de teste (como na Etapa 1) e conferindo, com `set local role authenticated` + `request.jwt.claims`: A cria post; B não apaga post de A; B curte → existe 1 notificação `like` para A; B tenta `insert into notifications` → erro capturado em `do $$ … exception … $$` vira linha `ok=true`; A bloqueia B → B não enxerga posts de A; B não muda `removed`; admin (sem role) muda `removed`. Última consulta retorna todas as linhas com `ok`.
- [ ] **Step 2:** Escrever a migration.
- [ ] **Step 3:** Commit `feat: tabelas sociais, notificações e bucket de mídia` (verificação roda na Task 9 com o dono).

---

### Task 2: Regras puras novas

**Files:**
- Modify: `src/lib/logic.ts`
- Test: `src/lib/logic.test.ts`

**Interfaces:**
- Produces:
  - `HIGHLIGHT_DAYS = 7`, `HIGHLIGHT_MAX = 10`
  - `highlightPosts(s: Pick<AppState, "posts" | "users" | "blocks">, viewerId: string, nowMs: number): Post[]`
  - `type VideoSupport = { canCompress: boolean }`
  - `VIDEO_FALLBACK_MB = 15`
  - `videoPlan(support: VideoSupport, sizeBytes: number, durationSec: number): { action: "comprimir" | "enviar" } | { action: "recusar"; error: string }`

- [ ] **Step 1: Testes que falham**

```ts
describe("destaques e vídeos", () => {
  const now = Date.parse("2026-11-13T12:00:00Z");
  const base = createSeedState();
  const prof = { ...base.users[0]!, id: "prof", role: "professor" as const };
  const aluno = { ...base.users[1]!, id: "aluno", role: "aluno" as const };
  const post = (id: string, authorId: string, daysAgo: number, extra = {}) => ({ ...base.posts[0]!, id, authorId, createdAt: new Date(now - daysAgo * 864e5).toISOString(), ...extra });
  const s = { users: [prof, aluno], blocks: {}, posts: [post("a", "prof", 1), post("b", "aluno", 1), post("c", "prof", 8), post("d", "prof", 2, { removed: true }), post("e", "prof", 0)] };
  it("destaca só professores dos últimos 7 dias, mais novo primeiro", () => {
    expect(L.highlightPosts(s, "aluno", now).map((p) => p.id)).toEqual(["e", "a"]);
  });
  it("não destaca quem está bloqueado", () => {
    expect(L.highlightPosts({ ...s, blocks: { aluno: ["prof"] } }, "aluno", now)).toEqual([]);
  });
  it("limita a 10", () => {
    const many = { ...s, posts: Array.from({ length: 12 }, (_, i) => post(`p${i}`, "prof", i * 0.1)) };
    expect(L.highlightPosts(many, "aluno", now)).toHaveLength(10);
  });
  it("decide como tratar o vídeo", () => {
    expect(L.videoPlan({ canCompress: true }, 90e6, 50)).toEqual({ action: "comprimir" });
    expect(L.videoPlan({ canCompress: false }, 10e6, 20)).toEqual({ action: "enviar" });
    expect(L.videoPlan({ canCompress: false }, 20e6, 20)).toEqual({ action: "recusar", error: "Esse vídeo é grande demais para este aparelho. Grave um vídeo mais curto." });
    expect(L.videoPlan({ canCompress: true }, 10e6, 61)).toEqual({ action: "recusar", error: "O vídeo pode ter no máximo 60 segundos." });
  });
});
```

- [ ] **Step 2:** Rodar `vitest run src/lib/logic.test.ts` — Expected: FAIL (`highlightPosts is not a function`).
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Suite completa + tsc — Expected: PASS.
- [ ] **Step 5:** Commit `feat: regras de destaques e vídeos`.

---

### Task 3: Camada de dados `src/lib/api`

**Files:**
- Create: `src/lib/api/mappers.ts`, `src/lib/api/social.ts` (todas as leituras/escritas), `src/lib/api/errors.ts`
- Test: `src/lib/api/mappers.test.ts`

**Interfaces:**
- Produces (`mappers.ts`, puro):
  - Tipos `PostRow`, `MediaRow`, `CommentRow`, `StoryRow`, `NotificationRow`, `ReportRow`, `PublicProfileRow`
  - `rowsToSocial(input: { posts: PostRow[]; media: MediaRow[]; comments: CommentRow[]; postLikes: {post_id,user_id}[]; commentLikes: {comment_id,user_id}[]; profiles: PublicProfileRow[]; follows: {follower_id,followee_id}[]; saves: {user_id,post_id}[]; blocks: {blocker_id,blocked_id}[]; stories: StoryRow[]; storyViews: {story_id,user_id}[]; storyReactions: {story_id,user_id}[]; notifications: NotificationRow[]; reports: ReportRow[] }): Pick<AppState, "users" | "posts" | "comments" | "follows" | "saved" | "blocks" | "stories" | "notifications" | "reports">`
  - Mídia ordenada por `position`; `likes` montados a partir das tabelas de curtida; `follows/saved/blocks` como `Record<userId, string[]>`.
- Produces (`errors.ts`): `isDuplicateError(e: { code?: string } | null): boolean` (`code === "23505"`).
- Produces (`social.ts`): `fetchSnapshot(userId): Promise<ReturnType<typeof rowsToSocial>>` (300 posts) e escritas: `insertPost(data, media): Promise<string>`, `deletePost(id)`, `setLike(postId, on)`, `addComment(postId, text, parentId?)`, `deleteComment(id)`, `setCommentLike(id, on)`, `setFollow(targetId, on)`, `setSave(postId, on)`, `setBlock(targetId, on)`, `insertStory(media, caption): Promise<string>`, `deleteStory(id)`, `markStoryViewed(id)`, `reactToStory(id)`, `markNotificationsRead()`, `insertReport(input)`, `resolveReport(id, action)`, `notifyMentions(postId, commentId, usernames)`. Todas lançam `Error(friendly)`; duplicata = sucesso.

- [ ] **Step 1:** Testes de `rowsToSocial` (um post com 2 mídias fora de ordem → ordenadas; curtidas viram `likes`; profile com `role/is_moderator` vira `User`; follows agrupados) e de `isDuplicateError`. Rodar — Expected: FAIL.
- [ ] **Step 2:** Implementar `mappers.ts`, `errors.ts` e `social.ts`.
- [ ] **Step 3:** Suite + tsc — Expected: PASS.
- [ ] **Step 4:** Commit `feat: camada de dados social`.

---

### Task 4: Mídia — upload e compressão de vídeo

**Files:**
- Create: `src/lib/api/media.ts`, `src/lib/video-compress.ts`
- Test: `src/lib/api/media.test.ts`

**Interfaces:**
- Produces: `uploadMedia(blob: Blob, ext: string): Promise<{ url: string; path: string }>`; `removeUploads(paths: string[]): Promise<void>`; `uploadAll(items: { blob: Blob; ext: string }[], uploader = uploadMedia, remover = removeUploads): Promise<{ url: string; path: string }[]>` (falha no meio → chama `remover` com os já enviados e relança); `canCompressVideo(): boolean`; `compressVideo(file: File, onProgress: (ratio: number) => void): Promise<Blob>`.

- [ ] **Step 1:** Teste de `uploadAll` com uploader falso que falha na 3ª chamada: espera rejeição e `remover` chamado com os 2 caminhos anteriores. Rodar — Expected: FAIL.
- [ ] **Step 2:** Implementar (`compressVideo`: `<video muted playsinline>`, canvas com lado menor 480, `canvas.captureStream(30)` + trilha de áudio do vídeo quando houver, `MediaRecorder` com `video/mp4` se suportado senão `video/webm`, `videoBitsPerSecond: 1_000_000`, progresso por `currentTime/duration`).
- [ ] **Step 3:** Suite + tsc — Expected: PASS.
- [ ] **Step 4:** Commit `feat: upload de mídia e compressão de vídeo`.

---

### Task 5: Store como cache otimista + migração v6

**Files:**
- Modify: `src/lib/store.ts`, `src/lib/logic.ts` (`migrateState` v5→v6; remover criação local de notificações em `toggleLike`, `addComment`, `toggleCommentLike`, `toggleFollow`, `reactToStory`, `createPost`, `resolveReport`; remover `refreshSeedStories`), `src/lib/mock-data.ts` (seed só com `settings` e eventos; `version: 6`)
- Test: `src/lib/store-auth.test.ts` (estender), `src/lib/logic.test.ts`

**Interfaces:**
- Consumes: `fetchSnapshot`, escritas de `social.ts`.
- Produces: `optimistic(apply: (s) => AppState, remote: () => Promise<unknown>, errorText: string): Promise<boolean>` (interno, exportado para teste); `actions.refresh()`; ações existentes mantêm nome e passam a retornar `Promise`.

- [ ] **Step 1:** Testes: v5→v6 remove posts/users/stories/comments/notifications/reports e preserva `settings`/`eventInterest`; `optimistic` aplica na hora e reverte quando `remote` rejeita (com mock de `./api/social`); login carrega snapshot no estado. Ajustar testes antigos que esperavam notificações locais. Rodar — Expected: FAIL.
- [ ] **Step 2:** Implementar; `applyOwnProfile` passa a vir do snapshot; recarga em `visibilitychange` com intervalo mínimo de 60 s.
- [ ] **Step 3:** Suite + tsc — Expected: PASS.
- [ ] **Step 4:** Commit `feat: estado do app vira cache do Supabase`.

---

### Task 6: Telas de publicar, stories e perfil com upload real

**Files:**
- Modify: `src/routes/_rede.publicar.tsx`, `src/components/vm/stories/StoryComposer.tsx`, `src/routes/_rede.editar-perfil.tsx`, `src/components/vm/media/UploadPreview.tsx` (barra "Preparando vídeo… N%")

**Interfaces:**
- Consumes: `videoPlan`, `canCompressVideo`, `compressVideo`, `uploadAll`, `actions.createPost/createStory/updateProfile`.

Comportamento: ao escolher vídeo → `videoPlan`; "comprimir" mostra progresso; "recusar" mostra o erro e remove o item. Publicar envia tudo com `uploadAll` e só então cria o post; falha → "Não conseguimos enviar sua foto/vídeo. Tente de novo." Avatar/capa: `uploadMedia` e grava `avatar_url`/`cover_url`; `pinned_post_id` gravado no banco.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** `vitest run` + `tsc` + `vite build` — Expected: verdes.
- [ ] **Step 3:** Commit `feat: publicar e stories enviam mídia ao Supabase`.

---

### Task 7: Feed com Destaques e telas de leitura

**Files:**
- Modify: `src/routes/_rede.feed.tsx` (faixa "Destaques" acima das abas, cartões horizontais roláveis; some se vazia), `src/routes/_rede.tsx` (estado vazio do feed "Seja a primeira pessoa a postar"), telas que leem `state` (`_rede.u.$username.tsx`, `_rede.post.$id.tsx`, `_rede.explorar.tsx`, `_rede.notificacoes.tsx`, `_rede.moderacao.tsx`, `_rede.salvos.tsx`, `_rede.reels.tsx`) apenas onde precisarem `await` nas ações ou tratar lista vazia.

- [ ] **Step 1:** Teste de rota/render leve: `highlightPosts` vazio não renderiza a faixa (componente `Highlights` exportado de `src/components/vm/Highlights.tsx`, testado com `@testing-library/react`). Rodar — Expected: FAIL.
- [ ] **Step 2:** Implementar.
- [ ] **Step 3:** `vitest run` + `tsc` + `vite build` — Expected: verdes.
- [ ] **Step 4:** Commit `feat: feed com destaques de professores`.

---

### Task 8: Limpeza de stories, conta oficial e documentação

**Files:**
- Create: `supabase/functions/expire-stories/index.ts` (apaga stories com `expires_at < now()` e seus arquivos no bucket; exige header `Authorization: Bearer <service_role>` ou segredo `CRON_SECRET`)
- Create: `supabase/migrations/20261113000100_cron_stories.sql` (habilita `pg_cron`/`pg_net`; agenda `0 * * * *` chamando a função com `CRON_SECRET` lido do Vault)
- Create: `supabase/seed/conta_oficial.sql` (6–8 posts `seed:` para `@vozesdomuro`)
- Modify: `AGENTS.md` (social no Supabase; store = cache; mídia no bucket `media`; IndexedDB só legado), `docs/supabase-setup.md` (passos da Etapa 2)

- [ ] **Step 1:** Escrever arquivos.
- [ ] **Step 2:** Commit `feat: limpeza de stories, conta oficial e docs`.

---

### Task 9: Aplicar no Supabase e testar com o dono

- [ ] **Step 1 (dono):** Rodar `20261113000000_social.sql`, depois `social_check.sql` → todas `ok = true`.
- [ ] **Step 2 (dono):** Publicar `expire-stories` (Verify JWT off), criar segredo `CRON_SECRET` no Vault, rodar a migration de cron.
- [ ] **Step 3 (dono):** Criar conta `@vozesdomuro` pelo app, rodar `conta_oficial.sql`.
- [ ] **Step 4:** Teste ponta a ponta com 2 contas (dono + segunda conta): post foto, carrossel, vídeo comprimido, story, comentário/resposta/menção, curtida, seguir, salvar, notificações, bloquear, denunciar, moderar, destaques de professor.
- [ ] **Step 5:** `vitest run` + `tsc` + `vite build` verdes; revisão final; pedir "pode enviar" antes de `git push`.
