-- ============================================================
-- Tasks that are born "done" get a completed_at stamp.
--
-- completed_at was only maintained by the BEFORE UPDATE trigger, so a task
-- inserted straight into 'done' (quick-add from the Standard Meeting board,
-- logging work after the fact) kept completed_at NULL and then vanished:
-- the stand-up Done column and the reports both select by completed_at.
--
-- BEFORE INSERT, because the existing trg_task_insert fires AFTER and so
-- cannot modify the row.
-- ============================================================

create or replace function public.handle_task_insert_completed()
returns trigger
language plpgsql set search_path = public
as $$
begin
  -- Only fill a missing stamp: explicit values (seeds, imports) win.
  if new.status = 'done' and new.completed_at is null then
    new.completed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_task_insert_completed on public.tasks;
create trigger trg_task_insert_completed
  before insert on public.tasks
  for each row execute function public.handle_task_insert_completed();
