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
- Accounts and profiles live in Supabase (Auth + `public.profiles`); posts, stories, comments and other app data still live in the module store (`src/lib/store.ts`) persisted to localStorage until Etapa 2; seed data in `src/lib/mock-data.ts`. Why: the app is moving to a real backend on the Supabase free plan one stage at a time.
- Every Supabase table has RLS; schema changes are versioned SQL in `supabase/migrations/`; the `service_role` key is only used inside Edge Functions (`supabase/functions/`), never in the front end or repo. Why: the anon key is public, so the database rules are the security boundary.
- Account role (`aluno`/`professor`) is derived from birth date in the `handle_new_user` trigger (mirrored by `roleForAge` in `logic.ts`) and is not explained in the UI; `is_moderator` is set only by the admin in the Supabase dashboard. Why: students must not be able to grant themselves visibility or moderation powers.
- State mutations are pure functions in `src/lib/logic.ts` (tested in `logic.test.ts`); `store.ts` only wraps them. Why: keeps rules testable.
- Posts hold a `media[]` list (image/video, with width/height/alt); seed media live in `src/assets/seed` (jpg + 320/640/1024 webp, mp4 + poster) and are referenced as `seed:<name>`. Why: hashed asset URLs change between builds and would break persisted data.
- User-uploaded photos/videos are stored as blobs in IndexedDB (`src/lib/media-db.ts`) and referenced as `idb:<key>`; render media only through `MediaImage`/`VideoPlayer`/`useMediaSrc`. Why: localStorage is too small for videos and carousels.
- Persisted state is versioned; bump `version` and extend `migrateState()` in `logic.ts` whenever the shape changes. Why: users keep old data in their browser.
- Signed-in screens live under the pathless `_rede` layout, which waits for store hydration and shows a sign-in prompt when logged out. Why: localStorage is unavailable during SSR.
- Stories live in `state.stories` and expire after 24h via `isStoryActive`; seed stories (`s-seed-*`) get fresh timestamps on every load in `migrateState`. Why: the demo must never show an empty stories row.
- Resolve account mentions from current usernames with shared input/render controls and pure notification rules; replies reference a root comment and comments carry likes. Why: interactions stay consistent across posts and comments without a backend.
- Profile customization stores optional cover and pinned-post references plus the existing semantic color key; validate pinned ownership in pure logic. Why: older accounts keep working and users cannot feature someone else's work as their own.
