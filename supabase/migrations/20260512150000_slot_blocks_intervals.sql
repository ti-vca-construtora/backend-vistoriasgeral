alter table public.tb_slot_blocks
  add column if not exists start_time time,
  add column if not exists end_time time;

update public.tb_slot_blocks
set
  start_time = coalesce(start_time, time),
  end_time = coalesce(
    end_time,
    case
      when time >= time '23:30' then time '23:59:59'
      else time + interval '30 minutes'
    end
  )
where start_time is null
   or end_time is null;

alter table public.tb_slot_blocks
  alter column start_time set not null,
  alter column end_time set not null;

alter table public.tb_slot_blocks
  drop constraint if exists tb_slot_blocks_start_before_end;

alter table public.tb_slot_blocks
  add constraint tb_slot_blocks_start_before_end
  check (start_time < end_time);

create unique index if not exists uq_tb_slot_blocks_interval
  on public.tb_slot_blocks(idslot, start_time, end_time);
