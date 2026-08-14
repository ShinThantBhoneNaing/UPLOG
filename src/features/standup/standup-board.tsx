"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
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
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: !enabled,
  });
  return (
    <div
      ref={setNodeRef}
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
  enabled,
  children,
}: {
  userId: string;
  column: Column;
  enabled: boolean;
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
      {children}
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
  const [meetingMode, setMeetingMode] = useState(false);
  const [grouping, setGrouping] = useState<"project" | "employee">("project");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTask, setActiveTask] = useState<TaskWithRelations | null>(null);
  const [previewTask, setPreviewTask] = useState<TaskWithRelations | null>(null);

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
    const overId = e.over?.id;
    if (typeof overId !== "string") return;
    const [userId, toColumn] = overId.split("|") as [string, Column];
    const found = findTask(String(e.active.id));
    if (!found || found.row.profile.id !== userId || found.column === toColumn) return;

    // Only the assignee may move their own ticket on the meeting board.
    if (found.task.assignee && found.task.assignee.id !== currentUserId) {
      toast.warning(
        `Only ${found.task.assignee.full_name} can move this ticket. They've been notified — talk to them if something needs to change.`
      );
      void notifyMoveAttempt(found.task.id);
      return;
    }

    const prev = rows;
    // 1. optimistic move
    setRows((rs) =>
      rs.map((r) =>
        r.profile.id !== userId
          ? r
          : {
              ...r,
              [found.column]: r[found.column].filter((t) => t.id !== found.task.id),
              [toColumn]: [
                { ...found.task, status: COLUMN_STATUS[toColumn] },
                ...r[toColumn],
              ],
            }
      )
    );
    // 2. persist (activity event comes from the DB trigger) — 3. revert on failure
    startTransition(async () => {
      const result = await updateTask({
        id: found.task.id,
        status: COLUMN_STATUS[toColumn],
      });
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
          status !== ALL && status !== "in_progress" ? [] : r.inProgress.filter(matches),
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

  const hasAnyTask = rows.some(
    (r) => r.todo.length + r.inProgress.length + r.done.length > 0
  );

  // Step 1 view: one card per project with ticket counts.
  const projectGroups = useMemo(() => {
    const groups = new Map<
      string,
      { id: string | null; name: string; todo: number; inProgress: number; done: number }
    >();
    for (const r of filteredRows) {
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
    }
    return [...groups.values()].sort(
      (a, b) =>
        b.todo + b.inProgress + b.done - (a.todo + a.inProgress + a.done)
    );
  }, [filteredRows]);
  const dndEnabled = data.isToday;
  const large = meetingMode;

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            className={cn(
              "flex items-center gap-2 font-semibold tracking-tight",
              meetingMode ? "text-2xl" : "text-xl sm:text-2xl"
            )}
          >
            <Presentation className="size-6 text-primary" aria-hidden />
            Standard Meeting
          </h1>
          {!meetingMode && (
            <p className="mt-1 text-sm text-muted-foreground">
              Your morning stand-up wall — powered by the team&apos;s real tasks.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {shareToken && !meetingMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const url = `${window.location.origin}/share/standup/${shareToken}`;
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
            size="sm"
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
            size="sm"
            onClick={() => void toggleFullscreen()}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
          </Button>
        </div>
      </div>

      {/* ---------- date bar ---------- */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
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
              meetingMode ? "min-w-64 text-base" : "min-w-52 text-sm"
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
          size="sm"
          onClick={() => go(today)}
        >
          Today
        </Button>
        <Button
          variant={data.date === yesterday ? "default" : "outline"}
          size="sm"
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
            className="h-8 w-40 pl-8 text-sm"
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
                className="h-8 pl-8 text-sm"
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
              <SelectTrigger className="h-8 w-36 text-sm" aria-label="Filter by employee">
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
              <SelectTrigger className="h-8 w-36 text-sm" aria-label="Filter by project">
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
              <SelectTrigger className="h-8 w-32 text-sm" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {/* ---------- view toggle ---------- */}
      <div className="mb-4 flex items-center gap-2">
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
          "mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border bg-card px-4",
          meetingMode ? "py-3 text-base" : "py-2.5 text-sm"
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
        <div
          className={cn(
            "grid gap-4",
            meetingMode
              ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "sm:grid-cols-2 lg:grid-cols-3"
          )}
        >
          {projectGroups.map((g) => {
            const total = g.todo + g.inProgress + g.done;
            return (
              <button
                key={g.id ?? NOPROJ}
                type="button"
                onClick={() => {
                  setProject(g.id ?? NOPROJ);
                  setGrouping("employee");
                }}
                className={cn(
                  "relative rounded-md border-0 bg-accent p-5 text-left shadow-sm transition-all",
                  "hover:-translate-y-0.5 hover:rotate-0 hover:shadow-md",
                  "[clip-path:polygon(0_0,100%_0,100%_calc(100%-14px),calc(100%-14px)_100%,0_100%)]",
                  tiltForGroup(g.id ?? g.name)
                )}
              >
                <span
                  aria-hidden
                  className="absolute bottom-0 right-0 size-[14px] bg-primary/30 [clip-path:polygon(0_0,100%_0,0_100%)]"
                />
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={cn(
                      "font-semibold leading-snug",
                      meetingMode ? "text-lg" : "text-base"
                    )}
                  >
                    {g.name}
                  </p>
                  <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-sm font-bold tabular-nums text-primary">
                    {total}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-warning" aria-hidden />
                    {g.todo} to do
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-primary" aria-hidden />
                    {g.inProgress} in progress
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-success" aria-hidden />
                    {g.done} done
                  </span>
                </div>
                <p className="mt-3 text-xs font-medium text-primary">
                  Open board →
                </p>
              </button>
            );
          })}
          {projectGroups.length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
              No tasks match the current filters.
            </p>
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

                    {COLUMNS.map((c) => (
                      <DroppableCell
                        key={c.key}
                        userId={row.profile.id}
                        column={c.key}
                        enabled={dndEnabled}
                      >
                        {row[c.key].map((t) => (
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
                    ))}

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
