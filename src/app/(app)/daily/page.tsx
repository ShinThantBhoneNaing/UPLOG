import type { Metadata } from "next";
import { format, subDays } from "date-fns";
import { NotebookPen } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { UserAvatar } from "@/components/user-avatar";
import { DailyForm } from "@/features/daily/daily-form";
import { getCurrentProfile } from "@/features/shell/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { formatDate, relativeTime } from "@/lib/utils";
import type { DailyUpdate, ProfileLite } from "@/types/database";

export const metadata: Metadata = { title: "Daily Log" };

type UpdateWithAuthor = DailyUpdate & { author: ProfileLite | null };

export default async function DailyPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: myUpdate }, { data: myTasks }, { data: teamUpdates }] =
    await Promise.all([
      supabase
        .from("daily_updates")
        .select("*, daily_update_tasks(task_id)")
        .eq("user_id", profile.id)
        .eq("update_date", today)
        .maybeSingle<DailyUpdate & { daily_update_tasks: { task_id: string }[] }>(),
      supabase
        .from("tasks")
        .select("id, title")
        .eq("assignee_id", profile.id)
        .in("status", ["todo", "in_progress", "review", "done"])
        .order("updated_at", { ascending: false })
        .limit(12),
      supabase
        .from("daily_updates")
        .select("*, author:profiles!daily_updates_user_id_fkey(id, full_name, avatar_url)")
        .gte("update_date", subDays(new Date(), 7).toISOString().slice(0, 10))
        .order("created_at", { ascending: false })
        .limit(30)
        .overrideTypes<UpdateWithAuthor[]>(),
    ]);

  const othersUpdates = (teamUpdates ?? []).filter(
    (u) => u.user_id !== profile.id || u.update_date !== today
  );

  return (
    <>
      <PageHeader
        title={format(new Date(), "EEEE, MMMM d")}
        description="Log today's work in seconds — your team will see it in the feed."
      />

      <DailyForm
        initialSummary={myUpdate?.summary ?? ""}
        initialTaskIds={myUpdate?.daily_update_tasks.map((t) => t.task_id) ?? []}
        candidateTasks={myTasks ?? []}
        alreadySaved={Boolean(myUpdate)}
      />

      <section aria-label="Recent team updates" className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          Team updates — last 7 days
        </h2>
        {othersUpdates.length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title="No team updates yet"
            description="Daily updates from your teammates will show up here."
          />
        ) : (
          <ul className="space-y-3">
            {othersUpdates.map((u) => (
              <li key={u.id} className="flex gap-3 rounded-xl border bg-card p-4">
                <UserAvatar
                  name={u.author?.full_name ?? "Former teammate"}
                  avatarUrl={u.author?.avatar_url}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">
                      {u.author?.full_name ?? "Former teammate"}
                    </span>{" "}
                    <span className="text-xs text-muted-foreground">
                      · {formatDate(u.update_date)} · {relativeTime(u.created_at)}
                    </span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {u.summary}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
