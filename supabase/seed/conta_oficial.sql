-- Conteúdo de boas-vindas na conta oficial @vozesdomuro.
-- 1) Crie a conta @vozesdomuro pela tela de cadastro do app e confirme o e-mail.
-- 2) Rode este arquivo inteiro no SQL Editor (uma vez só).
-- As imagens "seed:" já vêm dentro do app e não gastam espaço do Supabase.
do $$
declare
  conta uuid := (select id from public.profiles where username = 'vozesdomuro');
  novo uuid;
  item record;
begin
  if conta is null then
    raise exception 'Crie primeiro a conta @vozesdomuro pelo app.';
  end if;
  if exists (select 1 from public.posts where author_id = conta) then
    raise notice 'A conta oficial já tem posts; nada foi feito.';
    return;
  end if;

  update public.profiles
     set name = 'Vozes do Muro',
         bio = 'Conta oficial da rede. Aqui a gente mostra como postar com respeito: crédito sempre, autorização de imagem e arte sem dano.'
   where id = conta;

  for item in
    select * from (values
      (1, 'imagem', 'Cores do Bairro', 'Muralismo', 'Mural comunitário feito com autorização dos moradores. Mural bom é aquele que conversa com quem passa todo dia.', 'Exemplo da conta oficial', array['mural','comunidade'], 'image', 'seed:mural', null, 1024, 1280, null::real, 'Mural colorido em laranja, roxo e verde com quatro rostos de pessoas negras de diferentes idades, e a frase ''Favela também é cidade''.'),
      (2, 'imagem', 'Wildstyle no muro livre', 'Grafite', 'Letras entrelaçadas, setas e efeito 3D: isso é wildstyle. Pinte em muro livre ou com autorização.', 'Exemplo da conta oficial', array['grafite','wildstyle'], 'image', 'seed:grafite', null, 1024, 1024, null, 'Grafite wildstyle com letras 3D em roxo, laranja e verde-lima num muro de grafite livre, com latas de spray no chão.'),
      (3, 'imagem', 'Nossa voz, nosso bairro', 'Rap', 'Rap é crônica da quebrada. Mostre sua rima, sua batalha, seu beat — sempre com crédito para quem fez.', 'Exemplo da conta oficial', array['rap','batalha'], 'image', 'seed:rap', null, 1024, 1024, null, 'MC de boné cantando ao microfone na praça à noite, com DJ ao fundo, faixa ''Hip hop é comunidade'' e público com as mãos para o alto.'),
      (4, 'imagem', 'Lambe-lambe e memória', 'Lambe-lambe', 'Cola de farinha, papel e ideia na cabeça. O lambe é barato, rápido e conta histórias.', 'Exemplo da conta oficial', array['lambe','colagem'], 'image', 'seed:lambe', null, 1024, 1280, null, 'Muro com vários cartazes lambe-lambe sobrepostos: retratos em preto e branco, uma mulher com turbante colorido e frases como ''A luta é todo dia'' e ''Mais amor por favor''.'),
      (5, 'imagem', 'Vozes da quebrada', 'Poesia', 'Sarau e slam: poesia autoral, até 3 minutos, sem figurino. Qual é a sua?', 'Exemplo da conta oficial', array['slam','sarau'], 'image', 'seed:poesia', null, 1024, 1024, null, 'Poeta com cabelo black power recitando ao microfone embaixo de um viaduto, iluminado por luz alaranjada, com público ao redor.'),
      (6, 'imagem', 'Letras que contam histórias', 'Pichação', 'Aqui a gente estuda a história e a estética das letras — sem incentivar dano ao patrimônio.', 'Exemplo da conta oficial', array['letras','historia'], 'image', 'seed:letras', null, 1024, 1024, null, 'Painel branco em exposição com letras pretas altas e angulosas no estilo da pichação paulistana formando a frase ''Pichação é arte''.'),
      (7, 'video', 'Do muro livre ao mural', 'Muralismo', 'Vídeos de até 60 segundos também entram no muro. Mostre o processo!', 'Exemplo da conta oficial', array['processo','mural'], 'video', 'seed:reel-mural', 'seed:reel-mural-poster', 540, 960, 9::real, 'Vídeo vertical que aproxima lentamente um grafite colorido e depois mostra o mural ''Cores do Bairro'' finalizado.'),
      (8, 'video', 'Slam embaixo do viaduto', 'Poesia', 'Gravou a apresentação? Poste aqui e marque quem estava junto com @.', 'Exemplo da conta oficial', array['slam','poesia'], 'video', 'seed:reel-slam', 'seed:reel-slam-poster', 540, 960, 9::real, 'Vídeo vertical de um poeta recitando sob o viaduto, que se transforma no muro de cartazes lambe-lambe.')
    ) as t(ordem, tipo, titulo, categoria, descricao, creditos, tags, kind, src, poster, width, height, duration, alt)
    order by ordem
  loop
    insert into public.posts (author_id, type, title, description, category, credits, tags, created_at)
    values (conta, item.tipo, item.titulo, item.descricao, item.categoria, item.creditos, item.tags,
            now() - make_interval(hours => (9 - item.ordem) * 3))
    returning id into novo;
    insert into public.post_media (post_id, position, kind, src, poster, width, height, alt, duration)
    values (novo, 0, item.kind, item.src, item.poster, item.width, item.height, item.alt, item.duration);
  end loop;
end $$;
