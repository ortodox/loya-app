import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthState } from "@/logic/auth-step";

export async function getAuthState(supabase: SupabaseClient): Promise<AuthState> {
  // getUser() validates the JWT with Supabase; never trust getSession() on the server.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hasUser: false, currentLevel: null };

  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return { hasUser: true, currentLevel: data?.currentLevel ?? null };
}
