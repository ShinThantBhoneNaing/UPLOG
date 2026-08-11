-- ============================================================
-- UPLOG · 00001 · Schema: enums, tables, indexes
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Enums ----------
create type public.user_role as enum ('admin', 'manager', 'member');
create type public.task_status as enum ('todo', 'in_progress', 'review', 'done', 'cancelled');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.project_status as enum ('active', 'paused', 'completed', 'archived');
create type public.activity_type as enum (
  'task_created', 'task_updated', 'task_status_changed', 'task_assigned',
  'task_completed', 'comment_added', 'daily_update_created', 'attachment_added',
  'project_created', 'project_updated', 'member_joined_project'
);
create type public.notification_type as enum (
  'task_assigned', 'mention', 'comment_on_task', 'task_due_soon',
  'task_status_changed', 'added_to_project'
);

-- ---------- profiles ----------
-- One row per auth user, created by trigger on auth.users.
-- Soft-disable via is_active (never hard-delete people: history must survive).
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (char_length(full_name) between 1 and 120),
  email       text not null unique,
  avatar_url  text,
  job_title   text check (char_length(job_title) <= 120),
  department  text check (char_length(department) <= 120),
  role        public.user_role not null default 'member',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- workspace_settings (single row) ----------
create table public.workspace_settings (
  id         int primary key default 1 check (id = 1),
  name       text not null default 'UPLOG' check (char_length(name) between 1 and 80),
  logo_url   text,
  updated_at timestamptz not null default now()
);
insert into public.workspace_settings (id) values (1);

-- ---------- projects ----------
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 4000),
  status      public.project_status not null default 'active',
  owner_id    uuid references public.profiles (id) on delete set null,
  start_date  date,
  due_date    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- ---------- tasks ----------
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references public.projects (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  description  text check (char_length(description) <= 10000),
  status       public.task_status not null default 'todo',
  priority     public.task_priority not null default 'medium',
  assignee_id  uuid references public.profiles (id) on delete set null,
  creator_id   uuid references public.profiles (id) on delete set null,
  due_date     date,
  -- Fractional ordering for the Kanban board (insert between neighbors
  -- without rewriting the column).
  position     double precision not null default extract(epoch from clock_timestamp()),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Full-text search over title + description
  search_tsv   tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored
);

-- ---------- labels ----------
create table public.labels (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (char_length(name) between 1 and 40),
  color      text not null default '#F8694A' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);

create table public.task_labels (
  task_id  uuid not null references public.tasks (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  primary key (task_id, label_id)
);

-- ---------- task_comments ----------
create table public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 8000),
  edited_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_tsv tsvector generated always as (to_tsvector('english', coalesce(body, ''))) stored
);

-- ---------- daily_updates ----------
-- One journal entry per person per day.
create table public.daily_updates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  update_date date not null default current_date,
  summary     text not null check (char_length(summary) between 1 and 8000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  search_tsv  tsvector generated always as (to_tsvector('english', coalesce(summary, ''))) stored,
  unique (user_id, update_date)
);

create table public.daily_update_tasks (
  daily_update_id uuid not null references public.daily_updates (id) on delete cascade,
  task_id         uuid not null references public.tasks (id) on delete cascade,
  primary key (daily_update_id, task_id)
);

-- ---------- activities ----------
-- The immutable team feed. Written ONLY by triggers (no client insert policy).
-- task_id/project_id are SET NULL on delete so history survives; metadata
-- keeps the display context (titles, status names) forever.
create table public.activities (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles (id) on delete set null,
  type       public.activity_type not null,
  task_id    uuid references public.tasks (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- notifications ----------
-- Written ONLY by triggers / SECURITY DEFINER functions.
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  type       public.notification_type not null,
  task_id    uuid references public.tasks (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  message    text not null check (char_length(message) <= 500),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- attachments ----------
create table public.attachments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks (id) on delete cascade,
  uploader_id  uuid references public.profiles (id) on delete set null,
  file_name    text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique,
  mime_type    text not null,
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 20 * 1024 * 1024),
  created_at   timestamptz not null default now()
);

-- ---------- audit_logs ----------
-- Security-sensitive actions. Admin-read-only; written by triggers.
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  target_type text not null,
  target_id   uuid,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- Indexes ----------
create index idx_tasks_assignee      on public.tasks (assignee_id) where assignee_id is not null;
create index idx_tasks_project       on public.tasks (project_id) where project_id is not null;
create index idx_tasks_status        on public.tasks (status);
create index idx_tasks_due_date      on public.tasks (due_date) where due_date is not null;
create index idx_tasks_board         on public.tasks (status, position);
create index idx_tasks_search        on public.tasks using gin (search_tsv);

create index idx_comments_task       on public.task_comments (task_id, created_at);
create index idx_comments_search     on public.task_comments using gin (search_tsv);

create index idx_daily_updates_user  on public.daily_updates (user_id, update_date desc);
create index idx_daily_updates_date  on public.daily_updates (update_date desc);
create index idx_daily_updates_search on public.daily_updates using gin (search_tsv);

create index idx_activities_created  on public.activities (created_at desc);
create index idx_activities_actor    on public.activities (actor_id, created_at desc);
create index idx_activities_project  on public.activities (project_id, created_at desc) where project_id is not null;
create index idx_activities_task     on public.activities (task_id) where task_id is not null;
create index idx_activities_type     on public.activities (type, created_at desc);

create index idx_notifications_user  on public.notifications (user_id, created_at desc);
create index idx_notifications_unread on public.notifications (user_id) where read_at is null;

create index idx_attachments_task    on public.attachments (task_id);
create index idx_audit_logs_created  on public.audit_logs (created_at desc);
create index idx_project_members_user on public.project_members (user_id);
create index idx_projects_status     on public.projects (status);
