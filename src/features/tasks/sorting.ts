import { PRIORITY_META } from "@/lib/utils";
import type { TaskWithRelations } from "@/types/database";

/**
 * Ordering for task cards on the board and the stand-up wall.
 *
 * "custom" is the hand-arranged order held in tasks.position — the only
 * mode where cards can be dragged into a new sequence. The others are
 * derived, so dragging in them would have nothing to write to.
 */
export const SORT_OPTIONS = [
  "custom",
  "created_desc",
  "created_asc",
  "priority_desc",
  "priority_asc",
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  custom: "Custom order",
  created_desc: "Newest first",
  created_asc: "Oldest first",
  priority_desc: "Priority: high first",
  priority_asc: "Priority: low first",
};

export function sortTasks<T extends TaskWithRelations>(
  tasks: T[],
  sort: SortOption
): T[] {
  // position breaks ties so equal keys keep a stable, hand-arranged order.
  const byPosition = (a: T, b: T) => a.position - b.position;
  const byNewest = (a: T, b: T) => b.created_at.localeCompare(a.created_at);
  const byPriority = (a: T, b: T) =>
    PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank;

  const copy = [...tasks];
  switch (sort) {
    case "custom":
      return copy.sort(byPosition);
    case "created_desc":
      return copy.sort((a, b) => byNewest(a, b) || byPosition(a, b));
    case "created_asc":
      return copy.sort((a, b) => -byNewest(a, b) || byPosition(a, b));
    case "priority_desc":
      return copy.sort((a, b) => byPriority(a, b) || byNewest(a, b));
    case "priority_asc":
      return copy.sort((a, b) => -byPriority(a, b) || byNewest(a, b));
  }
}

/**
 * A position that sorts between two neighbours. Positions are doubles
 * (seeded from the epoch clock), so halving the gap never needs a
 * reindex pass over the column.
 */
export function positionBetween(
  before: number | undefined,
  after: number | undefined
): number {
  if (before === undefined && after === undefined) return Date.now() / 1000;
  if (before === undefined) return after! - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}

/**
 * Where `taskId` lands after being dropped: `orderedIds` is the column's
 * final sequence, and the new position is the midpoint of its neighbours.
 */
export function positionForDrop(
  orderedIds: string[],
  taskId: string,
  positionOf: (id: string) => number | undefined
): number {
  const index = orderedIds.indexOf(taskId);
  const before = index > 0 ? positionOf(orderedIds[index - 1]!) : undefined;
  const after =
    index >= 0 && index < orderedIds.length - 1
      ? positionOf(orderedIds[index + 1]!)
      : undefined;
  return positionBetween(before, after);
}
