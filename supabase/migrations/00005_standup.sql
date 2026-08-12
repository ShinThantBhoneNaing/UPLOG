-- ============================================================
-- UPLOG · 00005 · Standard Meeting support
--
-- Adds the one field the stand-up board needs (an optional time
-- estimate per task) and indexes for per-day board queries.
-- Run this in the Supabase SQL Editor like the previous migrations.
-- ============================================================

alter table public.tasks
  add column if not exists estimate_hours numeric(5, 2)
  check (estimate_hours is null or (estimate_hours > 0 and estimate_hours <= 999));

comment on column public.tasks.estimate_hours is
  'Optional planned effort in hours. Displayed as "est." on the Standard Meeting board — actual time tracking is a separate future concept.';

-- Board queries: "tasks completed on day D" and "tasks created on day D".
create index if not exists idx_tasks_completed_at
  on public.tasks (completed_at)
  where completed_at is not null;

create index if not exists idx_tasks_created_at
  on public.tasks (created_at);
