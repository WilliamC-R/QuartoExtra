-- Demanda de garagem por imóvel (0 = não)
alter table public.imoveis
  add column if not exists qtd_garagens int not null default 0
  check (qtd_garagens >= 0 and qtd_garagens <= 10);

-- Vagas de garagem por prédio
create table if not exists public.garagens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  estado text not null default '',
  cidade text not null default '',
  predio text not null default '',
  codigo text not null,
  imovel_id uuid references public.imoveis(id) on delete set null,
  status text not null default 'livre'
    check (status in ('livre', 'ocupada', 'bloqueada')),
  obs text not null default '',
  created_at timestamptz default now()
);

create index if not exists idx_garagens_user_id on public.garagens(user_id);
create index if not exists idx_garagens_predio on public.garagens(estado, cidade, predio);
create index if not exists idx_garagens_imovel_id on public.garagens(imovel_id);

alter table public.garagens enable row level security;

drop policy if exists "garagens_select_own" on public.garagens;
create policy "garagens_select_own" on public.garagens
  for select using (auth.uid() = user_id);

drop policy if exists "garagens_insert_own" on public.garagens;
create policy "garagens_insert_own" on public.garagens
  for insert with check (auth.uid() = user_id);

drop policy if exists "garagens_update_own" on public.garagens;
create policy "garagens_update_own" on public.garagens
  for update using (auth.uid() = user_id);

drop policy if exists "garagens_delete_own" on public.garagens;
create policy "garagens_delete_own" on public.garagens
  for delete using (auth.uid() = user_id);
