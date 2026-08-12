"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProfileLite } from "@/types/database";

const ALL = "__all__";

const TYPE_OPTIONS = [
  { value: "task_created", label: "Task created" },
  { value: "task_status_changed", label: "Status changed" },
  { value: "task_completed", label: "Task completed" },
  { value: "task_assigned", label: "Assignment changed" },
  { value: "comment_added", label: "Comment added" },
  { value: "daily_update_created", label: "Daily update" },
  { value: "attachment_added", label: "File attached" },
  { value: "project_created", label: "Project created" },
];

export function HistoryFilters({
  profiles,
  projects,
}: {
  profiles: ProfileLite[];
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params);
      if (value && value !== ALL) next.set(key, value);
      else next.delete(key);
      next.delete("page"); // filters reset pagination
      router.replace(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router]
  );

  // Debounced text search.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const current = params.get("q") ?? "";
    if (q === current) return;
    debounceRef.current = setTimeout(() => setParam("q", q.trim() || null), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, params, setParam]);

  const hasFilters =
    Boolean(params.get("q")) ||
    Boolean(params.get("user")) ||
    Boolean(params.get("project")) ||
    Boolean(params.get("type")) ||
    Boolean(params.get("from")) ||
    Boolean(params.get("to"));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-56">
        <Search
          className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search history…"
          className="pl-8"
          aria-label="Search history"
        />
      </div>

      <Select
        value={params.get("user") ?? ALL}
        onValueChange={(v) => setParam("user", v)}
        items={{
          [ALL]: "Everyone",
          ...Object.fromEntries(profiles.map((p) => [p.id, p.full_name])),
        }}
      >
        <SelectTrigger className="w-36" aria-label="Filter by person">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Everyone</SelectItem>
          {profiles.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.get("project") ?? ALL}
        onValueChange={(v) => setParam("project", v)}
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

      <Select
        value={params.get("type") ?? ALL}
        onValueChange={(v) => setParam("type", v)}
        items={{
          [ALL]: "All activity",
          ...Object.fromEntries(TYPE_OPTIONS.map((t) => [t.value, t.label])),
        }}
      >
        <SelectTrigger className="w-40" aria-label="Filter by activity type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All activity</SelectItem>
          {TYPE_OPTIONS.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="date"
        value={params.get("from") ?? ""}
        onChange={(e) => setParam("from", e.target.value || null)}
        className="w-36"
        aria-label="From date"
      />
      <Input
        type="date"
        value={params.get("to") ?? ""}
        onChange={(e) => setParam("to", e.target.value || null)}
        className="w-36"
        aria-label="To date"
      />

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            router.replace(pathname);
          }}
        >
          <X aria-hidden /> Clear
        </Button>
      )}
    </div>
  );
}
