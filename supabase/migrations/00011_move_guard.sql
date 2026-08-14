-- ============================================================
-- UPLOG · 00011 · Meeting-board move guard notification
--
-- When someone who is NOT the assignee tries to move a ticket on the
-- Standard Meeting board, the UI blocks it and calls this RPC so the
-- assignee gets a notification to go talk to that person.
-- SECURITY DEFINER because clients cannot insert notifications directly.
-- ============================================================

create or replace function public.notify_move_attempt(p_task_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_task public.tasks%rowtype;
  v_actor uuid := auth.uid();
  v_actor_name text;
begin
  -- Caller must be a real, active teammate.
  if v_actor is null or not exists (
    select 1 from public.profiles where id = v_actor and is_active
  ) then
    raise exception 'Not allowed';
  end if;

  select * into v_task from public.tasks where id = p_task_id;
  if v_task.id is null
     or v_task.assignee_id is null
     or v_task.assignee_id = v_actor then
    return; -- nothing to notify
  end if;

  select full_name into v_actor_name from public.profiles where id = v_actor;

  -- At most one such notification per task per actor per hour (no spam).
  if exists (
    select 1 from public.notifications n
    where n.task_id = p_task_id
      and n.user_id = v_task.assignee_id
      and n.actor_id = v_actor
      and n.type = 'task_status_changed'
      and n.message like '%tried to move%'
      and n.created_at > now() - interval '1 hour'
  ) then
    return;
  end if;

  insert into public.notifications (user_id, actor_id, type, task_id, project_id, message)
  values (
    v_task.assignee_id, v_actor, 'task_status_changed', v_task.id, v_task.project_id,
    'tried to move your ticket "' || v_task.title ||
    '" on the meeting board — please communicate with them if there is any problem'
  );
end;
$$;

grant execute on function public.notify_move_attempt(uuid) to authenticated;
