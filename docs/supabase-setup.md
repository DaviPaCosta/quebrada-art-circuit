# Configurar o Supabase (Etapa 1)

Passo a passo para o dono do projeto. **Nunca cole senhas ou chaves no chat.**

## 1. Criar o projeto
1. Entre em supabase.com → **New project**.
2. Nome: `vozes-do-muro`. Região: **South America (São Paulo)**.
3. Crie uma senha forte para o banco e guarde num lugar seguro.

## 2. Colocar as chaves públicas no app
1. No painel: **Project Settings → API**.
2. Copie a **Project URL** e a chave **anon public**.
3. Abra o arquivo `.env` na raiz do projeto e preencha:
   ```
   VITE_SUPABASE_URL=<Project URL>
   VITE_SUPABASE_ANON_KEY=<anon public>
   ```
4. **Não** use a chave `service_role` em lugar nenhum do app.

## 3. Criar a tabela de perfis
1. Painel → **SQL Editor** → **New query**.
2. Cole todo o conteúdo de `supabase/migrations/20261112000000_profiles.sql` e clique em **Run**.
3. Em outra query, cole `supabase/tests/profiles_check.sql` e rode: todas as linhas devem vir com `ok = true`
   (o arquivo cria um usuário de teste e desfaz tudo no fim).
4. Contas criadas pelo botão **Add user** do painel falham (falta a data de nascimento): crie contas sempre pela
   tela de cadastro do app.

## 4. Publicar a função de excluir conta
Painel → **Edge Functions** → **Deploy a new function** → nome `delete-account` → cole o conteúdo de
`supabase/functions/delete-account/index.ts` → **Deploy**.

## 5. Links dos e-mails
Painel → **Authentication → URL Configuration**:
- **Site URL**: o endereço publicado do app no Lovable (ex.: `https://quebrada-art-circuit.lovable.app`).
- **Redirect URLs**: o mesmo endereço com `/**` no fim, e `http://localhost:*/**` para testes.

## 6. E-mails em português
Painel → **Authentication → Email Templates**:
- **Confirm signup**: assunto `Confirme sua conta no Vozes do Muro`; corpo = `supabase/templates/confirmar.html`.
- **Reset password**: assunto `Crie uma nova senha — Vozes do Muro`; corpo = `supabase/templates/recuperar.html`.

## 7. Envio de e-mails pelo Resend (grátis, 3.000/mês)
O envio padrão do Supabase só manda ~2 e-mails por hora.
1. Crie conta em resend.com e confirme seu e-mail.
2. Resend → **API Keys** → crie uma chave.
3. Supabase → **Project Settings → Authentication → SMTP Settings** → ative **Custom SMTP**:
   - Host `smtp.resend.com`, porta `465`, usuário `resend`, senha = a chave do Resend.
   - Remetente: `onboarding@resend.dev` (até você ter um domínio próprio).
   - Nome do remetente: `Vozes do Muro`.

> **Atenção:** sem domínio próprio verificado, o Resend só entrega para o e-mail da sua conta Resend.
> Para mandar para alunos e professores, escolha uma opção:
> - **Com domínio** (o da escola ou um comprado): verifique-o no Resend e use `nao-responda@seudominio`.
> - **Sem domínio:** use o **Brevo** (grátis, 300 e-mails/dia). Em brevo.com → **SMTP & API** pegue
>   host `smtp-relay.brevo.com`, porta `587`, login e chave SMTP; em **Senders** verifique um e-mail seu
>   como remetente. Alguns e-mails podem cair no spam.

## 8. Marcar moderadores
Painel → **Table Editor → profiles** → na linha da pessoa, mude `is_moderator` para `true`.
Para corrigir o papel de alguém, mude `role` para `aluno` ou `professor` na mesma tela.


---

# Etapa 2 — rede social online

1. **SQL Editor:** rode `supabase/migrations/20261113000000_social.sql`. Depois rode `supabase/tests/social_check.sql`: todas as linhas com `ok = true`.
2. **Edge Functions → Deploy a new function → Via Editor:** nome `expire-stories`, código de `supabase/functions/expire-stories/index.ts`. Em **Details**, desligue "Verify JWT".
3. **Segredo da limpeza:** invente um texto longo e aleatório (ex.: 40 letras e números) e rode no SQL Editor
   `select vault.create_secret('<o texto>', 'cron_secret');`. Depois rode `supabase/migrations/20261113000200_cron_check.sql`.
4. **SQL Editor:** rode `supabase/migrations/20261113000100_cron_stories.sql` (agenda a limpeza de hora em hora).
5. **Conta oficial:** crie a conta `@vozesdomuro` pelo app, confirme o e-mail e rode `supabase/seed/conta_oficial.sql`.

---

# Etapas 3, 4 e 5 — perfil, conversas e notícias

1. **SQL Editor**, nesta ordem (uma query de cada vez):
   - `supabase/migrations/20261114000000_archive.sql`
   - `supabase/migrations/20261114000100_chat.sql`
   - `supabase/migrations/20261114000200_news.sql`
   - Depois `supabase/tests/etapas_check.sql`: todas as linhas com `ok = true`.
2. **Edge Functions**:
   - Atualizar `expire-stories` com o código novo (agora também limpa mídia de conversas).
   - Nova função `fetch-news` (código de `supabase/functions/fetch-news/index.ts`), com **Verify JWT desligado**.
3. **Primeira carga de notícias** (sem esperar as 6h), no SQL Editor:
   `select net.http_post(url := 'https://eiyydsceqgomnsghbscf.supabase.co/functions/v1/fetch-news', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb, timeout_milliseconds := 60000);`
