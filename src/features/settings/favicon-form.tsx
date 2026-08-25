"use client";

import { useState, useSyncExternalStore } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorWheel } from "@/components/ui/color-wheel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  type FaviconShape,
  type FaviconStyle,
  DEFAULT_FAVICON,
  applyFavicon,
  faviconDataUrl,
  loadFavicon,
  saveFavicon,
} from "./theme-favicon";

const SHAPES: Array<{ value: FaviconShape; label: string }> = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "circle", label: "Circle" },
];

const emptySubscribe = () => () => {};

/**
 * Web icon panel: background color and shape of the browser-tab icon.
 * Persists per browser; the root layout script restores it on load.
 */
export function FaviconForm() {
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [custom, setCustom] = useState<FaviconStyle | null>(() =>
    typeof window === "undefined" ? null : loadFavicon()
  );

  const effective = custom ?? DEFAULT_FAVICON;

  function update(next: FaviconStyle | null) {
    setCustom(next);
    applyFavicon(next);
    saveFavicon(next);
  }

  if (!hydrated) {
    return <Skeleton className="h-64 max-w-md rounded-xl" />;
  }

  return (
    <div className="max-w-md space-y-4 rounded-xl border bg-card p-5">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={faviconDataUrl(effective)}
          alt="Web icon preview"
          className="size-12 shrink-0"
        />
        <div
          role="radiogroup"
          aria-label="Web icon shape"
          className="flex flex-1 gap-2"
        >
          {SHAPES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={effective.shape === s.value}
              onClick={() => update({ ...effective, shape: s.value })}
              className={cn(
                "flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                effective.shape === s.value
                  ? "border-primary bg-primary/5 text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <ColorWheel
        value={effective.hex}
        onChange={(hex) => update({ ...effective, hex })}
      />

      <div className="flex items-center justify-between border-t pt-3">
        <p className="text-xs text-muted-foreground">
          Browser-tab icon color and shape
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={custom === null}
          onClick={() => update(null)}
        >
          <RotateCcw aria-hidden /> Reset
        </Button>
      </div>
    </div>
  );
}
