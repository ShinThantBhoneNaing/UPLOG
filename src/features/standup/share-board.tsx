"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Flag, FolderKanban, Paperclip, Search, Users } from "lucide-react";
import {
  applyCustomColors,
  parseCustomColors,
} from "@/features/settings/theme-colors";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
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
import { cn, formatHours } from "@/lib/utils";

/* Shapes returned by the get_standup_share RPC */
export interface ShareTask {
  id: string;
  title: string;
  priority: "low" | "medium" | "high" | "urgent";
  project: string | null;
  time_taken_hours?: number | null;
}
export interface ShareRow {
  id: string;
  name: string;
  avatar_url: string | null;
  job_title: string | null;
  todo: ShareTask[];
  in_progress: ShareTask[];
  done: ShareTask[];
}
export interface ShareData {
  date: string;
  workspace: string;
  rows: ShareRow[];
}

const ALL = "__all__";
const NOPROJ = "__noproj__";
type Column = "todo" | "in_progress" | "done";
/* Mirrors sticky-card.tsx: paper from --sticky, status via paperclip color. */
const COLUMNS: { key: Column; label: string; dot: string; clip: string }[] = [
  { key: "todo", label: "To Do", dot: "bg-warning", clip: "text-warning" },
  { key: "in_progress", label: "In Progress", dot: "bg-primary", clip: "text-primary" },
  { key: "done", label: "Done", dot: "bg-success", clip: "text-success" },
];

function tiltForGroup(key: string): string {
  const n = key.charCodeAt(0) + key.charCodeAt(key.length - 1);
  const classes = ["-rotate-[0.6deg]", "rotate-[0.4deg]", "rotate-0", "-rotate-[0.3deg]", "rotate-[0.6deg]"];
  return classes[n % classes.length];
}

function tilt(id: string): string {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  const classes = ["-rotate-1", "rotate-[0.75deg]", "-rotate-[0.5deg]", "rotate-1", "rotate-0"];
  return classes[n % classes.length];
}

function ShareSticky({
  task,
  clip,
  done,
}: {
  task: ShareTask;
  clip: string;
  done?: boolean;
}) {
  const urgent = task.priority === "urgent" || task.priority === "high";
  return (
    <div
      className={cn(
        "font-handwriting relative p-3 pt-3.5",
        tilt(task.id),
        done && "opacity-85"
      )}
    >
      {/* stacked sheets + status paperclip, mirroring sticky-card.tsx */}
      <span
        aria-hidden
        className="absolute inset-0 rotate-[2deg] rounded-sm bg-sticky/40 shadow-sm"
      />
      <span
        aria-hidden
        className="absolute inset-0 -rotate-[1.5deg] rounded-sm bg-sticky/50"
      />
      <span
        aria-hidden
        className="absolute inset-0 rounded-sm bg-sticky/20 shadow-sm dark:bg-sticky/15"
      />
      <Paperclip
        aria-hidden
        className={cn("absolute -top-2 left-4 size-4 -rotate-12", clip)}
      />
      <p
        className={cn(
          "relative line-clamp-3 text-sm font-medium leading-snug",
          done && "text-muted-foreground"
        )}
      >
        {task.title}
      </p>
      <div className="relative mt-2 flex flex-wrap items-center gap-x-2 text-xs">
        {urgent && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-semibold",
              task.priority === "urgent" ? "text-destructive" : "text-primary"
            )}
          >
            <Flag className="size-3" aria-hidden />
            {task.priority === "urgent" ? "Urgent" : "High"}
          </span>
        )}
        {task.time_taken_hours != null && (
          <span className="tabular-nums font-semibold text-foreground/70">
            {formatHours(task.time_taken_hours)}
          </span>
        )}
        {task.project && (
          <span className="truncate text-muted-foreground">{task.project}</span>
        )}
      </div>
    </div>
  );
}

/** Read-only public stand-up board (meeting-mode look, no login). */
export function ShareBoard({
  data,
  token,
}: {
  data: ShareData;
  token: string;
}) {
  const router = useRouter();
  const [employee, setEmployee] = useState<string>(ALL);
  const [project, setProject] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const [grouping, setGrouping] = useState<"project" | "employee">("employee");

  // The share link can carry the sharer's custom colors (?theme=base64 JSON)
  // so viewers see the board the way the sharer styled it.
  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get("theme");
    if (!encoded) return;
    try {
      applyCustomColors(parseCustomColors(atob(encoded)));
    } catch {
      // malformed param — keep default theme
    }
  }, []);

  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(addDays(parseISO(`${today}T00:00:00`), -1), "yyyy-MM-dd");
  function go(date: string) {
    // Preserve the theme param across date navigation.
    const params = new URLSearchParams(window.location.search);
    if (date === today) params.delete("date");
    else params.set("date", date);
    const qs = params.toString();
    router.push(`/share/standup/${token}${qs ? `?${qs}` : ""}`);
  }
  const shift = (days: number) =>
    go(format(addDays(parseISO(`${data.date}T00:00:00`), days), "yyyy-MM-dd"));

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (t: ShareTask) =>
      (project === ALL
        ? true
        : project === NOPROJ
          ? !t.project
          : t.project === project) &&
      (q === "" || t.title.toLowerCase().includes(q));
    return data.rows
      .filter((r) => employee === ALL || r.id === employee)
      .map((r) => ({
        ...r,
        todo: status !== ALL && status !== "todo" ? [] : r.todo.filter(match),
        in_progress:
          status !== ALL && status !== "in_progress" ? [] : r.in_progress.filter(match),
        done: status !== ALL && status !== "done" ? [] : r.done.filter(match),
      }))
      .filter(
        (r) =>
          employee !== ALL ||
          r.todo.length + r.in_progress.length + r.done.length > 0
      );
  }, [data.rows, employee, project, status, query]);

  const projectNames = useMemo(() => {
    const names = new Set<string>();
    for (const r of data.rows) {
      for (const t of [...r.todo, ...r.in_progress, ...r.done]) {
        if (t.project) names.add(t.project);
      }
    }
    return [...names].sort();
  }, [data.rows]);

  const employeeProjects = useMemo(() => {
    return rows
      .map((r) => {
        const groups = new Map<
          string,
          { name: string; isNone: boolean; todo: number; in_progress: number; done: number }
        >();
        for (const [col, list] of [
          ["todo", r.todo],
          ["in_progress", r.in_progress],
          ["done", r.done],
        ] as const) {
          for (const t of list) {
            const key = t.project ?? NOPROJ;
            let g = groups.get(key);
            if (!g) {
              g = {
                name: t.project ?? "No project",
                isNone: !t.project,
                todo: 0,
                in_progress: 0,
                done: 0,
              };
              groups.set(key, g);
            }
            g[col] += 1;
          }
        }
        return {
          row: r,
          projects: [...groups.values()].sort(
            (a, b) =>
              b.todo + b.in_progress + b.done - (a.todo + a.in_progress + a.done)
          ),
        };
      })
      .filter((e) => e.projects.length > 0);
  }, [rows]);

  const totals = {
    tasks: rows.reduce((n, r) => n + r.todo.length + r.in_progress.length + r.done.length, 0),
    done: rows.reduce((n, r) => n + r.done.length, 0),
    inProgress: rows.reduce((n, r) => n + r.in_progress.length, 0),
    hours:
      Math.round(
        rows.reduce(
          (n, r) => n + r.done.reduce((s, t) => s + (t.time_taken_hours ?? 0), 0),
          0
        ) * 100
      ) / 100,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Logo />
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Standard Meeting
            <span className="ml-3 text-base font-normal text-muted-foreground">
              {format(parseISO(`${data.date}T00:00:00`), "EEEE, MMMM d, yyyy")}
            </span>
          </h1>
        </div>
        <p className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
          Read-only shared view · {data.workspace}
        </p>
      </header>

      {/* date navigation */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border bg-card">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => shift(-1)}
            aria-label="Previous day"
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span className="min-w-48 px-2 text-center text-sm font-medium tabular-nums">
            {data.date === today
              ? "Today"
              : data.date === yesterday
                ? "Yesterday"
                : format(parseISO(`${data.date}T00:00:00`), "EEE, MMM d, yyyy")}
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
      </div>

      {/* filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-52">
          <Search
            className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks…"
            className="h-8 pl-8 text-sm"
            aria-label="Search tasks"
          />
        </div>
        <Select
          value={employee}
          onValueChange={(v) => setEmployee(v ?? ALL)}
          items={{
            [ALL]: "All employees",
            ...Object.fromEntries(data.rows.map((r) => [r.id, r.name])),
          }}
        >
          <SelectTrigger className="h-8 w-40 text-sm" aria-label="Filter by employee">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All employees</SelectItem>
            {data.rows.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={project}
          onValueChange={(v) => setProject(v ?? ALL)}
          items={{
            [ALL]: "All projects",
            ...Object.fromEntries(projectNames.map((n) => [n, n])),
          }}
        >
          <SelectTrigger className="h-8 w-40 text-sm" aria-label="Filter by project">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All projects</SelectItem>
            {projectNames.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
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
          <SelectTrigger className="h-8 w-36 text-sm" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* view toggle */}
      <div className="mb-3 flex items-center gap-2">
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

      {/* summary */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border bg-card px-4 py-3 text-base">
        <span><span className="font-semibold tabular-nums">{rows.length}</span> <span className="text-muted-foreground">Employees</span></span>
        <span><span className="font-semibold tabular-nums">{totals.tasks}</span> <span className="text-muted-foreground">Tasks</span></span>
        <span><span className="font-semibold tabular-nums">{totals.inProgress}</span> <span className="text-muted-foreground">In Progress</span></span>
        <span><span className="font-semibold tabular-nums">{totals.done}</span> <span className="text-muted-foreground">Done</span></span>
        <span className="ml-auto">
          <span className="font-semibold tabular-nums">
            {totals.hours ? formatHours(totals.hours) : "—"}
          </span>{" "}
          <span className="text-muted-foreground">{totals.hours ? "tracked" : ""}</span>
        </span>
      </div>

      {/* board */}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
          Nothing on the board for this day.
        </p>
      ) : grouping === "project" ? (
        <div className="space-y-5">
          {employeeProjects.map((e) => (
            <section
              key={e.row.id}
              aria-label={`Projects for ${e.row.name}`}
              className="rounded-xl border bg-card p-4"
            >
              <div className="mb-3 flex items-center gap-2.5">
                <UserAvatar name={e.row.name} avatarUrl={e.row.avatar_url} className="size-9" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{e.row.name}</p>
                  {e.row.job_title && (
                    <p className="truncate text-xs text-muted-foreground">
                      {e.row.job_title}
                    </p>
                  )}
                </div>
                <span className="ml-auto text-xs text-muted-foreground">
                  {e.projects.length} {e.projects.length === 1 ? "project" : "projects"}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {e.projects.map((g) => {
                  const total = g.todo + g.in_progress + g.done;
                  return (
                    <button
                      key={g.name}
                      type="button"
                      onClick={() => {
                        setProject(g.isNone ? NOPROJ : g.name);
                        setEmployee(e.row.id);
                        setGrouping("employee");
                      }}
                      className={cn(
                        "relative p-4 pt-[18px] text-left text-project-card-foreground transition-all",
                        "hover:-translate-y-0.5 hover:rotate-0",
                        tiltForGroup(e.row.id[0] + g.name)
                      )}
                    >
                      {/* stacked sheets + paperclip, mirroring standup-board */}
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
                        <p className="line-clamp-2 text-sm font-semibold leading-snug">
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
                          {g.in_progress}
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
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card scrollbar-thin">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[190px_1fr_1fr_1fr] border-b bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <div className="px-3 py-2.5">Employee</div>
              {COLUMNS.map((c) => (
                <div key={c.key} className="flex items-center gap-1.5 px-3 py-2.5">
                  <span className={cn("size-2 rounded-full", c.dot)} aria-hidden />
                  {c.label}
                </div>
              ))}
            </div>
            {rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[190px_1fr_1fr_1fr] border-b last:border-b-0"
              >
                <div className="flex items-start gap-2.5 border-r px-3 py-3">
                  <UserAvatar name={row.name} avatarUrl={row.avatar_url} className="size-10" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.name}</p>
                    {row.job_title && (
                      <p className="truncate text-xs text-muted-foreground">
                        {row.job_title}
                      </p>
                    )}
                  </div>
                </div>
                {COLUMNS.map((c) => (
                  <div key={c.key} className="flex min-h-20 flex-col gap-2 p-2">
                    {row[c.key].map((t) => (
                      <ShareSticky
                        key={t.id}
                        task={t}
                        clip={c.clip}
                        done={c.key === "done"}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Powered by UPLOG — Plan. Share. Get things done.
      </p>
    </div>
  );
}
