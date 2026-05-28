-- Valor do imóvel (rentabilidade) e agrupamento no mapa
alter table public.imoveis
  add column if not exists valor_imovel numeric not null default 0,
  add column if not exists estado text not null default '',
  add column if not exists predio text not null default '',
  add column if not exists unidade text not null default '';
