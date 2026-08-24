"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorWheel } from "@/components/ui/color-wheel";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  type ColorSetting,
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
  {
    key: "background",
    label: "Background",
    description: "Page background and panels",
    varName: "--background",
  },
  {
    key: "sidebar",
    label: "Sidebar",
    description: "Navigation panel",
    varName: "--sidebar",
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

const emptySubscribe = () => () => {};

/**
 * Custom colors panel: color wheel plus opacity and frosted-blur controls
 * for primary, secondary, sticky-note and background colors. Sits below the
 * theme switcher; persists per browser.
 */
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

  const effectiveHex = (key: CustomColorKey) =>
    custom[key]?.hex ?? defaults[key] ?? "#c65102";

  /** Current entry for a key, materialized from defaults if not custom yet. */
  const entryFor = (key: CustomColorKey): ColorSetting =>
    custom[key] ?? { hex: effectiveHex(key), alpha: 100, blur: false };

  function setEntry(key: CustomColorKey, patch: Partial<ColorSetting>) {
    update({ ...custom, [key]: { ...entryFor(key), ...patch } });
  }

  function reset(key: CustomColorKey) {
    const next = { ...custom };
    delete next[key];
    update(next);
  }

  if (!hydrated) {
    return <Skeleton className="h-64 max-w-md rounded-xl" />;
  }

  const activeTarget = TARGETS.find((t) => t.key === active)!;
  const activeEntry = entryFor(active);

  return (
    <div className="max-w-md space-y-4 rounded-xl border bg-card p-5">
      <div
        role="radiogroup"
        aria-label="Color to customize"
        className="grid grid-cols-2 gap-2"
      >
        {TARGETS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={active === t.key}
            title={t.description}
            onClick={() => setActive(t.key)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
              active === t.key
                ? "border-primary bg-primary/5 text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <span
              aria-hidden
              className="size-5 shrink-0 rounded-full border shadow-sm"
              style={{ backgroundColor: effectiveHex(t.key) }}
            />
            <span className="truncate">{t.label}</span>
            {custom[t.key] && (
              <span className="ml-auto text-[10px] font-normal text-primary">
                custom
              </span>
            )}
          </button>
        ))}
      </div>

      <ColorWheel
        value={effectiveHex(active)}
        onChange={(hex) => setEntry(active, { hex })}
      />

      <div className="flex flex-wrap gap-1.5" aria-label="Preset colors">
        {PRESETS.map((hex) => (
          <button
            key={hex}
            type="button"
            title={hex}
            aria-label={`Use ${hex}`}
            onClick={() => setEntry(active, { hex })}
            className="size-6 rounded-md border shadow-sm transition-transform hover:scale-110"
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>

      <div className="space-y-3 border-t pt-3">
        <div className="flex items-center gap-3">
          <Label htmlFor="color-opacity" className="w-24 shrink-0 text-xs">
            Opacity
          </Label>
          <input
            id="color-opacity"
            type="range"
            min={10}
            max={100}
            value={Math.round(activeEntry.alpha)}
            onChange={(e) =>
              setEntry(active, { alpha: Number(e.target.value) })
            }
            className="color-slider h-3 w-full cursor-pointer rounded-full border"
            style={{
              background: `linear-gradient(to right, transparent, ${activeEntry.hex})`,
            }}
          />
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {Math.round(activeEntry.alpha)}%
          </span>
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="color-blur" className="text-xs">
            Frosted blur
            <span className="ml-1 font-normal text-muted-foreground">
              (glass effect behind {activeTarget.label.toLowerCase()})
            </span>
          </Label>
          <Switch
            id="color-blur"
            checked={activeEntry.blur}
            onCheckedChange={(blur) => setEntry(active, { blur })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-3">
        <p className="text-xs text-muted-foreground">
          {activeTarget.description}
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
