do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'tb_slot_blocks'
      and constraint_name = 'tb_slot_blocks_idslot_fkey'
  ) then
    alter table public.tb_slot_blocks
      drop constraint tb_slot_blocks_idslot_fkey;
  end if;

  alter table public.tb_slot_blocks
    add constraint tb_slot_blocks_idslot_fkey
    foreign key (idslot)
    references public.tb_inspection_slots(id)
    on delete cascade;
end $$;
