-- imoveis
create table if not exists public.imoveis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  nome text not null,
  cidade text default '',
  bairro text default '',
  tipo text default 'Apartamento',
  diaria numeric default 0,
  cap int default 2,
  status text default 'ativo' check (status in ('ativo', 'manutencao', 'bloqueado')),
  obs text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- reservas
create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  imovel_id uuid references public.imoveis(id) on delete cascade not null,
  hospede text default '',
  checkin date not null,
  checkout date not null,
  valor numeric default 0,
  origem text default 'Airbnb',
  obs text default '',
  created_at timestamptz default now()
);

create index if not exists idx_imoveis_user_id on public.imoveis(user_id);
create index if not exists idx_reservas_user_id on public.reservas(user_id);
create index if not exists idx_reservas_imovel_id on public.reservas(imovel_id);
create index if not exists idx_reservas_checkin on public.reservas(checkin);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists imoveis_updated_at on public.imoveis;
create trigger imoveis_updated_at
  before update on public.imoveis
  for each row execute function public.set_updated_at();

-- RLS
alter table public.imoveis enable row level security;
alter table public.reservas enable row level security;

drop policy if exists "imoveis_select_own" on public.imoveis;
create policy "imoveis_select_own" on public.imoveis
  for select using (auth.uid() = user_id);

drop policy if exists "imoveis_insert_own" on public.imoveis;
create policy "imoveis_insert_own" on public.imoveis
  for insert with check (auth.uid() = user_id);

drop policy if exists "imoveis_update_own" on public.imoveis;
create policy "imoveis_update_own" on public.imoveis
  for update using (auth.uid() = user_id);

drop policy if exists "imoveis_delete_own" on public.imoveis;
create policy "imoveis_delete_own" on public.imoveis
  for delete using (auth.uid() = user_id);

drop policy if exists "reservas_select_own" on public.reservas;
create policy "reservas_select_own" on public.reservas
  for select using (auth.uid() = user_id);

drop policy if exists "reservas_insert_own" on public.reservas;
create policy "reservas_insert_own" on public.reservas
  for insert with check (auth.uid() = user_id);

drop policy if exists "reservas_update_own" on public.reservas;
create policy "reservas_update_own" on public.reservas
  for update using (auth.uid() = user_id);

drop policy if exists "reservas_delete_own" on public.reservas;
create policy "reservas_delete_own" on public.reservas
  for delete using (auth.uid() = user_id);
