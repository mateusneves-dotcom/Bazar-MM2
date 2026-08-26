-- Rode este script no Supabase: Project → SQL Editor → New query → Run
-- Ele cria a tabela que guarda TODOS os dados do bazar (produtos, vendas,
-- histórico de fechamentos e pedidos) como um único registro JSON, no
-- mesmo formato que o app já usava.

create table if not exists bazar_store (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Habilita Row Level Security (obrigatório no Supabase para controlar quem
-- pode ler/escrever). Como o app não tem login de verdade (só o PIN da
-- Caixa, que é só uma trava visual), liberamos leitura e escrita públicas
-- para a chave "anon" — é o mesmo nível de proteção que o app já tinha.
alter table bazar_store enable row level security;

drop policy if exists "bazar_store_select_anon" on bazar_store;
create policy "bazar_store_select_anon"
  on bazar_store for select
  to anon
  using (true);

drop policy if exists "bazar_store_insert_anon" on bazar_store;
create policy "bazar_store_insert_anon"
  on bazar_store for insert
  to anon
  with check (true);

drop policy if exists "bazar_store_update_anon" on bazar_store;
create policy "bazar_store_update_anon"
  on bazar_store for update
  to anon
  using (true)
  with check (true);

-- Observação de segurança: com essas políticas, qualquer pessoa que
-- inspecione o código-fonte do site e pegue a SUPABASE_URL + ANON_KEY
-- consegue ler e ALTERAR os dados diretamente pela API do Supabase (sem
-- passar pelo PIN do app). Para um bazar pequeno/uso entre pessoas de
-- confiança isso costuma ser aceitável (é o mesmo risco que já existia).
-- Se um dia quiser travar mais, dá pra mover as escritas para uma função
-- serverless própria (como já fizemos com o pagamento) e tirar a política
-- de insert/update do anon.
