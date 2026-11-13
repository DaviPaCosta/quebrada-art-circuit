# Vozes do Muro — Backend real com Supabase (arquitetura + Etapa 1)

Data: 2026-11-12 · Status: aprovado em conversa, aguardando revisão do documento

## 1. Contexto

O app (TanStack Start + React 19 + Tailwind 4 + shadcn/ui, publicado pelo Lovable) é hoje um
protótipo sem backend: todo o estado fica em `localStorage` (`src/lib/store.ts`) e as mídias em
IndexedDB (`src/lib/media-db.ts`). Usuários não enxergam o conteúdo uns dos outros e a senha fica
em texto puro no navegador.

Objetivo: transformar em app funcional para alunos e professores, com custo zero, usando o
**plano grátis do Supabase** numa conta do próprio dono do projeto.

## 2. Decisões tomadas

| Tema | Decisão |
| --- | --- |
| Backend | Supabase (Auth, Postgres, Storage, Realtime, Edge Functions + pg_cron), conta própria, região São Paulo |
| Público | Alunos e professores; cadastro aberto, estilo Instagram |
| Papel (aluno/professor) | Derivado da data de nascimento, de forma **não explicada na tela**: < 20 anos → aluno; > 30 → professor; 20–30 → escolhe numa lista |
| Idade mínima | 13 anos |
| Benefício do professor | Mais relevância (peso maior) no feed |
| Moderação | Campo separado `is_moderator`, marcado manualmente pelo admin no painel do Supabase |
| Menores de 18 | Bairro nunca exibido publicamente |
| E-mail | Confirmação e recuperação de senha em português, via SMTP do Resend (plano grátis) |
| Música em posts | **Fora do escopo** |
| Notícias | Portais de periferia/hip hop (RSS) + Google News por palavra-chave, 1x/dia; só título, resumo curto, capa e link |
| Curiosidades | Lista fixa ampliada, uma por dia |
| Conversas | 1 a 1: texto, câmera, foto, vídeo, "visto" |

## 3. Arquitetura geral

```
App React (Lovable / Cloudflare)
  ├── Supabase Auth ......... cadastro, confirmação de e-mail, login, recuperar senha
  ├── Supabase Postgres ..... profiles, posts, stories, comments, conversas... (RLS em tudo)
  ├── Supabase Storage ...... fotos/vídeos comprimidos no aparelho antes do envio
  ├── Supabase Realtime ..... mensagens novas na hora
  └── Edge Function + cron .. busca diária de notícias
```

- Regras de acesso ficam no banco (Row Level Security), não só na tela.
- Regras de negócio continuam como funções puras testadas em `src/lib/logic.ts`.
- `src/lib/supabase.ts` cria um único cliente com `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_ANON_KEY` (chave pública). A chave `service_role` nunca vai para o front.

### Limites para caber no plano grátis (1 GB de Storage)

- Fotos comprimidas no aparelho (~300 KB).
- Vídeos até 60 s, reduzidos para 720p (~8–10 MB).
- Arquivos de stories apagados após 24h.
- Mídia das conversas apagada após 30 dias (texto permanece).

### Etapas

1. **Contas reais** (este documento detalha).
2. Posts, stories, comentários e feed online, com peso maior para professores.
3. Perfil: cor, grade, adicionar com legenda, arquivar e excluir.
4. Conversas 1 a 1 com câmera, foto, vídeo e "visto".
5. Notícias diárias e curiosidade do dia.

Cada etapa tem seu próprio desenho aprovado antes do código.

## 4. Etapa 1 — Contas reais

### 4.1 Banco

Tabela `public.profiles` (1:1 com `auth.users`):

| Coluna | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid PK → `auth.users.id` | on delete cascade |
| `username` | text unique | minúsculo, regra igual a `isValidUsername` |
| `name` | text | 1–40 caracteres |
| `birth_date` | date | **nunca exposto** a outros usuários |
| `role` | text `aluno`/`professor` | calculado no banco |
| `is_moderator` | boolean default false | só o admin altera |
| `bio`, `bairro` | text | |
| `show_bairro` | boolean | forçado `false` para menores de 18 na leitura pública |
| `color` | text `spray`/`violet`/`lime`/`sand` | |
| `avatar_url`, `cover_url` | text null | |
| `styles` | text[] | categorias |
| `created_at` | timestamptz | |

- **Trigger `handle_new_user`** (after insert em `auth.users`): lê `username`, `name`,
  `birth_date` e `role_choice` de `raw_user_meta_data`; rejeita idade < 13; calcula `role`
  (< 20 aluno, > 30 professor, 20–30 usa `role_choice`, padrão aluno).
- **View `public_profiles`**: tudo menos `birth_date`; `bairro` vazio quando
  `show_bairro = false` ou idade < 18. Outros usuários leem só por ela.
- **RLS**: o dono lê e atualiza o próprio registro (inclusive `username`, que segue único e
  validado); colunas `role`, `is_moderator` e `birth_date` bloqueadas para update pelo usuário (trigger
  `before update` que mantém os valores antigos se quem altera não é `service_role`).
- Função `username_available(text)` (security definer) para checar disponibilidade no cadastro.
- SQL versionado em `supabase/migrations/`.

### 4.2 Telas

- **`/cadastro`**: nome, @usuário (checagem em tempo real), e-mail, senha (mín. 8), data de
  nascimento, lista Professor(a)/Aluno(a) só se 20–30 anos, aceite das regras. < 13 bloqueia com
  mensagem gentil. Sucesso → tela "Confira seu e-mail".
- **`/entrar`**: e-mail + senha. Erro claro se o e-mail ainda não foi confirmado, com botão
  "reenviar e-mail".
- **`/recuperar-senha`**: envia link; **`/nova-senha`**: define a nova senha.
- **`/auth/callback`**: recebe o link de confirmação e leva ao feed.
- Configurações: "Sair" e "Excluir conta" passam a usar o Supabase (exclusão via Edge Function
  com `service_role`).

### 4.3 Ponte com o estado local (só durante a transição)

Enquanto posts/stories ainda estão no aparelho (até a Etapa 2):

- `store.ts` escuta `supabase.auth.onAuthStateChange`; ao haver sessão, busca o próprio perfil e o
  insere/atualiza em `state.users`, com `sessionUserId = auth.uid`.
- Campo `password` sai de `User`; `signUp`/`signIn` locais saem de `logic.ts`.
- `migrateState` com nova `version` remove usuários de demonstração e senhas antigas.
- O layout `_rede` espera, além da hidratação, a sessão do Supabase ser resolvida.
- **O app não deve ser divulgado antes do fim da Etapa 2.**

### 4.4 E-mail

- SMTP do Resend configurado no painel do Supabase (Auth → SMTP).
- Templates de confirmação e recuperação em português com o nome "Vozes do Muro".
- Redirect URLs liberadas: domínio publicado do Lovable e `http://localhost:*`.

### 4.5 Erros

- Mensagens em português para: e-mail já usado, @ indisponível, senha fraca, e-mail não
  confirmado, link expirado, sem internet.
- Falha ao carregar o perfil após login → tela com "tentar de novo" e "sair".

### 4.6 Testes

- `roleForBirthDate(birthDate, choice, today)` e `ageOn(birthDate, today)` puros em `logic.ts`,
  com testes em 12, 13, 19, 20, 30 e 31 anos e aniversário no próprio dia.
- Teste de `migrateState` removendo senhas.
- Teste manual ponta a ponta no projeto Supabase: cadastro → e-mail → login → recuperar senha;
  tentativa de alterar `role`/`is_moderator` via API deve falhar.

### 4.7 O que o dono do projeto faz (sem compartilhar chaves no chat)

1. Criar o projeto Supabase (região São Paulo).
2. Autorizar o conector do Supabase no Claude **ou** colar os SQLs gerados no SQL Editor.
3. Colocar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em `.env.local` (local) e nas
   variáveis do Lovable.
4. Criar conta no Resend e colar a chave SMTP direto no painel do Supabase.
5. Marcar moderadores no Table Editor (`profiles.is_moderator`).

### 4.8 Documentação do projeto

`AGENTS.md` é atualizado: sai a regra "sem backend"; entram Supabase, RLS e migrations
versionadas em `supabase/migrations/`.

## 5. Fora do escopo desta etapa

Posts/stories/comentários online, conversas, notícias, arquivar fotos, painel de admin dentro do
app, música.
