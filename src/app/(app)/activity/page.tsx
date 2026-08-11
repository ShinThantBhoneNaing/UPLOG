import type { Metadata } from "next";
import Link from "next/link";
import { Activity as ActivityIcon } from "lucide-react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ActivityItem } from "@/features/activity/activity-item";
import { ACTIVITY_WITH_ACTOR } from "@/features/tasks/queries";
import { createClient } from "@/lib/supabase/server";
import type { ActivityWithActor } from "@/types/database";

export const metadata: Metadata = { title: "Activity" };

function dayLabel(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMMM d");
}

export default async function ActivityPage() {
  const supabase = await createClient();

  const { data: activities } = await supabase
    .from("activities")
    .select(ACTIVITY_WITH_ACTOR)
    .order("created_at", { ascending: false })
    .limit(80)
    .overrideTypes<ActivityWithActor[]>();

  // Group by day for scannability.
  const groups: { label: string; items: ActivityWithActor[] }[] = [];
  for (const a of activities ?? []) {
    const label = dayLabel(a.created_at);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(a);
    else groups.push({ label, items: [a] });
  }

  return (
    <>
      <PageHeader
        title="Team activity"
        description="Everything your team has been doing, as it happens."
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title="No activity yet"
          description="Create a task or post a daily update to get things moving."
        />
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="mb-1 text-sm font-semibold text-muted-foreground">
                {g.label}
              </h2>
              <ul className="divide-y rounded-xl border bg-card px-4">
                {g.items.map((a) => (
                  <ActivityItem key={a.id} activity={a} />
                ))}
              </ul>
            </section>
          ))}
          <p className="text-center text-sm text-muted-foreground">
            Looking for something older?{" "}
            <Link href="/history" className="font-medium text-primary hover:underline">
              Search the full history
            </Link>
          </p>
        </div>
      )}
    </>
  );
}
