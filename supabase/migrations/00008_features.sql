-- ============================================================
-- UPLOG · 00008 · Phone, delete policy, public stand-up share
--
-- 1. profiles.phone (optional contact number)
-- 2. Deleting tasks becomes manager/admin-only
-- 3. Public read-only Standard Meeting share:
--    a secret token on workspace_settings + a SECURITY DEFINER RPC
--    that returns the board for a date WITHOUT authentication,
--    but ONLY when the correct token is presented.
-- ============================================================

-- ---------- 1. phone ----------
alter table public.profiles
  add column if not exists phone text
  check (phone is null or char_length(phone) <= 40);

-- ---------- 2. delete tasks: manager/admin only ----------
drop policy if exists "tasks: creator or manager deletes" on public.tasks;
drop policy if exists "tasks: managers delete" on public.tasks;

create policy "tasks: managers delete"
  on public.tasks for delete
  to authenticated
  using (public.is_manager_or_admin());

-- ---------- 3. stand-up share token ----------
alter table public.workspace_settings
  add column if not exists standup_share_token uuid not null default gen_random_uuid();

-- Admins can rotate the link (invalidates the old one).
create or replace function public.rotate_standup_share_token()
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_token uuid;
begin
  if not public.is_manager_or_admin() then
    raise exception 'Not allowed';
  end if;
  update public.workspace_settings
     set standup_share_token = gen_random_uuid()
   where id = 1
   returning standup_share_token into v_token;
  return v_token;
end;
$$;

-- Public board snapshot. SECURITY DEFINER bypasses RLS on purpose;
-- the ONLY gate is the secret token. Exposes just what the meeting
-- wall shows: names, titles, statuses, per-person tracked hours.
create or replace function public.get_standup_share(p_token uuid, p_date date default current_date)
returns jsonb
language plpgsql security definer set search_path = public
stable
as $$
declare
  v_rows jsonb;
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
        where t.assignee_id = pr.id and t.status = 'todo'
      ), '[]'::jsonb),
      'in_progress', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', t.id, 'title', t.title, 'priority', t.priority,
                 'project', proj.name))
        from public.tasks t
        left join public.projects proj on proj.id = t.project_id
        where t.assignee_id = pr.id and t.status in ('in_progress', 'review')
      ), '[]'::jsonb),
      'done', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', t.id, 'title', t.title, 'priority', t.priority,
                 'project', proj.name, 'time_taken_hours', t.time_taken_hours))
        from public.tasks t
        left join public.projects proj on proj.id = t.project_id
        where t.assignee_id = pr.id
          and t.completed_at >= p_date::timestamptz
          and t.completed_at < (p_date + 1)::timestamptz
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

-- Callable without a session.
grant execute on function public.get_standup_share(uuid, date) to anon;
