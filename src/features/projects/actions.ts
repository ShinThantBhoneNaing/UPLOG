"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { GENERIC_ERROR } from "@/lib/utils";

const projectSchema = z.object({
  name: z.string().trim().min(1, "Give the project a name").max(120),
  description: z.string().trim().max(4000).optional(),
  startDate: z.iso.date().nullable().optional(),
  dueDate: z.iso.date().nullable().optional(),
});

const updateProjectSchema = z.object({
  id: z.guid(),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  status: z.enum(["active", "paused", "completed", "archived"]).optional(),
  startDate: z.iso.date().nullable().optional(),
  dueDate: z.iso.date().nullable().optional(),
});

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function createProject(
  input: z.input<typeof projectSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        name: parsed.data.name,
        description: parsed.data.description || null,
        owner_id: user.id,
        start_date: parsed.data.startDate ?? null,
        due_date: parsed.data.dueDate ?? null,
      })
      .select("id")
      .single();

    if (error || !project) {
      console.error("[projects] create failed:", error?.message);
      return {
        ok: false,
        error: "We couldn't create the project. Only managers and admins can create projects.",
      };
    }

    // Owner joins automatically.
    await supabase
      .from("project_members")
      .insert({ project_id: project.id, user_id: user.id });

    refresh();
    return { ok: true, data: { id: project.id } };
  } catch (e) {
    console.error("[projects] create threw:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function updateProject(
  input: z.input<typeof updateProjectSchema>
): Promise<ActionResult> {
  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const d = parsed.data;
    const patch: Record<string, unknown> = {};
    if (d.name !== undefined) patch.name = d.name;
    if (d.description !== undefined) patch.description = d.description;
    if (d.status !== undefined) patch.status = d.status;
    if (d.startDate !== undefined) patch.start_date = d.startDate;
    if (d.dueDate !== undefined) patch.due_date = d.dueDate;

    const { error, count } = await supabase
      .from("projects")
      .update(patch, { count: "exact" })
      .eq("id", d.id);

    if (error || count === 0) {
      return { ok: false, error: "We couldn't update the project." };
    }
    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[projects] update threw:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function addProjectMember(
  projectId: string,
  userId: string
): Promise<ActionResult> {
  if (!z.guid().safeParse(projectId).success || !z.guid().safeParse(userId).success) {
    return { ok: false, error: "Invalid input" };
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("project_members")
      .insert({ project_id: projectId, user_id: userId });
    if (error) {
      if (error.code === "23505") return { ok: true }; // already a member
      console.error("[projects] add member failed:", error.message);
      return { ok: false, error: "We couldn't add that member." };
    }
    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[projects] add member threw:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function removeProjectMember(
  projectId: string,
  userId: string
): Promise<ActionResult> {
  if (!z.guid().safeParse(projectId).success || !z.guid().safeParse(userId).success) {
    return { ok: false, error: "Invalid input" };
  }
  try {
    const supabase = await createClient();
    const { error, count } = await supabase
      .from("project_members")
      .delete({ count: "exact" })
      .eq("project_id", projectId)
      .eq("user_id", userId);
    if (error || count === 0) {
      return { ok: false, error: "We couldn't remove that member." };
    }
    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[projects] remove member threw:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}
