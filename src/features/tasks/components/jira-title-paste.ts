"use client";

import type { ClipboardEvent, Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { applyJiraPaste } from "../jira-paste";

/**
 * Paste a Jira issue into a title field.
 *
 * Everything comes from the clipboard — no Jira credentials, no API calls.
 * A copy made from Jira's UI carries the summary in its HTML flavour, so
 * the title fills in completely; a bare link yields the key alone and
 * leaves the caret after the `::` to type the name.
 *
 * Anything that isn't a Jira issue is left to paste normally.
 */
export function handleJiraTitlePaste({
  event,
  title,
  description,
  setTitle,
  setDescription,
  maxTitleLength = 200,
}: {
  event: ClipboardEvent<HTMLInputElement>;
  title: string;
  description: string;
  setTitle: Dispatch<SetStateAction<string>>;
  setDescription: Dispatch<SetStateAction<string>>;
  maxTitleLength?: number;
}): void {
  const input = event.currentTarget;
  const applied = applyJiraPaste({
    plain: event.clipboardData.getData("text/plain"),
    html: event.clipboardData.getData("text/html"),
    title,
    selectionStart: input.selectionStart ?? title.length,
    selectionEnd: input.selectionEnd ?? title.length,
    description,
    maxTitleLength,
  });
  if (!applied) return;

  event.preventDefault();
  const { ref } = applied;
  setTitle(applied.title);
  setDescription(applied.description);
  requestAnimationFrame(() =>
    input.setSelectionRange(applied.caret, applied.caret)
  );

  const note = ref.summary
    ? `Linked ${ref.key}`
    : `Linked ${ref.key} — add a name after ::`;

  if (!ref.url) {
    toast.success(note);
    return;
  }

  // Pasting is a user gesture, so this opens rather than being swallowed by
  // the popup blocker. If a blocker intervenes anyway, window.open returns
  // null and the toast offers a click — which always counts as a gesture.
  const opened = window.open(ref.url, "_blank");
  if (opened) {
    // Sever the back-reference so the ticket tab can't navigate this one.
    try {
      opened.opener = null;
    } catch {
      // Cross-origin browsers may refuse; the tab is already open either way.
    }
    toast.success(`${note} — opened in a new tab`);
    return;
  }

  const url = ref.url;
  toast.success(note, {
    action: {
      label: "Open ticket",
      onClick: () => window.open(url, "_blank", "noopener,noreferrer"),
    },
  });
}
