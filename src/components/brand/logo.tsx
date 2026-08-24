import { cn } from "@/lib/utils";

/**
 * The UPLOG mark: an ink "U" whose right stem is a brand-orange arrow
 * pointing up-right. Vector recreation of public/brand/uplog-brandsheet.png.
 */
export function LogoMark({
  className,
  ink = "var(--color-foreground)",
}: {
  className?: string;
  /** Color of the "U" body; the arrow is always brand orange. */
  ink?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M8 6h9.5v20.5a6.75 6.75 0 0 0 13.5 0V25H40.5v1.5a16.25 16.25 0 0 1-32.5 0V6z"
        fill={ink}
      />
      <path
        d="M35.5 4H45v9.5L36.5 24H27.5L35.5 4z"
        fill="none"
      />
      <path
        d="M34.8 4H45v10.2L36.6 24.5h-9.4L34.8 4z"
        fill="#EC5800"
      />
    </svg>
  );
}

/**
 * Full lockup: mark + "UPLOG" wordmark ("UP" orange, "LOG" ink),
 * mirroring the brand sheet.
 */
export function Logo({
  className,
  markClassName,
  textClassName,
  ink,
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  ink?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cn("size-7 shrink-0", markClassName)} ink={ink} />
      <span
        className={cn(
          "text-lg font-bold tracking-[0.18em] select-none",
          textClassName
        )}
      >
        <span className="text-primary">UP</span>
        <span>LOG</span>
      </span>
    </span>
  );
}
