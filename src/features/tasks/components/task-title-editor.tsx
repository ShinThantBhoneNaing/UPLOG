"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateTask } from "../actions";

/** Inline title + description editing for users who can edit the task. */
export function TaskTitleEditor({
  taskId,
  title,
  description,
  canEdit,
}: {
  taskId: string;
  title: string;
  description: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDescription, setDraftDescription] = useState(description ?? "");

  function save() {
    startTransition(async () => {
      const result = await updateTask({
        id: taskId,
        title: draftTitle.trim(),
        description: draftDescription.trim() || null,
      });
      if (result.ok) {
        setEditing(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <Input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          maxLength={200}
          aria-label="Task title"
          className="text-lg font-semibold"
        />
        <Textarea
          value={draftDescription}
          onChange={(e) => setDraftDescription(e.target.value)}
          rows={5}
          maxLength={10000}
          placeholder="Describe the task…"
          aria-label="Task description"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={pending || !draftTitle.trim()}>
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setDraftTitle(title);
              setDraftDescription(description ?? "");
            }}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group">
      <div className="flex items-start gap-2">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h1>
        {canEdit && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="mt-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => setEditing(true)}
            aria-label="Edit title and description"
          >
            <Pencil aria-hidden />
          </Button>
        )}
      </div>
      {description ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {description}
        </p>
      ) : (
        canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Add a description…
          </button>
        )
      )}
    </div>
  );
}
