/**
 * User-customizable theme colors (primary, secondary, sticky-note paper).
 * Stored in localStorage and applied as inline CSS-variable overrides on
 * <html>, so they win over both the :root and .dark stylesheet values.
 */

export type CustomColorKey = "primary" | "secondary" | "sticky";
export type CustomColors = Partial<Record<CustomColorKey, string>>;

export const COLORS_STORAGE_KEY = "uplog-colors";

const DARK_TEXT = "#241f1a";
const LIGHT_TEXT = "#faf6f0";

/** Near-black or near-white, whichever reads on the given background. */
export function readableForeground(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? DARK_TEXT : LIGHT_TEXT;
}

/** CSS variables driven by each customizable color. */
function varsFor(key: CustomColorKey, hex: string): Array<[string, string]> {
  switch (key) {
    case "primary": {
      const fg = readableForeground(hex);
      return [
        ["--primary", hex],
        ["--ring", hex],
        ["--sidebar-primary", hex],
        ["--sidebar-ring", hex],
        ["--primary-foreground", fg],
        ["--sidebar-primary-foreground", fg],
      ];
    }
    case "secondary":
      return [
        ["--secondary", hex],
        ["--secondary-foreground", readableForeground(hex)],
      ];
    case "sticky":
      return [["--sticky", hex]];
  }
}

const ALL_KEYS: CustomColorKey[] = ["primary", "secondary", "sticky"];

export function applyCustomColors(colors: CustomColors) {
  const style = document.documentElement.style;
  for (const key of ALL_KEYS) {
    const hex = colors[key];
    for (const [name, value] of varsFor(key, hex ?? "#000000")) {
      if (hex) style.setProperty(name, value);
      else style.removeProperty(name);
    }
  }
}

export function loadCustomColors(): CustomColors {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(COLORS_STORAGE_KEY) ?? "{}"
    );
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: CustomColors = {};
    for (const key of ALL_KEYS) {
      const v = (parsed as Record<string, unknown>)[key];
      if (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)) out[key] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveCustomColors(colors: CustomColors) {
  if (Object.keys(colors).length > 0) {
    localStorage.setItem(COLORS_STORAGE_KEY, JSON.stringify(colors));
  } else {
    localStorage.removeItem(COLORS_STORAGE_KEY);
  }
}

/**
 * Inline no-flash script for the root layout: re-applies saved colors before
 * first paint. Keep in sync with varsFor()/readableForeground() above.
 */
export const THEME_COLORS_SCRIPT = `(function(){try{var c=JSON.parse(localStorage.getItem(${JSON.stringify(
  COLORS_STORAGE_KEY
)})||"{}");var s=document.documentElement.style;function fg(h){var n=parseInt(h.slice(1),16);return .299*(n>>16&255)+.587*(n>>8&255)+.114*(n&255)>150?"${DARK_TEXT}":"${LIGHT_TEXT}"}function ok(h){return typeof h==="string"&&/^#[0-9a-fA-F]{6}$/.test(h)}if(ok(c.primary)){var f=fg(c.primary);s.setProperty("--primary",c.primary);s.setProperty("--ring",c.primary);s.setProperty("--sidebar-primary",c.primary);s.setProperty("--sidebar-ring",c.primary);s.setProperty("--primary-foreground",f);s.setProperty("--sidebar-primary-foreground",f)}if(ok(c.secondary)){s.setProperty("--secondary",c.secondary);s.setProperty("--secondary-foreground",fg(c.secondary))}if(ok(c.sticky)){s.setProperty("--sticky",c.sticky)}}catch(e){}})();`;

/* ---------------------------------------------------------------- *
 * Color math shared with the color-wheel picker.
 * ---------------------------------------------------------------- */

export type Hsl = { h: number; s: number; l: number };

export function hexToHsl(hex: string): Hsl | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
}

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g] = [c, x];
  else if (h < 120) [r, g] = [x, c];
  else if (h < 180) [g, b] = [c, x];
  else if (h < 240) [g, b] = [x, c];
  else if (h < 300) [r, b] = [x, c];
  else [r, b] = [c, x];
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Resolve any CSS color (incl. oklch) to hex via a 1px canvas. */
export function cssColorToHex(color: string): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return (
    "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("")
  );
}

/**
 * The stylesheet's own value for a theme variable in the current light/dark
 * mode, ignoring any inline customization override.
 */
export function stylesheetDefaultHex(varName: string): string | null {
  const style = document.documentElement.style;
  const override = style.getPropertyValue(varName);
  if (override) style.removeProperty(varName);
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  if (override) style.setProperty(varName, override);
  return raw ? cssColorToHex(raw) : null;
}
