/**
 * Inline images inside task text.
 *
 * The attachments bucket is private, so a description can't hold a plain
 * URL — signed links expire. It stores a reference to the storage object
 * instead, and the renderer signs it fresh on every view:
 *
 *   ![screenshot.png](attachment:<uploader-id>/<task-id>/<file>)
 */
const PATTERN = String.raw`!\[([^\]\n]*)\]\(attachment:([^)\s]+)\)`;

/** A fresh regex each call — a shared /g literal carries lastIndex state. */
export const attachmentRefRegex = () => new RegExp(PATTERN, "g");

export function attachmentRef(fileName: string, storagePath: string): string {
  // Brackets and newlines would break the reference back out of its own syntax.
  const label = fileName.replace(/[[\]\n]/g, " ").trim() || "image";
  return `![${label}](attachment:${storagePath})`;
}

export type RichTextSegment =
  | { kind: "text"; text: string }
  | { kind: "image"; alt: string; path: string };

/** Splits text into plain runs and inline image references, in order. */
export function parseRichText(text: string): RichTextSegment[] {
  const segments: RichTextSegment[] = [];
  const regex = attachmentRefRegex();
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ kind: "text", text: text.slice(last, match.index) });
    }
    segments.push({ kind: "image", alt: match[1] || "image", path: match[2]! });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    segments.push({ kind: "text", text: text.slice(last) });
  }
  return segments;
}
