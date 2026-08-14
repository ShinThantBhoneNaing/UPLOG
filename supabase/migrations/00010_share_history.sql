-- ============================================================
-- UPLOG · 00010 · Shared stand-up board: browse any day
--
-- The share link is permanent (until rotated). This upgrade makes the
-- shared board date-aware, matching the internal board's semantics:
--   today      → live wall (open tasks + completed today)
--   past day D → Done = completed on D · In Progress = tasks with real
--                recorded activity on D · To Do = created on D, never started
-- ============================================================

create or replace function public.get_standup_share(p_token uuid, p_date date default current_date)
returns jsonb
language plpgsql security definer set search_path = public
stable
as $$
declare
  v_rows jsonb;
  v_is_today boolean := p_date >= current_date;
  v_start timestamptz := p_date::timestamptz;
  v_end   timestamptz := (p_date + 1)::timestamptz;
begin
  if not exists (
    select 1 from public.workspace_settings
    where id = 1 and standup_share_token = p_token
  ) then
    raise exception 'Invalid share link';
  end if;

  select coalesce(jsonb_agg(row_data order by row_data->>'name'), '[]'::jsonb)
  into v_rows
  from (
    select jsonb_build_object(
      'id', pr.id,
      'name', pr.full_name,
      'avatar_url', pr.avatar_url,
      'job_title', pr.job_title,
      'todo', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', t.id, 'title', t.title, 'priority', t.priority,
                 'project', proj.name))
        from public.tasks t
        left join public.projects proj on proj.id = t.project_id
        where t.assignee_id = pr.id
          and t.status = 'todo'
          and (v_is_today or (t.created_at >= v_start and t.created_at < v_end))
      ), '[]'::jsonb),
      'in_progress', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', t.id, 'title', t.title, 'priority', t.priority,
                 'project', proj.name))
        from public.tasks t
        left join public.projects proj on proj.id = t.project_id
        where t.assignee_id = pr.id
          and (
            (v_is_today and t.status in ('in_progress', 'review'))
            or
            (not v_is_today
             and not (t.completed_at >= v_start and t.completed_at < v_end)
             and exists (
               select 1 from public.activities a
               where a.task_id = t.id
                 and a.created_at >= v_start and a.created_at < v_end
                 and a.type in ('task_created','task_status_changed','task_assigned','comment_added','attachment_added')
             )
             and not (t.status = 'todo' and t.created_at >= v_start and t.created_at < v_end)
            )
          )
      ), '[]'::jsonb),
      'done', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', t.id, 'title', t.title, 'priority', t.priority,
                 'project', proj.name, 'time_taken_hours', t.time_taken_hours))
        from public.tasks t
        left join public.projects proj on proj.id = t.project_id
        where t.assignee_id = pr.id
          and t.completed_at >= v_start
          and t.completed_at < v_end
      ), '[]'::jsonb)
    ) as row_data
    from public.profiles pr
    where pr.is_active
  ) sub
  where (row_data->'todo' <> '[]'::jsonb
      or row_data->'in_progress' <> '[]'::jsonb
      or row_data->'done' <> '[]'::jsonb);

  return jsonb_build_object(
    'date', p_date,
    'workspace', (select name from public.workspace_settings where id = 1),
    'rows', v_rows
  );
end;
$$;

grant execute on function public.get_standup_share(uuid, date) to anon;
