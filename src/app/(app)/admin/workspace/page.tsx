import type { Metadata } from "next";
import { WorkspaceForm } from "@/features/admin/workspace-form";
import { createClient } from "@/lib/supabase/server";
import type { WorkspaceSettings } from "@/types/database";

export const metadata: Metadata = { title: "Admin · Workspace" };

export default async function AdminWorkspacePage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("workspace_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle<WorkspaceSettings>();

  return <WorkspaceForm initialName={settings?.name ?? "UPLOG"} />;
}
