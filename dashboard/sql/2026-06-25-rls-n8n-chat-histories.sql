-- Fecha exposição da n8n_chat_histories (RLS off + anon com grants de escrita).
-- Contexto: o dashboard lê essa tabela só em páginas admin (createClient =
-- usuário autenticado). O n8n escreve por conexão Postgres direta (dono da
-- tabela), que bypassa RLS — então ligar RLS NÃO quebra a gravação do agente.
--
-- Rode no Supabase → SQL Editor do projeto La Vaca (ref rlpanuhrwxbkohaezbqh).

-- 1) Liga RLS (sem política, anon/authenticated passam a ser barrados)
alter table public.n8n_chat_histories enable row level security;

-- 2) Permite leitura só para admin (espelha o padrão is_admin() já usado em areas/contatos)
drop policy if exists n8n_chat_histories_admin_read on public.n8n_chat_histories;
create policy n8n_chat_histories_admin_read
  on public.n8n_chat_histories
  for select
  to authenticated
  using (is_admin());

-- 3) Remove os grants de escrita do anon (defesa em profundidade — anon nunca
--    deve escrever histórico de conversa)
revoke insert, update, delete, truncate on public.n8n_chat_histories from anon;

-- ───────────────────────── VERIFICAÇÃO ─────────────────────────
-- Deve retornar 0 (anon bloqueado):
--   set local role anon;  select count(*) from public.n8n_chat_histories;  reset role;
-- Total real (como postgres) deve continuar > 0:
--   select count(*) from public.n8n_chat_histories;
--
-- DEPOIS de rodar, testar no app:
--   1. Página Olivia carrega as conversas (admin) ✓
--   2. Mandar 1 mensagem no WhatsApp e ver se o agente ainda grava o histórico ✓
--
-- ROLLBACK (se algo quebrar):
--   alter table public.n8n_chat_histories disable row level security;
--   grant insert, update, delete on public.n8n_chat_histories to anon;  -- só se precisar reverter o item 3
