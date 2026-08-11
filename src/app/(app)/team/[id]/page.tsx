import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckSquare, Mail } from "lucide-react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/user-avatar";
import { ActivityItem } from "@/features/activity/activity-item";
import { StatusBadge, PriorityBadge } from "@/features/tasks/components/badges";
import { ACTIVITY_WITH_ACTOR } from "@/features/tasks/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type {
  ActivityWithActor,
  DailyUpdate,
  Profile,
  Task,
} from "@/types/database";

export const metadata: Metadata = { title: "Profile" };

export default async function MemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();

  const [
    { data: member },
    { data: openTasks },
    { data: activities },
    { data: updates },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle<Profile>(),
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_date")
      .eq("assignee_id", id)
      .in("status", ["todo", "in_progress", "review"])
      .order("updated_at", { ascending: false })
      .limit(10)
      .overrideTypes<Pick<Task, "id" | "title" | "status" | "priority" | "due_date">[]>(),
    supabase
      .from("activities")
      .select(ACTIVITY_WITH_ACTOR)
      .eq("actor_id", id)
      .order("created_at", { ascending: false })
      .limit(20)
      .overrideTypes<ActivityWithActor[]>(),
    supabase
      .from("daily_updates")
      .select("*")
      .eq("user_id", id)
      .order("update_date", { ascending: false })
      .limit(7)
      .overrideTypes<DailyUpdate[]>(),
  ]);

  if (!member) notFound();

  return (
    <div>
      <Link
        href="/team"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to team
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <UserAvatar
          name={member.full_name}
          avatarUrl={member.avatar_url}
          className="size-16"
        />
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
            {member.full_name}
            <Badge variant="secondary" className="capitalize">
              {member.role}
            </Badge>
            {!member.is_active && (
              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                Disabled
              </Badge>
            )}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {member.job_title ?? "—"}
            {member.department && ` · ${member.department}`}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="size-3.5" aria-hidden />
            {member.email} · Joined {formatDate(member.created_at)}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <section aria-label="Recent activity">
            <h2 className="mb-1 text-sm font-semibold text-muted-foreground">
              Recent activity
            </h2>
            {activities?.length ? (
              <ul className="divide-y rounded-xl border bg-card px-4">
                {activities.map((a) => (
                  <ActivityItem key={a.id} activity={a} />
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                No activity yet.
              </p>
            )}
          </section>

          {(updates?.length ?? 0) > 0 && (
            <>
              <Separator className="my-6" />
              <section aria-label="Recent daily updates">
                <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                  Recent daily updates
                </h2>
                <ul className="space-y-3">
                  {updates!.map((u) => (
                    <li key={u.id} className="rounded-xl border bg-card p-4">
                      <p className="text-xs font-medium text-muted-foreground">
                        {formatDate(u.update_date)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                        {u.summary}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>

        <aside aria-label="Open tasks" className="lg:border-l lg:pl-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <CheckSquare className="size-4" aria-hidden />
            Open tasks ({openTasks?.length ?? 0})
          </h2>
          {openTasks?.length ? (
            <ul className="space-y-2.5">
              {openTasks.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/tasks/${t.id}`}
                    className="block rounded-lg border bg-card p-3 transition-shadow hover:shadow-sm"
                  >
                    <p className="line-clamp-2 text-sm font-medium">{t.title}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <StatusBadge status={t.status} />
                      <PriorityBadge priority={t.priority} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No open tasks.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
