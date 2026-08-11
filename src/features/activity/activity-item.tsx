import Link from "next/link";
import {
  CheckCircle2,
  CircleDot,
  FilePlus2,
  FolderPlus,
  MessageSquare,
  NotebookPen,
  Paperclip,
  UserPlus,
} from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { relativeTime, STATUS_META } from "@/lib/utils";
import type { ActivityWithActor, TaskStatus } from "@/types/database";

function statusLabel(s: string | null | undefined): string {
  return s && s in STATUS_META ? STATUS_META[s as TaskStatus].label : (s ?? "");
}

/** One sentence per activity type, with links to the task/project. */
export function activitySentence(a: ActivityWithActor): {
  icon: typeof CheckCircle2;
  text: React.ReactNode;
} {
  const m = a.metadata;
  const taskLink = a.task_id ? (
    <Link href={`/tasks/${a.task_id}`} className="font-medium text-foreground hover:underline">
      {m.task_title ?? "a task"}
    </Link>
  ) : (
    <span className="font-medium text-foreground">{m.task_title ?? "a task"}</span>
  );
  const projectLink = a.project_id ? (
    <Link href={`/projects/${a.project_id}`} className="font-medium text-foreground hover:underline">
      {m.project_name ?? "a project"}
    </Link>
  ) : (
    <span className="font-medium text-foreground">{m.project_name ?? "a project"}</span>
  );

  switch (a.type) {
    case "task_created":
      return { icon: CircleDot, text: <>created {taskLink}</> };
    case "task_completed":
      return { icon: CheckCircle2, text: <>completed {taskLink}</> };
    case "task_status_changed":
      return {
        icon: CircleDot,
        text: (
          <>
            moved {taskLink} to{" "}
            <span className="font-medium text-foreground">
              {statusLabel(m.to_status)}
            </span>
          </>
        ),
      };
    case "task_assigned":
      return { icon: UserPlus, text: <>updated the assignee on {taskLink}</> };
    case "task_updated":
      return { icon: CircleDot, text: <>updated {taskLink}</> };
    case "comment_added":
      return { icon: MessageSquare, text: <>commented on {taskLink}</> };
    case "daily_update_created":
      return {
        icon: NotebookPen,
        text: (
          <>
            posted a daily update
            {m.snippet ? (
              <span className="text-muted-foreground"> — “{m.snippet}”</span>
            ) : null}
          </>
        ),
      };
    case "attachment_added":
      return {
        icon: Paperclip,
        text: (
          <>
            attached <span className="font-medium text-foreground">{m.file_name}</span> to{" "}
            {taskLink}
          </>
        ),
      };
    case "project_created":
      return { icon: FolderPlus, text: <>created project {projectLink}</> };
    case "project_updated":
      return {
        icon: FolderPlus,
        text: (
          <>
            set {projectLink} to{" "}
            <span className="font-medium text-foreground">{m.to_status}</span>
          </>
        ),
      };
    case "member_joined_project":
      return { icon: FilePlus2, text: <>updated the members of {projectLink}</> };
  }
}

export function ActivityItem({ activity }: { activity: ActivityWithActor }) {
  const { icon: Icon, text } = activitySentence(activity);
  const actorName = activity.actor?.full_name ?? "Someone";

  return (
    <li className="flex gap-3 py-3">
      {activity.actor ? (
        <UserAvatar
          name={actorName}
          avatarUrl={activity.actor.avatar_url}
          className="mt-0.5 size-7"
        />
      ) : (
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon className="size-3.5 text-muted-foreground" aria-hidden />
        </span>
      )}
      <div className="min-w-0 text-sm">
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{actorName}</span> {text}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground/80">
          {relativeTime(activity.created_at)}
        </p>
      </div>
    </li>
  );
}
