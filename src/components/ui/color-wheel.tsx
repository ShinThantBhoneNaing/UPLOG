"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  type Hsl,
  hexToHsl,
  hslToHex,
} from "@/features/settings/theme-colors";

/**
 * Dependency-free HSL color wheel: hue around the disk, saturation from
 * center to edge, lightness on a slider below, plus a hex field.
 */
export function ColorWheel({
  value,
  onChange,
  className,
}: {
  /** Current color as #rrggbb. */
  value: string;
  onChange: (hex: string) => void;
  className?: string;
}) {
  const [hsl, setHsl] = useState<Hsl>(
    () => hexToHsl(value) ?? { h: 24, s: 90, l: 47 }
  );
  const [hexDraft, setHexDraft] = useState(value);
  const diskRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Adopt external value changes (e.g. switching which color is edited) by
  // adjusting state during render, per the React docs pattern. prevValue is
  // kept in sync on every commit so our own echoes don't reset the wheel.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    const next = hexToHsl(value);
    if (next) setHsl(next);
    setHexDraft(value);
  }

  function commit(next: Hsl) {
    setHsl(next);
    const hex = hslToHex(next.h, next.s, next.l);
    setPrevValue(hex);
    setHexDraft(hex);
    onChange(hex);
  }

  function pickFromPointer(e: React.PointerEvent<HTMLDivElement>) {
    const el = diskRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const radius = rect.width / 2;
    const dx = e.clientX - rect.left - radius;
    const dy = e.clientY - rect.top - radius;
    // conic-gradient starts at 12 o'clock; atan2's zero is at 3 o'clock
    const hue = (Math.atan2(dy, dx) * (180 / Math.PI) + 450) % 360;
    const sat = Math.min(Math.hypot(dx, dy) / radius, 1) * 100;
    commit({ h: hue, s: sat, l: hsl.l });
  }

  const thumbAngle = ((hsl.h - 90) * Math.PI) / 180;
  const thumbLeft = 50 + (Math.cos(thumbAngle) * hsl.s) / 2;
  const thumbTop = 50 + (Math.sin(thumbAngle) * hsl.s) / 2;
  const hex = hslToHex(hsl.h, hsl.s, hsl.l);

  return (
    <div className={cn("space-y-3", className)}>
      <div
        ref={diskRef}
        role="slider"
        aria-label="Hue and saturation"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsl.h)}
        aria-valuetext={`hue ${Math.round(hsl.h)}, saturation ${Math.round(hsl.s)}%`}
        className="relative mx-auto size-44 cursor-crosshair touch-none rounded-full border shadow-inner"
        style={{
          background:
            "radial-gradient(circle, #fff, rgba(255,255,255,0) 72%)," +
            "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
        }}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          pickFromPointer(e);
        }}
        onPointerMove={(e) => {
          if (dragging.current) pickFromPointer(e);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
          style={{
            left: `${thumbLeft}%`,
            top: `${thumbTop}%`,
            backgroundColor: hex,
          }}
        />
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(hsl.l)}
        aria-label="Lightness"
        onChange={(e) => commit({ ...hsl, l: Number(e.target.value) })}
        className="color-slider h-3 w-full cursor-pointer rounded-full border"
        style={{
          background: `linear-gradient(to right, #000, ${hslToHex(hsl.h, hsl.s, 50)}, #fff)`,
        }}
      />

      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-8 shrink-0 rounded-md border"
          style={{ backgroundColor: hex }}
        />
        <Input
          value={hexDraft}
          aria-label="Hex color"
          spellCheck={false}
          className="h-8 font-mono text-xs uppercase"
          onChange={(e) => {
            setHexDraft(e.target.value);
            const parsed = hexToHsl(e.target.value);
            if (parsed) {
              const normalized = (
                e.target.value.startsWith("#")
                  ? e.target.value
                  : `#${e.target.value}`
              ).toLowerCase();
              setHsl(parsed);
              setPrevValue(normalized);
              onChange(normalized);
            }
          }}
        />
      </div>
    </div>
  );
}
