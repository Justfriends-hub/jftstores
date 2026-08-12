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

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Lawal's Marketplace" },
      { name: "description", content: "Sign in to Lawal's Marketplace to track orders, message sellers, and manage your shop." },
      { property: "og:title", content: "Sign in — Lawal's Marketplace" },
      { property: "og:description", content: "Sign in to Lawal's Marketplace to track orders, message sellers, and manage your shop." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://jftstores.lovable.app/login" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Sign in — Lawal's Marketplace" },
      { name: "twitter:description", content: "Sign in to Lawal's Marketplace to track orders, message sellers, and manage your shop." },
    ],
    links: [{ rel: "canonical", href: "https://jftstores.lovable.app/login" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/", replace: true });
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
    const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (error) toast.error(error instanceof Error ? error.message : "Google sign-in failed");
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
