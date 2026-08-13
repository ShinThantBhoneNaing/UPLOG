import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { UserAvatar } from "@/components/user-avatar";
import { ProjectFormDialog } from "@/features/projects/project-form-dialog";
import { ProjectProgress } from "@/features/projects/project-progress";
import { getCurrentProfile } from "@/features/shell/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Project, ProjectStats, ProfileLite } from "@/types/database";

export const metadata: Metadata = { title: "Projects" };

const PROJECT_STATUS_STYLES: Record<Project["status"], string> = {
  active: "bg-success/12 text-success",
  paused: "bg-warning/15 text-warning-foreground dark:text-warning",
  completed: "bg-info/12 text-info",
  archived: "bg-muted text-muted-foreground",
};

type ProjectWithOwner = Project & { owner: ProfileLite | null };

export default async function ProjectsPage() {
  const profile = await getCurrentProfile();
  if (profile.role === "member") redirect("/dashboard");
  const supabase = await createClient();

  const [{ data: projects }, { data: stats }] = await Promise.all([
    supabase
      .from("projects")
      .select("*, owner:profiles!projects_owner_id_fkey(id, full_name, avatar_url)")
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .overrideTypes<ProjectWithOwner[]>(),
    supabase.from("project_stats").select("*").overrideTypes<ProjectStats[]>(),
  ]);

  const statsById = new Map((stats ?? []).map((s) => [s.project_id, s]));
  const canCreate = profile.role === "admin" || profile.role === "manager";

  return (
    <>
      <PageHeader
        title="Projects"
        description="Every project with its progress at a glance."
        actions={canCreate ? <ProjectFormDialog /> : undefined}
      />

      {!projects?.length ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description={
            canCreate
              ? "Create the first project to start organizing tasks."
              : "Projects created by your managers will appear here."
          }
          action={canCreate ? <ProjectFormDialog /> : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const s = statsById.get(p.id);
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group rounded-xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold group-hover:text-primary">
                    {p.name}
                  </h2>
                  <Badge
                    variant="secondary"
                    className={cn("capitalize", PROJECT_STATUS_STYLES[p.status])}
                  >
                    {p.status}
                  </Badge>
                </div>
                {p.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {p.description}
                  </p>
                )}
                {s && <ProjectProgress stats={s} className="mt-4" />}
                {p.owner && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <UserAvatar
                      name={p.owner.full_name}
                      avatarUrl={p.owner.avatar_url}
                      className="size-5"
                    />
                    {p.owner.full_name}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
