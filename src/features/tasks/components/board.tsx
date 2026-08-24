"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { cn, BOARD_STATUSES, STATUS_META } from "@/lib/utils";
import type { TaskStatus, TaskWithRelations } from "@/types/database";
import { positionForDrop } from "../sorting";
import { TaskCard } from "./task-card";

function SortableCard({ task }: { task: TaskWithRelations }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...listeners}
      {...attributes}
      className={cn("touch-manipulation", isDragging && "opacity-40")}
    >
      <TaskCard task={task} />
    </div>
  );
}

function Column({
  status,
  tasks,
}: {
  status: TaskStatus;
  tasks: TaskWithRelations[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = STATUS_META[status];

  return (
    <section
      ref={setNodeRef}
      aria-label={`${meta.label} column, ${tasks.length} tasks`}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl bg-muted/50 transition-colors lg:w-auto lg:min-w-0 lg:flex-1",
        isOver && "bg-primary/8 ring-1 ring-primary/30"
      )}
    >
      <header className="flex items-center gap-2 px-3 pb-1 pt-3">
        <span className={cn("size-2 rounded-full", meta.dot)} aria-hidden />
        <h3 className="text-sm font-semibold">{meta.label}</h3>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
        {status === "done" && (
          <span className="ml-auto text-xs text-muted-foreground">today</span>
        )}
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2 scrollbar-thin">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((t) => (
            <SortableCard key={t.id} task={t} />
          ))}
        </SortableContext>
      </div>
    </section>
  );
}

/**
 * The Done column shows what was finished today, not every task ever
 * completed — otherwise it grows without bound and buries the day's work.
 * Older completions stay on the History page and in the list view.
 */
function completedToday(task: TaskWithRelations): boolean {
  if (!task.completed_at) return false;
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return new Date(task.completed_at).getTime() >= midnight.getTime();
}

export function Board({
  tasks: allTasks,
  onMove,
  onReorder,
  reorderable = false,
}: {
  /** Already in display order — the board never re-sorts. */
  tasks: TaskWithRelations[];
  /** Dropped on another column. `position` is only set in custom order. */
  onMove: (taskId: string, to: TaskStatus, position?: number) => void;
  /** Dropped at a new place in the same column (custom order only). */
  onReorder?: (taskId: string, position: number) => void;
  /** Custom order: cards can be resequenced, not just moved across. */
  reorderable?: boolean;
}) {
  const [activeTask, setActiveTask] = useState<TaskWithRelations | null>(null);

  // Drag maths and rendering both work off the visible set, so drop
  // positions are computed against the cards actually on screen.
  const tasks = allTasks.filter(
    (t) => t.status !== "done" || completedToday(t)
  );

  // Small activation distance keeps card links clickable.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragStart(e: DragStartEvent) {
    setActiveTask(tasks.find((t) => t.id === e.active.id) ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    if (!e.over) return;

    const activeId = String(e.active.id);
    const overId = String(e.over.id);
    const task = tasks.find((t) => t.id === activeId);
    if (!task) return;

    // Dropped on a column, or on a card that tells us its column.
    const isColumn = BOARD_STATUSES.includes(overId as TaskStatus);
    const to = isColumn
      ? (overId as TaskStatus)
      : tasks.find((t) => t.id === overId)?.status;
    if (!to) return;

    const sameColumn = task.status === to;
    if (sameColumn && !reorderable) {
      toast.info("Choose “Custom order” to rearrange cards by hand.");
      return;
    }

    const columnIds = tasks.filter((t) => t.status === to).map((t) => t.id);
    let orderedIds: string[];

    if (sameColumn) {
      const from = columnIds.indexOf(activeId);
      const target = isColumn ? columnIds.length - 1 : columnIds.indexOf(overId);
      if (from === -1 || target === -1 || from === target) return;
      orderedIds = arrayMove(columnIds, from, target);
    } else {
      const at = isColumn
        ? columnIds.length
        : Math.max(0, columnIds.indexOf(overId));
      orderedIds = [...columnIds.slice(0, at), activeId, ...columnIds.slice(at)];
    }

    const position = positionForDrop(
      orderedIds,
      activeId,
      (id) => tasks.find((t) => t.id === id)?.position
    );

    if (sameColumn) onReorder?.(activeId, position);
    // Derived sorts have no sequence to honour, so let the move keep its
    // default placement instead of writing an order the user can't see.
    else onMove(activeId, to, reorderable ? position : undefined);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin lg:grid lg:grid-cols-4 lg:overflow-visible">
        {BOARD_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={tasks.filter((t) => t.status === status)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask && <TaskCard task={activeTask} className="rotate-2 shadow-lg" />}
      </DragOverlay>
    </DndContext>
  );
}
