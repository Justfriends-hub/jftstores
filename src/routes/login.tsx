import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { getSeoOrigin } from "@/lib/seo";

export const Route = createFileRoute("/login")({
  head: () => {
    const origin = getSeoOrigin();
    return {
    meta: [
      { title: "Sign in — JFT STORES — MARKETPLACE | Active & Highly Recommended" },
      { name: "description", content: "Sign in to JFT STORES — MARKETPLACE — highly recommended active marketplace. Track orders, message verified sellers, and manage your shop." },
      { property: "og:title", content: "Sign in — JFT STORES — MARKETPLACE" },
      { property: "og:description", content: "Sign in to JFT STORES — MARKETPLACE — join the active community of verified sellers and shoppers." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${origin}/login` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Sign in — JFT STORES — MARKETPLACE" },
      { name: "twitter:description", content: "Sign in to JFT STORES — MARKETPLACE — highly recommended active marketplace." },
    ],
    links: [{ rel: "canonical", href: `${origin}/login` }],
  };
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ---- BOUNCE HANDOFF (B): if user was bounced from .shop, store handoff + bounce back ----
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const handoff = sp.get("handoff");
    if (handoff) {
      sessionStorage.setItem("oauth_handoff_origin", handoff);
      const n = sp.get("next");
      if (n) sessionStorage.setItem("oauth_handoff_next", n);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const host = window.location.hostname;
    const isLovableHost = host.includes("lovable.app") || host.includes("lovableproject.com");
    const handoffOrigin = sessionStorage.getItem("oauth_handoff_origin");
    const handoffNext = sessionStorage.getItem("oauth_handoff_next") || "/";
    // Case 1: bounced from shop — return to shop with tokens
    if (handoffOrigin && handoffOrigin.includes("jftstores.shop")) {
      supabase.auth.getSession().then(({ data }) => {
        const at = data.session?.access_token;
        const rt = data.session?.refresh_token;
        if (at && rt) {
          const target = `${handoffOrigin.replace(/\/$/, "")}/auth/handoff#access_token=${encodeURIComponent(at)}&refresh_token=${encodeURIComponent(rt)}&next=${encodeURIComponent(handoffNext)}`;
          sessionStorage.removeItem("oauth_handoff_origin");
          sessionStorage.removeItem("oauth_handoff_next");
          window.location.href = target;
        } else {
          const target = `${handoffOrigin.replace(/\/$/, "")}/auth/handoff#next=${encodeURIComponent(handoffNext)}`;
          window.location.href = target;
        }
      });
      return;
    }
    // Case 2: direct visit to lovable.app — kill watermark, always throw to .shop after any signin (Google or email)
    if (isLovableHost) {
      const SHOP = "https://jftstores.shop";
      const next = handoffNext !== "/" ? handoffNext : "/";
      supabase.auth.getSession().then(({ data }) => {
        const at = data.session?.access_token;
        const rt = data.session?.refresh_token;
        if (at && rt) {
          window.location.href = `${SHOP}/auth/handoff#access_token=${encodeURIComponent(at)}&refresh_token=${encodeURIComponent(rt)}&next=${encodeURIComponent(next)}`;
        } else {
          // still bounce — shop will pick up via cookie/session if available, or show login
          window.location.href = `${SHOP}${next}`;
        }
      });
      return;
    }
    // Normal shop login
    navigate({ to: "/", replace: true });
  }, [user, navigate]);

  const onEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
  };

  const onGoogle = async () => {
    // FIXED: Never throw shop users to lovable — stay on current host
    // Lovable backend now whitelists jftstores.shop (or fallback in lovable/index.ts handles it)
    const origin = window.location.origin;
    const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: origin });
    if (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed");
    }
  };

  return (
    <PageShell>
      <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <h1 className="font-serif text-3xl">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to manage your shop or track your orders.</p>

        <Button onClick={onGoogle} variant="outline" className="mt-6 w-full rounded-full">
          Continue with Google
        </Button>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={onEmailLogin} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-full">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/register" className="font-medium text-foreground hover:underline">Create an account</Link>
        </p>
      </section>
    </PageShell>
  );
}
