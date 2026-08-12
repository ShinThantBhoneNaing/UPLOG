import { z } from "zod";

export const TASK_STATUS_VALUES = [
  "todo",
  "in_progress",
  "review",
  "done",
  "cancelled",
] as const;

export const TASK_PRIORITY_VALUES = ["low", "medium", "high", "urgent"] as const;

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(200),
  description: z.string().trim().max(10000).optional(),
  projectId: z.uuid().nullable().optional(),
  assigneeId: z.uuid().nullable().optional(),
  priority: z.enum(TASK_PRIORITY_VALUES).default("medium"),
  status: z.enum(TASK_STATUS_VALUES).default("todo"),
  dueDate: z.iso.date().nullable().optional(),
  labelIds: z.array(z.uuid()).max(10).optional(),
});

export const updateTaskSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(10000).nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  assigneeId: z.uuid().nullable().optional(),
  priority: z.enum(TASK_PRIORITY_VALUES).optional(),
  status: z.enum(TASK_STATUS_VALUES).optional(),
  dueDate: z.iso.date().nullable().optional(),
  position: z.number().finite().optional(),
});

export const commentSchema = z.object({
  taskId: z.uuid(),
  body: z.string().trim().min(1, "Write a comment first").max(8000),
  mentionedUserIds: z.array(z.uuid()).max(20).optional(),
});

export const editCommentSchema = z.object({
  id: z.uuid(),
  body: z.string().trim().min(1).max(8000),
});

export const attachmentSchema = z.object({
  taskId: z.uuid(),
  fileName: z.string().trim().min(1).max(255),
  storagePath: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(20 * 1024 * 1024, "Files can be at most 20 MB"),
});

/** Allowed upload types, mirrored in the storage bucket config. */
export const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/zip",
  "application/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
