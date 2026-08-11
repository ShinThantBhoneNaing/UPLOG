"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { GENERIC_ERROR } from "@/lib/utils";

const dailyUpdateSchema = z.object({
  summary: z.string().trim().min(1, "Write a short summary first").max(8000),
  taskIds: z.array(z.uuid()).max(30).optional(),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Creates or updates today's journal entry (one per person per day). */
export async function saveDailyUpdate(
  input: z.input<typeof dailyUpdateSchema>
): Promise<ActionResult> {
  const parsed = dailyUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const today = new Date().toISOString().slice(0, 10);

    const { data: update, error } = await supabase
      .from("daily_updates")
      .upsert(
        { user_id: user.id, update_date: today, summary: parsed.data.summary },
        { onConflict: "user_id,update_date" }
      )
      .select("id")
      .single();

    if (error || !update) {
      console.error("[daily] upsert failed:", error?.message);
      return { ok: false, error: "We couldn't save your update." };
    }

    // Replace task links.
    await supabase
      .from("daily_update_tasks")
      .delete()
      .eq("daily_update_id", update.id);
    const taskIds = parsed.data.taskIds ?? [];
    if (taskIds.length) {
      await supabase
        .from("daily_update_tasks")
        .insert(taskIds.map((task_id) => ({ daily_update_id: update.id, task_id })));
    }

    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[daily] save threw:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}
