-- Inspector portal, enterprise orientation PDFs, complete inspection history,
-- manual satisfaction delivery and corrected cancellation/rejection metrics.

create extension if not exists pgcrypto;

alter type public."inspections-status"
  add value if not exists 'RECUSA_EM_ABERTO';

alter table public.tb_users
  drop constraint if exists tb_users_role_check;
alter table public.tb_users
  add constraint tb_users_role_check
  check (role in ('ADMIN', 'USER', 'INSPECTOR', 'VIEWER'));

alter table public.tb_inspections
  add column if not exists counts_as_rejection boolean not null default false;

alter table public.tb_rejections
  add column if not exists source text not null default 'INSPECTION';

alter table public.tb_rejections
  drop constraint if exists tb_rejections_source_check;
alter table public.tb_rejections
  add constraint tb_rejections_source_check
  check (source in ('INSPECTION', 'CANCELLATION'));

create table if not exists public.tb_enterprise_documents (
  id bigserial primary key,
  identerprise bigint not null references public.tb_enterprises(id) on delete cascade,
  kind text not null default 'ORIENTATION',
  title text not null,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  content_base64 text not null,
  public_token uuid not null default gen_random_uuid(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint uq_enterprise_documents_public_token unique (public_token),
  constraint ck_enterprise_documents_kind check (kind in ('ORIENTATION')),
  constraint ck_enterprise_documents_pdf check (mime_type = 'application/pdf'),
  constraint ck_enterprise_documents_size check (
    size_bytes > 0 and size_bytes <= 10485760
  )
);

create unique index if not exists uq_enterprise_active_orientation
  on public.tb_enterprise_documents(identerprise, kind)
  where active = true;

create table if not exists public.tb_system_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.tb_inspection_events (
  id bigserial primary key,
  idinspection bigint not null references public.tb_inspections(id) on delete cascade,
  event_type text not null,
  previous_status text,
  new_status text,
  previous_datetime timestamptz,
  new_datetime timestamptz,
  inspector text,
  obs text,
  counts_as_rejection boolean not null default false,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint ck_inspection_events_type check (
    event_type in ('SCHEDULED', 'STATUS_CHANGED', 'RESCHEDULED', 'UPDATED')
  )
);

create index if not exists idx_inspection_events_inspection_created
  on public.tb_inspection_events(idinspection, created_at);

alter table public.tb_enterprise_documents enable row level security;
alter table public.tb_system_settings enable row level security;
alter table public.tb_inspection_events enable row level security;

create or replace function public.log_inspection_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text;
begin
  if tg_op = 'INSERT' then
    insert into public.tb_inspection_events (
      idinspection,
      event_type,
      new_status,
      new_datetime,
      inspector,
      obs,
      counts_as_rejection,
      metadata
    )
    values (
      new.id,
      'SCHEDULED',
      new.status,
      new.datetime,
      new.inspector,
      new.obs,
      coalesce(new.counts_as_rejection, false),
      jsonb_build_object('mobuss', new.mobuss)
    );
    return new;
  end if;

  if old.status is distinct from new.status
     or old.counts_as_rejection is distinct from new.counts_as_rejection then
    kind := 'STATUS_CHANGED';
  elsif old.datetime is distinct from new.datetime then
    kind := 'RESCHEDULED';
  elsif old.inspector is distinct from new.inspector
     or old.obs is distinct from new.obs
     or old.mobuss is distinct from new.mobuss then
    kind := 'UPDATED';
  else
    return new;
  end if;

  insert into public.tb_inspection_events (
    idinspection,
    event_type,
    previous_status,
    new_status,
    previous_datetime,
    new_datetime,
    inspector,
    obs,
    counts_as_rejection,
    metadata
  )
  values (
    new.id,
    kind,
    old.status,
    new.status,
    old.datetime,
    new.datetime,
    new.inspector,
    new.obs,
    coalesce(new.counts_as_rejection, false),
    jsonb_build_object(
      'previous_inspector', old.inspector,
      'previous_obs', old.obs,
      'mobuss', new.mobuss
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_log_inspection_event on public.tb_inspections;
create trigger trg_log_inspection_event
after insert or update on public.tb_inspections
for each row execute function public.log_inspection_event();

-- The tablet is now the primary survey channel. Completing an inspection creates
-- the survey, but WhatsApp is only queued by the explicit manual-send endpoint.
create or replace function public.create_satisfaction_survey_after_inspection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('ACEITE', 'RECUSA', 'RECUSA_EM_ABERTO')
     and old.status is distinct from new.status then
    insert into public.tb_satisfaction_surveys (idinspection)
    values (new.id)
    on conflict (idinspection) do nothing;
  end if;
  return new;
end;
$$;

update public.tb_satisfaction_notifications
set
  status = 'CANCELED',
  updated_at = now(),
  last_error = coalesce(last_error, 'Envio automatico desativado; use o disparo manual')
where status in ('PENDING', 'PROCESSING');

alter table public.tb_satisfaction_surveys
  drop constraint if exists ck_satisfaction_surveys_service_rating,
  drop constraint if exists ck_satisfaction_surveys_broker_rating,
  drop constraint if exists ck_satisfaction_surveys_inspector_rating,
  drop constraint if exists ck_satisfaction_surveys_common_areas_rating,
  drop constraint if exists ck_satisfaction_surveys_unit_quality_rating;

alter table public.tb_satisfaction_surveys
  add constraint ck_satisfaction_surveys_service_rating
    check (service_rating between 1 and 5),
  add constraint ck_satisfaction_surveys_broker_rating
    check (broker_rating between 1 and 5),
  add constraint ck_satisfaction_surveys_inspector_rating
    check (inspector_rating between 1 and 5),
  add constraint ck_satisfaction_surveys_common_areas_rating
    check (common_areas_rating between 1 and 5),
  add constraint ck_satisfaction_surveys_unit_quality_rating
    check (unit_quality_rating between 1 and 5);
