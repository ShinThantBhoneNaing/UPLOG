/**
 * Recognising Jira issues pasted into a task field.
 *
 * No Jira credentials are involved: everything comes from what the clipboard
 * already carries. Copying out of Jira usually puts two flavours on the
 * clipboard — a plain URL and an HTML anchor whose text holds the summary —
 * so the summary is available whenever the copy came from Jira's UI. A bare
 * URL (address bar, chat message) still yields the issue key.
 *
 * Shapes seen in the wild:
 *   https://acme.atlassian.net/browse/ABC-123
 *   <a href=".../browse/ABC-123">[ABC-123] Feature implementation</a>
 *   <a href=".../browse/ABC-123">ABC-123: Feature implementation</a>
 *   [ABC-123] Feature implementation
 *   Feature implementation - ABC-123 - Jira      (browser tab title)
 */

/** Project key + number, e.g. ABC-123. Project keys are upper-case. */
const ISSUE_KEY = /\b([A-Z][A-Z0-9]{1,9}-\d+)\b/;
const URL_IN_TEXT = /https?:\/\/[^\s<>"')]+/;

export interface JiraRef {
  key: string;
  /** null when the clipboard only carried a link. */
  summary: string | null;
  url: string | null;
}

/**
 * The issue key a URL points at, or null if it isn't a Jira issue link.
 * Used when rendering text, so a pasted link shows as its ticket key.
 *
 * Matched on URL shape rather than host, so self-hosted Jira on a company
 * domain works too.
 */
const JIRA_URL_KEY =
  /(?:\/browse\/|\/issues\/|[?&]selectedIssue=)([A-Z][A-Z0-9]{1,9}-\d+)\b/;

export function jiraKeyFromUrl(url: string): string | null {
  return firstMatch(JIRA_URL_KEY, url);
}

function firstMatch(re: RegExp, value: string | null | undefined): string | null {
  if (!value) return null;
  const match = re.exec(value);
  return match ? (match[1] ?? match[0]) : null;
}

/** The first anchor pointing at a Jira issue, with its visible text. */
function anchorFromHtml(html: string): { href: string; text: string } | null {
  if (!html || typeof DOMParser === "undefined") return null;
  // Parsed detached from the document: nothing here is ever rendered or run.
  const doc = new DOMParser().parseFromString(html, "text/html");
  const anchors = [...doc.querySelectorAll("a[href]")];
  const issue =
    anchors.find((a) => ISSUE_KEY.test(a.getAttribute("href") ?? "")) ??
    anchors.find((a) => ISSUE_KEY.test(a.textContent ?? ""));
  if (issue) {
    return {
      href: issue.getAttribute("href") ?? "",
      text: (issue.textContent ?? "").replace(/\s+/g, " ").trim(),
    };
  }
  const text = (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  return text ? { href: "", text } : null;
}

/** Strips the key, its brackets and separators, and Jira's tab-title suffix. */
function summaryFrom(text: string, key: string): string | null {
  if (!text) return null;
  let out = text.replace(/\s+/g, " ").trim();
  if (URL_IN_TEXT.test(out) && out.replace(URL_IN_TEXT, "").trim() === "") {
    return null; // the "text" was just the link
  }
  out = out
    .replace(new RegExp(`\\[\\s*${key}\\s*\\]`, "g"), " ")
    .replace(new RegExp(`\\b${key}\\b`, "g"), " ")
    // "… - Jira", "… - Acme Jira", "… | Jira Software"
    .replace(/[-–|]\s*(?:[\w ]*\s)?jira(?:\s+software)?\s*$/i, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Leftover separators once the key is gone.
    .replace(/^[\s:–\-|·»]+/, "")
    .replace(/[\s:–\-|·»]+$/, "")
    .trim();

  return out || null;
}

export function parseJiraPaste(plain: string, html: string): JiraRef | null {
  const anchor = anchorFromHtml(html);
  const text = anchor?.text || plain.replace(/\s+/g, " ").trim();
  const url = anchor?.href || firstMatch(URL_IN_TEXT, plain);

  const key =
    firstMatch(ISSUE_KEY, url) ??
    firstMatch(ISSUE_KEY, text) ??
    firstMatch(ISSUE_KEY, plain);
  if (!key) return null;

  return { key, summary: summaryFrom(text, key), url: url || null };
}

/** "ABC-123::Feature implementation", clamped to the title column's limit. */
export function jiraTitle(ref: JiraRef, maxLength = 200): string {
  const prefix = `${ref.key}::`;
  if (!ref.summary) return prefix;
  return `${prefix}${ref.summary}`.slice(0, maxLength);
}

/** Appends the issue link to a description unless it is already in there. */
export function withJiraLink(description: string, ref: JiraRef): string {
  if (!ref.url || description.includes(ref.url)) return description;
  return description ? `${description.trimEnd()}\n${ref.url}` : ref.url;
}

/**
 * What a title field should become when a Jira issue is pasted into it:
 * the key and summary replace the selection, and the link is filed in the
 * description. Returns null for anything that isn't a Jira issue, so the
 * caller can let the browser paste normally.
 */
export function applyJiraPaste({
  plain,
  html,
  title,
  selectionStart,
  selectionEnd,
  description,
  maxTitleLength = 200,
}: {
  plain: string;
  html: string;
  title: string;
  selectionStart: number;
  selectionEnd: number;
  description: string;
  maxTitleLength?: number;
}): { title: string; description: string; caret: number; ref: JiraRef } | null {
  const ref = parseJiraPaste(plain, html);
  if (!ref) return null;

  const insert = jiraTitle(ref, maxTitleLength);
  const before = title.slice(0, selectionStart);
  const after = title.slice(selectionEnd);
  const next = `${before}${insert}${after}`.slice(0, maxTitleLength);

  return {
    title: next,
    description: withJiraLink(description, ref),
    caret: Math.min(before.length + insert.length, next.length),
    ref,
  };
}
