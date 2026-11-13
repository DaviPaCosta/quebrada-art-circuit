# Etapas 3, 4 e 5 — Perfil, Conversas e Notícias

Data: 2026-11-14 · Status: aprovado em conversa · Plano: tarefas abaixo, executadas em ordem.

## Etapa 3 — Perfil
- `posts.archived boolean default false`. Arquivado: só o autor vê (RLS em `posts` e `post_visible`), some do feed, explorar e perfil público.
- Menu ⋯ do próprio post: Editar legenda (título ≤ 80, descrição ≤ 2000, hashtags), Arquivar/Desarquivar, Excluir (já existe).
- Perfil próprio: abas "Publicações" e "Arquivados".
- Regras puras: `visiblePosts` exclui arquivados; `archivedPosts(s, userId)`; `setArchived(s, userId, postId, on)`; `editPostText(s, userId, postId, patch)` → `Result`.

## Etapa 4 — Conversas 1 a 1
- Tabelas: `conversations(id, created_at, last_message_at)`, `conversation_members(conversation_id, user_id, last_read_at)`, `messages(id, conversation_id, sender_id, kind text|image|video, body, media_path, poster_path, width, height, duration, created_at)`.
- RPC `start_conversation(other uuid) returns uuid` (reaproveita a conversa existente; recusa bloqueados e a si mesmo). RLS: só membros leem/enviam; `sender_id = auth.uid()`; ninguém altera mensagem alheia.
- Mídia em bucket privado `chat` (`<conversation_id>/<uuid>.<ext>`); leitura/escrita só para membros (policy por `storage.foldername`); exibição por URL assinada (1 h) via `chat:<path>` em `useMediaSrc`.
- Tempo real: Supabase Realtime (`postgres_changes` em `messages`), publicação habilitada na migration.
- "Visto": ✓ enviado, ✓✓ quando `last_read_at` do outro ≥ `created_at`. Não lidas: contador no ícone 💬.
- Limpeza: `expire-stories` também apaga mídia de conversas com mais de 30 dias (linha vira "mídia expirada").
- Denúncia de mensagem: `reports.target_type` ganha `message`.

## Etapa 5 — Notícias e curiosidades
- Tabela `news(id, url unique, title, summary, image, source, published_at, created_at)`; leitura `authenticated`; escrita só service role.
- Edge Function `fetch-news`: RSS de Agência Mural, Alma Preta, Periferia em Movimento, Nós Mulheres da Periferia, Bocada Forte + Google News (consultas: "batalha de rima", "rap nacional", "grafite arte urbana", "slam poesia", "trap brasileiro"); deduplica por URL e título; guarda 30 dias. Agendada diariamente às 6h (09:00 UTC).
- Parser RSS puro e testado em `src/lib/news.ts` (copiado para a função): título, link, resumo sem HTML (≤ 240), imagem (`media:content`, `enclosure`, primeira `<img>`), data.
- Página Cultura: card "Curiosidade do dia" (30 itens, escolhido por data) e aba "Notícias" (capa, título, resumo, fonte, data, abre o site original).
