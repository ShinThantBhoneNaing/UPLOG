import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format, subDays } from "date-fns";
import { PageHeader } from "@/components/page-header";
import { UserAvatar } from "@/components/user-avatar";
import { ProjectProgress } from "@/features/projects/project-progress";
import { TrendChart, type TrendPoint } from "@/features/reports/trend-chart";
import { getCurrentProfile } from "@/features/shell/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { ProjectStats, ProfileLite } from "@/types/database";

export const metadata: Metadata = { title: "Reports" };

const RANGES = [
  { key: "1", label: "Today", days: 1 },
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin" && profile.role !== "manager") {
    redirect("/dashboard");
  }

  const { range: rawRange } = await searchParams;
  const range = RANGES.find((r) => r.key === rawRange) ?? RANGES[1];
  const since = subDays(new Date(), range.days).toISOString();
  const sinceDate = since.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const trendSince = subDays(new Date(), 13).toISOString().slice(0, 10);

  const supabase = await createClient();

  const [
    { count: completed },
    { count: created },
    { count: overdue },
    { count: updates },
    { count: activityCount },
    { data: trendRows },
    { data: workloadRows },
    { data: profiles },
    { data: projects },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "done")
      .gte("completed_at", since),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["todo", "in_progress", "review"])
      .lt("due_date", today),
    supabase
      .from("daily_updates")
      .select("id", { count: "exact", head: true })
      .gte("update_date", sinceDate),
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    supabase
      .from("activities")
      .select("created_at")
      .gte("created_at", `${trendSince}T00:00:00`)
      .limit(5000),
    supabase.from("member_workload").select("*"),
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("is_active", true)
      .overrideTypes<ProfileLite[]>(),
    supabase
      .from("projects")
      .select("id, name")
      .eq("status", "active")
      .order("name"),
  ]);

  // 14-day activity trend, grouped by local day.
  const byDay = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    byDay.set(format(subDays(new Date(), i), "yyyy-MM-dd"), 0);
  }
  for (const row of trendRows ?? []) {
    const key = row.created_at.slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const trend: TrendPoint[] = [...byDay.entries()].map(([iso, count]) => ({
    day: format(new Date(`${iso}T12:00:00`), "EEE d"),
    count,
  }));

  // Workload joined with profiles (view has no FK metadata for embedding).
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  type W = {
    user_id: string;
    open_tasks: number;
    in_progress_tasks: number;
    done_last_7d: number;
  };
  const workload = ((workloadRows as W[] | null) ?? [])
    .flatMap((w) => {
      const p = profileById.get(w.user_id);
      return p ? [{ ...w, profile: p }] : [];
    })
    .sort((a, b) => b.open_tasks - a.open_tasks);
  const maxOpen = Math.max(1, ...workload.map((w) => w.open_tasks));

  // Project completion.
  let projectStats: (ProjectStats & { name: string })[] = [];
  if (projects?.length) {
    const { data: stats } = await supabase
      .from("project_stats")
      .select("*")
      .in(
        "project_id",
        projects.map((p) => p.id)
      )
      .overrideTypes<ProjectStats[]>();
    const nameById = new Map(projects.map((p) => [p.id, p.name]));
    projectStats = (stats ?? [])
      .map((s) => ({ ...s, name: nameById.get(s.project_id) ?? "" }))
      .sort((a, b) => b.total_tasks - a.total_tasks);
  }

  const tiles = [
    { label: "Tasks completed", value: completed ?? 0 },
    { label: "Tasks created", value: created ?? 0 },
    { label: "Overdue now", value: overdue ?? 0, danger: true },
    { label: "Daily updates", value: updates ?? 0 },
    { label: "Activity events", value: activityCount ?? 0 },
  ];

  return (
    <>
      <PageHeader
        title="Reports"
        description="How the team is doing — productivity, workload and progress."
        actions={
          <div
            role="group"
            aria-label="Date range"
            className="flex rounded-lg border bg-card p-0.5"
          >
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/reports?range=${r.key}`}
                aria-current={r.key === range.key ? "true" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  r.key === range.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>
        }
      />

      {/* Stat tiles — numbers are the display, no chart needed */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p
              className={cn(
                "mt-1.5 text-2xl font-semibold tabular-nums",
                t.danger && t.value > 0 && "text-destructive"
              )}
            >
              {t.value}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t.label === "Overdue now" ? "right now" : `last ${range.label.toLowerCase()}`}
            </p>
          </div>
        ))}
      </div>

      <section aria-label="Activity trend" className="mt-8 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Activity — last 14 days</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          All recorded team events per day.
        </p>
        <TrendChart data={trend} />
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section aria-label="Team workload" className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">Team workload</h2>
          {workload.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <ul className="space-y-3">
              {workload.map((w) => (
                <li key={w.user_id}>
                  <div className="flex items-center gap-2 text-sm">
                    <UserAvatar
                      name={w.profile.full_name}
                      avatarUrl={w.profile.avatar_url}
                      className="size-6"
                    />
                    <Link
                      href={`/team/${w.user_id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {w.profile.full_name}
                    </Link>
                    <span className="ml-auto tabular-nums text-muted-foreground">
                      {w.open_tasks} open · {w.done_last_7d} done/wk
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[var(--chart-1)]"
                      style={{ width: `${(w.open_tasks / maxOpen) * 100}%` }}
                      aria-hidden
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Project progress" className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">Project progress</h2>
          {projectStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active projects.</p>
          ) : (
            <ul className="space-y-5">
              {projectStats.map((s) => (
                <li key={s.project_id}>
                  <Link
                    href={`/projects/${s.project_id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {s.name}
                  </Link>
                  <ProjectProgress stats={s} className="mt-1" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
