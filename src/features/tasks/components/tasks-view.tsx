"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, LayoutGrid, List, Search } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATUS_META, TASK_STATUSES } from "@/lib/utils";
import type {
  ProfileLite,
  TaskStatus,
  TaskWithRelations,
} from "@/types/database";
import { updateTask } from "../actions";
import { sortTasks, type SortOption } from "../sorting";
import { Board } from "./board";
import { SortSelect } from "./sort-select";
import { TaskFormDialog } from "./task-form-dialog";
import { TaskList } from "./task-list";

const ALL = "__all__";
const ME = "__me__";
const UNASSIGNED = "__unassigned__";

export function TasksView({
  tasks: serverTasks,
  profiles,
  projects,
  currentUserId,
}: {
  tasks: TaskWithRelations[];
  profiles: ProfileLite[];
  projects: { id: string; name: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Local copy for optimistic board moves; resyncs when the server
  // component re-renders with fresh data (render-time derived state).
  const [tasks, setTasks] = useState(serverTasks);
  const [prevServerTasks, setPrevServerTasks] = useState(serverTasks);
  if (serverTasks !== prevServerTasks) {
    setPrevServerTasks(serverTasks);
    setTasks(serverTasks);
  }

  const [view, setView] = useState<"board" | "list">("board");
  const [assignee, setAssignee] = useState<string>(ME);
  const [project, setProject] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  // Custom = the hand-arranged tasks.position order the board already used.
  const [sort, setSort] = useState<SortOption>("custom");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (assignee === ME && t.assignee?.id !== currentUserId) return false;
      if (assignee === UNASSIGNED && t.assignee) return false;
      if (
        assignee !== ALL &&
        assignee !== ME &&
        assignee !== UNASSIGNED &&
        t.assignee?.id !== assignee
      )
        return false;
      if (project !== ALL && t.project?.id !== project) return false;
      if (status !== ALL && t.status !== status) return false;
      if (q && !t.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, assignee, project, status, query, currentUserId]);

  const sorted = useMemo(() => sortTasks(filtered, sort), [filtered, sort]);

  /**
   * Optimistically patch a task, persist, and roll back if the write fails.
   * `local` holds fields the server derives for itself (completed_at) — they
   * keep the board honest until the refresh lands, but are never sent.
   */
  function persist(
    taskId: string,
    patch: { status?: TaskStatus; position?: number },
    local?: { completed_at?: string | null }
  ) {
    const prev = tasks;
    setTasks((ts) =>
      ts.map((t) => (t.id === taskId ? { ...t, ...patch, ...local } : t))
    );
    // Activity events come from the DB trigger.
    startTransition(async () => {
      const result = await updateTask({ id: taskId, ...patch });
      if (!result.ok) {
        setTasks(prev);
        toast.error(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function moveTask(taskId: string, to: TaskStatus, position?: number) {
    // Without an explicit drop position the card goes to the top, as before.
    const next =
      position ??
      Math.min(0, ...tasks.filter((t) => t.status === to).map((t) => t.position)) -
        1;
    // Mirror the DB trigger's completed_at, or a card dropped on Done would
    // fall straight out of the "finished today" filter and disappear.
    persist(
      taskId,
      { status: to, position: next },
      { completed_at: to === "done" ? new Date().toISOString() : null }
    );
  }

  function reorderTask(taskId: string, position: number) {
    persist(taskId, { position });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs value={view} onValueChange={(v) => setView(v as "board" | "list")}>
          <TabsList>
            <TabsTrigger value="board" aria-label="Board view">
              <LayoutGrid className="size-4" aria-hidden /> Board
            </TabsTrigger>
            <TabsTrigger value="list" aria-label="List view">
              <List className="size-4" aria-hidden /> List
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative ml-auto w-full sm:w-52">
          <Search
            className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter tasks…"
            className="pl-8"
            aria-label="Filter tasks by title"
          />
        </div>

        <Select
          value={assignee}
          onValueChange={(v) => setAssignee(v ?? ME)}
          items={{
            [ME]: "My tasks",
            [ALL]: "Everyone",
            [UNASSIGNED]: "Unassigned",
            ...Object.fromEntries(profiles.map((p) => [p.id, p.full_name])),
          }}
        >
          <SelectTrigger className="w-36" aria-label="Filter by assignee">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ME}>My tasks</SelectItem>
            <SelectItem value={ALL}>Everyone</SelectItem>
            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={project}
          onValueChange={(v) => setProject(v ?? ALL)}
          items={{
            [ALL]: "All projects",
            ...Object.fromEntries(projects.map((p) => [p.id, p.name])),
          }}
        >
          <SelectTrigger className="w-36" aria-label="Filter by project">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {view === "list" && (
          <Select
            value={status}
            onValueChange={(v) => setStatus(v ?? ALL)}
            items={{
              [ALL]: "All statuses",
              ...Object.fromEntries(
                TASK_STATUSES.map((s) => [s, STATUS_META[s].label])
              ),
            }}
          >
            <SelectTrigger className="w-36" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <SortSelect value={sort} onChange={setSort} />

        <TaskFormDialog profiles={profiles} projects={projects} currentUserId={currentUserId} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={query || status !== ALL ? "No matching tasks" : "No tasks yet"}
          description={
            query || status !== ALL
              ? "Try adjusting your filters."
              : "Your board is clear. Create your first task to get moving."
          }
          action={
            !query && status === ALL ? (
              <TaskFormDialog profiles={profiles} projects={projects} currentUserId={currentUserId} />
            ) : undefined
          }
        />
      ) : view === "board" ? (
        <Board
          tasks={sorted}
          onMove={moveTask}
          onReorder={reorderTask}
          reorderable={sort === "custom"}
        />
      ) : (
        // Remount on sort change so the table's column sort starts clean.
        <TaskList key={sort} tasks={sorted} />
      )}
    </div>
  );
}
