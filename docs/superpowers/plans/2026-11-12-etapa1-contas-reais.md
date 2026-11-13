# Etapa 1 — Contas reais (Supabase Auth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o login simulado por contas reais no Supabase (cadastro com data de nascimento, papel aluno/professor calculado no banco, confirmação de e-mail, login, recuperar senha, excluir conta), mantendo posts/stories ainda locais até a Etapa 2.

**Architecture:** Um cliente Supabase único (`src/lib/supabase.ts`) é usado por um módulo fino de autenticação (`src/lib/auth.ts`). O `store.ts` ouve `onAuthStateChange`, busca o perfil em `public.profiles` e o injeta em `state.users` (ponte temporária). Regras de idade/papel são puras em `logic.ts` e espelhadas em SQL no trigger `handle_new_user`; RLS e um trigger de proteção impedem o usuário de alterar `role`, `is_moderator` e `birth_date`.

**Tech Stack:** TanStack Start/Router, React 19, TypeScript, Vitest, `@supabase/supabase-js` v2, Postgres (Supabase), Supabase Edge Functions (Deno), Resend (SMTP).

**Spec:** `docs/superpowers/specs/2026-11-12-backend-supabase-etapa1-design.md`

## Global Constraints

- Todo texto de interface e e-mail em português do Brasil; nome do app "Vozes do Muro".
- Papel: idade < 20 → `aluno`; idade > 30 → `professor`; 20–30 (inclusive) → escolha da lista (`aluno` se ausente). A regra **não é explicada na tela**; a lista só aparece para 20–30.
- Idade mínima 13 anos. Idade calculada no fuso `America/Sao_Paulo`.
- Senha mínima 8 caracteres. Username: `/^[a-z0-9._]{3,20}$/` (regra existente `isValidUsername`).
- `birth_date` e e-mail nunca expostos a outros usuários; `bairro` oculto publicamente para menores de 18.
- `role`, `is_moderator`, `birth_date` não podem ser alterados pelo próprio usuário; `is_moderator` só pelo painel do Supabase.
- Só a chave pública (`anon`) no front. A `service_role` nunca entra no repositório nem no front.
- Toda mudança de shape do estado local: bump de `version` + passo em `migrateState()` (regra do AGENTS.md).
- Não fazer `git push` sem confirmação do dono do projeto (sincroniza com o Lovable).
- Pacotes com `npx bun@1 ...` para manter `bun.lock` (não commitar `package-lock.json`).

## Review Focus

1. **Data de nascimento com fuso:** `new Date("2010-05-01")` é UTC e vira 30/04 no Brasil — idade e papel devem usar só os números da string `YYYY-MM-DD`. Teste em Task 2 (`ageOn` com string e data local).
2. **@ ocupado entre a checagem e o envio:** o trigger falha e o Supabase devolve "Database error saving new user"; o usuário deve ver "Esse nome de usuário já está em uso." Teste em Task 4 (`friendlyAuthError`).
3. **Login com e-mail não confirmado:** precisa de mensagem clara + botão "Reenviar e-mail". Teste em Task 4 (`friendlyAuthError("Email not confirmed")`).
4. **Sessão válida sem linha em `profiles`** (trigger falhou ou perfil apagado): o app não pode travar no carregamento; mostra "Tentar de novo" / "Sair". Teste em Task 5 (`profileToUser` rejeita `null` e store marca `authError`).
5. **Dados antigos no navegador** (usuários com `password`, `role: "moderador"`): migração v5 remove senhas e converte papéis sem perder posts. Teste em Task 3.

---

### Task 1: Dependência e cliente Supabase

**Files:**
- Modify: `package.json`, `bun.lock` (via `npx bun@1 add @supabase/supabase-js`)
- Create: `src/lib/supabase.ts`
- Create: `.env.example`
- Create: `.env` (só `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, preenchidos na Task 9; chave pública por definição, protegida por RLS)

**Interfaces:**
- Produces: `getSupabase(): SupabaseClient` (lança `Error("Supabase não configurado")` se as variáveis faltarem), `isSupabaseConfigured(): boolean`, `APP_URL(): string` (= `window.location.origin`).

- [ ] **Step 1:** `npx bun@1 add @supabase/supabase-js` — Expected: `package.json` e `bun.lock` alterados, `node_modules` criado.
- [ ] **Step 2:** Criar `src/lib/supabase.ts` com cliente preguiçoso (criado na primeira chamada, só no navegador), `auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true, autoRefreshToken: true }`.
- [ ] **Step 3:** `.env.example` com as duas chaves vazias e comentário "chave anon é pública; NUNCA coloque a service_role aqui".
- [ ] **Step 4:** `npx tsc --noEmit` — Expected: sem erros.
- [ ] **Step 5:** Commit `feat: cliente Supabase`.

---

### Task 2: Regras puras de idade e papel

**Files:**
- Modify: `src/lib/logic.ts` (adicionar; remover `signUp` e `signIn` locais)
- Test: `src/lib/logic.test.ts`

**Interfaces:**
- Produces:
  - `type AccountRole = "aluno" | "professor"`
  - `MIN_AGE = 13`
  - `ageOn(birthDate: string, today: Date): number` — `birthDate` é `"YYYY-MM-DD"`; usa ano/mês/dia locais de `today`.
  - `needsRoleChoice(age: number): boolean` — `true` para 20..30.
  - `roleForAge(age: number, choice?: AccountRole): AccountRole`
  - `validateSignUp(input: SignUpInput, today: Date): string | null` — `SignUpInput = { name; username; email; password; birthDate; roleChoice?: AccountRole; acceptedRules: boolean }`; devolve a primeira mensagem de erro ou `null`.

- [ ] **Step 1: Testes que falham**

```ts
describe("idade e papel", () => {
  const hoje = new Date(2026, 10, 12); // 12/11/2026 local
  it("conta a idade pelo calendário, sem fuso", () => {
    expect(L.ageOn("2013-11-12", hoje)).toBe(13);
    expect(L.ageOn("2013-11-13", hoje)).toBe(12);
    expect(L.ageOn("2006-11-12", hoje)).toBe(20);
  });
  it("define o papel nos limites", () => {
    expect(L.roleForAge(19)).toBe("aluno");
    expect(L.roleForAge(20, "professor")).toBe("professor");
    expect(L.roleForAge(30)).toBe("aluno");
    expect(L.roleForAge(30, "professor")).toBe("professor");
    expect(L.roleForAge(31, "aluno")).toBe("professor");
    expect(L.roleForAge(19, "professor")).toBe("aluno");
  });
  it("só pede escolha entre 20 e 30", () => {
    expect([19, 20, 30, 31].map(L.needsRoleChoice)).toEqual([false, true, true, false]);
  });
  it("valida o cadastro", () => {
    const ok = { name: "Ana", username: "ana.rima", email: "a@b.co", password: "12345678", birthDate: "2010-01-01", acceptedRules: true };
    expect(L.validateSignUp(ok, hoje)).toBeNull();
    expect(L.validateSignUp({ ...ok, birthDate: "2014-01-01" }, hoje)).toBe("Você precisa ter pelo menos 13 anos para criar uma conta.");
    expect(L.validateSignUp({ ...ok, password: "1234567" }, hoje)).toBe("A senha precisa ter pelo menos 8 caracteres.");
    expect(L.validateSignUp({ ...ok, acceptedRules: false }, hoje)).toBe("Você precisa aceitar as regras de convivência.");
    expect(L.validateSignUp({ ...ok, birthDate: "" }, hoje)).toBe("Informe sua data de nascimento.");
    expect(L.validateSignUp({ ...ok, birthDate: "2999-01-01" }, hoje)).toBe("Data de nascimento inválida.");
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/logic.test.ts` — Expected: FAIL (`L.ageOn is not a function`).
- [ ] **Step 3:** Implementar as funções acima em `logic.ts`. Mensagens de nome/username/e-mail reaproveitam as de `signUp` atual; ordem das checagens: nome, username, e-mail, senha, data vazia, data inválida/futura, idade mínima, regras. **Não** remover `signUp`/`signIn` locais aqui (isso acontece na Task 5, junto com o `store.ts`).
- [ ] **Step 4:** `npx vitest run` — Expected: PASS.
- [ ] **Step 5:** Commit `feat: regras de idade e papel`.

---

### Task 3: Tipos, dados de exemplo e migração v5

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/mock-data.ts`, `src/lib/logic.ts` (`migrateState`, `resolveReport`), `src/components/vm/AppShell.tsx:81`, `src/routes/_rede.configuracoes.tsx:57`, `src/routes/_rede.moderacao.tsx:36`, `src/routes/_rede.u.$username.tsx:84`, `src/routes/entrar.tsx` (remover `DEMO_LOGIN`)
- Test: `src/lib/logic.test.ts`

**Interfaces:**
- Produces: `User` sem `password`; `User.role: AccountRole`; `User.isModerator: boolean`; `User.email` passa a ser opcional (`email?: string`, só preenchido para o próprio usuário); `AppState.version = 5`. Remove `Role` e `DEMO_LOGIN`.

Contas de demonstração **continuam** como autoras do conteúdo de exemplo (sem login) até a Etapa 2 — removê-las deixaria posts órfãos. (Ajuste à spec 4.3, a confirmar com o dono.)

- [ ] **Step 1: Teste que falha**

```ts
it("v4 → v5 remove senhas e converte papéis", () => {
  const seed = createSeedState();
  const old = { ...seed, version: 4, users: seed.users.map((u, i) => ({ ...u, password: "x", role: i === 0 ? "moderador" : "usuario" })) };
  const s = L.migrateState(old, seed)!;
  expect(s.version).toBe(5);
  expect(s.users.every((u) => !("password" in u))).toBe(true);
  expect(s.users[0]).toMatchObject({ role: "professor", isModerator: true });
  expect(s.users[1]).toMatchObject({ role: "aluno", isModerator: false });
  expect(s.posts).toHaveLength(seed.posts.length);
});
```

- [ ] **Step 2:** `npx vitest run src/lib/logic.test.ts` — Expected: FAIL.
- [ ] **Step 3:** Atualizar tipos; `mock-data` sem senhas, com `role`/`isModerator` (o moderador atual vira `professor` + `isModerator: true`), `version: 5`; passo `version === 4` em `migrateState`; trocar `role === "moderador"` por `isModerator` nos 5 pontos; remover bloco de conta demo de `entrar.tsx`.
- [ ] **Step 4:** `npx vitest run && npx tsc --noEmit` — Expected: PASS, sem erros.
- [ ] **Step 5:** Commit `refactor: papéis aluno/professor e migração v5`.

---

### Task 4: Banco — migration de perfis + mensagens de erro

**Files:**
- Create: `supabase/migrations/20261112000000_profiles.sql`
- Create: `supabase/tests/profiles_check.sql` (consultas de verificação manual)
- Create: `src/lib/auth-errors.ts`
- Test: `src/lib/auth-errors.test.ts`

**Interfaces:**
- Produces (SQL): tabela `public.profiles` (colunas da spec 4.1); `public.handle_new_user()` trigger em `auth.users`; `public.protect_profile_columns()` trigger `before update`; view `public.public_profiles` (`security_invoker = false`, sem `birth_date`, `bairro` = `''` se `not show_bairro` ou idade < 18); `public.username_available(name text) returns boolean` (`security definer`, `stable`).
- Produces (TS): `friendlyAuthError(message: string): string`.

Regras SQL fixas:
- Idade: `extract(year from age((now() at time zone 'America/Sao_Paulo')::date, birth_date))`.
- `handle_new_user`: `raise exception 'idade_minima'` se < 13; `raise exception 'username_invalido'` se não casar `^[a-z0-9._]{3,20}$`; papel conforme Global Constraints; `color` sorteada entre os 4 valores.
- RLS em `profiles`: `select` e `update` só `auth.uid() = id`; sem `insert`/`delete` para `authenticated`. `public_profiles` legível por `authenticated`.
- `protect_profile_columns`: se `auth.role() <> 'service_role'`, mantém `role`, `is_moderator`, `birth_date`, `id`, `created_at` de `OLD`.

- [ ] **Step 1: Teste que falha**

```ts
it.each([
  ["Database error saving new user", "Esse nome de usuário já está em uso ou é inválido."],
  ["User already registered", "Já existe uma conta com esse e-mail."],
  ["Email not confirmed", "Confirme seu e-mail antes de entrar. Verifique a caixa de entrada e o spam."],
  ["Invalid login credentials", "E-mail ou senha incorretos."],
  ["Failed to fetch", "Sem conexão com a internet. Tente de novo."],
  ["Email link is invalid or has expired", "O link expirou. Peça um novo."],
  ["qualquer outra coisa", "Algo deu errado. Tente de novo em instantes."],
])("traduz %s", (msg, pt) => expect(friendlyAuthError(msg)).toBe(pt));
```

- [ ] **Step 2:** `npx vitest run src/lib/auth-errors.test.ts` — Expected: FAIL.
- [ ] **Step 3:** Implementar `friendlyAuthError` (busca por substring, sem diferenciar maiúsculas) e escrever a migration SQL.
- [ ] **Step 4:** `npx vitest run` — Expected: PASS. A migration é aplicada e verificada na Task 9.
- [ ] **Step 5:** Commit `feat: tabela de perfis com RLS e mensagens de erro`.

---

### Task 5: Serviço de autenticação e ponte com o store

**Files:**
- Create: `src/lib/auth.ts`
- Modify: `src/lib/store.ts`, `src/routes/_rede.tsx`, `src/lib/logic.ts` (remover `signUp`/`signIn` locais e testes que os usem)
- Test: `src/lib/auth.test.ts`

**Interfaces:**
- Consumes: `getSupabase`, `friendlyAuthError`, `validateSignUp`, `ageOn`, `roleForAge`.
- Produces (`auth.ts`):
  - `type ProfileRow` (colunas de `profiles`)
  - `profileToUser(row: ProfileRow | null, email: string): User | null` (pura)
  - `signUp(input: SignUpInput): Promise<{ ok: true } | { ok: false; error: string }>` — `options.data = { username, name, birth_date, role_choice }`, `emailRedirectTo = APP_URL() + "/auth/callback"`
  - `signIn(email, password)`, `resendConfirmation(email)`, `requestPasswordReset(email)` (`redirectTo = APP_URL() + "/nova-senha"`), `updatePassword(password)`, `signOut()`, `usernameAvailable(username): Promise<boolean>` — todas devolvendo `{ ok, error? }` com `friendlyAuthError`.
  - `fetchOwnProfile(userId: string): Promise<ProfileRow | null>`
  - `saveOwnProfile(userId: string, patch: ProfilePatch): Promise<{ ok: true } | { ok: false; error: string }>` — grava só `name, username, bio, bairro, show_bairro, color, styles` (avatar/capa/destaque continuam locais até a Etapa 2).
- Produces (`store.ts`): `useAuthStatus(): "carregando" | "pronto" | "erro"`, `actions.retryAuth()`; remove `actions.signUp`, `actions.signIn`, `actions.emailExists`, `actions.resetDemo`; `actions.signOut()` vira `async`; `actions.updateProfile` passa a chamar `saveOwnProfile` antes de gravar localmente.

- [ ] **Step 1: Teste que falha**

```ts
it("converte a linha do banco em usuário do app", () => {
  const row = { id: "x", username: "ana", name: "Ana", birth_date: "2010-01-01", role: "aluno", is_moderator: false, bio: "", bairro: "Capão", show_bairro: true, color: "lime", avatar_url: null, cover_url: null, styles: ["Rap"], created_at: "2026-11-12T00:00:00Z" };
  expect(profileToUser(row, "a@b.co")).toMatchObject({ id: "x", username: "ana", role: "aluno", isModerator: false, email: "a@b.co", showBairro: true, styles: ["Rap"] });
  expect(profileToUser(null, "a@b.co")).toBeNull();
});
```

- [ ] **Step 2:** `npx vitest run src/lib/auth.test.ts` — Expected: FAIL.
- [ ] **Step 3:** Implementar `auth.ts`. Em `store.ts`: em `hydrateStore()`, se `isSupabaseConfigured()`, registrar `onAuthStateChange`; com sessão → `fetchOwnProfile` → `profileToUser` → inserir/substituir em `state.users` e `sessionUserId = user.id`, `authStatus = "pronto"`; perfil nulo ou erro → `authStatus = "erro"`; sem sessão → `sessionUserId = null`, `"pronto"`. Evento `PASSWORD_RECOVERY` → `window.location.assign("/nova-senha")`. Em `_rede.tsx`: tela de carregamento enquanto `"carregando"`; em `"erro"`, mensagem "Não conseguimos carregar seu perfil." com botões "Tentar de novo" (`retryAuth`) e "Sair".
- [ ] **Step 4:** `npx vitest run && npx tsc --noEmit` — Expected: PASS.
- [ ] **Step 5:** Commit `feat: sessão Supabase ligada ao estado do app`.

---

### Task 6: Telas de cadastro, login, recuperação e callback

**Files:**
- Modify: `src/routes/cadastro.tsx`, `src/routes/entrar.tsx`, `src/routes/recuperar-senha.tsx`, `src/routes/index.tsx` (texto "contas e dados são simulados" → remover)
- Create: `src/routes/nova-senha.tsx`, `src/routes/auth.callback.tsx`
- Test: `src/test/app-routing.test.tsx` (rotas novas casam)

**Interfaces:**
- Consumes: funções de `auth.ts`, `validateSignUp`, `ageOn`, `needsRoleChoice`.

Comportamento fixo:
- **Cadastro:** campos na ordem nome, @usuário, e-mail, senha, data de nascimento (`<input type="date">`, `max` = hoje), lista "Professor(a)/Aluno(a)" (aparece só se `needsRoleChoice(ageOn(...))`, sem texto explicando o porquê), aceite das regras. Checagem de @ com `usernameAvailable` após 400 ms sem digitar ("@ disponível" / "Esse nome de usuário já está em uso."). Botão desabilitado enquanto envia. Sucesso → mesma página mostra "Confira seu e-mail" com o endereço e botão "Reenviar e-mail".
- **Entrar:** só e-mail + senha. Erro de e-mail não confirmado mostra botão "Reenviar e-mail de confirmação". Usuário já logado → `/feed`.
- **Recuperar senha:** chama `requestPasswordReset`; sempre mostra "Se existir uma conta com esse e-mail, enviamos um link." (não revela se existe).
- **Nova senha:** dois campos (senha, confirmar), mín. 8, iguais; sem sessão de recuperação → "O link expirou. Peça um novo." com link para `/recuperar-senha`; sucesso → toast "Senha alterada!" e `/feed`.
- **Callback:** mostra "Confirmando sua conta…"; ao ficar `"pronto"` com usuário → `/feed`; erro na URL (`error_description`) ou 10 s sem sessão → "O link expirou. Peça um novo." + `/entrar`.

- [ ] **Step 1:** Adicionar ao teste de rotas: `router.matchRoutes("/nova-senha")` e `"/auth/callback"` não caem em `rootRouteId`. Rodar `npx vitest run src/test` — Expected: FAIL.
- [ ] **Step 2:** Implementar as telas (reaproveitar `AuthLayout`, `FieldError`, `Button`, `Input`, `Label`, `Select` do shadcn).
- [ ] **Step 3:** `npx vitest run && npx tsc --noEmit && npx eslint src` — Expected: PASS, sem erros.
- [ ] **Step 4:** Commit `feat: telas de cadastro e login reais`.

---

### Task 7: Excluir conta e sair

**Files:**
- Create: `supabase/functions/delete-account/index.ts`
- Modify: `src/lib/auth.ts` (`deleteAccount(): Promise<{ ok } | { ok: false; error }>` via `getSupabase().functions.invoke("delete-account")`), `src/lib/store.ts` (`actions.deleteAccount` async: chama o serviço, depois a limpeza local existente), `src/routes/_rede.configuracoes.tsx` (remover botão "Restaurar demonstração"; "Sair" e "Excluir conta" com `await` e estado de carregamento)

**Interfaces:**
- Produces: Edge Function que lê o JWT do header `Authorization`, obtém o usuário com cliente anon, e apaga com cliente `service_role` (`auth.admin.deleteUser(id)`); `profiles` cai por cascade. Responde `{ ok: true }` ou `401`.

- [ ] **Step 1:** Escrever a função e as alterações de front.
- [ ] **Step 2:** `npx tsc --noEmit && npx vitest run` — Expected: PASS.
- [ ] **Step 3:** Commit `feat: excluir conta no servidor`.

---

### Task 8: Templates de e-mail e documentação

**Files:**
- Create: `supabase/templates/confirmar.html`, `supabase/templates/recuperar.html`
- Create: `docs/supabase-setup.md` (passo a passo do dono, Task 9)
- Modify: `AGENTS.md` (trocar a regra "Prototype has no backend" por: contas e perfis no Supabase; RLS obrigatória; migrations em `supabase/migrations/`; chave `service_role` só em Edge Functions; posts/stories ainda locais até a Etapa 2)

Templates: assunto "Confirme sua conta no Vozes do Muro" / "Crie uma nova senha — Vozes do Muro"; botão com `{{ .ConfirmationURL }}`; aviso "Se não foi você, ignore este e-mail."

- [ ] **Step 1:** Escrever arquivos.
- [ ] **Step 2:** Commit `docs: templates de e-mail e guia de configuração`.

---

### Task 9: Configurar o Supabase e verificar ponta a ponta

Feita **junto com o dono do projeto** (ele cria contas e cola chaves; nada de segredo no chat).

- [ ] **Step 1 (dono):** Criar projeto Supabase (São Paulo). Preencher `.env` com URL e chave `anon`.
- [ ] **Step 2:** Aplicar `20261112000000_profiles.sql` (via conector Supabase autorizado, ou dono cola no SQL Editor). Rodar `supabase/tests/profiles_check.sql`. Expected: tabela, triggers, view e função existem; RLS ativa.
- [ ] **Step 3:** Publicar `delete-account` (conector ou `npx supabase functions deploy delete-account`).
- [ ] **Step 4 (dono):** Auth → URL Configuration: Site URL = domínio publicado do Lovable; Redirect URLs = domínio publicado + `http://localhost:*/**`. Auth → Email Templates: colar os dois templates. Auth → SMTP: dados do Resend.
- [ ] **Step 5:** `npm run dev` e testar no navegador: cadastro 15 anos (vira aluno, sem lista), 25 anos (lista aparece), 40 anos (professor, sem lista), 12 anos (bloqueado); e-mail chega em português; link confirma e abre o feed; login antes de confirmar mostra o aviso; recuperar senha funciona; editar perfil persiste após recarregar.
- [ ] **Step 6:** Segurança: logado como aluno, no console `getSupabase().from("profiles").update({ role: "professor", is_moderator: true }).eq("id", <meu id>)` → linha continua `aluno`/`false`; `select` em `profiles` de outro id → vazio; `public_profiles` não tem `birth_date`.
- [ ] **Step 7:** Excluir conta de teste → some de `auth.users` e `profiles`.
- [ ] **Step 8:** `npx vitest run && npx tsc --noEmit && npm run build` — Expected: tudo verde.
- [ ] **Step 9:** Pedir confirmação ao dono e só então `git push` (sincroniza com o Lovable). Conferir no Lovable que o build publica.
