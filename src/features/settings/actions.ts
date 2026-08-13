"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { GENERIC_ERROR } from "@/lib/utils";

export type ActionResult = { ok: true } | { ok: false; error: string };

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  jobTitle: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  avatarUrl: z.url().max(500).nullable().optional(),
});

export async function updateOwnProfile(
  input: z.input<typeof profileSchema>
): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
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
    const patch: Record<string, unknown> = {
      full_name: d.fullName,
      job_title: d.jobTitle || null,
      department: d.department || null,
      phone: d.phone || null,
    };
    if (d.avatarUrl !== undefined) patch.avatar_url = d.avatarUrl;

    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id);

    if (error) {
      console.error("[settings] profile update failed:", error.message);
      return { ok: false, error: "We couldn't save your profile." };
    }
    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[settings] profile update threw:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

const passwordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72),
});

export async function changePassword(
  input: z.input<typeof passwordSchema>
): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    if (error) {
      console.error("[settings] password change failed:", error.message);
      return { ok: false, error: "We couldn't change your password." };
    }
    return { ok: true };
  } catch (e) {
    console.error("[settings] password change threw:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}
