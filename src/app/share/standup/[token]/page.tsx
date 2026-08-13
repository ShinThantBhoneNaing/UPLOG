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
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!z.uuid().safeParse(token).success) notFound();

  // Plain anon client — deliberately no cookies/session.
  const supabase = createAnonClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase.rpc("get_standup_share", {
    p_token: token,
  });

  if (error || !data) notFound();

  return <ShareBoard data={data as unknown as ShareData} />;
}
