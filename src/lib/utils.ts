import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  format,
  formatDistanceToNowStrict,
  isPast,
  isToday,
  isTomorrow,
  parseISO,
} from "date-fns";
import type { TaskPriority, TaskStatus } from "@/types/database";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ---------- Formatting ---------- */

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function relativeTime(iso: string): string {
  return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });
}

export function formatDate(iso: string): string {
  return format(parseISO(iso), "MMM d, yyyy");
}

export function formatDateShort(iso: string): string {
  return format(parseISO(iso), "MMM d");
}

/** Human label for a due date: "Today", "Tomorrow", "Aug 15" — flags overdue. */
export function dueLabel(iso: string): { label: string; overdue: boolean } {
  const d = parseISO(iso);
  if (isToday(d)) return { label: "Today", overdue: false };
  if (isTomorrow(d)) return { label: "Tomorrow", overdue: false };
  return { label: format(d, "MMM d"), overdue: isPast(d) };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function greeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const first = name.split(/\s+/)[0] ?? name;
  return `${part}, ${first}`;
}

/* ---------- Domain display maps (single source of truth for the UI) ---------- */

export const TASK_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "review",
  "done",
  "cancelled",
];

export const BOARD_STATUSES: TaskStatus[] = ["todo", "in_progress", "review", "done"];

export const STATUS_META: Record<
  TaskStatus,
  { label: string; dot: string; badge: string }
> = {
  todo: {
    label: "Todo",
    dot: "bg-muted-foreground",
    badge: "bg-secondary text-secondary-foreground",
  },
  in_progress: {
    label: "In Progress",
    dot: "bg-info",
    badge: "bg-info/12 text-info dark:bg-info/15",
  },
  review: {
    label: "Review",
    dot: "bg-warning",
    badge: "bg-warning/15 text-warning-foreground dark:text-warning",
  },
  done: {
    label: "Done",
    dot: "bg-success",
    badge: "bg-success/12 text-success",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-muted-foreground/50",
    badge: "bg-muted text-muted-foreground line-through",
  },
};

export const TASK_PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; badge: string; rank: number }
> = {
  low: { label: "Low", badge: "text-muted-foreground border-border", rank: 0 },
  medium: { label: "Medium", badge: "text-info border-info/40", rank: 1 },
  high: {
    label: "High",
    badge: "text-primary border-primary/40",
    rank: 2,
  },
  urgent: {
    label: "Urgent",
    badge: "text-destructive border-destructive/40 font-semibold",
    rank: 3,
  },
};

/* ---------- Misc ---------- */

/** User-safe error message; technical detail goes to the server log. */
export const GENERIC_ERROR = "Something went wrong. Please try again.";
