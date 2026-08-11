/**
 * Shared select fragments so every task query returns the same shape
 * (TaskWithRelations) without duplicating join strings.
 */
export const TASK_WITH_RELATIONS = `
  *,
  assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url),
  project:projects!tasks_project_id_fkey(id, name),
  labels(*)
` as const;

export const ACTIVITY_WITH_ACTOR = `
  *,
  actor:profiles!activities_actor_id_fkey(id, full_name, avatar_url)
` as const;

export const COMMENT_WITH_AUTHOR = `
  *,
  author:profiles!task_comments_author_id_fkey(id, full_name, avatar_url)
` as const;
