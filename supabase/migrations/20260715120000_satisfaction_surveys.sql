-- Customer satisfaction surveys and reliable Huggy notification outbox.
-- Existing completed inspections are intentionally not backfilled.

create extension if not exists pgcrypto;

create table if not exists public.tb_satisfaction_surveys (
  id bigserial primary key,
  idinspection bigint not null references public.tb_inspections(id) on delete cascade,
  public_token uuid not null default gen_random_uuid(),
  status text not null default 'PENDING',
  service_rating smallint,
  broker_rating smallint,
  inspector_rating smallint,
  common_areas_rating smallint,
  unit_quality_rating smallint,
  recommendation_score smallint,
  positive_highlight text,
  feedback text,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint uq_satisfaction_surveys_inspection unique (idinspection),
  constraint uq_satisfaction_surveys_public_token unique (public_token),
  constraint ck_satisfaction_surveys_status check (status in ('PENDING', 'ANSWERED')),
  constraint ck_satisfaction_surveys_service_rating check (service_rating between 1 and 4),
  constraint ck_satisfaction_surveys_broker_rating check (broker_rating between 1 and 4),
  constraint ck_satisfaction_surveys_inspector_rating check (inspector_rating between 1 and 4),
  constraint ck_satisfaction_surveys_common_areas_rating check (common_areas_rating between 1 and 4),
  constraint ck_satisfaction_surveys_unit_quality_rating check (unit_quality_rating between 1 and 4),
  constraint ck_satisfaction_surveys_recommendation check (recommendation_score between 0 and 10),
  constraint ck_satisfaction_surveys_positive_highlight check (
    positive_highlight is null or positive_highlight in (
      'TEAM_SERVICE',
      'DELIVERY_ORGANIZATION',
      'PROPERTY_QUALITY',
      'INFORMATION_TRANSPARENCY'
    )
  ),
  constraint ck_satisfaction_surveys_answer check (
    (status = 'PENDING' and answered_at is null)
    or
    (
      status = 'ANSWERED'
      and answered_at is not null
      and service_rating is not null
      and broker_rating is not null
      and inspector_rating is not null
      and common_areas_rating is not null
      and unit_quality_rating is not null
      and recommendation_score is not null
    )
  )
);

create table if not exists public.tb_satisfaction_notifications (
  id bigserial primary key,
  idsurvey bigint not null references public.tb_satisfaction_surveys(id) on delete cascade,
  kind text not null,
  status text not null default 'PENDING',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  huggy_contact_id text,
  huggy_chat_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint uq_satisfaction_notifications_kind unique (idsurvey, kind),
  constraint ck_satisfaction_notifications_kind check (kind in ('INITIAL', 'REMINDER')),
  constraint ck_satisfaction_notifications_status check (
    status in ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELED')
  ),
  constraint ck_satisfaction_notifications_attempts check (attempts >= 0)
);

create index if not exists idx_satisfaction_surveys_status_created
  on public.tb_satisfaction_surveys(status, created_at);

create index if not exists idx_satisfaction_notifications_due
  on public.tb_satisfaction_notifications(status, next_attempt_at);

alter table public.tb_satisfaction_surveys enable row level security;
alter table public.tb_satisfaction_notifications enable row level security;

create or replace function public.create_satisfaction_survey_after_inspection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  survey_id bigint;
begin
  if new.status in ('ACEITE', 'RECUSA') and old.status is distinct from new.status then
    insert into public.tb_satisfaction_surveys (idinspection)
    values (new.id)
    on conflict (idinspection) do update
      set idinspection = excluded.idinspection
    returning id into survey_id;

    insert into public.tb_satisfaction_notifications (
      idsurvey,
      kind,
      next_attempt_at
    )
    values
      (survey_id, 'INITIAL', now()),
      (survey_id, 'REMINDER', now() + interval '24 hours')
    on conflict (idsurvey, kind) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_create_satisfaction_survey on public.tb_inspections;
create trigger trg_create_satisfaction_survey
after update of status on public.tb_inspections
for each row
execute function public.create_satisfaction_survey_after_inspection();

create or replace function public.claim_satisfaction_notifications(p_limit integer default 10)
returns setof public.tb_satisfaction_notifications
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Recupera trabalhos interrompidos por reinicio do processo.
  update public.tb_satisfaction_notifications
  set
    status = case when attempts < 4 then 'PENDING' else 'FAILED' end,
    next_attempt_at = now(),
    updated_at = now(),
    last_error = coalesce(last_error, 'Processamento interrompido antes da conclusao')
  where status = 'PROCESSING'
    and updated_at < now() - interval '10 minutes';

  update public.tb_satisfaction_notifications n
  set
    status = 'CANCELED',
    updated_at = now()
  from public.tb_satisfaction_surveys s
  where s.id = n.idsurvey
    and s.status = 'ANSWERED'
    and n.status in ('PENDING', 'PROCESSING', 'FAILED');

  return query
  with due as (
    select n.id
    from public.tb_satisfaction_notifications n
    join public.tb_satisfaction_surveys s on s.id = n.idsurvey
    where n.status = 'PENDING'
      and n.next_attempt_at <= now()
      and n.attempts < 4
      and s.status = 'PENDING'
    order by n.next_attempt_at, n.id
    for update of n skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ), claimed as (
    update public.tb_satisfaction_notifications n
    set
      status = 'PROCESSING',
      attempts = n.attempts + 1,
      updated_at = now()
    from due
    where n.id = due.id
    returning n.*
  )
  select * from claimed;
end;
$$;

revoke all on function public.claim_satisfaction_notifications(integer) from public;
grant execute on function public.claim_satisfaction_notifications(integer) to service_role;
