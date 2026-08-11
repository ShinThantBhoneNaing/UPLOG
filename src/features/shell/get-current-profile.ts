import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/**
 * The signed-in user's profile, deduped per request with React cache().
 * Redirects to /login when there is no session (defense in depth on top
 * of the proxy) and blocks disabled accounts.
 */
export const getCurrentProfile = cache(async (): Promise<Profile> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  // RLS returns nothing for disabled accounts.
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  return profile;
});
