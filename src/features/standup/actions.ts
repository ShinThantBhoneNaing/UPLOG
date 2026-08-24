"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Called when a non-assignee tries to move a ticket on the meeting board.
 * The RPC (SECURITY DEFINER) validates the caller and notifies the
 * assignee — rate-limited to once per task/actor/hour.
 */
export async function notifyMoveAttempt(taskId: string): Promise<void> {
  if (!z.guid().safeParse(taskId).success) return;
  try {
    const supabase = await createClient();
    await supabase.rpc("notify_move_attempt", { p_task_id: taskId });
  } catch (e) {
    console.error("[standup] notify_move_attempt failed:", e);
  }
}
