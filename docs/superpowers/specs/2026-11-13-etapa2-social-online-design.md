# Vozes do Muro — Etapa 2: rede social online

Data: 2026-11-13 · Status: aprovado em conversa

## 1. Objetivo

Levar para o Supabase tudo o que é compartilhado entre pessoas, para que alunos e professores vejam o
conteúdo uns dos outros: posts (foto, vídeo, carrossel), stories, comentários e respostas, curtidas
(posts e comentários), seguir, salvar, bloquear, notificações, denúncias/moderação e fotos de perfil/capa.
Continuam no aparelho: agenda de eventos (`eventInterest`) e configurações de acessibilidade.

## 2. Decisões

| Tema | Decisão |
| --- | --- |
| Arquitetura do front | **Cache**: o estado do `store.ts` vira cópia do banco; ações são otimistas (atualiza na hora, grava no banco, desfaz e avisa se falhar). Telas mudam o mínimo. |
| Vídeos | Comprimidos no aparelho para 480p (~1 Mbps) com barra de progresso; sem suporte → só aceita vídeo de até 15 MB. Duração máxima 60 s. |
| Fotos | Compressão atual (WebP até 1080 px). |
| Armazenamento | Bucket `media` público para leitura, nomes aleatórios (`<user_id>/<uuid>.<ext>`); cada um só grava/apaga na própria pasta. |
| Feed | Faixa "Destaques": posts de professores dos últimos 7 dias, até 10. Abaixo, todos os posts (menos bloqueados/removidos), mais novo primeiro, 20 por página. |
| Conteúdo de exemplo | Conta oficial `@vozesdomuro` criada pelo dono; SQL de seed com 6–8 posts usando as imagens `seed:` do app. Perfis falsos e stories de exemplo saem. |
| Notificações | Criadas pelo banco (triggers/RPC), nunca pelo cliente direto. |
| Stories | Vencem em 24 h; Edge Function agendada (pg_cron, 1x/hora) apaga linhas e arquivos vencidos. |

## 3. Banco (migration `20261113000000_social.sql`)

Tabelas (todas com RLS; `uuid` default `gen_random_uuid()`; `created_at timestamptz default now()`):

- `posts`: `id, author_id → profiles, type ('imagem'|'video'|'carrossel'), title, description, category, credits, tags text[], region, removed bool default false`.
- `post_media`: `id, post_id → posts on delete cascade, position, kind ('image'|'video'), src, poster, width, height, alt, duration`.
- `comments`: `id, post_id, author_id, parent_id → comments null, text (1..500)`.
- `post_likes (post_id, user_id)`, `comment_likes (comment_id, user_id)`, `saves (user_id, post_id)`,
  `follows (follower_id, followee_id, check ≠)`, `blocks (blocker_id, blocked_id, check ≠)` — PK composta.
- `stories`: `id, author_id, kind, src, poster, width, height, alt, duration, caption, expires_at default now()+24h`.
- `story_views (story_id, user_id)`, `story_reactions (story_id, user_id)`.
- `notifications`: `id, user_id, actor_id, type, post_id null, text null, read bool default false`.
- `reports`: `id, reporter_id, target_type ('post'|'user'|'comment'), target_id text, reason, details, status ('pendente'|'removido'|'arquivado')`.

Funções auxiliares (`security definer`, `search_path=''`): `is_moderator()`, `blocked_between(a,b)`.

Regras de acesso:
- Leitura (`authenticated`): posts não removidos e cujo autor não está bloqueado em nenhum sentido; mídia/comentários/curtidas de posts visíveis; stories não vencidos de não bloqueados; moderador lê tudo.
- Escrita: cada um insere/apaga só o que é seu (`author_id/user_id/follower_id/blocker_id/reporter_id = auth.uid()`); post só editável pelo autor (exceto `removed`, que só moderador muda — trigger de proteção como na Etapa 1); `reports` lidas/alteradas só por moderador; `notifications` lidas e marcadas como lidas só pelo dono, nunca inseridas pelo cliente.
- `story_views`/`story_reactions`: o autor do story vê quem viu/reagiu.

Notificações por trigger: curtida em post (`like`), comentário (`comment`), resposta (`reply`, para o autor do comentário pai), curtida em comentário (`commentLike`), seguir (`follow`), 🔥 em story (`story`), moderação (`moderacao`, quando o moderador remove). Nunca notifica a si mesmo nem entre bloqueados. Menções: RPC `notify_mentions(post_id, comment_id, usernames text[])` que valida o autor = `auth.uid()` e insere `mention` para usuários existentes não bloqueados (máx. 10).

`profiles`: leitura pública passa a incluir `avatar_url`, `cover_url`, `pinned_post_id` (nova coluna, valida que o post é do dono).

Storage: bucket `media` (público, limite 20 MB por arquivo, tipos image/webp, image/jpeg, image/png, video/webm, video/mp4); policies de insert/delete só em `(storage.foldername(name))[1] = auth.uid()::text`.

## 4. Front

- `src/lib/api/` (novo): leitura e escrita por domínio (`posts.ts`, `comments.ts`, `social.ts`, `stories.ts`, `notifications.ts`, `reports.ts`, `media.ts`) + `mappers.ts` puro (linha do banco → tipos do app), testado.
- `store.ts`: após login, carrega feed (página 1 + destaques), seguidos/salvos/bloqueados, notificações e stories; perfis citados são buscados sob demanda em `public_profiles`. Ações chamam `api/*` de forma otimista usando as funções puras de `logic.ts`; erro → reverte + toast.
- `logic.ts`: novas funções puras `highlightPosts(posts, users, nowMs)` e `videoPlan(support, sizeBytes, durationSec)` → `'comprimir' | 'enviar' | 'recusar'` com mensagem; notificações deixam de ser criadas no cliente (o banco cria).
- Mídia: `uploadMedia(blob, ext)` envia ao bucket e devolve a URL pública; `compressVideo(file, onProgress)` usa `<video>` + `canvas.captureStream()` + `MediaRecorder` (480p, 1 Mbps; `video/webm` ou `video/mp4`); `putMedia`/IndexedDB deixa de ser usado para conteúdo novo.
- Telas: feed com faixa Destaques e "carregar mais"; perfil busca perfil público + posts; post busca post + comentários; explorar/mais curtidos via consultas; notificações; salvos; moderação (fila de denúncias); editar perfil envia avatar/capa ao bucket.
- Migração local v6: remove usuários/posts/stories/comentários/notificações/denúncias locais e mídias IndexedDB; mantém `settings` e `eventInterest`.

## 5. Conta oficial

`supabase/seed/conta_oficial.sql`: recebe o @ `vozesdomuro`, insere 6–8 posts com `post_media.src = 'seed:<nome>'` (grafite, mural, lambe, rap, poesia, danca, foto, letras) e legendas educativas. Rodado pelo dono no SQL Editor depois de criar a conta pelo app.

## 6. Erros

- Upload falhou → post não é criado; mensagem "Não conseguimos enviar sua foto/vídeo. Tente de novo."; arquivos já enviados daquele post são apagados.
- Ação otimista falhou → volta ao estado anterior + toast em português.
- Compressão sem suporte e vídeo > 15 MB → "Esse vídeo é grande demais para este aparelho. Grave um vídeo mais curto."
- Sem internet ao abrir → telas mostram o que já está em cache + aviso.

## 7. Testes

- Puros: `highlightPosts`, `videoPlan`, mappers, migração v6, regras otimistas existentes adaptadas.
- SQL `supabase/tests/social_check.sql` (com rollback): dono apaga só o próprio post; bloqueado não vê posts; aluno não muda `removed`; moderador muda; notificação de curtida criada pelo trigger e não pelo cliente; usuário não insere notificação; storage policy recusa pasta alheia (verificação de policy por consulta ao catálogo).
- Ponta a ponta com o dono: post com foto, carrossel, vídeo comprimido, story, comentário/resposta/menção, curtida, seguir, salvar, bloquear, denunciar e moderar, notificações, conta oficial.

## 8. Fora do escopo

Conversas (Etapa 4), notícias (Etapa 5), arquivar posts (Etapa 3), música, tempo real no feed (atualiza ao abrir/rolar).
