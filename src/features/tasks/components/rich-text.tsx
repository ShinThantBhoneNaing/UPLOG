"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ImageOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { parseRichText } from "../attachment-refs";
import { jiraKeyFromUrl } from "../jira-paste";

/**
 * Plain text with URLs turned into links. A Jira issue link collapses to
 * its ticket key, so a description reads "HCM-150 ↗" instead of carrying a
 * wall of URL. Every link opens in a new tab.
 */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"')]+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (!/^https?:\/\//.test(part)) return <span key={i}>{part}</span>;

        const issueKey = jiraKeyFromUrl(part);
        if (issueKey) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              title={part}
              className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 align-baseline text-xs font-semibold text-primary transition-colors hover:border-primary/60 hover:bg-primary/15"
            >
              {issueKey}
              <ExternalLink className="size-3" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          );
        }

        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-medium text-primary underline underline-offset-2 hover:opacity-80"
          >
            {part}
          </a>
        );
      })}
    </>
  );
}

/**
 * Task text: clickable links plus inline images. Images live in a private
 * bucket, so their URLs are signed here — per view, never stored.
 */
export function RichText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const segments = parseRichText(text);
  const paths = segments.flatMap((s) => (s.kind === "image" ? [s.path] : []));
  // Joined so the effect re-runs on content change, not on array identity.
  const pathKey = paths.join("|");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!pathKey) return;
    const wanted = pathKey.split("|");
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase.storage
        .from("attachments")
        .createSignedUrls(wanted, 3600);
      if (cancelled) return;
      const next: Record<string, string> = {};
      const missing: Record<string, boolean> = {};
      (data ?? []).forEach((entry, i) => {
        const path = wanted[i]!;
        if (entry.signedUrl) next[path] = entry.signedUrl;
        else missing[path] = true;
      });
      setUrls(next);
      setFailed(missing);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathKey]);

  return (
    <div className={cn("text-sm leading-relaxed text-foreground/90", className)}>
      {segments.map((segment, i) =>
        segment.kind === "text" ? (
          <span key={i} className="whitespace-pre-wrap">
            <Linkified text={segment.text} />
          </span>
        ) : failed[segment.path] ? (
          <span
            key={i}
            className="my-1 flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <ImageOff className="size-3.5" aria-hidden />
            {segment.alt} (image unavailable)
          </span>
        ) : urls[segment.path] ? (
          <a
            key={i}
            href={urls[segment.path]}
            target="_blank"
            rel="noopener noreferrer"
            className="my-2 block w-fit"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urls[segment.path]}
              alt={segment.alt}
              className="max-h-96 rounded-lg border object-contain transition-opacity hover:opacity-90"
            />
          </a>
        ) : (
          <span
            key={i}
            className="my-2 block h-24 w-40 animate-pulse rounded-lg border bg-muted"
            aria-label={`Loading ${segment.alt}`}
          />
        )
      )}
    </div>
  );
}
