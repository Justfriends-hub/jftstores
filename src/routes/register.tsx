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

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create your account — Just Friends Store" },
      { name: "description", content: "Join Just Friends Store to shop from independent sellers or open your own free storefront." },
      { property: "og:title", content: "Create your account — Just Friends Store" },
      { property: "og:description", content: "Join Just Friends Store to shop from independent sellers or open your own free storefront." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://jftstores.lovable.app/register" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Create your account — Just Friends Store" },
      { name: "twitter:description", content: "Join Just Friends Store to shop from independent sellers or open your own free storefront." },
    ],
    links: [{ rel: "canonical", href: "https://jftstores.lovable.app/register" }],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/sell", replace: true });
  }, [user, navigate]);

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/sell`,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email to confirm your account.");
  };

  const onGoogle = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (error) toast.error(error instanceof Error ? error.message : "Google sign-in failed");
  };

  return (
    <PageShell>
      <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <h1 className="font-serif text-3xl">Join Son of Sun Greece</h1>
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
