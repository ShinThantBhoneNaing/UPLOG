import type { Metadata } from "next";
import Link from "next/link";
import { History as HistoryIcon } from "lucide-react";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ActivityItem } from "@/features/activity/activity-item";
import { HistoryFilters } from "@/features/history/history-filters";
import { ACTIVITY_WITH_ACTOR } from "@/features/tasks/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDateShort } from "@/lib/utils";
import type { ActivityWithActor, ProfileLite } from "@/types/database";

export const metadata: Metadata = { title: "History" };

const PAGE_SIZE = 50;

const filterSchema = z.object({
  q: z.string().max(200).optional(),
  user: z.uuid().optional(),
  project: z.uuid().optional(),
  type: z
    .enum([
      "task_created", "task_updated", "task_status_changed", "task_assigned",
      "task_completed", "comment_added", "daily_update_created",
      "attachment_added", "project_created", "project_updated",
      "member_joined_project",
    ])
    .optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
});

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = filterSchema.safeParse(
    Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
    )
  );
  const f = parsed.success ? parsed.data : {};
  const page = f.page ?? 1;

  const supabase = await createClient();

  let query = supabase
    .from("activities")
    .select(ACTIVITY_WITH_ACTOR, { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (f.user) query = query.eq("actor_id", f.user);
  if (f.project) query = query.eq("project_id", f.project);
  if (f.type) query = query.eq("type", f.type);
  if (f.from) query = query.gte("created_at", `${f.from}T00:00:00`);
  if (f.to) query = query.lte("created_at", `${f.to}T23:59:59`);
  if (f.q) {
    // Search the denormalized display context (survives task deletion).
    const escaped = f.q.replace(/[%_]/g, "\\$&");
    query = query.or(
      `metadata->>task_title.ilike.%${escaped}%,metadata->>project_name.ilike.%${escaped}%,metadata->>snippet.ilike.%${escaped}%,metadata->>file_name.ilike.%${escaped}%`
    );
  }

  const [{ data: activities, count }, { data: profiles }, { data: projects }] =
    await Promise.all([
      query.overrideTypes<ActivityWithActor[]>(),
      supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .order("full_name")
        .overrideTypes<ProfileLite[]>(),
      supabase.from("projects").select("id, name").order("name"),
    ]);

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) {
      if (v !== undefined && k !== "page") params.set(k, String(v));
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/history?${qs}` : "/history";
  };

  return (
    <>
      <PageHeader
        title="Work history"
        description="Search and filter everything the team has done."
      />

      <div className="mb-5">
        <HistoryFilters profiles={profiles ?? []} projects={projects ?? []} />
      </div>

      {!activities?.length ? (
        <EmptyState
          icon={HistoryIcon}
          title="No matching history"
          description="Try widening the date range or clearing filters."
        />
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            {total} {total === 1 ? "entry" : "entries"}
            {f.from && ` from ${formatDateShort(f.from)}`}
            {f.to && ` to ${formatDateShort(f.to)}`}
          </p>
          <ul className="divide-y rounded-xl border bg-card px-4">
            {activities.map((a) => (
              <ActivityItem key={a.id} activity={a} />
            ))}
          </ul>

          {pageCount > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {page} of {pageCount}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button variant="outline" size="sm" render={<Link href={pageHref(page - 1)} />}>
                    Previous
                  </Button>
                )}
                {page < pageCount && (
                  <Button variant="outline" size="sm" render={<Link href={pageHref(page + 1)} />}>
                    Next
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
