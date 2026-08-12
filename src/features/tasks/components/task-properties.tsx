"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRIORITY_META,
  STATUS_META,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/utils";
import type {
  ProfileLite,
  TaskPriority,
  TaskStatus,
  TaskWithRelations,
} from "@/types/database";
import { deleteTask, updateTask } from "../actions";

const UNSET = "__none__";

/**
 * The task property rail: status, priority, assignee, project, due date.
 * Every control saves on change — one interaction per edit.
 */
export function TaskProperties({
  task,
  profiles,
  projects,
  canDelete,
}: {
  task: TaskWithRelations;
  profiles: ProfileLite[];
  projects: { id: string; name: string }[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function save(patch: Parameters<typeof updateTask>[0]) {
    startTransition(async () => {
      const result = await updateTask(patch);
      if (!result.ok) {
        toast.error(result.error);
      }
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteTask(task.id);
      if (result.ok) {
        toast.success("Task deleted");
        router.push("/tasks");
      } else {
        toast.error(result.error);
        setConfirmOpen(false);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="prop-status">Status</Label>
        <Select
          value={task.status}
          onValueChange={(v) => v && save({ id: task.id, status: v as TaskStatus })}
        >
          <SelectTrigger id="prop-status" className="w-full" disabled={pending}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prop-priority">Priority</Label>
        <Select
          value={task.priority}
          onValueChange={(v) => v && save({ id: task.id, priority: v as TaskPriority })}
        >
          <SelectTrigger id="prop-priority" className="w-full" disabled={pending}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_META[p].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prop-assignee">Assignee</Label>
        <Select
          value={task.assignee?.id ?? UNSET}
          onValueChange={(v) =>
            save({ id: task.id, assigneeId: !v || v === UNSET ? null : v })
          }
        >
          <SelectTrigger id="prop-assignee" className="w-full" disabled={pending}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET}>Unassigned</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prop-project">Project</Label>
        <Select
          value={task.project?.id ?? UNSET}
          onValueChange={(v) =>
            save({ id: task.id, projectId: !v || v === UNSET ? null : v })
          }
        >
          <SelectTrigger id="prop-project" className="w-full" disabled={pending}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET}>No project</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prop-due">Due date</Label>
        <Input
          id="prop-due"
          type="date"
          defaultValue={task.due_date ?? ""}
          disabled={pending}
          onChange={(e) =>
            save({ id: task.id, dueDate: e.target.value || null })
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prop-estimate">Estimate (hours)</Label>
        <Input
          id="prop-estimate"
          type="number"
          inputMode="decimal"
          min="0.25"
          step="0.25"
          max="999"
          placeholder="e.g. 2.5"
          defaultValue={task.estimate_hours ?? ""}
          disabled={pending}
          onBlur={(e) => {
            const raw = e.target.value.trim();
            const value = raw ? Number(raw) : null;
            if (value !== null && (!Number.isFinite(value) || value <= 0)) return;
            if (value !== task.estimate_hours) {
              save({ id: task.id, estimateHours: value });
            }
          }}
        />
      </div>

      {canDelete && (
        <>
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 aria-hidden /> Delete task
          </Button>
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Delete this task?</DialogTitle>
                <DialogDescription>
                  “{task.title}” and its comments and attachments will be
                  permanently removed. Team history entries are kept.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={remove} disabled={pending}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
