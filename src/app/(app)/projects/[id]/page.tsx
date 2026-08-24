import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckSquare, Plus } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Separator } from "@/components/ui/separator";
import { ActivityItem } from "@/features/activity/activity-item";
import { ProjectMembers } from "@/features/projects/project-members";
import { ProjectProgress } from "@/features/projects/project-progress";
import { ProjectStatusSelect } from "@/features/projects/project-status-select";
import { getCurrentProfile } from "@/features/shell/get-current-profile";
import { TaskFormDialog } from "@/features/tasks/components/task-form-dialog";
import { TaskList } from "@/features/tasks/components/task-list";
import { ACTIVITY_WITH_ACTOR, TASK_WITH_RELATIONS } from "@/features/tasks/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type {
  ActivityWithActor,
  Project,
  ProjectStats,
  ProfileLite,
  TaskWithRelations,
} from "@/types/database";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();

  const profile = await getCurrentProfile();
  if (profile.role === "member") redirect("/dashboard");
  const supabase = await createClient();

  const [
    { data: project },
    { data: stats },
    { data: tasks },
    { data: memberRows },
    { data: profiles },
    { data: activities },
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle<Project>(),
    supabase
      .from("project_stats")
      .select("*")
      .eq("project_id", id)
      .maybeSingle<ProjectStats>(),
    supabase
      .from("tasks")
      .select(TASK_WITH_RELATIONS)
      .eq("project_id", id)
      .order("updated_at", { ascending: false })
      .limit(200)
      .overrideTypes<TaskWithRelations[]>(),
    supabase
      .from("project_members")
      .select("user:profiles!project_members_user_id_fkey(id, full_name, avatar_url)")
      .eq("project_id", id),
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("is_active", true)
      .order("full_name")
      .overrideTypes<ProfileLite[]>(),
    supabase
      .from("activities")
      .select(ACTIVITY_WITH_ACTOR)
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(15)
      .overrideTypes<ActivityWithActor[]>(),
  ]);

  if (!project) notFound();

  const members = (memberRows ?? [])
    .map((r) => r.user as unknown as ProfileLite)
    .filter(Boolean);
  const canManage =
    profile.role === "admin" ||
    profile.role === "manager" ||
    project.owner_id === profile.id;

  return (
    <div>
      <Link
        href="/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to projects
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {project.name}
            </h1>
            {canManage ? (
              <ProjectStatusSelect projectId={project.id} status={project.status} />
            ) : (
              <span className="text-sm capitalize text-muted-foreground">
                {project.status}
              </span>
            )}
          </div>
          {project.description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {project.description}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {project.start_date && <>Started {formatDate(project.start_date)}</>}
            {project.start_date && project.due_date && " · "}
            {project.due_date && <>Due {formatDate(project.due_date)}</>}
          </p>

          {stats && <ProjectProgress stats={stats} className="mt-5 max-w-md" />}

          <Separator className="my-6" />

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Tasks {stats ? `(${stats.total_tasks})` : ""}
            </h2>
            <TaskFormDialog
              profiles={profiles ?? []}
              projects={[{ id: project.id, name: project.name }]}
              defaultProjectId={project.id}
              currentUserId={profile.id}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus aria-hidden /> Add task
                </Button>
              }
            />
          </div>

          {tasks?.length ? (
            <TaskList tasks={tasks} />
          ) : (
            <EmptyState
              icon={CheckSquare}
              title="No tasks in this project yet"
              description="Add the first task to start tracking progress."
            />
          )}

          {(activities?.length ?? 0) > 0 && (
            <>
              <Separator className="my-6" />
              <section aria-label="Project activity">
                <h2 className="mb-1 text-sm font-semibold text-muted-foreground">
                  Recent activity
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

        <aside className="lg:border-l lg:pl-6">
          <ProjectMembers
            projectId={project.id}
            members={members}
            allProfiles={profiles ?? []}
            canManage={canManage}
            currentUserId={profile.id}
          />
        </aside>
      </div>
    </div>
  );
}
