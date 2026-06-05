-- Replace daily inspection slots with direct inspection blocks by enterprise/date.

create table if not exists public.tb_inspection_blocks (
  id bigserial primary key,
  identerprise bigint not null references public.tb_enterprises(id) on delete restrict,
  date date not null,
  start_time time not null,
  end_time time not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint tb_inspection_blocks_start_before_end check (start_time < end_time)
);

insert into public.tb_inspection_blocks (
  identerprise,
  date,
  start_time,
  end_time,
  reason,
  created_at,
  updated_at
)
select
  s.identerprise,
  s.date,
  coalesce(b.start_time, b.time),
  coalesce(
    b.end_time,
    case
      when b.time >= time '23:30' then time '23:59:59'
      else b.time + interval '30 minutes'
    end
  ),
  b.reason,
  b.created_at,
  b.updated_at
from public.tb_slot_blocks b
join public.tb_inspection_slots s on s.id = b.idslot
where exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'tb_slot_blocks'
)
on conflict do nothing;

create index if not exists idx_tb_inspection_blocks_enterprise_date
  on public.tb_inspection_blocks(identerprise, date);

create unique index if not exists uq_tb_inspection_blocks_interval
  on public.tb_inspection_blocks(identerprise, date, start_time, end_time);

alter table public.tb_inspection_blocks enable row level security;

drop policy if exists "tb_inspection_blocks_select_allowed" on public.tb_inspection_blocks;
create policy "tb_inspection_blocks_select_allowed"
on public.tb_inspection_blocks
for select
using (public.can_access_enterprise(identerprise));

drop policy if exists "tb_inspection_blocks_admin_write" on public.tb_inspection_blocks;
create policy "tb_inspection_blocks_admin_write"
on public.tb_inspection_blocks
for all
using (public.current_user_role() = 'ADMIN')
with check (public.current_user_role() = 'ADMIN');

alter table public.tb_inspections
  drop constraint if exists tb_inspections_idslot_fkey;

alter table public.tb_inspections
  drop column if exists idslot;

drop table if exists public.tb_slot_blocks;
drop table if exists public.tb_inspection_slots;
