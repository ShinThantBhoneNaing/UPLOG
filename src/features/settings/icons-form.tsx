"use client";

import { useState, useSyncExternalStore } from "react";
import {
  Bell,
  CheckSquare,
  Flag,
  Home,
  Search,
  Settings,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  type IconStyle,
  applyIconStyle,
  loadIconStyle,
  saveIconStyle,
} from "./theme-icons";

const ROWS: Array<{
  key: keyof IconStyle;
  label: string;
  options: Array<{ value: string; label: string }>;
}> = [
  {
    key: "weight",
    label: "Weight",
    options: [
      { value: "thin", label: "Thin" },
      { value: "regular", label: "Regular" },
      { value: "bold", label: "Bold" },
    ],
  },
  {
    key: "corners",
    label: "Corners",
    options: [
      { value: "round", label: "Round" },
      { value: "sharp", label: "Sharp" },
    ],
  },
  {
    key: "fill",
    label: "Fill",
    options: [
      { value: "outline", label: "Outline" },
      { value: "tinted", label: "Tinted" },
    ],
  },
];

const PREVIEW_ICONS = [Home, Search, CheckSquare, Flag, Bell, Settings];

const emptySubscribe = () => () => {};

/**
 * Icon style panel: weight, corner and fill style for every icon in the
 * app. Applied globally via data attributes on <html>; persists per browser.
 */
export function IconsForm() {
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [style, setStyle] = useState<IconStyle>(() =>
    typeof window === "undefined"
      ? { weight: "regular", corners: "round", fill: "outline" }
      : loadIconStyle()
  );

  function update(patch: Partial<IconStyle>) {
    const next = { ...style, ...patch };
    setStyle(next);
    applyIconStyle(next);
    saveIconStyle(next);
  }

  if (!hydrated) {
    return <Skeleton className="h-48 max-w-md rounded-xl" />;
  }

  return (
    <div className="max-w-md space-y-4 rounded-xl border bg-card p-5">
      <div
        aria-hidden
        className="flex items-center justify-around rounded-lg border bg-background/60 px-4 py-3 text-foreground"
      >
        {PREVIEW_ICONS.map((Icon, i) => (
          <Icon key={i} className="size-5" />
        ))}
      </div>

      {ROWS.map((row) => (
        <div key={row.key} className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
            {row.label}
          </span>
          <div
            role="radiogroup"
            aria-label={`Icon ${row.label.toLowerCase()}`}
            className="flex flex-1 gap-2"
          >
            {row.options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={style[row.key] === opt.value}
                onClick={() => update({ [row.key]: opt.value })}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  style[row.key] === opt.value
                    ? "border-primary bg-primary/5 text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
