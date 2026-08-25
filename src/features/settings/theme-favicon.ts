/**
 * User-customizable web icon (favicon): background color and shape.
 * The icon is regenerated as an inline SVG data URL and swapped into the
 * page's <link rel="icon">, overriding the static app/icon.svg.
 */

export type FaviconShape = "square" | "rounded" | "circle";

export type FaviconStyle = {
  hex: string; // background #rrggbb
  shape: FaviconShape;
};

export const FAVICON_STORAGE_KEY = "uplog-favicon";

export const DEFAULT_FAVICON: FaviconStyle = {
  hex: "#c2b280",
  shape: "square",
};

const RADIUS: Record<FaviconShape, number> = {
  square: 0,
  rounded: 10,
  circle: 24,
};

/** The UPLOG mark on the chosen ground; "U" ink flips for readability. */
export function faviconSvg({ hex, shape }: FaviconStyle): string {
  const n = parseInt(hex.slice(1), 16);
  const lum =
    0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  const ink = lum > 150 ? "#1c1c1c" : "#ffffff";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">` +
    `<rect width="48" height="48" rx="${RADIUS[shape]}" fill="${hex}"/>` +
    `<path d="M10 9h7.5v15.5a5.25 5.25 0 0 0 10.5 0V23.5H35.5v1a12.75 12.75 0 0 1-25.5 0V9z" fill="${ink}"/>` +
    `<path d="M28.6 9H37v8.4l-6.6 8.3h-7.6L28.6 9z" fill="#ec5800"/>` +
    `</svg>`
  );
}

export function faviconDataUrl(style: FaviconStyle): string {
  return "data:image/svg+xml," + encodeURIComponent(faviconSvg(style));
}

export function applyFavicon(style: FaviconStyle | null) {
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (style === null) {
    // Back to the static default served by Next from app/icon.svg.
    if (link) link.href = "/icon.svg";
    return;
  }
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/svg+xml";
  link.href = faviconDataUrl(style);
}

export function loadFavicon(): FaviconStyle | null {
  try {
    const v: unknown = JSON.parse(
      localStorage.getItem(FAVICON_STORAGE_KEY) ?? "null"
    );
    if (typeof v !== "object" || v === null) return null;
    const { hex, shape } = v as Record<string, unknown>;
    if (typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
    return {
      hex: hex.toLowerCase(),
      shape: shape === "rounded" || shape === "circle" ? shape : "square",
    };
  } catch {
    return null;
  }
}

export function saveFavicon(style: FaviconStyle | null) {
  if (style === null) localStorage.removeItem(FAVICON_STORAGE_KEY);
  else localStorage.setItem(FAVICON_STORAGE_KEY, JSON.stringify(style));
}

/**
 * Inline script for the root layout: swaps in the saved web icon on load.
 * Keep in sync with faviconSvg()/applyFavicon() above.
 */
export const THEME_FAVICON_SCRIPT = `(function(){try{var v=JSON.parse(localStorage.getItem(${JSON.stringify(
  FAVICON_STORAGE_KEY
)})||"null");if(!v||typeof v.hex!=="string"||!/^#[0-9a-fA-F]{6}$/.test(v.hex))return;var rx=v.shape==="circle"?24:v.shape==="rounded"?10:0;var n=parseInt(v.hex.slice(1),16),ink=.299*(n>>16&255)+.587*(n>>8&255)+.114*(n&255)>150?"#1c1c1c":"#ffffff";var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="'+rx+'" fill="'+v.hex+'"/><path d="M10 9h7.5v15.5a5.25 5.25 0 0 0 10.5 0V23.5H35.5v1a12.75 12.75 0 0 1-25.5 0V9z" fill="'+ink+'"/><path d="M28.6 9H37v8.4l-6.6 8.3h-7.6L28.6 9z" fill="#ec5800"/></svg>';var l=document.querySelector('link[rel~="icon"]');if(!l){l=document.createElement("link");l.rel="icon";document.head.appendChild(l)}l.type="image/svg+xml";l.href="data:image/svg+xml,"+encodeURIComponent(svg)}catch(e){}})();`;
