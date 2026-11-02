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
- Prototype has no backend: all app data lives in a module store (`src/lib/store.ts`) persisted to localStorage; seed data in `src/lib/mock-data.ts`. Why: the school brief requires a database-free, simulated prototype.
- State mutations are pure functions in `src/lib/logic.ts` (tested in `logic.test.ts`); `store.ts` only wraps them. Why: keeps rules testable.
- Seed images are stored as `seed:<name>` and resolved via `resolveImage()`. Why: hashed asset URLs change between builds and would break persisted data.
- Signed-in screens live under the pathless `_rede` layout, which waits for store hydration and shows a sign-in prompt when logged out. Why: localStorage is unavailable during SSR.
