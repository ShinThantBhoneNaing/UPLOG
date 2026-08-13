-- ============================================================
-- UPLOG · 00009 · Time-taken: activity-log fallback + backfill
--
-- Tasks that entered In Progress BEFORE automatic time tracking was
-- installed have no started_at, so completing them produced no
-- time_taken. Fix:
--   1. Backfill started_at for open tasks from the activity log.
--   2. On completion, if started_at is missing, derive it from the
--      recorded "moved to in progress" activity.
--   3. Stamp started_at when a task is created directly as In Progress.
-- ============================================================

-- ---------- 1. backfill open in-progress tasks ----------
update public.tasks t
set started_at = sub.started
from (
  select a.task_id, max(a.created_at) as started
  from public.activities a
  where a.type = 'task_status_changed'
    and a.metadata ->> 'to_status' = 'in_progress'
  group by a.task_id
) sub
where t.id = sub.task_id
  and t.status in ('in_progress', 'review')
  and t.started_at is null;

-- Also backfill already-done tasks that missed their time.
update public.tasks t
set started_at = sub.started,
    time_taken_hours = round(extract(epoch from (t.completed_at - sub.started)) / 3600.0, 2)
from (
  select a.task_id, max(a.created_at) as started
  from public.activities a
  where a.type = 'task_status_changed'
    and a.metadata ->> 'to_status' = 'in_progress'
  group by a.task_id
) sub
where t.id = sub.task_id
  and t.status = 'done'
  and t.completed_at is not null
  and t.time_taken_hours is null
  and sub.started <= t.completed_at;

-- ---------- 2. completion fallback in the trigger ----------
create or replace function public.handle_task_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if new.status is distinct from old.status then
    -- First move into In Progress starts the clock.
    if new.status = 'in_progress' and new.started_at is null then
      new.started_at := now();
    end if;

    if new.status = 'done' then
      new.completed_at := now();
      -- Fallback: recover the start time from the activity log for tasks
      -- that predate automatic tracking.
      if new.started_at is null then
        select max(a.created_at) into new.started_at
        from public.activities a
        where a.task_id = new.id
          and a.type = 'task_status_changed'
          and a.metadata ->> 'to_status' = 'in_progress';
      end if;
      if new.started_at is not null then
        new.time_taken_hours :=
          round(extract(epoch from (now() - new.started_at)) / 3600.0, 2);
      end if;
    elsif old.status = 'done' then
      -- Reopened: clear completion data, keep the original start time.
      new.completed_at := null;
      new.time_taken_hours := null;
    end if;

    insert into public.activities (actor_id, type, task_id, project_id, metadata)
    values (v_actor,
            (case when new.status = 'done' then 'task_completed'
                  else 'task_status_changed' end)::public.activity_type,
            new.id, new.project_id,
            jsonb_build_object('task_title', new.title,
                               'from_status', old.status, 'to_status', new.status));

    if old.creator_id is not null and old.creator_id is distinct from v_actor then
      insert into public.notifications (user_id, actor_id, type, task_id, project_id, message)
      values (old.creator_id, v_actor, 'task_status_changed', new.id, new.project_id,
              'moved "' || new.title || '" to ' || replace(new.status::text, '_', ' '));
    end if;
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    insert into public.activities (actor_id, type, task_id, project_id, metadata)
    values (v_actor, 'task_assigned', new.id, new.project_id,
            jsonb_build_object('task_title', new.title));

    if new.assignee_id is not null and new.assignee_id is distinct from v_actor then
      insert into public.notifications (user_id, actor_id, type, task_id, project_id, message)
      values (new.assignee_id, v_actor, 'task_assigned', new.id, new.project_id,
              'assigned you "' || new.title || '"');
    end if;
  end if;

  return new;
end;
$$;

-- ---------- 3. tasks created directly as In Progress ----------
create or replace function public.stamp_started_at_on_insert()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('in_progress', 'review') and new.started_at is null then
    new.started_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_task_insert_started on public.tasks;
create trigger trg_task_insert_started
  before insert on public.tasks
  for each row execute function public.stamp_started_at_on_insert();
