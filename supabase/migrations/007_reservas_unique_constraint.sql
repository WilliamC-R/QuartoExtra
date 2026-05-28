-- Remove duplicatas existentes antes de criar o constraint
-- Mantém apenas a reserva mais recente para cada combinação imovel+checkin+checkout
delete from public.reservas
where id not in (
  select max(id::text)::uuid
  from public.reservas
  group by user_id, imovel_id, checkin, checkout
);

-- Adiciona constraint único para permitir upsert no import
alter table public.reservas
  add constraint reservas_unique_slot
  unique (user_id, imovel_id, checkin, checkout);
