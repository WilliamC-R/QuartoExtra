alter table public.imoveis
  add column if not exists iptu_anual         numeric(12,2) not null default 0,
  add column if not exists repasse_iptu_anual  numeric(12,2) not null default 0,
  add column if not exists itbi               numeric(12,2) not null default 0;
