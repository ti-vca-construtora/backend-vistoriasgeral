-- Daily, idempotent reminders for inspections scheduled for the next day.

create table if not exists public.tb_inspection_reminder_notifications (
  id bigserial primary key,
  idinspection bigint not null references public.tb_inspections(id) on delete cascade,
  inspection_date date not null,
  status text not null default 'PENDING',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  huggy_contact_id text,
  huggy_chat_id text,
  huggy_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint uq_inspection_reminder_date unique (idinspection, inspection_date),
  constraint ck_inspection_reminder_status check (
    status in ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELED')
  ),
  constraint ck_inspection_reminder_attempts check (attempts >= 0)
);

create index if not exists idx_inspection_reminders_due
  on public.tb_inspection_reminder_notifications(status, next_attempt_at);

alter table public.tb_inspection_reminder_notifications enable row level security;

create or replace function public.claim_inspection_reminder_notifications(
  p_limit integer default 10
)
returns setof public.tb_inspection_reminder_notifications
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tb_inspection_reminder_notifications
  set
    status = case when attempts < 4 then 'PENDING' else 'FAILED' end,
    next_attempt_at = now(),
    updated_at = now(),
    last_error = coalesce(last_error, 'Processamento interrompido antes da conclusao')
  where status = 'PROCESSING'
    and updated_at < now() - interval '10 minutes';

  return query
  with due as (
    select notification.id
    from public.tb_inspection_reminder_notifications notification
    where notification.status = 'PENDING'
      and notification.next_attempt_at <= now()
      and notification.attempts < 4
    order by notification.next_attempt_at, notification.id
    for update of notification skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ), claimed as (
    update public.tb_inspection_reminder_notifications notification
    set
      status = 'PROCESSING',
      attempts = notification.attempts + 1,
      updated_at = now()
    from due
    where notification.id = due.id
    returning notification.*
  )
  select * from claimed;
end;
$$;

revoke all on function public.claim_inspection_reminder_notifications(integer) from public;
grant execute on function public.claim_inspection_reminder_notifications(integer) to service_role;
