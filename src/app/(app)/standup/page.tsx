import type { Metadata } from "next";
import { format } from "date-fns";
import { z } from "zod";
import { StandupBoard } from "@/features/standup/standup-board";
import { getStandupData } from "@/features/standup/queries";

export const metadata: Metadata = { title: "Standard Meeting" };

export default async function StandupPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: rawDate } = await searchParams;
  const today = format(new Date(), "yyyy-MM-dd");
  const parsed = z.iso.date().safeParse(rawDate);
  // Clamp to [reasonable past, today]
  const date =
    parsed.success && parsed.data <= today && parsed.data >= "2020-01-01"
      ? parsed.data
      : today;

  const data = await getStandupData(date);

  return <StandupBoard data={data} />;
}
