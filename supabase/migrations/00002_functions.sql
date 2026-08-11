-- ============================================================
-- UPLOG · 00002 · Functions, triggers, views, search
-- ============================================================

-- ---------- Role helpers ----------
-- SECURITY DEFINER so they can read profiles without tripping RLS recursion.
create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role = 'admin' and is_active from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'manager') and is_active from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Disabled accounts keep a valid JWT until it expires; this shuts them out at
-- the policy level immediately.
create or replace function public.is_active_user()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select is_active from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---------- updated_at maintenance ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at        before update on public.profiles        for each row execute function public.set_updated_at();
create trigger trg_projects_updated_at        before update on public.projects        for each row execute function public.set_updated_at();
create trigger trg_tasks_updated_at           before update on public.tasks           for each row execute function public.set_updated_at();
create trigger trg_comments_updated_at        before update on public.task_comments   for each row execute function public.set_updated_at();
create trigger trg_daily_updates_updated_at   before update on public.daily_updates   for each row execute function public.set_updated_at();
create trigger trg_workspace_updated_at       before update on public.workspace_settings for each row execute function public.set_updated_at();

-- ---------- Profile auto-creation on signup ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Column-level guard on profiles ----------
-- Members may edit their own profile, but only admins may change
-- role / is_active / email. Enforced here because RLS is row-level only.
create or replace function public.enforce_profile_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- auth.uid() is null outside the client API path (service role, SQL
  -- editor, seeds) — those are trusted; the guard protects the API surface.
  if (new.role is distinct from old.role
      or new.is_active is distinct from old.is_active
      or new.email is distinct from old.email)
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only admins can change role, active status or email';
  end if;

  -- Audit sensitive changes
  if new.role is distinct from old.role then
    insert into public.audit_logs (actor_id, action, target_type, target_id, detail)
    values (auth.uid(), 'role_changed', 'profile', new.id,
            jsonb_build_object('from', old.role, 'to', new.role, 'user', new.full_name));
  end if;
  if new.is_active is distinct from old.is_active then
    insert into public.audit_logs (actor_id, action, target_type, target_id, detail)
    values (auth.uid(), case when new.is_active then 'user_enabled' else 'user_disabled' end,
            'profile', new.id, jsonb_build_object('user', new.full_name));
  end if;

  return new;
end;
$$;

create trigger trg_profile_guard
  before update on public.profiles
  for each row execute function public.enforce_profile_guard();

-- ---------- Task lifecycle ----------
-- AFTER INSERT: the task row must exist before activities/notifications
-- reference it via FK.
create or replace function public.handle_task_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  -- Falls back to creator_id so seeded/imported rows attribute correctly.
  v_actor uuid := coalesce(auth.uid(), new.creator_id);
begin
  insert into public.activities (actor_id, type, task_id, project_id, metadata)
  values (v_actor, 'task_created', new.id, new.project_id,
          jsonb_build_object('task_title', new.title));

  if new.assignee_id is not null and new.assignee_id is distinct from v_actor then
    insert into public.notifications (user_id, actor_id, type, task_id, project_id, message)
    values (new.assignee_id, v_actor, 'task_assigned', new.id, new.project_id,
            'assigned you "' || new.title || '"');
  end if;
  return new;
end;
$$;

create trigger trg_task_insert
  after insert on public.tasks
  for each row execute function public.handle_task_insert();

-- BEFORE UPDATE: sync completed_at and record status/assignment changes.
create or replace function public.handle_task_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if new.status is distinct from old.status then
    -- Keep completed_at in sync
    if new.status = 'done' then
      new.completed_at := now();
    elsif old.status = 'done' then
      new.completed_at := null;
    end if;

    insert into public.activities (actor_id, type, task_id, project_id, metadata)
    values (v_actor,
            (case when new.status = 'done' then 'task_completed'
                  else 'task_status_changed' end)::public.activity_type,
            new.id, new.project_id,
            jsonb_build_object('task_title', new.title,
                               'from_status', old.status, 'to_status', new.status));

    -- Tell the creator when someone else moves their task
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

create trigger trg_task_update
  before update on public.tasks
  for each row execute function public.handle_task_update();

-- ---------- Comments ----------
create or replace function public.handle_new_comment()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_task public.tasks%rowtype;
  v_target uuid;
begin
  select * into v_task from public.tasks where id = new.task_id;

  insert into public.activities (actor_id, type, task_id, project_id, metadata)
  values (new.author_id, 'comment_added', new.task_id, v_task.project_id,
          jsonb_build_object('task_title', v_task.title,
                             'snippet', left(new.body, 120)));

  -- Notify assignee and creator (deduped, never self)
  for v_target in
    select distinct u from unnest(array[v_task.assignee_id, v_task.creator_id]) as u
    where u is not null and u <> new.author_id
  loop
    insert into public.notifications (user_id, actor_id, type, task_id, project_id, message)
    values (v_target, new.author_id, 'comment_on_task', new.task_id, v_task.project_id,
            'commented on "' || v_task.title || '"');
  end loop;

  return new;
end;
$$;

create trigger trg_new_comment
  after insert on public.task_comments
  for each row execute function public.handle_new_comment();

-- Mark edits
create or replace function public.mark_comment_edited()
returns trigger
language plpgsql
as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_comment_edited
  before update on public.task_comments
  for each row execute function public.mark_comment_edited();

-- @Mentions: called by the app after inserting a comment. Validates that the
-- caller authored the comment, then notifies the mentioned users. SECURITY
-- DEFINER because users cannot insert notifications for others directly.
create or replace function public.notify_mentions(p_comment_id uuid, p_user_ids uuid[])
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_comment public.task_comments%rowtype;
  v_task public.tasks%rowtype;
  v_target uuid;
begin
  select * into v_comment from public.task_comments where id = p_comment_id;
  if v_comment.id is null or v_comment.author_id <> auth.uid() then
    raise exception 'Not allowed';
  end if;
  select * into v_task from public.tasks where id = v_comment.task_id;

  foreach v_target in array p_user_ids loop
    if v_target <> v_comment.author_id
       and exists (select 1 from public.profiles where id = v_target and is_active) then
      insert into public.notifications (user_id, actor_id, type, task_id, project_id, message)
      values (v_target, v_comment.author_id, 'mention', v_task.id, v_task.project_id,
              'mentioned you on "' || v_task.title || '"');
    end if;
  end loop;
end;
$$;

-- ---------- Daily updates ----------
create or replace function public.handle_new_daily_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.activities (actor_id, type, metadata)
  values (new.user_id, 'daily_update_created',
          jsonb_build_object('update_date', new.update_date,
                             'snippet', left(new.summary, 140)));
  return new;
end;
$$;

create trigger trg_new_daily_update
  after insert on public.daily_updates
  for each row execute function public.handle_new_daily_update();

-- ---------- Attachments ----------
create or replace function public.handle_new_attachment()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_task public.tasks%rowtype;
begin
  select * into v_task from public.tasks where id = new.task_id;
  insert into public.activities (actor_id, type, task_id, project_id, metadata)
  values (new.uploader_id, 'attachment_added', new.task_id, v_task.project_id,
          jsonb_build_object('task_title', v_task.title, 'file_name', new.file_name));
  return new;
end;
$$;

create trigger trg_new_attachment
  after insert on public.attachments
  for each row execute function public.handle_new_attachment();

-- ---------- Projects ----------
create or replace function public.handle_project_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activities (actor_id, type, project_id, metadata)
    values (coalesce(auth.uid(), new.owner_id), 'project_created', new.id,
            jsonb_build_object('project_name', new.name));
  elsif new.status is distinct from old.status then
    insert into public.activities (actor_id, type, project_id, metadata)
    values (auth.uid(), 'project_updated', new.id,
            jsonb_build_object('project_name', new.name,
                               'from_status', old.status, 'to_status', new.status));
    if new.status = 'archived' then
      insert into public.audit_logs (actor_id, action, target_type, target_id, detail)
      values (auth.uid(), 'project_archived', 'project', new.id,
              jsonb_build_object('project', new.name));
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_project_change
  after insert or update on public.projects
  for each row execute function public.handle_project_change();

create or replace function public.handle_new_project_member()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_project public.projects%rowtype;
begin
  select * into v_project from public.projects where id = new.project_id;

  insert into public.activities (actor_id, type, project_id, metadata)
  values (coalesce(auth.uid(), new.user_id), 'member_joined_project', new.project_id,
          jsonb_build_object('project_name', v_project.name,
                             'member_id', new.user_id::text));

  if new.user_id is distinct from auth.uid() then
    insert into public.notifications (user_id, actor_id, type, project_id, message)
    values (new.user_id, auth.uid(), 'added_to_project', new.project_id,
            'added you to ' || v_project.name);
  end if;
  return new;
end;
$$;

create trigger trg_new_project_member
  after insert on public.project_members
  for each row execute function public.handle_new_project_member();

-- ---------- Workspace settings audit ----------
create or replace function public.audit_workspace_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, target_type, detail)
  values (auth.uid(), 'workspace_updated', 'workspace',
          jsonb_build_object('name', new.name));
  return new;
end;
$$;

create trigger trg_workspace_audit
  after update on public.workspace_settings
  for each row execute function public.audit_workspace_change();

-- ---------- Due-soon notifications ----------
-- Run daily (pg_cron below). Notifies assignees of open tasks due within
-- 24 hours, at most once per task per day.
create or replace function public.notify_due_soon()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, task_id, project_id, message)
  select t.assignee_id, 'task_due_soon', t.id, t.project_id,
         '"' || t.title || '" is due ' ||
         case when t.due_date = current_date then 'today' else 'tomorrow' end
  from public.tasks t
  where t.assignee_id is not null
    and t.status in ('todo', 'in_progress', 'review')
    and t.due_date between current_date and current_date + 1
    and not exists (
      select 1 from public.notifications n
      where n.task_id = t.id and n.type = 'task_due_soon'
        and n.user_id = t.assignee_id
        and n.created_at > now() - interval '20 hours'
    );
end;
$$;

-- Schedule with pg_cron when available (Supabase: enable in Dashboard →
-- Database → Extensions). Safe no-op elsewhere.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('uplog-due-soon', '0 6 * * *', 'select public.notify_due_soon()');
  end if;
exception when others then
  raise notice 'pg_cron not scheduled: %', sqlerrm;
end;
$$;

-- ---------- Views ----------
-- security_invoker: the caller's RLS applies to the underlying tables.
create view public.project_stats
with (security_invoker = on) as
select
  p.id as project_id,
  count(t.id)                                        as total_tasks,
  count(t.id) filter (where t.status = 'done')       as done_tasks,
  count(t.id) filter (where t.status = 'in_progress') as in_progress_tasks,
  count(t.id) filter (where t.status = 'todo')       as todo_tasks,
  count(t.id) filter (where t.status = 'review')     as review_tasks,
  count(t.id) filter (where t.status in ('todo','in_progress','review')
                      and t.due_date < current_date) as overdue_tasks
from public.projects p
left join public.tasks t on t.project_id = p.id
group by p.id;

create view public.member_workload
with (security_invoker = on) as
select
  pr.id as user_id,
  count(t.id) filter (where t.status in ('todo','in_progress','review')) as open_tasks,
  count(t.id) filter (where t.status = 'in_progress')                    as in_progress_tasks,
  count(t.id) filter (where t.status = 'done'
                      and t.completed_at > now() - interval '7 days')    as done_last_7d,
  max(a.created_at)                                                      as last_activity_at
from public.profiles pr
left join public.tasks t on t.assignee_id = pr.id
left join public.activities a on a.actor_id = pr.id
group by pr.id;

-- ---------- Global search ----------
-- One round-trip for the command palette. SECURITY INVOKER: RLS applies.
create or replace function public.search_all(q text, max_results int default 20)
returns table (
  kind text,
  id uuid,
  title text,
  snippet text,
  task_id uuid,
  rank real
)
language sql stable
as $$
  with query as (select websearch_to_tsquery('english', q) as tsq)
  (
    select 'task'::text as kind, t.id as id, t.title as title,
           left(coalesce(t.description, ''), 140) as snippet,
           t.id as task_id,
           ts_rank(t.search_tsv, query.tsq) as rank
    from public.tasks t, query
    where t.search_tsv @@ query.tsq
    order by ts_rank(t.search_tsv, query.tsq) desc
    limit max_results
  )
  union all
  (
    select 'project', p.id, p.name, left(coalesce(p.description, ''), 140), null::uuid, 0.5::real
    from public.projects p
    where p.name ilike '%' || q || '%' or p.description ilike '%' || q || '%'
    limit 10
  )
  union all
  (
    select 'person', pr.id, pr.full_name,
           coalesce(pr.job_title, '') ||
           case when pr.department is not null then ' · ' || pr.department else '' end,
           null::uuid, 0.4::real
    from public.profiles pr
    where pr.full_name ilike '%' || q || '%' and pr.is_active
    limit 10
  )
  union all
  (
    select 'comment', c.id, left(c.body, 140), null, c.task_id,
           ts_rank(c.search_tsv, query.tsq)
    from public.task_comments c, query
    where c.search_tsv @@ query.tsq
    order by ts_rank(c.search_tsv, query.tsq) desc
    limit 10
  )
  union all
  (
    select 'daily_update', d.id,
           to_char(d.update_date, 'Mon DD, YYYY') || ' — daily update',
           left(d.summary, 140), null, ts_rank(d.search_tsv, query.tsq)
    from public.daily_updates d, query
    where d.search_tsv @@ query.tsq
    order by ts_rank(d.search_tsv, query.tsq) desc
    limit 10
  )
  order by rank desc
  limit max_results;
$$;
