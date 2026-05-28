alter table public.reservas
  add column if not exists custo_limpeza numeric(12,2) not null default 0,
  add column if not exists custo_energia numeric(12,2) not null default 0,
  add column if not exists custo_outros  numeric(12,2) not null default 0;
