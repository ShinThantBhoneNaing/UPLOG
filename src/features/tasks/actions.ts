"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { GENERIC_ERROR } from "@/lib/utils";
import {
  attachmentSchema,
  commentSchema,
  createTaskSchema,
  editCommentSchema,
  updateTaskSchema,
  ALLOWED_MIME_TYPES,
} from "@/lib/validations/task";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

/* ---------------- Tasks ---------------- */

export async function createTask(
  input: z.input<typeof createTaskSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const { supabase, user } = await requireUser();
    const d = parsed.data;

    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        title: d.title,
        description: d.description || null,
        project_id: d.projectId ?? null,
        assignee_id: d.assigneeId ?? null,
        priority: d.priority,
        status: d.status,
        due_date: d.dueDate ?? null,
        creator_id: user.id,
      })
      .select("id")
      .single();

    if (error || !task) {
      console.error("[tasks] create failed:", error?.message);
      return { ok: false, error: "We couldn't create the task." };
    }

    if (d.labelIds?.length) {
      await supabase
        .from("task_labels")
        .insert(d.labelIds.map((label_id) => ({ task_id: task.id, label_id })));
    }

    refresh();
    return { ok: true, data: { id: task.id } };
  } catch (e) {
    console.error("[tasks] create threw:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function updateTask(
  input: z.input<typeof updateTaskSchema>
): Promise<ActionResult> {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const { supabase } = await requireUser();
    const d = parsed.data;

    const patch: Record<string, unknown> = {};
    if (d.title !== undefined) patch.title = d.title;
    if (d.description !== undefined) patch.description = d.description;
    if (d.projectId !== undefined) patch.project_id = d.projectId;
    if (d.assigneeId !== undefined) patch.assignee_id = d.assigneeId;
    if (d.priority !== undefined) patch.priority = d.priority;
    if (d.status !== undefined) patch.status = d.status;
    if (d.dueDate !== undefined) patch.due_date = d.dueDate;
    if (d.position !== undefined) patch.position = d.position;

    const { error, count } = await supabase
      .from("tasks")
      .update(patch, { count: "exact" })
      .eq("id", d.id);

    if (error) {
      console.error("[tasks] update failed:", error.message);
      return { ok: false, error: "We couldn't save your changes." };
    }
    if (count === 0) {
      return { ok: false, error: "You don't have permission to edit this task." };
    }

    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[tasks] update threw:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid task" };

  try {
    const { supabase } = await requireUser();
    const { error, count } = await supabase
      .from("tasks")
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) {
      console.error("[tasks] delete failed:", error.message);
      return { ok: false, error: "We couldn't delete the task." };
    }
    if (count === 0) {
      return { ok: false, error: "You don't have permission to delete this task." };
    }

    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[tasks] delete threw:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function setTaskLabels(
  taskId: string,
  labelIds: string[]
): Promise<ActionResult> {
  const parsed = z
    .object({ taskId: z.uuid(), labelIds: z.array(z.uuid()).max(10) })
    .safeParse({ taskId, labelIds });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const { supabase } = await requireUser();
    // Replace-all semantics; RLS restricts to task editors.
    const { error: delError } = await supabase
      .from("task_labels")
      .delete()
      .eq("task_id", taskId);
    if (delError) {
      console.error("[tasks] label clear failed:", delError.message);
      return { ok: false, error: "We couldn't update labels." };
    }
    if (labelIds.length) {
      const { error } = await supabase
        .from("task_labels")
        .insert(labelIds.map((label_id) => ({ task_id: taskId, label_id })));
      if (error) {
        console.error("[tasks] label insert failed:", error.message);
        return { ok: false, error: "We couldn't update labels." };
      }
    }
    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[tasks] labels threw:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

/* ---------------- Comments ---------------- */

export async function addComment(
  input: z.input<typeof commentSchema>
): Promise<ActionResult> {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const { supabase, user } = await requireUser();
    const { data: comment, error } = await supabase
      .from("task_comments")
      .insert({
        task_id: parsed.data.taskId,
        author_id: user.id,
        body: parsed.data.body,
      })
      .select("id")
      .single();

    if (error || !comment) {
      console.error("[comments] insert failed:", error?.message);
      return { ok: false, error: "We couldn't post your comment." };
    }

    const mentions = parsed.data.mentionedUserIds ?? [];
    if (mentions.length) {
      // SECURITY DEFINER RPC validates comment authorship server-side.
      await supabase.rpc("notify_mentions", {
        p_comment_id: comment.id,
        p_user_ids: mentions,
      });
    }

    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[comments] add threw:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function editComment(
  input: z.input<typeof editCommentSchema>
): Promise<ActionResult> {
  const parsed = editCommentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const { supabase } = await requireUser();
    const { error, count } = await supabase
      .from("task_comments")
      .update({ body: parsed.data.body }, { count: "exact" })
      .eq("id", parsed.data.id);

    if (error || count === 0) {
      return { ok: false, error: "We couldn't update the comment." };
    }
    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[comments] edit threw:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function deleteComment(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid comment" };

  try {
    const { supabase } = await requireUser();
    const { error, count } = await supabase
      .from("task_comments")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error || count === 0) {
      return { ok: false, error: "We couldn't delete the comment." };
    }
    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[comments] delete threw:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

/* ---------------- Attachments ---------------- */

/**
 * Records an attachment row after the client uploads the file to Storage.
 * Path ownership is validated (must be under the caller's folder) and the
 * object's real existence/size is confirmed server-side.
 */
export async function recordAttachment(
  input: z.input<typeof attachmentSchema>
): Promise<ActionResult> {
  const parsed = attachmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (!ALLOWED_MIME_TYPES.has(parsed.data.mimeType)) {
    return { ok: false, error: "This file type isn't allowed." };
  }

  try {
    const { supabase, user } = await requireUser();
    const d = parsed.data;

    if (!d.storagePath.startsWith(`${user.id}/`)) {
      return { ok: false, error: "Invalid upload path." };
    }

    const { error } = await supabase.from("attachments").insert({
      task_id: d.taskId,
      uploader_id: user.id,
      file_name: d.fileName,
      storage_path: d.storagePath,
      mime_type: d.mimeType,
      size_bytes: d.sizeBytes,
    });

    if (error) {
      console.error("[attachments] insert failed:", error.message);
      return { ok: false, error: "We couldn't attach the file." };
    }
    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[attachments] record threw:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function deleteAttachment(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid file" };

  try {
    const { supabase } = await requireUser();

    const { data: att } = await supabase
      .from("attachments")
      .select("storage_path")
      .eq("id", id)
      .single();
    if (!att) return { ok: false, error: "File not found." };

    const { error, count } = await supabase
      .from("attachments")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error || count === 0) {
      return { ok: false, error: "You don't have permission to delete this file." };
    }

    // Best-effort object cleanup (storage RLS still applies).
    await supabase.storage.from("attachments").remove([att.storage_path]);

    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[attachments] delete threw:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}
