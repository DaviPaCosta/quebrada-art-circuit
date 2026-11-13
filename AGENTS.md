<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules
- All shared data lives in Supabase (profiles, posts, post_media, comments, likes, saves, follows, blocks, stories, notifications, reports); `src/lib/store.ts` is an optimistic cache filled by `fetchSnapshot` (`src/lib/api/social.ts`, 300 most recent posts) and only `settings`/`eventInterest` persist to localStorage. Why: everyone must see each other's content on the Supabase free plan without rewriting every screen.
- Read/write Supabase only through `src/lib/api/*`; map rows with the pure, tested `api/mappers.ts`. Notifications are created only by database triggers and the `notify_mentions` RPC, never inserted by the client. Why: users cannot forge notifications.
- Every Supabase table has RLS; schema changes are versioned SQL in `supabase/migrations/`; the `service_role` key is only used inside Edge Functions (`supabase/functions/`), never in the front end or repo. Why: the anon key is public, so the database rules are the security boundary.
- Account role (`aluno`/`professor`) is derived from birth date in the `handle_new_user` trigger (mirrored by `roleForAge` in `logic.ts`) and is not explained in the UI; `is_moderator` is set only by the admin in the Supabase dashboard. Why: students must not be able to grant themselves visibility or moderation powers.
- State mutations are pure functions in `src/lib/logic.ts` (tested in `logic.test.ts`); `store.ts` only wraps them. Why: keeps rules testable.
- Posts hold a `media[]` list (image/video, with width/height/alt); `src` is a public URL in the `media` bucket (`<user_id>/<uuid>.<ext>`) or `seed:<name>` for bundled examples in `src/assets/seed` (used by the official account seed). Why: bundled seed media cost no storage.
- Upload media with `uploadAll`/`uploadMedia` (`src/lib/api/media.ts`); videos go through `prepareVideo` (480p compression via MediaRecorder, ≤60 s, 15 MB fallback). IndexedDB (`media-db.ts`) is legacy. Render media only through `MediaImage`/`VideoPlayer`/`useMediaSrc`. Why: the free plan has 1 GB storage and ~5 GB egress.
- Persisted state is versioned (now 6); older versions migrate to a clean state keeping only settings. Bump `version` and extend `migrateState()` when the persisted shape changes. Why: users keep old data in their browser.
- Signed-in screens live under the pathless `_rede` layout, which waits for store hydration and shows a sign-in prompt when logged out. Why: localStorage is unavailable during SSR.
- Stories expire after 24h (`expires_at`); the `expire-stories` Edge Function, scheduled hourly by pg_cron, deletes expired rows and files. Why: storage on the free plan is small.
- Resolve account mentions from current usernames with shared input/render controls; the server sends mention notifications. Replies reference a root comment and comments carry likes. Why: interactions stay consistent across posts and comments.
- Profile customization stores optional cover and pinned-post references plus the existing semantic color key; validate pinned ownership in pure logic. Why: older accounts keep working and users cannot feature someone else's work as their own.
- Posts can be archived (`posts.archived`): only the author sees them (RLS + `visiblePosts`/`archivedPosts`). Why: users keep work without deleting it.
- 1:1 chat lives in `conversations`/`conversation_members`/`messages`; open chats only via the `start_conversation` RPC; chat media go to the private `chat` bucket (`<conversation_id>/...`) and render as `chat:<path>` through `useMediaSrc` (1 h signed URLs). Moderators never read conversations: message reports carry the text and `moderate_message` blanks the reported message. Why: students are minors, so private media must stay private.
- News come only from the `fetch-news` Edge Function (daily pg_cron) into `news` (read-only for users). Its RSS parser is a copy of the tested `src/lib/news.ts`; when the parser changes, copy it again. Why: show title/summary/link only, never full articles.
