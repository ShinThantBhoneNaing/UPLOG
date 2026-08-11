import type { Metadata } from "next";
import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { AdminProjectsTable } from "@/features/admin/admin-projects-table";
import { ProjectFormDialog } from "@/features/projects/project-form-dialog";
import { createClient } from "@/lib/supabase/server";
import type { Project, ProfileLite } from "@/types/database";

export const metadata: Metadata = { title: "Admin · Projects" };

export default async function AdminProjectsPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("*, owner:profiles!projects_owner_id_fkey(id, full_name, avatar_url)")
    .order("created_at", { ascending: false })
    .overrideTypes<(Project & { owner: ProfileLite | null })[]>();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ProjectFormDialog />
      </div>
      {!projects?.length ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create the first project to organize your team's tasks."
          action={<ProjectFormDialog />}
        />
      ) : (
        <AdminProjectsTable projects={projects} />
      )}
    </div>
  );
}
