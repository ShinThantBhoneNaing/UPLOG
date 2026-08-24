import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ShareBoard, type ShareData } from "@/features/standup/share-board";

export const metadata: Metadata = {
  title: "Standard Meeting — shared board",
  robots: { index: false, follow: false },
};

/**
 * Public read-only stand-up board. No login: access is gated solely by the
 * secret share token, validated inside the get_standup_share RPC.
 */
export default async function SharedStandupPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { token } = await params;
  if (!z.guid().safeParse(token).success) notFound();

  const { date: rawDate } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const parsedDate = z.iso.date().safeParse(rawDate);
  const date =
    parsedDate.success && parsedDate.data <= today && parsedDate.data >= "2020-01-01"
      ? parsedDate.data
      : today;

  // Plain anon client — deliberately no cookies/session.
  const supabase = createAnonClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase.rpc("get_standup_share", {
    p_token: token,
    p_date: date,
  });

  if (error || !data) notFound();

  return <ShareBoard data={data as unknown as ShareData} token={token} />;
}
