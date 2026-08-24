"use client";

import { useRef, useState } from "react";
import { ImageUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MAX_FILE_SIZE } from "@/lib/validations/task";
import { attachmentRef } from "../attachment-refs";

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export interface UploadedImage {
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Task description field that accepts pasted or dropped screenshots: the
 * image is uploaded to the attachments bucket and an inline reference is
 * written at the caret, so the description renders it in place.
 *
 * Before a task exists its images go to `<user>/inbox/…`; the caller records
 * them against the task once it has an id (and cleans them up if it never
 * gets created).
 */
export function DescriptionEditor({
  value,
  onChange,
  currentUserId,
  taskId,
  onUploaded,
  id,
  rows = 3,
  maxLength = 10000,
  placeholder,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  currentUserId: string;
  /** Present once the task exists — images land in its own folder. */
  taskId?: string;
  onUploaded?: (image: UploadedImage) => void;
  id?: string;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [uploading, setUploading] = useState(0);
  const [dragging, setDragging] = useState(false);

  function insertAtCaret(snippet: string) {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? start;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const lead = before && !before.endsWith("\n") ? "\n" : "";
    const trail = after.startsWith("\n") ? "" : "\n";
    onChange(`${before}${lead}${snippet}${trail}${after}`);

    const caret = before.length + lead.length + snippet.length + trail.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  }

  async function uploadImage(file: File) {
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Images can be at most 20 MB.");
      return;
    }

    setUploading((n) => n + 1);
    try {
      const supabase = createClient();
      // Clipboard screenshots all arrive as "image.png" — timestamp them so
      // the attachment list stays readable.
      const named =
        file.name && file.name !== "image.png"
          ? file.name
          : `pasted-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${
              file.type.split("/")[1] ?? "png"
            }`;
      const safeName = named.replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
      const path = `${currentUserId}/${taskId ?? "inbox"}/${crypto.randomUUID()}-${safeName}`;

      const { error } = await supabase.storage
        .from("attachments")
        .upload(path, file, { contentType: file.type });

      if (error) {
        console.error("[description] image upload failed:", error.message);
        toast.error("We couldn't upload that image.");
        return;
      }

      insertAtCaret(attachmentRef(named, path));
      onUploaded?.({
        storagePath: path,
        fileName: named.slice(0, 255),
        mimeType: file.type,
        sizeBytes: file.size,
      });
    } finally {
      setUploading((n) => n - 1);
    }
  }

  function takeImages(files: FileList | null): File[] {
    // Without a signed-in id there is no folder to upload to, so let the
    // paste fall through as ordinary text.
    if (!currentUserId) return [];
    return Array.from(files ?? []).filter((f) => IMAGE_TYPES.has(f.type));
  }

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(dragging && "border-primary ring-2 ring-primary/30", className)}
        onPaste={(e) => {
          const images = takeImages(e.clipboardData.files);
          if (images.length === 0) return; // ordinary text paste
          e.preventDefault();
          images.forEach((file) => void uploadImage(file));
        }}
        onDragOver={(e) => {
          if (takeImages(e.dataTransfer.files).length || e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          const images = takeImages(e.dataTransfer.files);
          setDragging(false);
          if (images.length === 0) return;
          e.preventDefault();
          images.forEach((file) => void uploadImage(file));
        }}
      />

      {uploading > 0 && (
        <p
          role="status"
          className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm"
        >
          <Loader2 className="size-3 animate-spin" aria-hidden />
          Uploading {uploading} image{uploading > 1 ? "s" : ""}…
        </p>
      )}
      {uploading === 0 && dragging && (
        <p className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-xs text-primary shadow-sm">
          <ImageUp className="size-3" aria-hidden /> Drop to attach
        </p>
      )}
    </div>
  );
}
