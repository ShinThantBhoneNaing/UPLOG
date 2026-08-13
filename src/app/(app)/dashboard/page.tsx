import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Loader2,
  NotebookPen,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { UserAvatar } from "@/components/user-avatar";
import { ActivityItem } from "@/features/activity/activity-item";
import { ProjectProgress } from "@/features/projects/project-progress";
import { getCurrentProfile } from "@/features/shell/get-current-profile";
import { ACTIVITY_WITH_ACTOR } from "@/features/tasks/queries";
import { createClient } from "@/lib/supabase/server";
import { cn, greeting } from "@/lib/utils";
import type {
  ActivityWithActor,
  ProjectStats,
  ProfileLite,
} from "@/types/database";

export const metadata: Metadata = { title: "Dashboard" };

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  href: string;
  tone?: "danger" | "success";
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border bg-card p-4 shadow-xs transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon
          className={cn(
            "size-4",
            tone === "danger"
              ? "text-destructive"
              : tone === "success"
                ? "text-success"
                : "text-primary"
          )}
          aria-hidden
        />
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums",
          tone === "danger" && value > 0 && "text-destructive"
        )}
      >
        {value}
      </p>
    </Link>
  );
}

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const startOfToday = `${today}T00:00:00`;
  const isManager = profile.role === "admin" || profile.role === "manager";

  const [
    { count: myOpen },
    { count: myInProgress },
    { count: myDoneToday },
    { count: myOverdue },
    { data: activities },
    { data: myUpdate },
    workloadRes,
    projectsRes,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignee_id", profile.id)
      .in("status", ["todo", "in_progress", "review"]),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignee_id", profile.id)
      .eq("status", "in_progress"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignee_id", profile.id)
      .eq("status", "done")
      .gte("completed_at", startOfToday),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignee_id", profile.id)
      .in("status", ["todo", "in_progress", "review"])
      .lt("due_date", today),
    supabase
      .from("activities")
      .select(ACTIVITY_WITH_ACTOR)
      .gte("created_at", startOfToday)
      .order("created_at", { ascending: false })
      .limit(12)
      .overrideTypes<ActivityWithActor[]>(),
    supabase
      .from("daily_updates")
      .select("id")
      .eq("user_id", profile.id)
      .eq("update_date", today)
      .maybeSingle(),
    isManager
      ? supabase.from("member_workload").select("*")
      : Promise.resolve({ data: null }),
    isManager
      ? supabase
          .from("projects")
          .select("id, name, status")
          .eq("status", "active")
          .limit(6)
      : Promise.resolve({ data: null }),
  ]);

  // Manager extras fetched in a second small round (depends on project list).
  let projectStats: (ProjectStats & { name: string })[] = [];
  if (isManager && projectsRes.data?.length) {
    const ids = projectsRes.data.map((p) => p.id);
    const { data: stats } = await supabase
      .from("project_stats")
      .select("*")
      .in("project_id", ids)
      .overrideTypes<ProjectStats[]>();
    const nameById = new Map(projectsRes.data.map((p) => [p.id, p.name]));
    projectStats = (stats ?? [])
      .map((s) => ({ ...s, name: nameById.get(s.project_id) ?? "" }))
      .sort((a, b) => b.total_tasks - a.total_tasks);
  }

  // member_workload is a view (no FK metadata for embedding) — join profiles here.
  type WorkloadRow = {
    user_id: string;
    open_tasks: number;
    in_progress_tasks: number;
    done_tasks: number;
    profile: ProfileLite;
  };
  let workload: WorkloadRow[] = [];
  if (isManager && workloadRes.data?.length) {
    const { data: teamProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("is_active", true)
      .overrideTypes<ProfileLite[]>();
    const byId = new Map((teamProfiles ?? []).map((p) => [p.id, p]));
    workload = (
      workloadRes.data as Omit<WorkloadRow, "profile">[]
    )
      .flatMap((w) => {
        const p = byId.get(w.user_id);
        return p ? [{ ...w, profile: p }] : [];
      })
      .sort((a, b) => b.open_tasks - a.open_tasks);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {greeting(profile.full_name)} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening today.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="My open tasks"
          value={myOpen ?? 0}
          icon={CheckSquare}
          href="/tasks"
        />
        <StatCard
          label="In progress"
          value={myInProgress ?? 0}
          icon={Loader2}
          href="/tasks"
        />
        <StatCard
          label="Completed today"
          value={myDoneToday ?? 0}
          icon={CheckCircle2}
          href="/tasks"
          tone="success"
        />
        <StatCard
          label="Overdue"
          value={myOverdue ?? 0}
          icon={AlertTriangle}
          href="/tasks"
          tone="danger"
        />
      </div>

      {!myUpdate && isManager && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <NotebookPen className="size-5 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-medium">
                What did you work on today?
              </p>
              <p className="text-xs text-muted-foreground">
                A quick daily update keeps your team in the loop.
              </p>
            </div>
          </div>
          <Button size="sm" render={<Link href="/daily" />}>
            Log today&apos;s work
          </Button>
        </div>
      )}

      <div
        className={cn(
          "mt-8 grid gap-8",
          isManager && "lg:grid-cols-[1fr_320px]"
        )}
      >
        <section aria-label="Today's team activity">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Today&apos;s team activity
            </h2>
            <Link
              href="/activity"
              className="text-xs font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          {activities?.length ? (
            <ul className="divide-y rounded-xl border bg-card px-4">
              {activities.map((a) => (
                <ActivityItem key={a.id} activity={a} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={ActivityIcon}
              title="Quiet so far today"
              description="Team activity will appear here as work happens."
            />
          )}
        </section>

        {isManager && (
          <div className="space-y-8">
            {workload.length > 0 && (
              <section aria-label="Team workload">
                <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                  Team workload
                </h2>
                <ul className="space-y-2 rounded-xl border bg-card p-4">
                  {workload.slice(0, 8).map((w) => (
                    <li key={w.user_id} className="flex items-center gap-2.5">
                      <UserAvatar
                        name={w.profile.full_name}
                        avatarUrl={w.profile.avatar_url}
                        className="size-7"
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/team/${w.user_id}`}
                          className="block truncate text-sm font-medium hover:underline"
                        >
                          {w.profile.full_name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {w.open_tasks} open · {w.done_tasks} done
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {projectStats.length > 0 && (
              <section aria-label="Project progress">
                <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                  Project progress
                </h2>
                <ul className="space-y-4 rounded-xl border bg-card p-4">
                  {projectStats.slice(0, 5).map((s) => (
                    <li key={s.project_id}>
                      <Link
                        href={`/projects/${s.project_id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {s.name}
                      </Link>
                      <ProjectProgress stats={s} showNumbers={false} className="mt-1" />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
