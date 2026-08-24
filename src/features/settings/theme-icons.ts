/**
 * User-customizable icon style. All app icons are lucide SVGs (class
 * "lucide"), so style is changed globally via data attributes on <html>
 * plus CSS overrides in globals.css — no per-icon code changes.
 */

export type IconWeight = "thin" | "regular" | "bold";
export type IconCorners = "round" | "sharp";
export type IconFill = "outline" | "tinted";

export type IconStyle = {
  weight: IconWeight;
  corners: IconCorners;
  fill: IconFill;
};

export const ICONS_STORAGE_KEY = "uplog-icons";

export const DEFAULT_ICON_STYLE: IconStyle = {
  weight: "regular",
  corners: "round",
  fill: "outline",
};

export function applyIconStyle(style: IconStyle) {
  const root = document.documentElement;
  const set = (attr: string, value: string | null) => {
    if (value) root.setAttribute(attr, value);
    else root.removeAttribute(attr);
  };
  set("data-icon-weight", style.weight === "regular" ? null : style.weight);
  set("data-icon-corners", style.corners === "sharp" ? "sharp" : null);
  set("data-icon-fill", style.fill === "tinted" ? "tinted" : null);
}

export function loadIconStyle(): IconStyle {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(ICONS_STORAGE_KEY) ?? "{}"
    );
    if (typeof parsed !== "object" || parsed === null)
      return DEFAULT_ICON_STYLE;
    const { weight, corners, fill } = parsed as Record<string, unknown>;
    return {
      weight:
        weight === "thin" || weight === "bold" ? weight : "regular",
      corners: corners === "sharp" ? "sharp" : "round",
      fill: fill === "tinted" ? "tinted" : "outline",
    };
  } catch {
    return DEFAULT_ICON_STYLE;
  }
}

export function saveIconStyle(style: IconStyle) {
  const isDefault =
    style.weight === "regular" &&
    style.corners === "round" &&
    style.fill === "outline";
  if (isDefault) localStorage.removeItem(ICONS_STORAGE_KEY);
  else localStorage.setItem(ICONS_STORAGE_KEY, JSON.stringify(style));
}

/**
 * Inline no-flash script for the root layout: re-applies the saved icon
 * style before first paint. Keep in sync with applyIconStyle() above.
 */
export const THEME_ICONS_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  ICONS_STORAGE_KEY
)})||"{}"),d=document.documentElement;if(s.weight==="thin"||s.weight==="bold")d.setAttribute("data-icon-weight",s.weight);if(s.corners==="sharp")d.setAttribute("data-icon-corners","sharp");if(s.fill==="tinted")d.setAttribute("data-icon-fill","tinted")}catch(e){}})();`;
