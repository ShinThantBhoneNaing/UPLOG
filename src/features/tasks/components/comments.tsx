"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { relativeTime } from "@/lib/utils";
import type { CommentWithAuthor, ProfileLite } from "@/types/database";
import { addComment, deleteComment, editComment } from "../actions";

/** Highlights @Full Name mentions of known teammates. */
function CommentBody({
  body,
  names,
}: {
  body: string;
  names: string[];
}) {
  const parts = useMemo(() => {
    if (names.length === 0) return [body];
    const escaped = names
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .sort((a, b) => b.length - a.length)
      .join("|");
    return body.split(new RegExp(`(@(?:${escaped}))`, "g"));
  }, [body, names]);

  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((part, i) =>
        part.startsWith("@") && names.includes(part.slice(1)) ? (
          <span key={i} className="rounded bg-primary/10 px-1 font-medium text-primary">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

function Composer({
  taskId,
  profiles,
}: {
  taskId: string;
  profiles: ProfileLite[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [mentioned, setMentioned] = useState<Map<string, string>>(new Map());
  const [mentionOpen, setMentionOpen] = useState(false);

  function mention(p: ProfileLite) {
    setBody((b) => `${b}${b && !b.endsWith(" ") ? " " : ""}@${p.full_name} `);
    setMentioned((m) => new Map(m).set(p.id, p.full_name));
    setMentionOpen(false);
  }

  function submit() {
    const text = body.trim();
    if (!text) return;
    startTransition(async () => {
      // Only report mentions whose @Name text is still present.
      const ids = [...mentioned.entries()]
        .filter(([, name]) => text.includes(`@${name}`))
        .map(([id]) => id);
      const result = await addComment({
        taskId,
        body: text,
        mentionedUserIds: ids,
      });
      if (result.ok) {
        setBody("");
        setMentioned(new Map());
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="rounded-xl border bg-card p-3"
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a comment… use @ to mention a teammate"
        rows={3}
        maxLength={8000}
        aria-label="Write a comment"
        className="border-0 p-1 shadow-none focus-visible:ring-0"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
      />
      <div className="mt-2 flex items-center justify-between">
        <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Mention a teammate"
              />
            }
          >
            <AtSign className="size-4" aria-hidden /> Mention
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-1">
            <ul>
              {profiles.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => mention(p)}
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
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Comment
        </Button>
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  isOwn,
  names,
}: {
  comment: CommentWithAuthor;
  isOwn: boolean;
  names: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);

  function saveEdit() {
    startTransition(async () => {
      const result = await editComment({ id: comment.id, body: draft.trim() });
      if (result.ok) {
        setEditing(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteComment(comment.id);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  return (
    <li className="group flex gap-3">
      <UserAvatar
        name={comment.author?.full_name ?? "Former teammate"}
        avatarUrl={comment.author?.avatar_url}
        className="mt-1 size-8"
      />
      <div className="min-w-0 flex-1 rounded-xl border bg-card px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {comment.author?.full_name ?? "Former teammate"}
          </span>
          <span className="text-xs text-muted-foreground">
            {relativeTime(comment.created_at)}
            {comment.edited_at && " · edited"}
          </span>
          {isOwn && !editing && (
            <span className="ml-auto flex opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setDraft(comment.body);
                  setEditing(true);
                }}
                aria-label="Edit comment"
              >
                <Pencil aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={remove}
                disabled={pending}
                aria-label="Delete comment"
              >
                <Trash2 aria-hidden />
              </Button>
            </span>
          )}
        </div>
        {editing ? (
          <div className="mt-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={8000}
              aria-label="Edit comment"
            />
            <div className="mt-2 flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setEditing(false)}
                aria-label="Cancel edit"
              >
                <X aria-hidden />
              </Button>
              <Button
                size="icon-sm"
                onClick={saveEdit}
                disabled={pending || !draft.trim()}
                aria-label="Save comment"
              >
                <Check aria-hidden />
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-1">
            <CommentBody body={comment.body} names={names} />
          </div>
        )}
      </div>
    </li>
  );
}

export function Comments({
  taskId,
  comments,
  profiles,
  currentUserId,
}: {
  taskId: string;
  comments: CommentWithAuthor[];
  profiles: ProfileLite[];
  currentUserId: string;
}) {
  const names = profiles.map((p) => p.full_name);

  return (
    <section aria-label="Comments">
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
        Comments {comments.length > 0 && `(${comments.length})`}
      </h2>
      {comments.length > 0 && (
        <ul className="mb-4 space-y-3">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              isOwn={c.author_id === currentUserId}
              names={names}
            />
          ))}
        </ul>
      )}
      <Composer taskId={taskId} profiles={profiles} />
    </section>
  );
}
