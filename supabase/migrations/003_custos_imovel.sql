-- Custos mensais por imóvel e valores repassados ao hóspede
alter table public.imoveis
  add column if not exists custo_condominio numeric not null default 0,
  add column if not exists custo_energia numeric not null default 0,
  add column if not exists custo_internet numeric not null default 0,
  add column if not exists custo_limpeza numeric not null default 0,
  add column if not exists repasse_condominio numeric not null default 0,
  add column if not exists repasse_energia numeric not null default 0,
  add column if not exists repasse_internet numeric not null default 0,
  add column if not exists repasse_limpeza numeric not null default 0;
