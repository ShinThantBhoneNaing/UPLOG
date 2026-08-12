import { addDays, format, parseISO, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { TASK_WITH_RELATIONS } from "@/features/tasks/queries";
import type { ProfileLite, TaskWithRelations } from "@/types/database";

/**
 * Standard Meeting data assembly.
 *
 * Date semantics (deliberately no extra "planned_date" column — zero double
 * entry, and history works retroactively from immutable records):
 *  - TODAY:      To Do = open todo tasks · In Progress = in_progress/review
 *                now · Done = completed today. (The live wall.)
 *  - PAST DAY D: Done = completed_at on D · In Progress = tasks with real
 *                recorded activity on D (status moves, comments, creation)
 *                that weren't completed on D · To Do = tasks created on D
 *                that never got started that day.
 */

export interface StandupRow {
  profile: ProfileLite;
  todo: TaskWithRelations[];
  inProgress: TaskWithRelations[];
  done: TaskWithRelations[];
  /** Sum of estimate_hours across this row's cards (estimates, not actuals). */
  estHours: number;
}

export interface StandupSummary {
  employees: number;
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  estHours: number;
}

export interface StandupHistoryDay {
  date: string; // yyyy-MM-dd
  total: number;
  done: number;
}

export interface StandupData {
  date: string;
  isToday: boolean;
  rows: StandupRow[];
  summary: StandupSummary;
  history: StandupHistoryDay[];
  profiles: ProfileLite[];
  projects: { id: string; name: string }[];
}

const ACTIVITY_TYPES_WORKED = [
  "task_created",
  "task_status_changed",
  "task_assigned",
  "task_completed",
  "comment_added",
  "attachment_added",
];

function dayRange(date: string): { start: string; end: string } {
  const d = parseISO(`${date}T00:00:00Z`);
  return { start: d.toISOString(), end: addDays(d, 1).toISOString() };
}

export async function getStandupData(date: string): Promise<StandupData> {
  const supabase = await createClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const isToday = date >= today; // future dates behave like today's live board
  const { start, end } = dayRange(date);
  const historyStart = dayRange(format(subDays(new Date(), 6), "yyyy-MM-dd")).start;

  const [
    { data: profiles },
    { data: projects },
    { data: doneTasks },
    openRes,
    touchedRes,
    { data: historyDone },
    { data: historyTouched },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, job_title")
      .eq("is_active", true)
      .order("full_name")
      .overrideTypes<ProfileLite[]>(),
    supabase
      .from("projects")
      .select("id, name")
      .in("status", ["active", "paused"])
      .order("name"),
    // Done column: tasks completed on D (works for any date).
    supabase
      .from("tasks")
      .select(TASK_WITH_RELATIONS)
      .gte("completed_at", start)
      .lt("completed_at", end)
      .limit(400)
      .overrideTypes<TaskWithRelations[]>(),
    // Today: the current open board.
    isToday
      ? supabase
          .from("tasks")
          .select(TASK_WITH_RELATIONS)
          .in("status", ["todo", "in_progress", "review"])
          .not("assignee_id", "is", null)
          .order("position")
          .limit(500)
          .overrideTypes<TaskWithRelations[]>()
      : Promise.resolve({ data: null }),
    // Past day: which tasks saw real activity on D, and by whom.
    !isToday
      ? supabase
          .from("activities")
          .select("task_id, actor_id, type, created_at")
          .gte("created_at", start)
          .lt("created_at", end)
          .in("type", ACTIVITY_TYPES_WORKED)
          .not("task_id", "is", null)
          .limit(2000)
      : Promise.resolve({ data: null }),
    // 7-day history strip.
    supabase
      .from("tasks")
      .select("id, completed_at")
      .gte("completed_at", historyStart)
      .limit(2000),
    supabase
      .from("activities")
      .select("task_id, created_at")
      .gte("created_at", historyStart)
      .in("type", ACTIVITY_TYPES_WORKED)
      .not("task_id", "is", null)
      .limit(5000),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const done = doneTasks ?? [];

  /* ---------- Column assembly ---------- */
  let todo: TaskWithRelations[] = [];
  let inProgress: TaskWithRelations[] = [];
  // Attribution for past days when a task has no assignee: the actor.
  const actorByTask = new Map<string, string>();

  if (isToday) {
    const open = openRes.data ?? [];
    todo = open.filter((t) => t.status === "todo");
    inProgress = open.filter(
      (t) => t.status === "in_progress" || t.status === "review"
    );
  } else {
    const touched = touchedRes.data ?? [];
    const doneIds = new Set(done.map((t) => t.id));
    const workedIds: string[] = [];
    for (const a of touched) {
      if (!a.task_id || doneIds.has(a.task_id)) continue;
      if (!workedIds.includes(a.task_id)) workedIds.push(a.task_id);
      if (a.actor_id && !actorByTask.has(a.task_id)) {
        actorByTask.set(a.task_id, a.actor_id);
      }
    }
    if (workedIds.length) {
      const { data: workedTasks } = await supabase
        .from("tasks")
        .select(TASK_WITH_RELATIONS)
        .in("id", workedIds.slice(0, 400))
        .overrideTypes<TaskWithRelations[]>();
      // Created that day and still never started that day → To Do;
      // everything else that was touched → worked on (In Progress).
      for (const t of workedTasks ?? []) {
        const createdOnD = t.created_at >= start && t.created_at < end;
        if (createdOnD && t.status === "todo") todo.push(t);
        else inProgress.push(t);
      }
    }
  }

  /* ---------- Group by employee ---------- */
  const rowByUser = new Map<string, StandupRow>();
  const rowFor = (userId: string | null | undefined): StandupRow | null => {
    const key = userId ?? "";
    const profile = profileById.get(key);
    if (!profile) return null;
    let row = rowByUser.get(key);
    if (!row) {
      row = { profile, todo: [], inProgress: [], done: [], estHours: 0 };
      rowByUser.set(key, row);
    }
    return row;
  };
  const attribute = (t: TaskWithRelations): string | null =>
    t.assignee?.id ?? actorByTask.get(t.id) ?? t.creator_id;

  for (const t of todo) rowFor(attribute(t))?.todo.push(t);
  for (const t of inProgress) rowFor(attribute(t))?.inProgress.push(t);
  for (const t of done) rowFor(attribute(t))?.done.push(t);

  const rows = [...rowByUser.values()]
    .map((row) => ({
      ...row,
      estHours: [...row.todo, ...row.inProgress, ...row.done].reduce(
        (sum, t) => sum + (t.estimate_hours ?? 0),
        0
      ),
    }))
    .sort((a, b) => a.profile.full_name.localeCompare(b.profile.full_name));

  /* ---------- Summary ---------- */
  const summary: StandupSummary = {
    employees: rows.length,
    total: rows.reduce(
      (n, r) => n + r.todo.length + r.inProgress.length + r.done.length,
      0
    ),
    todo: rows.reduce((n, r) => n + r.todo.length, 0),
    inProgress: rows.reduce((n, r) => n + r.inProgress.length, 0),
    done: rows.reduce((n, r) => n + r.done.length, 0),
    estHours: rows.reduce((n, r) => n + r.estHours, 0),
  };

  /* ---------- 7-day history ---------- */
  const doneByDay = new Map<string, number>();
  for (const t of historyDone ?? []) {
    if (!t.completed_at) continue;
    const d = t.completed_at.slice(0, 10);
    doneByDay.set(d, (doneByDay.get(d) ?? 0) + 1);
  }
  const touchedByDay = new Map<string, Set<string>>();
  for (const a of historyTouched ?? []) {
    if (!a.task_id) continue;
    const d = a.created_at.slice(0, 10);
    (touchedByDay.get(d) ?? touchedByDay.set(d, new Set()).get(d)!).add(a.task_id);
  }
  const history: StandupHistoryDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = format(subDays(new Date(), i), "yyyy-MM-dd");
    history.push({
      date: d,
      total: Math.max(touchedByDay.get(d)?.size ?? 0, doneByDay.get(d) ?? 0),
      done: doneByDay.get(d) ?? 0,
    });
  }

  return {
    date,
    isToday,
    rows,
    summary,
    history,
    profiles: profiles ?? [],
    projects: projects ?? [],
  };
}
