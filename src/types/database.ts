/**
 * Database types for UPLOG.
 *
 * Hand-maintained to match supabase/migrations. If you change the schema,
 * update these types (or regenerate with `supabase gen types typescript`).
 */

export type UserRole = "admin" | "manager" | "member";
export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type ProjectStatus = "active" | "paused" | "completed" | "archived";
export type ActivityType =
  | "task_created"
  | "task_updated"
  | "task_status_changed"
  | "task_assigned"
  | "task_completed"
  | "comment_added"
  | "daily_update_created"
  | "attachment_added"
  | "project_created"
  | "project_updated"
  | "member_joined_project";
export type NotificationType =
  | "task_assigned"
  | "mention"
  | "comment_on_task"
  | "task_due_soon"
  | "task_status_changed"
  | "added_to_project";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  job_title: string | null;
  department: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  owner_id: string | null;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  project_id: string;
  user_id: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  creator_id: string | null;
  due_date: string | null;
  position: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TaskLabel {
  task_id: string;
  label_id: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyUpdate {
  id: string;
  user_id: string;
  update_date: string;
  summary: string;
  created_at: string;
  updated_at: string;
}

export interface DailyUpdateTask {
  daily_update_id: string;
  task_id: string;
}

export interface Activity {
  id: string;
  actor_id: string | null;
  type: ActivityType;
  task_id: string | null;
  project_id: string | null;
  /** Denormalized display context, e.g. { task_title, from_status, to_status } */
  metadata: Record<string, string | null>;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  task_id: string | null;
  project_id: string | null;
  message: string;
  read_at: string | null;
  created_at: string;
}

export interface Attachment {
  id: string;
  task_id: string;
  uploader_id: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  detail: Record<string, string | null>;
  created_at: string;
}

export interface WorkspaceSettings {
  id: number;
  name: string;
  logo_url: string | null;
  updated_at: string;
}

/* ---- Common joined shapes used across the UI ---- */

export interface ProfileLite {
  id: string;
  full_name: string;
  avatar_url: string | null;
  job_title?: string | null;
}

export interface TaskWithRelations extends Task {
  assignee: ProfileLite | null;
  project: Pick<Project, "id" | "name"> | null;
  labels: Label[];
}

export interface ActivityWithActor extends Activity {
  actor: ProfileLite | null;
}

export interface NotificationWithActor extends Notification {
  actor: ProfileLite | null;
}

export interface CommentWithAuthor extends TaskComment {
  author: ProfileLite | null;
}

export interface ProjectStats {
  project_id: string;
  total_tasks: number;
  done_tasks: number;
  in_progress_tasks: number;
  todo_tasks: number;
  review_tasks: number;
  overdue_tasks: number;
}

export interface SearchResult {
  kind: "task" | "project" | "person" | "comment" | "daily_update";
  id: string;
  title: string;
  snippet: string | null;
  task_id: string | null;
  rank: number;
}
