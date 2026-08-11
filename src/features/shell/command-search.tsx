"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  FolderKanban,
  MessageSquare,
  NotebookPen,
  Search,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandInput,
  CommandList,
} from "@/components/ui/command";
import type { SearchResult } from "@/types/database";

const KIND_META = {
  task: { icon: CheckSquare, label: "Tasks" },
  project: { icon: FolderKanban, label: "Projects" },
  person: { icon: User, label: "People" },
  comment: { icon: MessageSquare, label: "Comments" },
  daily_update: { icon: NotebookPen, label: "Daily updates" },
} as const;

function hrefFor(r: SearchResult): string {
  switch (r.kind) {
    case "task":
      return `/tasks/${r.id}`;
    case "project":
      return `/projects/${r.id}`;
    case "person":
      return `/team/${r.id}`;
    case "comment":
      return r.task_id ? `/tasks/${r.task_id}` : "/tasks";
    case "daily_update":
      return "/history";
  }
}

export function CommandSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ⌘K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runSearch = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("search_all", {
        q: q.trim(),
        max_results: 20,
      });
      setResults((data as SearchResult[] | null) ?? []);
      setSearching(false);
    }, 250);
  }, []);

  const grouped = results.reduce<Partial<Record<SearchResult["kind"], SearchResult[]>>>(
    (acc, r) => {
      (acc[r.kind] ??= []).push(r);
      return acc;
    },
    {}
  );

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 w-9 justify-center px-0 text-muted-foreground sm:w-56 sm:justify-start sm:px-3"
      >
        <Search className="size-4" aria-hidden />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="pointer-events-none ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:inline-block">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Search tasks, projects, people, comments and updates"
      >
        <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search tasks, projects, people…"
          value={query}
          onValueChange={runSearch}
        />
        <CommandList>
          <CommandEmpty>
            {query.trim().length < 2
              ? "Type at least 2 characters to search."
              : searching
                ? "Searching…"
                : "No results found."}
          </CommandEmpty>
          {(
            Object.entries(grouped) as [SearchResult["kind"], SearchResult[]][]
          ).map(([kind, rows]) => {
            const meta = KIND_META[kind];
            const Icon = meta.icon;
            return (
              <CommandGroup key={kind} heading={meta.label}>
                {rows.map((r) => (
                  <CommandItem
                    key={`${r.kind}-${r.id}`}
                    value={`${r.kind}-${r.id}`}
                    onSelect={() => {
                      setOpen(false);
                      router.push(hrefFor(r));
                    }}
                  >
                    <Icon aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate">{r.title}</p>
                      {r.snippet && (
                        <p className="truncate text-xs text-muted-foreground">
                          {r.snippet}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
