-- ============================================================
-- UPLOG · 00012 · Accurate time taken: sum of In-Progress periods
--
-- Previously time_taken = first-In-Progress → Done as one span, so a
-- ticket bounced back to To Do (or left overnight in To Do) counted the
-- whole wall-clock gap. Now time_taken = the SUM of the periods the
-- ticket actually spent in in_progress/review, reconstructed from the
-- immutable activity log. Also recomputes all existing done tasks.
-- ============================================================

-- ---------- helper: accumulated active seconds for a task ----------
create or replace function public.active_seconds(p_task_id uuid, p_until timestamptz)
returns numeric
language sql stable security definer set search_path = public
as $$
  with segs as (
    select
      a.created_at as ts,
      lead(a.created_at) over (order by a.created_at) as next_ts,
      a.metadata ->> 'to_status' as to_status
    from public.activities a
    where a.task_id = p_task_id
      and a.type in ('task_status_changed', 'task_completed')
      and a.created_at <= p_until
  )
  select coalesce(sum(
    extract(epoch from (least(coalesce(next_ts, p_until), p_until) - ts))
  ), 0)
  from segs
  where to_status in ('in_progress', 'review');
$$;

-- ---------- trigger: use accumulated time on completion ----------
create or replace function public.handle_task_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_secs numeric;
begin
  if new.status is distinct from old.status then
    -- First move into In Progress starts the clock (kept for display).
    if new.status in ('in_progress', 'review') and new.started_at is null then
      new.started_at := now();
    end if;

    if new.status = 'done' then
      new.completed_at := now();
      -- Sum every period the task actually spent in progress. The
      -- current open period (since the last status change) ends now.
      v_secs := public.active_seconds(new.id, now());
      -- If the task is completing straight from in_progress/review, the
      -- log already contains the segment start; if it was NEVER in
      -- progress, v_secs is 0 → no time recorded (honest).
      if v_secs > 0 then
        new.time_taken_hours := round(v_secs / 3600.0, 2);
      elsif new.started_at is not null then
        -- Fallback for tasks predating the activity log
        new.time_taken_hours :=
          round(extract(epoch from (now() - new.started_at)) / 3600.0, 2);
      end if;
    elsif old.status = 'done' then
      -- Reopened: clear completion data; periods stay in the log and
      -- will be re-summed on the next completion.
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

-- ---------- recompute all existing done tasks ----------
update public.tasks t
set time_taken_hours = sub.hours
from (
  select t2.id,
         round(public.active_seconds(t2.id, t2.completed_at) / 3600.0, 2) as hours
  from public.tasks t2
  where t2.status = 'done' and t2.completed_at is not null
) sub
where t.id = sub.id
  and sub.hours > 0;
