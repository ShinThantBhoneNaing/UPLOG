"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
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
import {
  CalendarDays,
  FolderKanban,
  Share2,
  Users,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Maximize2,
  Minimize2,
  Paperclip,
  Plus,
  Presentation,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
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
import { UserAvatar } from "@/components/user-avatar";
import { updateTask } from "@/features/tasks/actions";
import { notifyMoveAttempt } from "./actions";
import {
  positionForDrop,
  sortTasks,
  type SortOption,
} from "@/features/tasks/sorting";
import { SortSelect } from "@/features/tasks/components/sort-select";
import { TaskFormDialog } from "@/features/tasks/components/task-form-dialog";
import { cn, formatHours } from "@/lib/utils";
import type { TaskStatus, TaskWithRelations } from "@/types/database";
import type { StandupData, StandupRow } from "./queries";
import { StickyCard } from "./sticky-card";
import { TaskPreviewDialog } from "./task-preview-dialog";

const ALL = "__all__";
const NOPROJ = "__noproj__";
type Column = "todo" | "inProgress" | "done";
const COLUMN_STATUS: Record<Column, TaskStatus> = {
  todo: "todo",
  inProgress: "in_progress",
  done: "done",
};
const COLUMNS: { key: Column; label: string; dot: string }[] = [
  { key: "todo", label: "To Do", dot: "bg-warning" },
  { key: "inProgress", label: "In Progress", dot: "bg-primary" },
  { key: "done", label: "Done", dot: "bg-success" },
];

function tiltForGroup(key: string): string {
  const n = key.charCodeAt(0) + key.charCodeAt(key.length - 1);
  const classes = ["-rotate-[0.6deg]", "rotate-[0.4deg]", "rotate-0", "-rotate-[0.3deg]", "rotate-[0.6deg]"];
  return classes[n % classes.length];
}

/* ---------------- drag & drop wrappers ---------------- */

function DraggableSticky({
  task,
  column,
  large,
  enabled,
  onOpen,
}: {
  task: TaskWithRelations;
  column: Column;
  large: boolean;
  enabled: boolean;
  onOpen: (task: TaskWithRelations) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: !enabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...listeners}
      {...attributes}
      className={cn("touch-manipulation", isDragging && "opacity-40")}
    >
      <StickyCard task={task} column={column} large={large} onOpen={onOpen} />
    </div>
  );
}

function DroppableCell({
  userId,
  column,
  columnLabel,
  employeeName,
  enabled,
  taskIds,
  onQuickAdd,
  children,
}: {
  userId: string;
  column: Column;
  columnLabel: string;
  employeeName: string;
  enabled: boolean;
  /** Cards in this cell, in display order — the sortable sequence. */
  taskIds: string[];
  /** Absent on past days, where the board is a read-only record. */
  onQuickAdd?: (userId: string, column: Column) => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${userId}|${column}`,
    disabled: !enabled,
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-16 flex-col gap-2 p-2 transition-colors",
        isOver && "rounded-lg bg-primary/8 ring-1 ring-primary/30"
      )}
    >
      <SortableContext
        items={taskIds}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
      {onQuickAdd && (
        <button
          type="button"
          onClick={() => onQuickAdd(userId, column)}
          aria-label={`Add a task for ${employeeName} in ${columnLabel}`}
          className={cn(
            "flex items-center justify-center gap-1 rounded-md border border-dashed py-1.5",
            "text-xs text-muted-foreground opacity-60 transition-all",
            "hover:border-primary/50 hover:text-primary hover:opacity-100",
            "focus-visible:opacity-100"
          )}
        >
          <Plus className="size-3.5" aria-hidden /> Add
        </button>
      )}
    </div>
  );
}

/* ---------------- main board ---------------- */

export function StandupBoard({
  data,
  currentUserId,
  shareToken,
}: {
  data: StandupData;
  currentUserId: string;
  /** Present for managers/admins: enables the public share-link button. */
  shareToken?: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  // Optimistic local copy, resynced when the server sends fresh data.
  const [rows, setRows] = useState(data.rows);
  const [prevData, setPrevData] = useState(data);
  if (data !== prevData) {
    setPrevData(data);
    setRows(data.rows);
  }

  const [employee, setEmployee] = useState<string>(ALL);
  const [project, setProject] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  // Custom = the hand-arranged tasks.position order the wall already used.
  const [sort, setSort] = useState<SortOption>("custom");
  const [meetingMode, setMeetingMode] = useState(false);
  const [grouping, setGrouping] = useState<"project" | "employee">("employee");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTask, setActiveTask] = useState<TaskWithRelations | null>(null);
  const [previewTask, setPreviewTask] = useState<TaskWithRelations | null>(null);
  // Quick-add target: which employee's row and which column the "+" was in.
  const [quickAdd, setQuickAdd] = useState<{
    assigneeId: string;
    status: TaskStatus;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  /* ----- realtime: refresh today's board when team activity happens ----- */
  useEffect(() => {
    if (!data.isToday) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel("standup-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activities" },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => router.refresh(), 1200);
        }
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [data.isToday, router]);

  /* ----- fullscreen ----- */
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    } else {
      setMeetingMode(true);
      await containerRef.current?.requestFullscreen().catch(() => {
        toast.error("Fullscreen isn't available in this browser.");
      });
    }
  }

  /* ----- date navigation ----- */
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(addDays(parseISO(`${today}T00:00:00`), -1), "yyyy-MM-dd");
  function go(date: string) {
    router.push(date === today ? "/standup" : `/standup?date=${date}`);
  }
  const shift = (days: number) =>
    go(format(addDays(parseISO(`${data.date}T00:00:00`), days), "yyyy-MM-dd"));

  /* ----- drag & drop ----- */
  function findTask(id: string): { task: TaskWithRelations; row: StandupRow; column: Column } | null {
    for (const row of rows) {
      for (const column of ["todo", "inProgress", "done"] as Column[]) {
        const task = row[column].find((t) => t.id === id);
        if (task) return { task, row, column };
      }
    }
    return null;
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveTask(findTask(String(e.active.id))?.task ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    if (!e.over) return;
    const activeId = String(e.active.id);
    const overId = String(e.over.id);
    const found = findTask(activeId);
    if (!found) return;

    // Dropped on a cell, or on a card that tells us which cell it lives in.
    const onCell = overId.includes("|");
    const over = onCell ? null : findTask(overId);
    const userId = onCell ? overId.split("|")[0]! : over?.row.profile.id;
    const toColumn = onCell
      ? (overId.split("|")[1] as Column)
      : over?.column;
    if (!userId || !toColumn || found.row.profile.id !== userId) return;

    const sameColumn = found.column === toColumn;
    // Derived sorts have no sequence to rewrite, so in-place drags are inert.
    if (sameColumn && sort !== "custom") {
      toast.info("Choose “Custom order” to rearrange cards by hand.");
      return;
    }

    // Only the assignee may move their own ticket on the meeting board.
    if (found.task.assignee && found.task.assignee.id !== currentUserId) {
      toast.warning(
        `Only ${found.task.assignee.full_name} can move this ticket. They've been notified — talk to them if something needs to change.`
      );
      void notifyMoveAttempt(found.task.id);
      return;
    }

    // Work out the cell's final sequence, then take the midpoint position.
    const source = rows.find((r) => r.profile.id === userId);
    const columnIds = source ? cardsIn(source, toColumn).map((t) => t.id) : [];
    let orderedIds: string[];
    if (sameColumn) {
      const from = columnIds.indexOf(activeId);
      const to = onCell ? columnIds.length - 1 : columnIds.indexOf(overId);
      if (from === -1 || to === -1 || from === to) return;
      orderedIds = arrayMove(columnIds, from, to);
    } else {
      const at = onCell
        ? columnIds.length
        : Math.max(0, columnIds.indexOf(overId));
      orderedIds = [...columnIds.slice(0, at), activeId, ...columnIds.slice(at)];
    }
    const position = positionForDrop(
      orderedIds,
      activeId,
      (id) => findTask(id)?.task.position
    );

    const prev = rows;
    // 1. optimistic move
    setRows((rs) =>
      rs.map((r) => {
        if (r.profile.id !== userId) return r;
        if (sameColumn) {
          return {
            ...r,
            [toColumn]: r[toColumn].map((t) =>
              t.id === activeId ? { ...t, position } : t
            ),
          };
        }
        return {
          ...r,
          [found.column]: r[found.column].filter((t) => t.id !== activeId),
          [toColumn]: [
            { ...found.task, status: COLUMN_STATUS[toColumn], position },
            ...r[toColumn],
          ],
        };
      })
    );
    // 2. persist (activity event comes from the DB trigger) — 3. revert on failure
    startTransition(async () => {
      const result = await updateTask(
        sameColumn
          ? { id: activeId, position }
          : { id: activeId, status: COLUMN_STATUS[toColumn], position }
      );
      if (!result.ok) {
        setRows(prev);
        toast.error(result.error);
      } else {
        router.refresh();
      }
    });
  }

  /* ----- filtering ----- */
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (t: TaskWithRelations) =>
      (project === ALL
        ? true
        : project === NOPROJ
          ? !t.project
          : t.project?.id === project) &&
      (q === "" || t.title.toLowerCase().includes(q));
    return rows
      .filter((r) => employee === ALL || r.profile.id === employee)
      .map((r) => ({
        ...r,
        todo: status !== ALL && status !== "todo" ? [] : r.todo.filter(matches),
        inProgress:
          status !== ALL && status !== "in_progress"
            ? []
            : r.inProgress.filter(matches),
        done: status !== ALL && status !== "done" ? [] : r.done.filter(matches),
      }))
      .map((r) => ({
        ...r,
        estHours:
          Math.round(
            r.done.reduce((sum, t) => sum + (t.time_taken_hours ?? 0), 0) * 100
          ) / 100,
      }))
      .filter(
        (r) =>
          employee !== ALL ||
          r.todo.length + r.inProgress.length + r.done.length > 0
      );
  }, [rows, employee, project, status, query]);

  /**
   * A cell's cards in display order. Sorting stays out of the filter memo:
   * it is a handful of cards per cell, and rebuilding the row objects here
   * would alias the memoized rows.
   */
  const cardsIn = (row: StandupRow, column: Column) =>
    sortTasks(row[column].slice(), sort);

  const hasAnyTask = rows.some(
    (r) => r.todo.length + r.inProgress.length + r.done.length > 0
  );

  // Project view: for each employee, which projects they are working on.
  const employeeProjects = useMemo(() => {
    return filteredRows
      .map((r) => {
        const groups = new Map<
          string,
          { id: string | null; name: string; todo: number; inProgress: number; done: number }
        >();
        for (const [col, list] of [
          ["todo", r.todo],
          ["inProgress", r.inProgress],
          ["done", r.done],
        ] as const) {
          for (const t of list) {
            const key = t.project?.id ?? "__none__";
            let g = groups.get(key);
            if (!g) {
              g = {
                id: t.project?.id ?? null,
                name: t.project?.name ?? "No project",
                todo: 0,
                inProgress: 0,
                done: 0,
              };
              groups.set(key, g);
            }
            g[col] += 1;
          }
        }
        return {
          profile: r.profile,
          projects: [...groups.values()].sort(
            (a, b) => b.todo + b.inProgress + b.done - (a.todo + a.inProgress + a.done)
          ),
        };
      })
      .filter((e) => e.projects.length > 0);
  }, [filteredRows]);
  const dndEnabled = data.isToday;
  const large = meetingMode;
  // An active project filter becomes the default for tasks created here.
  const filterProjectId =
    project !== ALL && project !== NOPROJ ? project : undefined;

  const summaryItems = [
    { label: "Employees", value: filteredRows.length },
    {
      label: "Tasks",
      value: filteredRows.reduce(
        (n, r) => n + r.todo.length + r.inProgress.length + r.done.length,
        0
      ),
    },
    { label: "To Do", value: filteredRows.reduce((n, r) => n + r.todo.length, 0) },
    {
      label: "In Progress",
      value: filteredRows.reduce((n, r) => n + r.inProgress.length, 0),
    },
    { label: "Done", value: filteredRows.reduce((n, r) => n + r.done.length, 0) },
  ];
  const totalEst = filteredRows.reduce((n, r) => n + r.estHours, 0);

  const dateLabel =
    data.date === today
      ? `Today, ${format(parseISO(`${data.date}T00:00:00`), "MMMM d, yyyy")}`
      : data.date === yesterday
        ? `Yesterday, ${format(parseISO(`${data.date}T00:00:00`), "MMMM d, yyyy")}`
        : format(parseISO(`${data.date}T00:00:00`), "EEEE, MMMM d, yyyy");

  return (
    <div
      ref={containerRef}
      className={cn(
        meetingMode &&
          "fixed inset-0 z-50 overflow-y-auto bg-background px-4 py-5 sm:px-8"
      )}
    >
      {/* ---------- header ---------- */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1
            className={cn(
              "flex items-center gap-2 font-semibold tracking-tight",
              meetingMode ? "text-2xl" : "text-lg sm:text-xl"
            )}
          >
            <Presentation className="size-5 text-primary" aria-hidden />
            Standard Meeting
          </h1>
          {!meetingMode && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your morning stand-up wall — powered by the team&apos;s real tasks.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data.isToday && (
            <TaskFormDialog
              // Re-mount when the project filter changes so it prefills.
              key={`header-${filterProjectId ?? "none"}`}
              profiles={data.profiles}
              projects={data.projects}
              currentUserId={currentUserId}
              defaultProjectId={filterProjectId}
              trigger={
                <Button size="xs">
                  <Plus aria-hidden /> New task
                </Button>
              }
            />
          )}
          {shareToken && !meetingMode && (
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                // Carry the sharer's custom colors along in the link so
                // viewers see the same board (settings live per browser).
                const saved = localStorage.getItem("uplog-colors");
                const theme = saved
                  ? `?theme=${encodeURIComponent(btoa(saved))}`
                  : "";
                const url = `${window.location.origin}/share/standup/${shareToken}${theme}`;
                void navigator.clipboard
                  .writeText(url)
                  .then(() => toast.success("Share link copied — anyone with it can view today's board (read-only)."))
                  .catch(() => toast.error("Couldn't copy the link."));
              }}
            >
              <Share2 aria-hidden /> Share
            </Button>
          )}
          <Button
            variant={meetingMode ? "default" : "outline"}
            size="xs"
            onClick={() => setMeetingMode((m) => !m)}
          >
            {meetingMode ? (
              <>
                <X aria-hidden /> Exit Meeting Mode
              </>
            ) : (
              <>
                <Presentation aria-hidden /> Meeting Mode
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => void toggleFullscreen()}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
          </Button>
        </div>
      </div>

      {/* ---------- date bar ---------- */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border bg-card">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => shift(-1)}
            aria-label="Previous day"
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span
            className={cn(
              "px-2 text-center font-medium tabular-nums",
              meetingMode ? "min-w-64 text-base" : "min-w-44 text-xs"
            )}
          >
            {dateLabel}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => shift(1)}
            disabled={data.date >= today}
            aria-label="Next day"
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>

        <Button
          variant={data.date === today ? "default" : "outline"}
          size="xs"
          onClick={() => go(today)}
        >
          Today
        </Button>
        <Button
          variant={data.date === yesterday ? "default" : "outline"}
          size="xs"
          onClick={() => go(yesterday)}
        >
          Yesterday
        </Button>
        <label className="relative inline-flex items-center">
          <span className="sr-only">Pick a date</span>
          <CalendarDays
            className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="date"
            value={data.date}
            max={today}
            onChange={(e) => e.target.value && go(e.target.value)}
            className="h-7 w-36 pl-8 text-xs"
          />
        </label>

        {!meetingMode && (
          <>
            <div className="relative ml-auto w-full sm:w-44">
              <Search
                className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tasks…"
                className="h-7 pl-8 text-xs"
                aria-label="Search tasks on the board"
              />
            </div>
            <Select
              value={employee}
              onValueChange={(v) => setEmployee(v ?? ALL)}
              items={{
                [ALL]: "All employees",
                ...Object.fromEntries(data.profiles.map((p) => [p.id, p.full_name])),
              }}
            >
              <SelectTrigger className="h-7 w-36 text-xs" aria-label="Filter by employee">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All employees</SelectItem>
                {data.profiles.map((p) => (
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
                ...Object.fromEntries(data.projects.map((p) => [p.id, p.name])),
              }}
            >
              <SelectTrigger className="h-7 w-36 text-xs" aria-label="Filter by project">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All projects</SelectItem>
                {data.projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v ?? ALL)}
              items={{
                [ALL]: "All statuses",
                todo: "To Do",
                in_progress: "In Progress",
                done: "Done",
              }}
            >
              <SelectTrigger className="h-7 w-32 text-xs" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
            <SortSelect
              value={sort}
              onChange={setSort}
              className="h-7 w-36 text-xs"
            />
          </>
        )}
      </div>

      {/* ---------- view toggle ---------- */}
      <div className="mb-2 flex items-center gap-2">
        <Tabs
          value={grouping}
          onValueChange={(v) => setGrouping(v as "project" | "employee")}
        >
          <TabsList>
            <TabsTrigger value="project" aria-label="Group by project">
              <FolderKanban className="size-4" aria-hidden /> Projects
            </TabsTrigger>
            <TabsTrigger value="employee" aria-label="Board by employee">
              <Users className="size-4" aria-hidden /> Board
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {grouping === "employee" && project !== ALL && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setProject(ALL);
              setEmployee(ALL);
              setGrouping("project");
            }}
          >
            <ChevronLeft aria-hidden /> All projects
          </Button>
        )}
      </div>

      {/* ---------- summary ---------- */}
      <div
        className={cn(
          "mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-card px-4",
          meetingMode ? "py-3 text-base" : "py-2 text-sm"
        )}
      >
        {summaryItems.map((s) => (
          <span key={s.label} className="flex items-baseline gap-1.5">
            <span className="font-semibold tabular-nums">{s.value}</span>
            <span className="text-muted-foreground">{s.label}</span>
          </span>
        ))}
        <span className="ml-auto flex items-baseline gap-1.5">
          <span className="font-semibold tabular-nums">
            {totalEst ? formatHours(totalEst) : "—"}
          </span>
          <span className="text-muted-foreground">
            {totalEst ? "tracked" : "no time tracked yet"}
          </span>
        </span>
      </div>

      {/* ---------- board ---------- */}
      {!hasAnyTask ? (
        <EmptyState
          icon={ClipboardList}
          title={
            data.isToday ? "No work planned for today yet" : "No work recorded for this day"
          }
          description={
            data.isToday
              ? "Tasks your team creates and assigns in UPLOG appear here automatically — no double entry."
              : "Tasks completed or worked on during this day would appear here."
          }
          action={
            data.isToday ? (
              <TaskFormDialog profiles={data.profiles} projects={data.projects} currentUserId={currentUserId} />
            ) : undefined
          }
        />
      ) : grouping === "project" ? (
        <div className="space-y-5">
          {employeeProjects.length === 0 ? (
            <p className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
              No tasks match the current filters.
            </p>
          ) : (
            employeeProjects.map((e) => (
              <section
                key={e.profile.id}
                aria-label={`Projects for ${e.profile.full_name}`}
                className="rounded-xl border bg-card p-4"
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <UserAvatar
                    name={e.profile.full_name}
                    avatarUrl={e.profile.avatar_url}
                    className={meetingMode ? "size-10" : "size-8"}
                  />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "truncate font-semibold",
                        meetingMode ? "text-base" : "text-sm"
                      )}
                    >
                      {e.profile.full_name}
                    </p>
                    {e.profile.job_title && (
                      <p className="truncate text-xs text-muted-foreground">
                        {e.profile.job_title}
                      </p>
                    )}
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {e.projects.length}{" "}
                    {e.projects.length === 1 ? "project" : "projects"}
                  </span>
                </div>

                <div
                  className={cn(
                    "grid gap-3",
                    meetingMode
                      ? "sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                      : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  )}
                >
                  {e.projects.map((g) => {
                    const total = g.todo + g.inProgress + g.done;
                    return (
                      <button
                        key={g.id ?? NOPROJ}
                        type="button"
                        onClick={() => {
                          setProject(g.id ?? NOPROJ);
                          setEmployee(e.profile.id);
                          setGrouping("employee");
                        }}
                        className={cn(
                          "relative p-4 pt-[18px] text-left text-project-card-foreground transition-all",
                          "hover:-translate-y-0.5 hover:rotate-0",
                          tiltForGroup((e.profile.id[0] ?? "x") + g.name)
                        )}
                      >
                        {/* stacked sheets + paperclip, like a pinned note pile */}
                        <span
                          aria-hidden
                          className="absolute inset-0 rotate-[2deg] rounded-sm bg-project-card/60 shadow-sm"
                        />
                        <span
                          aria-hidden
                          className="absolute inset-0 -rotate-[1.5deg] rounded-sm bg-project-card/75"
                        />
                        <span
                          aria-hidden
                          className="absolute inset-0 rounded-sm bg-project-card shadow-sm"
                        />
                        <Paperclip
                          aria-hidden
                          className="absolute -top-2 left-4 size-4 -rotate-12 text-primary"
                        />
                        <div className="relative flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "line-clamp-2 font-semibold leading-snug",
                              meetingMode ? "text-base" : "text-sm"
                            )}
                          >
                            {g.name}
                          </p>
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold tabular-nums text-primary">
                            {total}
                          </span>
                        </div>
                        <div className="relative mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-project-card-foreground/70">
                          <span className="flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-warning" aria-hidden />
                            {g.todo}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                            {g.inProgress}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-success" aria-hidden />
                            {g.done}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="overflow-x-auto rounded-xl border bg-card scrollbar-thin">
            <div className={cn("min-w-[880px]", meetingMode && "min-w-[1080px]")}>
              {/* header row */}
              <div className="grid grid-cols-[180px_1fr_1fr_1fr_92px] border-b bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div className="sticky left-0 z-10 bg-muted/40 px-3 py-2.5 backdrop-blur">
                  Employee
                </div>
                {COLUMNS.map((c) => (
                  <div key={c.key} className="flex items-center gap-1.5 px-3 py-2.5">
                    <span className={cn("size-2 rounded-full", c.dot)} aria-hidden />
                    {c.label}
                  </div>
                ))}
                <div className="px-3 py-2.5 text-right">
                  Time Taken
                </div>
              </div>

              {/* employee rows */}
              {filteredRows.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No tasks match the current filters.
                </p>
              ) : (
                filteredRows.map((row) => (
                  <div
                    key={row.profile.id}
                    className="grid grid-cols-[180px_1fr_1fr_1fr_92px] border-b last:border-b-0"
                  >
                    <div className="sticky left-0 z-10 flex items-start gap-2.5 border-r bg-card px-3 py-3">
                      <UserAvatar
                        name={row.profile.full_name}
                        avatarUrl={row.profile.avatar_url}
                        className={meetingMode ? "size-10" : "size-8"}
                      />
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "truncate font-medium",
                            meetingMode ? "text-base" : "text-sm"
                          )}
                        >
                          {row.profile.full_name}
                        </p>
                        {row.profile.job_title && (
                          <p className="truncate text-xs text-muted-foreground">
                            {row.profile.job_title}
                          </p>
                        )}
                      </div>
                    </div>

                    {COLUMNS.map((c) => {
                      const cards = cardsIn(row, c.key);
                      return (
                        <DroppableCell
                          key={c.key}
                          userId={row.profile.id}
                          column={c.key}
                          columnLabel={c.label}
                          employeeName={row.profile.full_name}
                          enabled={dndEnabled}
                          taskIds={cards.map((t) => t.id)}
                          onQuickAdd={
                            data.isToday
                              ? (assigneeId, col) =>
                                  setQuickAdd({
                                    assigneeId,
                                    status: COLUMN_STATUS[col],
                                  })
                              : undefined
                          }
                        >
                          {cards.map((t) => (
                            <DraggableSticky
                              key={t.id}
                              task={t}
                              column={c.key}
                              large={large}
                              enabled={dndEnabled}
                              onOpen={setPreviewTask}
                            />
                          ))}
                        </DroppableCell>
                      );
                    })}

                    <div
                      className={cn(
                        "flex items-start justify-end px-3 py-3 tabular-nums",
                        meetingMode ? "text-base" : "text-sm"
                      )}
                    >
                      {row.estHours ? (
                        <span className="font-semibold">
                          {formatHours(row.estHours)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <DragOverlay>
            {activeTask && (
              <div className="w-56 rotate-2">
                <StickyCard task={activeTask} column="inProgress" large={large} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <TaskPreviewDialog task={previewTask} onClose={() => setPreviewTask(null)} />

      {/* Quick add from a board cell: assignee and column are pre-filled. */}
      {quickAdd && (
        <TaskFormDialog
          key={`${quickAdd.assigneeId}-${quickAdd.status}`}
          open
          onOpenChange={(next) => {
            if (!next) setQuickAdd(null);
          }}
          profiles={data.profiles}
          projects={data.projects}
          currentUserId={currentUserId}
          defaultAssigneeId={quickAdd.assigneeId}
          defaultStatus={quickAdd.status}
          defaultProjectId={filterProjectId}
        />
      )}

      {/* ---------- meeting history ---------- */}
      {!meetingMode && (
        <section aria-label="Meeting history" className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
            Meeting history
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {data.history.map((h) => {
              const active = h.date === data.date;
              return (
                <button
                  key={h.date}
                  type="button"
                  onClick={() => go(h.date)}
                  aria-current={active ? "date" : undefined}
                  className={cn(
                    "shrink-0 rounded-lg border px-3.5 py-2 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/5"
                      : "bg-card hover:border-primary/40"
                  )}
                >
                  <p className="text-sm font-medium">
                    {h.date === today
                      ? "Today"
                      : h.date === yesterday
                        ? "Yesterday"
                        : format(parseISO(`${h.date}T00:00:00`), "MMM d")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {h.total} {h.total === 1 ? "task" : "tasks"} · {h.done} done
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
