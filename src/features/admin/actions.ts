"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { GENERIC_ERROR } from "@/lib/utils";

export type ActionResult = { ok: true } | { ok: false; error: string };

const adminUpdateUserSchema = z.object({
  id: z.uuid(),
  fullName: z.string().trim().min(1).max(120).optional(),
  jobTitle: z.string().trim().max(120).nullable().optional(),
  department: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  role: z.enum(["admin", "manager", "member"]).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Admin-only profile management. RLS ("profiles: admin edits any") plus the
 * profile-guard trigger enforce authorization in the database; this action is
 * just the transport.
 */
export async function adminUpdateUser(
  input: z.input<typeof adminUpdateUserSchema>
): Promise<ActionResult> {
  const parsed = adminUpdateUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const d = parsed.data;

    // Safety: an admin cannot disable or demote themselves (prevents
    // locking the workspace out of admin access).
    if (d.id === user.id && (d.isActive === false || (d.role && d.role !== "admin"))) {
      return { ok: false, error: "You can't remove your own admin access." };
    }

    const patch: Record<string, unknown> = {};
    if (d.fullName !== undefined) patch.full_name = d.fullName;
    if (d.jobTitle !== undefined) patch.job_title = d.jobTitle;
    if (d.department !== undefined) patch.department = d.department;
    if (d.phone !== undefined) patch.phone = d.phone;
    if (d.role !== undefined) patch.role = d.role;
    if (d.isActive !== undefined) patch.is_active = d.isActive;

    const { error, count } = await supabase
      .from("profiles")
      .update(patch, { count: "exact" })
      .eq("id", d.id);

    if (error) {
      console.error("[admin] user update failed:", error.message);
      return { ok: false, error: "We couldn't update that user." };
    }
    if (count === 0) {
      return { ok: false, error: "Only admins can manage users." };
    }

    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[admin] user update threw:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

const workspaceSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required").max(80),
});

export async function updateWorkspace(
  input: z.input<typeof workspaceSchema>
): Promise<ActionResult> {
  const parsed = workspaceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const { error, count } = await supabase
      .from("workspace_settings")
      .update({ name: parsed.data.name }, { count: "exact" })
      .eq("id", 1);

    if (error || count === 0) {
      return { ok: false, error: "Only admins can change workspace settings." };
    }
    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[admin] workspace update threw:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}
