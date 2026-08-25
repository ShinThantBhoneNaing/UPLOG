/**
 * User-customizable theme colors (primary, secondary, sticky-note paper,
 * background) with optional per-color opacity and frosted blur.
 * Stored in localStorage and applied as inline CSS-variable overrides on
 * <html> (plus a data-blur attribute), so they win over both the :root and
 * .dark stylesheet values.
 */

export type CustomColorKey =
  | "primary"
  | "secondary"
  | "sticky"
  | "background"
  | "sidebar"
  | "project"
  | "warning";

export type ColorSetting = {
  hex: string; // #rrggbb
  alpha: number; // 0–100
  blur: boolean; // frosted backdrop blur
};

export type CustomColors = Partial<Record<CustomColorKey, ColorSetting>>;

export const COLORS_STORAGE_KEY = "uplog-colors";

const DARK_TEXT = "#241f1a";
const LIGHT_TEXT = "#faf6f0";

const ALL_KEYS: CustomColorKey[] = [
  "primary",
  "secondary",
  "sticky",
  "background",
  "sidebar",
  "project",
  "warning",
];

/** Near-black or near-white, whichever reads on the given background. */
export function readableForeground(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? DARK_TEXT : LIGHT_TEXT;
}

/** #rrggbb + alpha% → #rrggbb or #rrggbbaa. */
function withAlpha(hex: string, alpha: number): string {
  if (alpha >= 100) return hex;
  return hex + Math.round(alpha * 2.55).toString(16).padStart(2, "0");
}

/**
 * Mix a hex color toward white (t > 0) or black (t < 0) — used to derive
 * card from background and hover/active fills from the sidebar color.
 */
function shade(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (x: number) =>
    Math.round(t >= 0 ? x + (255 - x) * t : x * (1 + t))
      .toString(16)
      .padStart(2, "0");
  return "#" + ch((n >> 16) & 255) + ch((n >> 8) & 255) + ch(n & 255);
}

const VAR_NAMES: Record<CustomColorKey, string[]> = {
  primary: [
    "--primary",
    "--ring",
    "--sidebar-primary",
    "--sidebar-ring",
    "--primary-foreground",
    "--sidebar-primary-foreground",
  ],
  secondary: ["--secondary", "--secondary-foreground"],
  sticky: ["--sticky"],
  background: [
    "--background",
    "--foreground",
    "--card",
    "--popover",
    "--card-foreground",
    "--popover-foreground",
    "--border",
    "--input",
  ],
  sidebar: [
    "--sidebar",
    "--sidebar-foreground",
    "--sidebar-accent",
    "--sidebar-accent-foreground",
    "--sidebar-border",
  ],
  project: ["--project-card", "--project-card-foreground"],
  warning: ["--warning", "--warning-foreground"],
};

/** CSS variables driven by each customizable color. */
function varsFor(key: CustomColorKey, c: ColorSetting): Array<[string, string]> {
  switch (key) {
    case "primary": {
      const fg = readableForeground(c.hex);
      const hex = withAlpha(c.hex, c.alpha);
      return [
        ["--primary", hex],
        ["--ring", c.hex],
        ["--sidebar-primary", hex],
        ["--sidebar-ring", c.hex],
        ["--primary-foreground", fg],
        ["--sidebar-primary-foreground", fg],
      ];
    }
    case "secondary":
      return [
        ["--secondary", withAlpha(c.hex, c.alpha)],
        ["--secondary-foreground", readableForeground(c.hex)],
      ];
    case "sticky":
      return [["--sticky", withAlpha(c.hex, c.alpha)]];
    case "background": {
      const fg = readableForeground(c.hex);
      const isDarkBg = fg === LIGHT_TEXT;
      // Cards sit slightly lighter than the page, like the stock theme;
      // opacity applies to the panels so the page shows through them.
      const card = withAlpha(shade(c.hex, isDarkBg ? 0.07 : 0.45), c.alpha);
      return [
        ["--background", c.hex],
        ["--foreground", fg],
        ["--card", card],
        ["--popover", card],
        ["--card-foreground", fg],
        ["--popover-foreground", fg],
        ["--border", fg + (isDarkBg ? "24" : "59")],
        ["--input", fg + (isDarkBg ? "2e" : "73")],
      ];
    }
    case "sidebar": {
      const fg = readableForeground(c.hex);
      const isDark = fg === LIGHT_TEXT;
      return [
        ["--sidebar", withAlpha(c.hex, c.alpha)],
        ["--sidebar-foreground", fg],
        // Hover/active nav fill: a step lighter on dark, darker on light.
        ["--sidebar-accent", shade(c.hex, isDark ? 0.09 : -0.07)],
        ["--sidebar-accent-foreground", fg],
        ["--sidebar-border", fg + (isDark ? "1f" : "3d")],
      ];
    }
    case "project":
      return [
        ["--project-card", withAlpha(c.hex, c.alpha)],
        ["--project-card-foreground", readableForeground(c.hex)],
      ];
    case "warning":
      // The "to do" status color: sticky paperclips, dots, badges.
      return [
        ["--warning", withAlpha(c.hex, c.alpha)],
        ["--warning-foreground", readableForeground(c.hex)],
      ];
  }
}

export function applyCustomColors(colors: CustomColors) {
  const root = document.documentElement;
  const blurred: string[] = [];
  for (const key of ALL_KEYS) {
    const setting = colors[key];
    if (setting) {
      for (const [name, value] of varsFor(key, setting)) {
        root.style.setProperty(name, value);
      }
      if (setting.blur) blurred.push(key);
    } else {
      for (const name of VAR_NAMES[key]) root.style.removeProperty(name);
    }
  }
  if (blurred.length > 0) root.setAttribute("data-blur", blurred.join(" "));
  else root.removeAttribute("data-blur");
}

function normalizeSetting(v: unknown): ColorSetting | null {
  // v1 stored a bare hex string; v2 stores {hex, alpha, blur}.
  const raw = typeof v === "string" ? { hex: v } : v;
  if (typeof raw !== "object" || raw === null) return null;
  const { hex, alpha, blur } = raw as Record<string, unknown>;
  if (typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  return {
    hex: hex.toLowerCase(),
    alpha:
      typeof alpha === "number" ? Math.min(100, Math.max(0, alpha)) : 100,
    blur: blur === true,
  };
}

/** Validate an untrusted JSON string (localStorage, share URL) into colors. */
export function parseCustomColors(json: string): CustomColors {
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: CustomColors = {};
    for (const key of ALL_KEYS) {
      const setting = normalizeSetting(
        (parsed as Record<string, unknown>)[key]
      );
      if (setting) out[key] = setting;
    }
    return out;
  } catch {
    return {};
  }
}

export function loadCustomColors(): CustomColors {
  return parseCustomColors(localStorage.getItem(COLORS_STORAGE_KEY) ?? "{}");
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
 * first paint. Keep in sync with varsFor()/normalizeSetting() above.
 */
export const THEME_COLORS_SCRIPT = `(function(){try{var c=JSON.parse(localStorage.getItem(${JSON.stringify(
  COLORS_STORAGE_KEY
)})||"{}");var s=document.documentElement.style,bl=[];function norm(v){if(typeof v==="string")v={hex:v};if(!v||typeof v!=="object"||typeof v.hex!=="string"||!/^#[0-9a-fA-F]{6}$/.test(v.hex))return null;return{hex:v.hex.toLowerCase(),alpha:typeof v.alpha==="number"?Math.min(100,Math.max(0,v.alpha)):100,blur:v.blur===true}}function fg(h){var n=parseInt(h.slice(1),16);return .299*(n>>16&255)+.587*(n>>8&255)+.114*(n&255)>150?"${DARK_TEXT}":"${LIGHT_TEXT}"}function a8(h,a){if(a>=100)return h;var v=Math.round(a*2.55).toString(16);return h+(v.length<2?"0"+v:v)}function sh(h,t){var n=parseInt(h.slice(1),16);function m(x){var v=Math.round(t>=0?x+(255-x)*t:x*(1+t)).toString(16);return v.length<2?"0"+v:v}return"#"+m(n>>16&255)+m(n>>8&255)+m(n&255)}var p=norm(c.primary);if(p){var f=fg(p.hex),h=a8(p.hex,p.alpha);s.setProperty("--primary",h);s.setProperty("--ring",p.hex);s.setProperty("--sidebar-primary",h);s.setProperty("--sidebar-ring",p.hex);s.setProperty("--primary-foreground",f);s.setProperty("--sidebar-primary-foreground",f);if(p.blur)bl.push("primary")}var q=norm(c.secondary);if(q){s.setProperty("--secondary",a8(q.hex,q.alpha));s.setProperty("--secondary-foreground",fg(q.hex));if(q.blur)bl.push("secondary")}var k=norm(c.sticky);if(k){s.setProperty("--sticky",a8(k.hex,k.alpha));if(k.blur)bl.push("sticky")}var b=norm(c.background);if(b){var bf=fg(b.hex),dk=bf==="${LIGHT_TEXT}",cd=a8(sh(b.hex,dk?0.07:0.45),b.alpha);s.setProperty("--background",b.hex);s.setProperty("--foreground",bf);s.setProperty("--card",cd);s.setProperty("--popover",cd);s.setProperty("--card-foreground",bf);s.setProperty("--popover-foreground",bf);s.setProperty("--border",bf+(dk?"24":"59"));s.setProperty("--input",bf+(dk?"2e":"73"));if(b.blur)bl.push("background")}var sb=norm(c.sidebar);if(sb){var sf=fg(sb.hex),sd=sf==="${LIGHT_TEXT}";s.setProperty("--sidebar",a8(sb.hex,sb.alpha));s.setProperty("--sidebar-foreground",sf);s.setProperty("--sidebar-accent",sh(sb.hex,sd?0.09:-0.07));s.setProperty("--sidebar-accent-foreground",sf);s.setProperty("--sidebar-border",sf+(sd?"1f":"3d"));if(sb.blur)bl.push("sidebar")}var pj=norm(c.project);if(pj){s.setProperty("--project-card",a8(pj.hex,pj.alpha));s.setProperty("--project-card-foreground",fg(pj.hex));if(pj.blur)bl.push("project")}var w=norm(c.warning);if(w){s.setProperty("--warning",a8(w.hex,w.alpha));s.setProperty("--warning-foreground",fg(w.hex));if(w.blur)bl.push("warning")}if(bl.length)document.documentElement.setAttribute("data-blur",bl.join(" "))}catch(e){}})();`;

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
