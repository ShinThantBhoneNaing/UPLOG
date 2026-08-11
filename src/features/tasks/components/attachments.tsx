"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileIcon, Loader2, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { formatBytes, relativeTime } from "@/lib/utils";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "@/lib/validations/task";
import type { Attachment } from "@/types/database";
import { deleteAttachment, recordAttachment } from "../actions";

export function Attachments({
  taskId,
  attachments,
  currentUserId,
  canManage,
}: {
  taskId: string;
  attachments: Attachment[];
  currentUserId: string;
  /** manager/admin can delete anyone's file */
  canManage: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function upload(file: File) {
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Files can be at most 20 MB.");
      return;
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      toast.error("This file type isn't allowed.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
      const path = `${currentUserId}/${taskId}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        console.error("[attachments] upload failed:", uploadError.message);
        toast.error("We couldn't upload the file. Please try again.");
        return;
      }

      const result = await recordAttachment({
        taskId,
        fileName: file.name.slice(0, 255),
        storagePath: path,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      if (!result.ok) {
        // Roll back the orphaned object.
        await supabase.storage.from("attachments").remove([path]);
        toast.error(result.error);
        return;
      }

      toast.success("File attached");
      router.refresh();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function download(att: Attachment) {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("attachments")
      .createSignedUrl(att.storage_path, 60, { download: att.file_name });
    if (error || !data) {
      toast.error("We couldn't prepare the download.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  function remove(att: Attachment) {
    startTransition(async () => {
      const result = await deleteAttachment(att.id);
      if (result.ok) {
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section aria-label="Attachments">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Attachments {attachments.length > 0 && `(${attachments.length})`}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Paperclip aria-hidden />
          )}
          Attach file
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          aria-label="Attach a file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
      </div>

      {attachments.length > 0 && (
        <ul className="space-y-2">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2"
            >
              <FileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{att.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(att.size_bytes)} · {relativeTime(att.created_at)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => void download(att)}
                aria-label={`Download ${att.file_name}`}
              >
                <Download aria-hidden />
              </Button>
              {(canManage || att.uploader_id === currentUserId) && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(att)}
                  disabled={pending}
                  aria-label={`Delete ${att.file_name}`}
                >
                  <Trash2 aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
