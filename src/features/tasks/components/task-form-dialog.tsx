"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { DescriptionEditor, type UploadedImage } from "./description-editor";
import {
  TASK_PRIORITIES,
  PRIORITY_META,
  TASK_STATUSES,
  STATUS_META,
} from "@/lib/utils";
import { MAX_FILE_SIZE } from "@/lib/validations/task";
import type { ProfileLite, TaskPriority, TaskStatus } from "@/types/database";
import { createTask, recordAttachment } from "../actions";

const UNSET = "__none__";
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_IMAGES = 5;

interface PendingImage {
  file: File;
  previewUrl: string;
}

export function TaskFormDialog({
  profiles,
  projects,
  defaultProjectId,
  defaultAssigneeId,
  defaultStatus = "todo",
  currentUserId,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  profiles: ProfileLite[];
  projects: { id: string; name: string }[];
  defaultProjectId?: string;
  /** Pre-selected assignee; falls back to currentUserId. */
  defaultAssigneeId?: string;
  /** Column the task is being created into. */
  defaultStatus?: TaskStatus;
  /** New tasks are assigned to this user by default (changeable). */
  currentUserId?: string;
  trigger?: React.ReactElement;
  /** Controlled mode: omit `trigger` and drive the dialog from the parent. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  function setOpen(next: boolean) {
    // Abandoning the form leaves pasted screenshots with nothing to belong
    // to — drop them rather than orphan them in the bucket.
    if (!next && inlineImages.current.length > 0) {
      const paths = inlineImages.current.map((i) => i.storagePath);
      inlineImages.current = [];
      void createClient().storage.from("attachments").remove(paths);
    }
    if (openProp === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }
  const [pending, startTransition] = useTransition();
  const imageInputRef = useRef<HTMLInputElement>(null);

  const initialAssignee = defaultAssigneeId ?? currentUserId ?? UNSET;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId ?? UNSET);
  const [assigneeId, setAssigneeId] = useState(initialAssignee);
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [images, setImages] = useState<PendingImage[]>([]);
  // Screenshots pasted into the description; already in storage, waiting for
  // a task id to be recorded against. A ref, so that clearing the list and
  // closing the dialog in the same tick can't race.
  const inlineImages = useRef<UploadedImage[]>([]);

  // Free object URLs when the component unmounts.
  useEffect(() => {
    return () => images.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addImages(files: FileList | null) {
    if (!files) return;
    const next: PendingImage[] = [];
    for (const file of Array.from(files)) {
      if (!IMAGE_TYPES.has(file.type)) {
        toast.error(`${file.name}: only PNG, JPEG, GIF or WebP images.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: images can be at most 20 MB.`);
        continue;
      }
      next.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    setImages((prev) => [...prev, ...next].slice(0, MAX_IMAGES));
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index]!.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setDueDate("");
    setProjectId(defaultProjectId ?? UNSET);
    setAssigneeId(initialAssignee);
    setStatus(defaultStatus);
    setPriority("medium");
    images.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setImages([]);
  }

  function submit() {
    startTransition(async () => {
      const result = await createTask({
        title,
        description: description || undefined,
        projectId: projectId === UNSET ? null : projectId,
        assigneeId: assigneeId === UNSET ? null : assigneeId,
        priority,
        status,
        dueDate: dueDate || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      // Upload attached images to the new task.
      if (images.length && result.data && currentUserId) {
        const supabase = createClient();
        let failed = 0;
        for (const img of images) {
          const safeName = img.file.name.replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
          const path = `${currentUserId}/${result.data.id}/${crypto.randomUUID()}-${safeName}`;
          const { error } = await supabase.storage
            .from("attachments")
            .upload(path, img.file, { contentType: img.file.type });
          if (error) {
            failed++;
            continue;
          }
          const rec = await recordAttachment({
            taskId: result.data.id,
            fileName: img.file.name.slice(0, 255),
            storagePath: path,
            mimeType: img.file.type,
            sizeBytes: img.file.size,
          });
          if (!rec.ok) failed++;
        }
        if (failed > 0) {
          toast.warning(`Task created, but ${failed} image(s) failed to upload.`);
        }
      }

      // Pasted screenshots are already uploaded — attach them to the task so
      // they appear in its attachment list alongside the inline copy.
      if (inlineImages.current.length && result.data) {
        const pasted = inlineImages.current;
        inlineImages.current = [];
        let unrecorded = 0;
        for (const image of pasted) {
          const rec = await recordAttachment({ taskId: result.data.id, ...image });
          if (!rec.ok) unrecorded++;
        }
        if (unrecorded > 0) {
          // The description still renders them; only the attachment list misses out.
          toast.warning(
            `${unrecorded} pasted image(s) couldn't be added to the attachment list.`
          );
        }
      }

      toast.success("Task created");
      setOpen(false);
      resetForm();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {openProp === undefined && (
        <DialogTrigger
          render={
            trigger ?? (
              <Button>
                <Plus aria-hidden /> New task
              </Button>
            )
          }
        />
      )}
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            A title is all you need — everything else is optional.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
              required
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">Description</Label>
            <DescriptionEditor
              id="task-description"
              value={description}
              onChange={setDescription}
              currentUserId={currentUserId ?? ""}
              onUploaded={(image) => inlineImages.current.push(image)}
              placeholder="Add context, links, acceptance criteria… (paste or drop screenshots right in)"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="task-project">Project</Label>
              <Select
                value={projectId}
                onValueChange={(v) => setProjectId(v ?? UNSET)}
                items={{
                  [UNSET]: "No project",
                  ...Object.fromEntries(projects.map((p) => [p.id, p.name])),
                }}
              >
                <SelectTrigger id="task-project" className="w-full">
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

            <div className="space-y-2">
              <Label htmlFor="task-assignee">Assignee</Label>
              <Select
                value={assigneeId}
                onValueChange={(v) => setAssigneeId(v ?? UNSET)}
                items={{
                  [UNSET]: "Unassigned",
                  ...Object.fromEntries(profiles.map((p) => [p.id, p.full_name])),
                }}
              >
                <SelectTrigger id="task-assignee" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>Unassigned</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                      {p.id === currentUserId && " (you)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus((v ?? "todo") as TaskStatus)}
                items={Object.fromEntries(
                  TASK_STATUSES.map((s) => [s, STATUS_META[s].label])
                )}
              >
                <SelectTrigger id="task-status" className="w-full">
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

            <div className="space-y-2">
              <Label htmlFor="task-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority((v ?? "medium") as TaskPriority)}
                items={Object.fromEntries(
                  TASK_PRIORITIES.map((p) => [p, PRIORITY_META[p].label])
                )}
              >
                <SelectTrigger id="task-priority" className="w-full">
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

            <div className="space-y-2">
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Image attachments with previews */}
          <div className="space-y-2">
            <Label>Images</Label>
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => (
                <div key={img.previewUrl} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.previewUrl}
                    alt={img.file.name}
                    className="size-16 rounded-lg border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    aria-label={`Remove ${img.file.name}`}
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex size-16 items-center justify-center rounded-lg border border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  aria-label="Attach images"
                >
                  <ImagePlus className="size-5" aria-hidden />
                </button>
              )}
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              multiple
              className="sr-only"
              aria-label="Choose images to attach"
              onChange={(e) => addImages(e.target.files)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Create task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
