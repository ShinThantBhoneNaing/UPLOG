"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Flag, Search } from "lucide-react";
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
type Column = "todo" | "in_progress" | "done";
const COLUMNS: { key: Column; label: string; dot: string; paper: string; fold: string }[] = [
  { key: "todo", label: "To Do", dot: "bg-warning", paper: "bg-warning/15 dark:bg-warning/12", fold: "bg-warning/40" },
  { key: "in_progress", label: "In Progress", dot: "bg-primary", paper: "bg-primary/12 dark:bg-primary/14", fold: "bg-primary/40" },
  { key: "done", label: "Done", dot: "bg-success", paper: "bg-success/12", fold: "bg-success/40" },
];

function tilt(id: string): string {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  const classes = ["-rotate-1", "rotate-[0.75deg]", "-rotate-[0.5deg]", "rotate-1", "rotate-0"];
  return classes[n % classes.length];
}

function ShareSticky({
  task,
  paper,
  fold,
  done,
}: {
  task: ShareTask;
  paper: string;
  fold: string;
  done?: boolean;
}) {
  const urgent = task.priority === "urgent" || task.priority === "high";
  return (
    <div
      className={cn(
        "relative rounded-md p-3 shadow-sm",
        "[clip-path:polygon(0_0,100%_0,100%_calc(100%-11px),calc(100%-11px)_100%,0_100%)]",
        paper,
        tilt(task.id),
        done && "opacity-85"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute bottom-0 right-0 size-[11px] [clip-path:polygon(0_0,100%_0,0_100%)]",
          fold
        )}
      />
      <p
        className={cn(
          "line-clamp-3 text-sm font-medium leading-snug",
          done && "text-muted-foreground"
        )}
      >
        {task.title}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs">
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
  const [status, setStatus] = useState<string>(ALL);
  const [query, setQuery] = useState("");

  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(addDays(parseISO(`${today}T00:00:00`), -1), "yyyy-MM-dd");
  function go(date: string) {
    router.push(
      date === today
        ? `/share/standup/${token}`
        : `/share/standup/${token}?date=${date}`
    );
  }
  const shift = (days: number) =>
    go(format(addDays(parseISO(`${data.date}T00:00:00`), days), "yyyy-MM-dd"));

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (t: ShareTask) => q === "" || t.title.toLowerCase().includes(q);
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
  }, [data.rows, employee, status, query]);

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
                        paper={c.paper}
                        fold={c.fold}
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
