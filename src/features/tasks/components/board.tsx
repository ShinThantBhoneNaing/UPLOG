"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { cn, BOARD_STATUSES, STATUS_META } from "@/lib/utils";
import type { TaskStatus, TaskWithRelations } from "@/types/database";
import { TaskCard } from "./task-card";

function DraggableCard({ task }: { task: TaskWithRelations }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
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
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2 scrollbar-thin">
        {tasks.map((t) => (
          <DraggableCard key={t.id} task={t} />
        ))}
      </div>
    </section>
  );
}

export function Board({
  tasks,
  onMove,
}: {
  tasks: TaskWithRelations[];
  /** Called when a card is dropped on another column. */
  onMove: (taskId: string, to: TaskStatus) => void;
}) {
  const [activeTask, setActiveTask] = useState<TaskWithRelations | null>(null);

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
    const to = e.over?.id as TaskStatus | undefined;
    if (!to || !BOARD_STATUSES.includes(to)) return;
    const task = tasks.find((t) => t.id === e.active.id);
    if (task && task.status !== to) onMove(task.id, to);
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
            tasks={tasks
              .filter((t) => t.status === status)
              .sort((a, b) => a.position - b.position)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask && <TaskCard task={activeTask} className="rotate-2 shadow-lg" />}
      </DragOverlay>
    </DndContext>
  );
}
