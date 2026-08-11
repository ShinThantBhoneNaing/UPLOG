import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getCurrentProfile } from "@/features/shell/get-current-profile";
import { TasksView } from "@/features/tasks/components/tasks-view";
import { TASK_WITH_RELATIONS } from "@/features/tasks/queries";
import { createClient } from "@/lib/supabase/server";
import type { ProfileLite, TaskWithRelations } from "@/types/database";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  // One parallel round of queries; board+list work off this set.
  const [{ data: tasks }, { data: profiles }, { data: projects }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(TASK_WITH_RELATIONS)
        .order("updated_at", { ascending: false })
        .limit(400)
        .overrideTypes<TaskWithRelations[]>(),
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

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Drag cards across the board, or switch to the list for sorting and filtering."
      />
      <TasksView
        tasks={tasks ?? []}
        profiles={profiles ?? []}
        projects={projects ?? []}
        currentUserId={profile.id}
      />
    </>
  );
}
