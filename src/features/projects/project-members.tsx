"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserAvatar } from "@/components/user-avatar";
import type { ProfileLite } from "@/types/database";
import { addProjectMember, removeProjectMember } from "./actions";

export function ProjectMembers({
  projectId,
  members,
  allProfiles,
  canManage,
  currentUserId,
}: {
  projectId: string;
  members: ProfileLite[];
  allProfiles: ProfileLite[];
  canManage: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const memberIds = new Set(members.map((m) => m.id));
  const candidates = allProfiles.filter((p) => !memberIds.has(p.id));
  const isMember = memberIds.has(currentUserId);

  function add(userId: string) {
    setOpen(false);
    startTransition(async () => {
      const result = await addProjectMember(projectId, userId);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  function remove(userId: string) {
    startTransition(async () => {
      const result = await removeProjectMember(projectId, userId);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  return (
    <section aria-label="Project members">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Members ({members.length})
        </h2>
        {!isMember && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => add(currentUserId)}
          >
            <UserPlus aria-hidden /> Join project
          </Button>
        )}
      </div>

      <ul className="space-y-1.5">
        {members.map((m) => (
          <li key={m.id} className="group flex items-center gap-2 text-sm">
            <UserAvatar
              name={m.full_name}
              avatarUrl={m.avatar_url}
              className="size-6"
            />
            <span className="truncate">{m.full_name}</span>
            {(canManage || m.id === currentUserId) && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-auto opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => remove(m.id)}
                disabled={pending}
                aria-label={
                  m.id === currentUserId
                    ? "Leave project"
                    : `Remove ${m.full_name}`
                }
              >
                <X aria-hidden />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {canManage && candidates.length > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" />
            }
          >
            <UserPlus aria-hidden /> Add member
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-1">
            <ul>
              {candidates.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => add(p.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <UserAvatar
                      name={p.full_name}
                      avatarUrl={p.avatar_url}
                      className="size-6"
                    />
                    {p.full_name}
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </section>
  );
}
