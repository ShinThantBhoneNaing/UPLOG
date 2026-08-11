"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProjectStatus } from "@/types/database";
import { updateProject } from "./actions";

const STATUSES: ProjectStatus[] = ["active", "paused", "completed", "archived"];

export function ProjectStatusSelect({
  projectId,
  status,
}: {
  projectId: string;
  status: ProjectStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={status}
      onValueChange={(v) => {
        if (!v || v === status) return;
        startTransition(async () => {
          const result = await updateProject({
            id: projectId,
            status: v as ProjectStatus,
          });
          if (!result.ok) toast.error(result.error);
          router.refresh();
        });
      }}
    >
      <SelectTrigger
        className="h-8 w-32 capitalize"
        disabled={pending}
        aria-label="Project status"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s} className="capitalize">
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
