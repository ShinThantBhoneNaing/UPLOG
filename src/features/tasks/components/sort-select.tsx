"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SORT_LABELS, SORT_OPTIONS, type SortOption } from "../sorting";

export function SortSelect({
  value,
  onChange,
  className,
}: {
  value: SortOption;
  onChange: (value: SortOption) => void;
  className?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange((v ?? "custom") as SortOption)}
      items={SORT_LABELS}
    >
      <SelectTrigger className={cn("w-44", className)} aria-label="Sort tasks">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option} value={option}>
            {SORT_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
