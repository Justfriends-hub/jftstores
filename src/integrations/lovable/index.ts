// Dual-domain aware OAuth — works on BOTH jftstores.shop and jftstores.lovable.app
// Lovable is still active and handles Google via Lovable Cloud Auth. We try Lovable first
// with window.location.origin; if it fails due to domain mismatch, we fallback to
// Supabase direct OAuth (which requires both domains whitelisted in Supabase dashboard).

import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { supabase } from "../supabase/client";
const lovableAuth = createLovableAuth();

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple" | "microsoft" | "lovable", opts?: SignInOptions) => {
      const redirectUri = opts?.redirect_uri ?? (typeof window !== "undefined" ? window.location.origin : undefined);

      // Try Lovable Cloud Auth first (handles Google for both domains if configured)
      try {
        const result = await lovableAuth.signInWithOAuth(provider, {
          redirect_uri: redirectUri,
          extraParams: {
            ...opts?.extraParams,
          },
        });

        if (result.redirected) {
          return result;
        }

        if (!result.error) {
          try {
            await supabase.auth.setSession(result.tokens);
          } catch (e) {
            return { error: e instanceof Error ? e : new Error(String(e)) };
          }
          return result;
        }

        // If Lovable errors (e.g. redirect_uri not whitelisted for .shop), fall through to Supabase
        console.warn("[lovable auth] failed, falling back to Supabase direct:", result.error);
      } catch (e) {
        console.warn("[lovable auth] exception, falling back to Supabase direct:", e);
      }

      // Fallback: Supabase direct OAuth — requires both domains in Supabase Auth > URL Configuration > Redirect URLs
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: provider as "google",
          options: {
            redirectTo: redirectUri,
          },
        });
        if (error) return { error };
        return { redirected: true } as const;
      } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
  },
};
