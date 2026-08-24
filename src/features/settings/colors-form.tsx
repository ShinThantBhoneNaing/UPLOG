"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorWheel } from "@/components/ui/color-wheel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  type CustomColorKey,
  type CustomColors,
  applyCustomColors,
  loadCustomColors,
  saveCustomColors,
  stylesheetDefaultHex,
} from "./theme-colors";

const TARGETS: Array<{
  key: CustomColorKey;
  label: string;
  description: string;
  varName: string;
}> = [
  {
    key: "primary",
    label: "Primary",
    description: "Buttons, links and highlights",
    varName: "--primary",
  },
  {
    key: "secondary",
    label: "Secondary",
    description: "Chips and subtle fills",
    varName: "--secondary",
  },
  {
    key: "sticky",
    label: "Sticky notes",
    description: "Stand-up board note paper",
    varName: "--sticky",
  },
];

const PRESETS = [
  "#ec5800", // persimmon
  "#c65102", // burnt orange
  "#c2b280", // sand / khaki
  "#8d7073", // mauve
  "#2f5d46", // forest
  "#d9a441", // ochre
  "#1c1c1c", // charcoal
];

/**
 * Custom colors panel: color wheel for primary, secondary and sticky-note
 * colors. Sits below the theme switcher; persists per browser.
 */
const emptySubscribe = () => () => {};

export function ColorsForm() {
  const { resolvedTheme } = useTheme();
  // false during SSR/hydration, true right after — gates DOM/localStorage use.
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [custom, setCustom] = useState<CustomColors>(() =>
    typeof window === "undefined" ? {} : loadCustomColors()
  );
  const [active, setActive] = useState<CustomColorKey>("primary");

  // Stylesheet defaults depend on the resolved light/dark mode.
  const defaults = useMemo<Partial<Record<CustomColorKey, string>>>(() => {
    if (!hydrated || !resolvedTheme) return {};
    const next: Partial<Record<CustomColorKey, string>> = {};
    for (const t of TARGETS) {
      next[t.key] = stylesheetDefaultHex(t.varName) ?? "#c65102";
    }
    return next;
  }, [hydrated, resolvedTheme]);

  function update(next: CustomColors) {
    setCustom(next);
    applyCustomColors(next);
    saveCustomColors(next);
  }

  function setColor(key: CustomColorKey, hex: string) {
    update({ ...custom, [key]: hex });
  }

  function reset(key: CustomColorKey) {
    const next = { ...custom };
    delete next[key];
    update(next);
  }

  const effective = (key: CustomColorKey) =>
    custom[key] ?? defaults[key] ?? "#c65102";

  if (!hydrated) {
    return <Skeleton className="h-64 max-w-md rounded-xl" />;
  }

  return (
    <div className="max-w-md space-y-4 rounded-xl border bg-card p-5">
      <div role="radiogroup" aria-label="Color to customize" className="grid grid-cols-3 gap-2">
        {TARGETS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={active === t.key}
            title={t.description}
            onClick={() => setActive(t.key)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors",
              active === t.key
                ? "border-primary bg-primary/5 text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <span
              aria-hidden
              className="size-5 rounded-full border shadow-sm"
              style={{ backgroundColor: effective(t.key) }}
            />
            {t.label}
            {custom[t.key] && (
              <span className="text-[10px] font-normal text-primary">custom</span>
            )}
          </button>
        ))}
      </div>

      <ColorWheel
        value={effective(active)}
        onChange={(hex) => setColor(active, hex)}
      />

      <div className="flex flex-wrap gap-1.5" aria-label="Preset colors">
        {PRESETS.map((hex) => (
          <button
            key={hex}
            type="button"
            title={hex}
            aria-label={`Use ${hex}`}
            onClick={() => setColor(active, hex)}
            className="size-6 rounded-md border shadow-sm transition-transform hover:scale-110"
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between border-t pt-3">
        <p className="text-xs text-muted-foreground">
          {TARGETS.find((t) => t.key === active)?.description}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!custom[active]}
          onClick={() => reset(active)}
        >
          <RotateCcw aria-hidden /> Reset
        </Button>
      </div>
    </div>
  );
}
