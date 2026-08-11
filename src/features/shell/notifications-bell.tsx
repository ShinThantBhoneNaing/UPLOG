"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserAvatar } from "@/components/user-avatar";
import { cn, relativeTime } from "@/lib/utils";
import type { NotificationWithActor } from "@/types/database";

export function NotificationsBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationWithActor[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("*, actor:profiles!notifications_actor_id_fkey(id, full_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(15)
      .overrideTypes<NotificationWithActor[]>();
    if (data) {
      setItems(data);
      setUnread(data.filter((n) => !n.read_at).length);
      setLoaded(true);
    }
  }, []);

  // Initial load + realtime badge updates.
  useEffect(() => {
    // load() only sets state after its awaited fetch resolves — this is the
    // standard async fetch-in-effect pattern, not a synchronous setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const supabase = createClient();
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => void load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load]);

  async function markAllRead() {
    setItems((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
    );
    setUnread(0);
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
  }

  function hrefFor(n: NotificationWithActor): string {
    if (n.task_id) return `/tasks/${n.task_id}`;
    if (n.project_id) return `/projects/${n.project_id}`;
    return "/activity";
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={
              unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
            }
          />
        }
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold">Notifications</h2>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => void markAllRead()}
            >
              <CheckCheck className="size-3.5" aria-hidden /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto scrollbar-thin">
          {!loaded ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Inbox className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                You&apos;re all caught up.
              </p>
            </div>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={hrefFor(n)}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/60",
                      !n.read_at && "bg-primary/5"
                    )}
                  >
                    {n.actor ? (
                      <UserAvatar
                        name={n.actor.full_name}
                        avatarUrl={n.actor.avatar_url}
                        className="mt-0.5 size-7"
                      />
                    ) : (
                      <span className="mt-0.5 flex size-7 items-center justify-center rounded-full bg-muted">
                        <Bell className="size-3.5 text-muted-foreground" aria-hidden />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="line-clamp-2">
                        {n.actor && (
                          <span className="font-medium">{n.actor.full_name} </span>
                        )}
                        {n.message}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {relativeTime(n.created_at)}
                      </p>
                    </div>
                    {!n.read_at && (
                      <span
                        className="ml-auto mt-2 size-2 shrink-0 rounded-full bg-primary"
                        aria-hidden
                      />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
