"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordAttachment, updateTask } from "../actions";
import { handleJiraTitlePaste } from "./jira-title-paste";
import { DescriptionEditor } from "./description-editor";
import { RichText } from "./rich-text";

/** Inline title + description editing for users who can edit the task. */
export function TaskTitleEditor({
  taskId,
  title,
  description,
  canEdit,
  currentUserId,
}: {
  taskId: string;
  title: string;
  description: string | null;
  canEdit: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDescription, setDraftDescription] = useState(description ?? "");

  async function copyTitle() {
    try {
      await navigator.clipboard.writeText(title);
      setCopied(true);
      toast.success("Task name copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard.");
    }
  }

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
          onPaste={(event) =>
            handleJiraTitlePaste({
              event,
              title: draftTitle,
              description: draftDescription,
              setTitle: setDraftTitle,
              setDescription: setDraftDescription,
            })
          }
          maxLength={200}
          aria-label="Task title"
          className="text-lg font-semibold"
        />
        <DescriptionEditor
          value={draftDescription}
          onChange={setDraftDescription}
          currentUserId={currentUserId}
          taskId={taskId}
          // The task already exists, so a pasted image can be attached at once.
          onUploaded={(image) => {
            void recordAttachment({ taskId, ...image }).then((result) => {
              if (!result.ok) toast.error(result.error);
            });
          }}
          rows={5}
          placeholder="Describe the task… (paste or drop screenshots right in)"
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
        <Button
          variant="ghost"
          size="icon-sm"
          className="mt-0.5 shrink-0"
          onClick={() => void copyTitle()}
          aria-label="Copy task name"
        >
          {copied ? (
            <Check className="text-success" aria-hidden />
          ) : (
            <Copy aria-hidden />
          )}
        </Button>
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
        <RichText text={description} className="mt-3" />
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
