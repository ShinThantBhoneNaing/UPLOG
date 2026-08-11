-- ============================================================
-- UPLOG · 00003 · Row Level Security
--
-- Model: UPLOG is a single-workspace team tool. Active, authenticated
-- teammates can READ workspace data (team transparency is the product).
-- WRITES are constrained per table. Disabled accounts (is_active = false)
-- lose all access immediately via is_active_user().
-- activities / notifications / audit_logs have NO client insert policies —
-- they are written exclusively by SECURITY DEFINER triggers.
-- ============================================================

alter table public.profiles           enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.projects           enable row level security;
alter table public.project_members    enable row level security;
alter table public.tasks              enable row level security;
alter table public.labels             enable row level security;
alter table public.task_labels        enable row level security;
alter table public.task_comments      enable row level security;
alter table public.daily_updates      enable row level security;
alter table public.daily_update_tasks enable row level security;
alter table public.activities         enable row level security;
alter table public.notifications      enable row level security;
alter table public.attachments        enable row level security;
alter table public.audit_logs         enable row level security;

-- ---------- profiles ----------
create policy "profiles: team can read"
  on public.profiles for select
  to authenticated
  using (public.is_active_user());

create policy "profiles: edit own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() and public.is_active_user())
  with check (id = auth.uid());
  -- role / is_active / email changes blocked by trg_profile_guard

create policy "profiles: admin edits any"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (true);

-- No insert (trigger-only via auth.users), no delete (soft-disable instead).

-- ---------- workspace_settings ----------
create policy "workspace: team can read"
  on public.workspace_settings for select
  to authenticated
  using (public.is_active_user());

create policy "workspace: admin updates"
  on public.workspace_settings for update
  to authenticated
  using (public.is_admin())
  with check (true);

-- ---------- projects ----------
create policy "projects: team can read"
  on public.projects for select
  to authenticated
  using (public.is_active_user());

create policy "projects: managers create"
  on public.projects for insert
  to authenticated
  with check (public.is_manager_or_admin());

create policy "projects: owner or manager updates"
  on public.projects for update
  to authenticated
  using (public.is_active_user()
         and (owner_id = auth.uid() or public.is_manager_or_admin()))
  with check (public.is_active_user()
         and (owner_id = auth.uid() or public.is_manager_or_admin()));

create policy "projects: admin deletes"
  on public.projects for delete
  to authenticated
  using (public.is_admin());

-- ---------- project_members ----------
create policy "project_members: team can read"
  on public.project_members for select
  to authenticated
  using (public.is_active_user());

create policy "project_members: managers or owner manage"
  on public.project_members for insert
  to authenticated
  with check (
    public.is_active_user()
    and (
      public.is_manager_or_admin()
      or exists (select 1 from public.projects p
                 where p.id = project_id and p.owner_id = auth.uid())
      -- members may join a project themselves
      or user_id = auth.uid()
    )
  );

create policy "project_members: managers, owner or self remove"
  on public.project_members for delete
  to authenticated
  using (
    public.is_active_user()
    and (
      public.is_manager_or_admin()
      or user_id = auth.uid()
      or exists (select 1 from public.projects p
                 where p.id = project_id and p.owner_id = auth.uid())
    )
  );

-- ---------- tasks ----------
create policy "tasks: team can read"
  on public.tasks for select
  to authenticated
  using (public.is_active_user());

create policy "tasks: active users create"
  on public.tasks for insert
  to authenticated
  with check (public.is_active_user() and creator_id = auth.uid());

create policy "tasks: involved users update"
  on public.tasks for update
  to authenticated
  using (
    public.is_active_user()
    and (creator_id = auth.uid()
         or assignee_id = auth.uid()
         or public.is_manager_or_admin())
  )
  with check (public.is_active_user());

create policy "tasks: creator or manager deletes"
  on public.tasks for delete
  to authenticated
  using (
    public.is_active_user()
    and (creator_id = auth.uid() or public.is_manager_or_admin())
  );

-- ---------- labels ----------
create policy "labels: team can read"
  on public.labels for select
  to authenticated
  using (public.is_active_user());

create policy "labels: active users create"
  on public.labels for insert
  to authenticated
  with check (public.is_active_user());

create policy "labels: managers delete"
  on public.labels for delete
  to authenticated
  using (public.is_manager_or_admin());

-- ---------- task_labels ----------
-- Whoever may update the task may label it.
create policy "task_labels: team can read"
  on public.task_labels for select
  to authenticated
  using (public.is_active_user());

create policy "task_labels: task editors manage"
  on public.task_labels for insert
  to authenticated
  with check (
    public.is_active_user()
    and exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (t.creator_id = auth.uid() or t.assignee_id = auth.uid()
             or public.is_manager_or_admin())
    )
  );

create policy "task_labels: task editors remove"
  on public.task_labels for delete
  to authenticated
  using (
    public.is_active_user()
    and exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (t.creator_id = auth.uid() or t.assignee_id = auth.uid()
             or public.is_manager_or_admin())
    )
  );

-- ---------- task_comments ----------
create policy "comments: team can read"
  on public.task_comments for select
  to authenticated
  using (public.is_active_user());

create policy "comments: author creates"
  on public.task_comments for insert
  to authenticated
  with check (public.is_active_user() and author_id = auth.uid());

create policy "comments: author edits"
  on public.task_comments for update
  to authenticated
  using (public.is_active_user() and author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "comments: author or admin deletes"
  on public.task_comments for delete
  to authenticated
  using (public.is_active_user()
         and (author_id = auth.uid() or public.is_admin()));

-- ---------- daily_updates ----------
create policy "daily_updates: team can read"
  on public.daily_updates for select
  to authenticated
  using (public.is_active_user());

create policy "daily_updates: own create"
  on public.daily_updates for insert
  to authenticated
  with check (public.is_active_user() and user_id = auth.uid());

create policy "daily_updates: own edit"
  on public.daily_updates for update
  to authenticated
  using (public.is_active_user() and user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "daily_updates: own or admin delete"
  on public.daily_updates for delete
  to authenticated
  using (public.is_active_user()
         and (user_id = auth.uid() or public.is_admin()));

-- ---------- daily_update_tasks ----------
create policy "daily_update_tasks: team can read"
  on public.daily_update_tasks for select
  to authenticated
  using (public.is_active_user());

create policy "daily_update_tasks: own manage"
  on public.daily_update_tasks for insert
  to authenticated
  with check (
    public.is_active_user()
    and exists (select 1 from public.daily_updates d
                where d.id = daily_update_id and d.user_id = auth.uid())
  );

create policy "daily_update_tasks: own remove"
  on public.daily_update_tasks for delete
  to authenticated
  using (
    public.is_active_user()
    and exists (select 1 from public.daily_updates d
                where d.id = daily_update_id and d.user_id = auth.uid())
  );

-- ---------- activities (read-only for clients) ----------
create policy "activities: team can read"
  on public.activities for select
  to authenticated
  using (public.is_active_user());

-- ---------- notifications (own only; written by triggers) ----------
create policy "notifications: read own"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "notifications: mark own read"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notifications: delete own"
  on public.notifications for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------- attachments ----------
create policy "attachments: team can read"
  on public.attachments for select
  to authenticated
  using (public.is_active_user());

create policy "attachments: uploader creates"
  on public.attachments for insert
  to authenticated
  with check (public.is_active_user() and uploader_id = auth.uid());

create policy "attachments: uploader or manager deletes"
  on public.attachments for delete
  to authenticated
  using (public.is_active_user()
         and (uploader_id = auth.uid() or public.is_manager_or_admin()));

-- ---------- audit_logs (admin read-only) ----------
create policy "audit_logs: admin reads"
  on public.audit_logs for select
  to authenticated
  using (public.is_admin());

-- ---------- Realtime ----------
-- Only the tables where live updates carry real value.
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.activities;
