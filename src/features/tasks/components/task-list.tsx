"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserAvatar } from "@/components/user-avatar";
import { PRIORITY_META, TASK_STATUSES } from "@/lib/utils";
import type { TaskWithRelations } from "@/types/database";
import { DueBadge, PriorityBadge, StatusBadge } from "./badges";

type SortKey = "title" | "status" | "priority" | "due_date" | "updated_at";
const PAGE_SIZE = 25;

function SortHeader({
  label,
  k,
  sortKey,
  onSort,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  onSort: (k: SortKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
      aria-label={`Sort by ${label}`}
    >
      {label}
      <ArrowUpDown
        className={`size-3 ${sortKey === k ? "text-foreground" : "text-muted-foreground/50"}`}
        aria-hidden
      />
    </button>
  );
}

export function TaskList({ tasks }: { tasks: TaskWithRelations[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const dir = asc ? 1 : -1;
    return [...tasks].sort((a, b) => {
      switch (sortKey) {
        case "title":
          return dir * a.title.localeCompare(b.title);
        case "status":
          return (
            dir * (TASK_STATUSES.indexOf(a.status) - TASK_STATUSES.indexOf(b.status))
          );
        case "priority":
          return (
            dir * (PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank)
          );
        case "due_date":
          return dir * (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
        case "updated_at":
          return dir * a.updated_at.localeCompare(b.updated_at);
      }
    });
  }, [tasks, sortKey, asc]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const rows = sorted.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE
  );

  function sortBy(key: SortKey) {
    if (key === sortKey) {
      setAsc((v) => !v);
    } else {
      setSortKey(key);
      setAsc(key === "title");
    }
    setPage(0);
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-56">
                <SortHeader label="Task" k="title" sortKey={sortKey} onSort={sortBy} />
              </TableHead>
              <TableHead>
                <SortHeader label="Status" k="status" sortKey={sortKey} onSort={sortBy} />
              </TableHead>
              <TableHead>
                <SortHeader label="Priority" k="priority" sortKey={sortKey} onSort={sortBy} />
              </TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>
                <SortHeader label="Due" k="due_date" sortKey={sortKey} onSort={sortBy} />
              </TableHead>
              <TableHead className="hidden md:table-cell">Project</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="max-w-72">
                  <Link
                    href={`/tasks/${t.id}`}
                    className="line-clamp-1 font-medium hover:underline"
                  >
                    {t.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={t.status} />
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={t.priority} />
                </TableCell>
                <TableCell>
                  {t.assignee ? (
                    <span className="flex items-center gap-2">
                      <UserAvatar
                        name={t.assignee.full_name}
                        avatarUrl={t.assignee.avatar_url}
                        className="size-6"
                      />
                      <span className="hidden truncate text-sm lg:inline">
                        {t.assignee.full_name}
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {t.due_date ? (
                    <DueBadge dueDate={t.due_date} done={t.status === "done"} />
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden max-w-40 md:table-cell">
                  <span className="line-clamp-1 text-sm text-muted-foreground">
                    {t.project?.name ?? "—"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {currentPage + 1} of {pageCount} · {sorted.length} tasks
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              aria-label="Previous page"
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={currentPage >= pageCount - 1}
              aria-label="Next page"
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
