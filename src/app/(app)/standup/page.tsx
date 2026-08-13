import type { Metadata } from "next";
import { format } from "date-fns";
import { z } from "zod";
import { getCurrentProfile } from "@/features/shell/get-current-profile";
import { StandupBoard } from "@/features/standup/standup-board";
import { getStandupData } from "@/features/standup/queries";
import { createClient } from "@/lib/supabase/server";

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

  const profile = await getCurrentProfile();
  const data = await getStandupData(date);

  // Managers/admins can copy a public read-only share link.
  let shareToken: string | null = null;
  if (profile.role !== "member") {
    const supabase = await createClient();
    const { data: ws } = await supabase
      .from("workspace_settings")
      .select("standup_share_token")
      .eq("id", 1)
      .maybeSingle<{ standup_share_token: string }>();
    shareToken = ws?.standup_share_token ?? null;
  }

  return (
    <StandupBoard
      data={data}
      currentUserId={profile.id}
      shareToken={shareToken}
    />
  );
}
