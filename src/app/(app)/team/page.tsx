import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { UserAvatar } from "@/components/user-avatar";
import { createClient } from "@/lib/supabase/server";
import { subHours } from "date-fns";
import { cn, relativeTime } from "@/lib/utils";
import type { Profile } from "@/types/database";

export const metadata: Metadata = { title: "Team" };

type WorkloadRow = {
  user_id: string;
  open_tasks: number;
  in_progress_tasks: number;
  done_last_7d: number;
  last_activity_at: string | null;
};

const ROLE_STYLES: Record<Profile["role"], string> = {
  admin: "bg-primary/12 text-primary",
  manager: "bg-info/12 text-info",
  member: "bg-secondary text-secondary-foreground",
};

export default async function TeamPage() {
  const supabase = await createClient();

  const [{ data: profiles }, { data: workload }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("full_name")
      .overrideTypes<Profile[]>(),
    supabase.from("member_workload").select("*").overrideTypes<WorkloadRow[]>(),
  ]);

  const workloadById = new Map((workload ?? []).map((w) => [w.user_id, w]));
  const active = (profiles ?? []).filter((p) => p.is_active);

  // "Working now" = activity in the last 4 hours.
  const workingCutoff = subHours(new Date(), 4).getTime();

  return (
    <>
      <PageHeader
        title="Team"
        description={`${active.length} ${active.length === 1 ? "person" : "people"} in your workspace.`}
      />

      {active.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teammates yet"
          description="Invite your team to register and they'll show up here."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((p) => {
            const w = workloadById.get(p.id);
            const lastActivity = w?.last_activity_at;
            const working =
              lastActivity && new Date(lastActivity).getTime() > workingCutoff;
            return (
              <Link
                key={p.id}
                href={`/team/${p.id}`}
                className="group rounded-xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar
                    name={p.full_name}
                    avatarUrl={p.avatar_url}
                    className="size-11"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold group-hover:text-primary">
                      {p.full_name}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {p.job_title ?? "—"}
                      {p.department && ` · ${p.department}`}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn("ml-auto capitalize", ROLE_STYLES[p.role])}
                  >
                    {p.role}
                  </Badge>
                </div>

                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      working ? "bg-success" : "bg-muted-foreground/40"
                    )}
                    aria-hidden
                  />
                  {working
                    ? "Working now"
                    : lastActivity
                      ? `Active ${relativeTime(lastActivity)}`
                      : "No activity yet"}
                  <span className="ml-auto tabular-nums">
                    {w?.open_tasks ?? 0} open{" "}
                    {(w?.open_tasks ?? 0) === 1 ? "task" : "tasks"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
