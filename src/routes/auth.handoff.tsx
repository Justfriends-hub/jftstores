import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/handoff")({
  component: HandoffPage,
});

function HandoffPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Finalizing login…");

  useEffect(() => {
    async function handle() {
      try {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        const next = params.get("next") ? decodeURIComponent(params.get("next")!) : "/";

        if (access_token && refresh_token) {
          setStatus("Restoring session on jftstores.shop…");
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) {
            setStatus(`Failed to restore: ${error.message}`);
            return;
          }
          // Clean hash so tokens don't linger in history
          window.history.replaceState(null, "", window.location.pathname);
          setStatus("Success — redirecting…");
          // Small delay so AuthProvider propagates
          setTimeout(() => navigate({ to: next as any, replace: true }), 400);
          return;
        }

        // Fallback: maybe already has session (e.g. came from lovable without tokens but already set via cookie)
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          navigate({ to: next as any, replace: true });
          return;
        }

        setStatus("No session found. Please try signing in again.");
        setTimeout(() => navigate({ to: "/login", replace: true }), 1500);
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Handoff failed");
      }
    }
    handle();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
