-- Roles, enterprise access, inspection slots and slot blocks.
-- Run this in Supabase SQL editor or through your migration workflow.

alter table public.tb_users
  add column if not exists role text not null default 'USER';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tb_users_role_check'
  ) then
    alter table public.tb_users
      add constraint tb_users_role_check
      check (role in ('ADMIN', 'USER', 'VIEWER'));
  end if;
end $$;

create table if not exists public.tb_user_enterprises (
  id bigserial primary key,
  iduser uuid not null references public.tb_users(id) on delete cascade,
  identerprise bigint not null references public.tb_enterprises(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (iduser, identerprise)
);

create table if not exists public.tb_inspection_slots (
  id bigserial primary key,
  identerprise bigint not null references public.tb_enterprises(id) on delete restrict,
  date date not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (identerprise, date),
  constraint tb_inspection_slots_status_check check (status in ('ACTIVE', 'INACTIVE'))
);

create table if not exists public.tb_slot_blocks (
  id bigserial primary key,
  idslot bigint not null references public.tb_inspection_slots(id) on delete cascade,
  time time not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (idslot, time)
);

alter table public.tb_inspections
  add column if not exists idslot bigint references public.tb_inspection_slots(id) on delete restrict;

create index if not exists idx_tb_user_enterprises_iduser
  on public.tb_user_enterprises(iduser);

create index if not exists idx_tb_user_enterprises_ident
  on public.tb_user_enterprises(identerprise);

create index if not exists idx_tb_inspection_slots_enterprise_date
  on public.tb_inspection_slots(identerprise, date);

create index if not exists idx_tb_slot_blocks_slot_time
  on public.tb_slot_blocks(idslot, time);

create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select role from public.tb_users where id = auth.uid()
$$;

create or replace function public.can_access_enterprise(target_enterprise bigint)
returns boolean
language sql
stable
as $$
  select coalesce(public.current_user_role() = 'ADMIN', false)
    or exists (
      select 1
      from public.tb_user_enterprises ue
      where ue.iduser = auth.uid()
        and ue.identerprise = target_enterprise
    )
$$;

alter table public.tb_users enable row level security;
alter table public.tb_user_enterprises enable row level security;
alter table public.tb_inspection_slots enable row level security;
alter table public.tb_slot_blocks enable row level security;

drop policy if exists "tb_users_admin_all" on public.tb_users;
create policy "tb_users_admin_all"
on public.tb_users
for all
using (public.current_user_role() = 'ADMIN')
with check (public.current_user_role() = 'ADMIN');

drop policy if exists "tb_users_self_read" on public.tb_users;
create policy "tb_users_self_read"
on public.tb_users
for select
using (id = auth.uid());

drop policy if exists "tb_user_enterprises_admin_all" on public.tb_user_enterprises;
create policy "tb_user_enterprises_admin_all"
on public.tb_user_enterprises
for all
using (public.current_user_role() = 'ADMIN')
with check (public.current_user_role() = 'ADMIN');

drop policy if exists "tb_user_enterprises_self_read" on public.tb_user_enterprises;
create policy "tb_user_enterprises_self_read"
on public.tb_user_enterprises
for select
using (iduser = auth.uid());

drop policy if exists "tb_inspection_slots_select_allowed" on public.tb_inspection_slots;
create policy "tb_inspection_slots_select_allowed"
on public.tb_inspection_slots
for select
using (public.can_access_enterprise(identerprise));

drop policy if exists "tb_inspection_slots_admin_write" on public.tb_inspection_slots;
create policy "tb_inspection_slots_admin_write"
on public.tb_inspection_slots
for all
using (public.current_user_role() = 'ADMIN')
with check (public.current_user_role() = 'ADMIN');

drop policy if exists "tb_slot_blocks_select_allowed" on public.tb_slot_blocks;
create policy "tb_slot_blocks_select_allowed"
on public.tb_slot_blocks
for select
using (
  exists (
    select 1
    from public.tb_inspection_slots s
    where s.id = tb_slot_blocks.idslot
      and public.can_access_enterprise(s.identerprise)
  )
);

drop policy if exists "tb_slot_blocks_admin_write" on public.tb_slot_blocks;
create policy "tb_slot_blocks_admin_write"
on public.tb_slot_blocks
for all
using (public.current_user_role() = 'ADMIN')
with check (public.current_user_role() = 'ADMIN');
