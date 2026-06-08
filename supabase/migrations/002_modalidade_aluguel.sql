-- Modalidade de aluguel: diária (curta temporada) ou mensal
alter table public.imoveis
  add column if not exists modalidade_aluguel text not null default 'diaria'
  check (modalidade_aluguel in ('diaria', 'mensal'));
