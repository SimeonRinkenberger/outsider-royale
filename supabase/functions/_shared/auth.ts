/**
 * Shared JWT authentication helper for edge functions.
 * Validates the user's JWT and returns the authenticated user.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthResult {
  user: { id: string; email?: string };
  profileId: string;
}

/**
 * Authenticate request via JWT and resolve the caller's profile ID.
 * Returns null if authentication fails.
 */
export async function authenticateRequest(req: Request): Promise<AuthResult | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  // Look up the user's profile to get the profile ID (used as RevenueCat app_user_id)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (profileError || !profile) return null;

  return {
    user: { id: user.id, email: user.email },
    profileId: profile.id,
  };
}
