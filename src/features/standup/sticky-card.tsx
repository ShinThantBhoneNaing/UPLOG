"use client";

import Link from "next/link";
import { Flag, Paperclip } from "lucide-react";
import { cn, formatHours } from "@/lib/utils";
import type { TaskWithRelations } from "@/types/database";

type Column = "todo" | "inProgress" | "done";

/**
 * Digital sticky note: a small stack of paper sheets held by a paperclip.
 * Paper tint comes from the user-customizable --sticky token (Settings >
 * Appearance > Custom colors); status is carried by the paperclip color and
 * the done-column fade. Slight tilt straightens on hover.
 */
const PAPER: Record<Column, { clip: string }> = {
  todo: { clip: "text-warning" },
  inProgress: { clip: "text-primary" },
  done: { clip: "text-success" },
};

/** Tiny deterministic tilt per card — straightens on hover. */
function tilt(id: string): string {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  const classes = ["-rotate-1", "rotate-[0.75deg]", "-rotate-[0.5deg]", "rotate-1", "rotate-0"];
  return classes[n % classes.length];
}

export function StickyCard({
  task,
  column,
  large = false,
  onOpen,
}: {
  task: TaskWithRelations;
  column: Column;
  /** Meeting-mode: bigger type for across-the-room readability. */
  large?: boolean;
  /** When set, clicking opens this handler (popup) instead of navigating. */
  onOpen?: (task: TaskWithRelations) => void;
}) {
  const urgent = task.priority === "urgent" || task.priority === "high";
  const paper = PAPER[column];

  const className = cn(
    "font-handwriting relative block w-full p-3 pt-3.5 text-left transition-all duration-150",
    "hover:rotate-0 hover:-translate-y-0.5",
    tilt(task.id),
    column === "done" && "opacity-85"
  );

  const content = (
    <>
      {/* stacked sheets peeking out behind the top paper */}
      <span
        aria-hidden
        className="absolute inset-0 rotate-[2deg] rounded-sm bg-sticky/40 shadow-sm"
      />
      <span
        aria-hidden
        className="absolute inset-0 -rotate-[1.5deg] rounded-sm bg-sticky/50"
      />
      {/* top paper */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-sm bg-sticky/20 shadow-sm dark:bg-sticky/15"
      />
      {/* status paperclip */}
      <Paperclip
        aria-hidden
        className={cn("absolute -top-2 left-4 size-4 -rotate-12", paper.clip)}
      />

      <p
        className={cn(
          // Handwriting face runs small — one step up from the old sizes.
          "relative font-medium leading-snug",
          large ? "line-clamp-3 text-base" : "line-clamp-2 text-sm",
          column === "done" && "text-muted-foreground"
        )}
      >
        {task.title}
      </p>

      <div
        className={cn(
          "relative mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5",
          large ? "text-sm" : "text-xs"
        )}
      >
        {urgent && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-semibold",
              task.priority === "urgent" ? "text-destructive" : "text-primary"
            )}
          >
            <Flag className={large ? "size-3" : "size-2.5"} aria-hidden />
            {task.priority === "urgent" ? "Urgent" : "High"}
          </span>
        )}
        {task.time_taken_hours != null && (
          <span className="tabular-nums font-semibold text-foreground/70">
            {formatHours(task.time_taken_hours)}
          </span>
        )}
        {task.project && (
          <span className="truncate text-muted-foreground">
            {task.project.name}
          </span>
        )}
        {task.labels[0] && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: task.labels[0].color }}
              aria-hidden
            />
            {task.labels[0].name}
          </span>
        )}
      </div>
    </>
  );

  if (onOpen) {
    return (
      <button type="button" onClick={() => onOpen(task)} className={className}>
        {content}
      </button>
    );
  }
  return (
    <Link href={`/tasks/${task.id}`} draggable={false} className={className}>
      {content}
    </Link>
  );
}
