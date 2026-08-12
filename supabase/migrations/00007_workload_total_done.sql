-- ============================================================
-- UPLOG · 00007 · Workload "done" = total done tickets
--
-- The workload view previously reported done tasks from the last 7 days;
-- it now reports the member's total completed-ticket count.
-- ============================================================

drop view if exists public.member_workload;

create view public.member_workload
with (security_invoker = on) as
select
  pr.id as user_id,
  count(distinct t.id) filter (where t.status in ('todo','in_progress','review')) as open_tasks,
  count(distinct t.id) filter (where t.status = 'in_progress')                    as in_progress_tasks,
  count(distinct t.id) filter (where t.status = 'done')                           as done_tasks,
  max(a.created_at)                                                               as last_activity_at
from public.profiles pr
left join public.tasks t on t.assignee_id = pr.id
left join public.activities a on a.actor_id = pr.id
group by pr.id;
