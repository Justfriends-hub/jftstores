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

export const Route = createFileRoute("/register")({
  head: () => {
    const origin = getSeoOrigin();
    return {
    meta: [
      { title: "Create your account — Lawal's Marketplace" },
      { name: "description", content: "Join Lawal's Marketplace to shop from independent sellers or open your own free storefront." },
      { property: "og:title", content: "Create your account — Lawal's Marketplace" },
      { property: "og:description", content: "Join Lawal's Marketplace to shop from independent sellers or open your own free storefront." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${origin}/register` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Create your account — Lawal's Marketplace" },
      { name: "twitter:description", content: "Join Lawal's Marketplace to shop from independent sellers or open your own free storefront." },
    ],
    links: [{ rel: "canonical", href: `${origin}/register` }],
  };
  },
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ---- BOUNCE HANDOFF (B) ----
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
    const handoffNext = sessionStorage.getItem("oauth_handoff_next") || "/sell";
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
          window.location.href = `${handoffOrigin.replace(/\/$/, "")}/auth/handoff#next=${encodeURIComponent(handoffNext)}`;
        }
      });
      return;
    }
    // Direct lovable visit — always throw to shop to kill watermark
    if (isLovableHost) {
      const SHOP = "https://jftstores.shop";
      supabase.auth.getSession().then(({ data }) => {
        const at = data.session?.access_token;
        const rt = data.session?.refresh_token;
        if (at && rt) {
          window.location.href = `${SHOP}/auth/handoff#access_token=${encodeURIComponent(at)}&refresh_token=${encodeURIComponent(rt)}&next=${encodeURIComponent(handoffNext)}`;
        } else {
          window.location.href = `${SHOP}${handoffNext}`;
        }
      });
      return;
    }
    navigate({ to: "/sell", replace: true });
  }, [user, navigate]);

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const host = window.location.hostname;
    const isLovableHost = host.includes("lovable.app") || host.includes("lovableproject.com");
    // Always land on shop to avoid watermark, even if they registered on lovable
    const redirectOrigin = isLovableHost ? "https://jftstores.shop" : window.location.origin;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${redirectOrigin}/sell`,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email to confirm your account.");
  };

  const onGoogle = async () => {
    const origin = window.location.origin;
    const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: origin });
    if (error) toast.error(error instanceof Error ? error.message : "Google sign-in failed");
  };

  return (
    <PageShell>
      <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <h1 className="font-serif text-3xl">Join Lawal's Marketplace</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          One free account to shop and (if you want) to open your own storefront.
        </p>

        <Button onClick={onGoogle} variant="outline" className="mt-6 w-full rounded-full">
          Continue with Google
        </Button>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={onRegister} className="space-y-4">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            <p className="mt-1 text-[11px] text-muted-foreground">At least 8 characters.</p>
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-full">
            {loading ? "Creating…" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-foreground hover:underline">Sign in</Link>
        </p>
      </section>
    </PageShell>
  );
}
