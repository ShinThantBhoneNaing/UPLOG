-- ============================================================
-- UPLOG · 00006 · Fixes + automatic time tracking
--
-- 1. Fix member_workload double-counting (join fan-out: each task was
--    multiplied by the member's activity rows → "4 done" for 1 task).
-- 2. Automatic "time taken": started_at is stamped when a task first
--    moves to In Progress; time_taken_hours is computed when it's Done.
--    No manual entry needed.
--
-- Idempotent — safe to run even if 00005 was skipped.
-- ============================================================

-- ---------- from 00005, in case it wasn't run ----------
alter table public.tasks
  add column if not exists estimate_hours numeric(5, 2)
  check (estimate_hours is null or (estimate_hours > 0 and estimate_hours <= 999));

create index if not exists idx_tasks_completed_at
  on public.tasks (completed_at) where completed_at is not null;

create index if not exists idx_tasks_created_at
  on public.tasks (created_at);

-- ---------- automatic time tracking ----------
alter table public.tasks
  add column if not exists started_at timestamptz;

alter table public.tasks
  add column if not exists time_taken_hours numeric(7, 2)
  check (time_taken_hours is null or time_taken_hours >= 0);

comment on column public.tasks.started_at is
  'Stamped automatically the first time the task moves to in_progress.';
comment on column public.tasks.time_taken_hours is
  'Auto-computed on completion: hours between started_at and completed_at.';

-- ---------- fixed workload view (count DISTINCT to kill fan-out) ----------
create or replace view public.member_workload
with (security_invoker = on) as
select
  pr.id as user_id,
  count(distinct t.id) filter (where t.status in ('todo','in_progress','review')) as open_tasks,
  count(distinct t.id) filter (where t.status = 'in_progress')                    as in_progress_tasks,
  count(distinct t.id) filter (where t.status = 'done'
                               and t.completed_at > now() - interval '7 days')    as done_last_7d,
  max(a.created_at)                                                               as last_activity_at
from public.profiles pr
left join public.tasks t on t.assignee_id = pr.id
left join public.activities a on a.actor_id = pr.id
group by pr.id;

-- ---------- task update trigger: stamp started_at / compute time taken ----------
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
      -- Time taken = In Progress → Done. Null if it never was in progress.
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
