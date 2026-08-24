import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { Separator } from "@/components/ui/separator";
import { ActivityItem } from "@/features/activity/activity-item";
import { getCurrentProfile } from "@/features/shell/get-current-profile";
import { Attachments } from "@/features/tasks/components/attachments";
import { LabelChip, PriorityBadge, StatusBadge } from "@/features/tasks/components/badges";
import { Comments } from "@/features/tasks/components/comments";
import { TaskProperties } from "@/features/tasks/components/task-properties";
import { TaskTitleEditor } from "@/features/tasks/components/task-title-editor";
import {
  ACTIVITY_WITH_ACTOR,
  COMMENT_WITH_AUTHOR,
  TASK_WITH_RELATIONS,
} from "@/features/tasks/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type {
  ActivityWithActor,
  Attachment,
  CommentWithAuthor,
  ProfileLite,
  TaskWithRelations,
} from "@/types/database";

export const metadata: Metadata = { title: "Task" };

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();

  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const [
    { data: task },
    { data: comments },
    { data: activities },
    { data: attachments },
    { data: profiles },
    { data: projects },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_WITH_RELATIONS)
      .eq("id", id)
      .maybeSingle<TaskWithRelations>(),
    supabase
      .from("task_comments")
      .select(COMMENT_WITH_AUTHOR)
      .eq("task_id", id)
      .order("created_at")
      .overrideTypes<CommentWithAuthor[]>(),
    supabase
      .from("activities")
      .select(ACTIVITY_WITH_ACTOR)
      .eq("task_id", id)
      .order("created_at", { ascending: false })
      .limit(20)
      .overrideTypes<ActivityWithActor[]>(),
    supabase
      .from("attachments")
      .select("*")
      .eq("task_id", id)
      .order("created_at")
      .overrideTypes<Attachment[]>(),
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("is_active", true)
      .order("full_name")
      .overrideTypes<ProfileLite[]>(),
    supabase
      .from("projects")
      .select("id, name")
      .in("status", ["active", "paused"])
      .order("name"),
  ]);

  if (!task) notFound();

  const isManager = profile.role === "admin" || profile.role === "manager";
  const canEdit =
    isManager ||
    task.creator_id === profile.id ||
    task.assignee?.id === profile.id;
  const canDelete = isManager; // managers/admins only (enforced by RLS too)

  return (
    <div>
      <Link
        href="/tasks"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to tasks
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.labels.map((l) => (
              <LabelChip key={l.id} label={l} />
            ))}
            {task.due_date && (
              <span className="text-sm text-muted-foreground">
                Due {formatDate(task.due_date)}
              </span>
            )}
          </div>

          <TaskTitleEditor
            taskId={task.id}
            title={task.title}
            description={task.description}
            canEdit={canEdit}
            currentUserId={profile.id}
          />

          <Separator className="my-6" />

          <Attachments
            taskId={task.id}
            attachments={attachments ?? []}
            currentUserId={profile.id}
            canManage={isManager}
          />

          <Separator className="my-6" />

          <Comments
            taskId={task.id}
            comments={comments ?? []}
            profiles={profiles ?? []}
            currentUserId={profile.id}
          />

          {(activities?.length ?? 0) > 0 && (
            <>
              <Separator className="my-6" />
              <section aria-label="Task activity">
                <h2 className="mb-1 text-sm font-semibold text-muted-foreground">
                  Activity
                </h2>
                <ul className="divide-y">
                  {activities!.map((a) => (
                    <ActivityItem key={a.id} activity={a} />
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>

        <aside aria-label="Task properties" className="lg:border-l lg:pl-6">
          <TaskProperties
            task={task}
            profiles={profiles ?? []}
            projects={projects ?? []}
            canDelete={canDelete}
          />
        </aside>
      </div>
    </div>
  );
}
