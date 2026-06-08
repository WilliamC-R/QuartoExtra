-- Garagem usada apenas pela reserva (não alocação fixa por apartamento)
alter table public.reservas
  add column if not exists precisa_garagem boolean not null default false,
  add column if not exists garagem_id uuid references public.garagens(id) on delete set null;

create index if not exists idx_reservas_garagem_id on public.reservas(garagem_id);

-- Inventário de vagas sem vínculo permanente ao imóvel
alter table public.garagens drop column if exists imovel_id;

-- Vagas que estavam "ocupadas" por imóvel voltam ao inventário (exceto bloqueadas)
update public.garagens set status = 'livre' where status = 'ocupada';
