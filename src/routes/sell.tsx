import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getSeoOrigin } from "@/lib/seo";
import { SellerOnboarding } from "@/components/onboarding/seller-onboarding";

export const Route = createFileRoute("/sell")({
  head: () => {
    const origin = getSeoOrigin();
    return {
    meta: [
      { title: "Open your free shop — Lawal's Marketplace" },
      { name: "description", content: "Create a free online storefront in minutes. Add products, share your link, and sell on WhatsApp with one cart and checkout." },
      { property: "og:title", content: "Open your free shop — Lawal's Marketplace" },
      { property: "og:description", content: "Create a free online storefront in minutes. Add products, share your link, and sell on WhatsApp with one cart and checkout." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${origin}/sell` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Open your free shop — Lawal's Marketplace" },
      { name: "twitter:description", content: "Create a free online storefront in minutes. Add products, share your link, and sell on WhatsApp with one cart and checkout." },
    ],
    links: [{ rel: "canonical", href: `${origin}/sell` }],
  };
  },
  component: SellPage,
});

type Seller = {
  id: string;
  business_name: string;
  slug: string;
  status: "pending" | "approved" | "rejected";
};

const RESERVED_SLUGS = new Set(["s","store","stores","admin","api","auth","cart","checkout","dashboard","login","register","sell","product","products","category","search","about","contact"]);
function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}
function isBadSlug(input: string): boolean {
  const low = input.toLowerCase();
  return low.includes("http") || low.includes("wa.me") || low.includes("whatsapp") || low.includes("://") || low.includes("/") || low.length < 3 || RESERVED_SLUGS.has(low);
}
function buildSeoSlug(businessName: string, fallback?: string): string {
  // Prefer business name; never derive from WhatsApp URL. Ensure 3-60 chars, SEO-friendly
  let base = slugify(businessName);
  if (!base || isBadSlug(base)) base = fallback ? slugify(fallback) : "";
  if (!base || base.length < 3) base = `store-${Math.random().toString(36).slice(2, 6)}`;
  if (RESERVED_SLUGS.has(base) || base.length < 3) base = `${base}-shop`;
  return base.slice(0, 60);
}

function SellPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [checking, setChecking] = useState(true);
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
      return;
    }
    supabase
      .from("sellers")
      .select("id,business_name,slug,status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setSeller((data as Seller) ?? null);
        setChecking(false);
      });
  }, [user, loading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    // Never use WhatsApp URL as slug — always derive from business name
    if (isBadSlug(slug) && slug) {
      toast.error("Store URL can't be a link. Using your business name instead.");
    }
    const candidate = isBadSlug(slug) ? "" : slug;
    const finalSlugBase = buildSeoSlug(businessName, candidate || slug);
    // ensure uniqueness — if taken, append -2, -3
    let finalSlug = finalSlugBase;
    let counter = 2;
    while (true) {
      const { data: exists } = await supabase.from("sellers").select("id").eq("slug", finalSlug).maybeSingle();
      if (!exists) break;
      finalSlug = `${finalSlugBase}-${counter}`.slice(0, 60);
      counter++;
      if (counter > 20) break;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("sellers")
      .insert({
        user_id: user.id,
        business_name: businessName,
        slug: finalSlug,
        description: description || null,
        whatsapp_number: whatsapp || null,
      })
      .select("id,business_name,slug,status")
      .single();
    setSubmitting(false);
    if (error) return toast.error(error.message.includes("duplicate") ? `URL /store/${finalSlug} taken, try another` : error.message);
    setSeller(data as Seller);
    toast.success(`Storefront submitted! Your URL is /store/${finalSlug} — add products to get indexed.`);
  };

  if (loading || checking) {
    return <PageShell><div className="mx-auto max-w-2xl px-4 py-16">Loading…</div></PageShell>;
  }

  if (seller) {
    return (
      <PageShell>
        <SellerOnboarding />
        <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <h1 className="font-serif text-3xl">{seller.business_name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your storefront is <span className="font-medium text-foreground">{seller.status}</span>.</p>
          {seller.status === "pending" && (
            <p className="mt-4 rounded-lg border border-border bg-muted/40 p-4 text-sm">
              An admin will review and approve your shop shortly. You can already start adding products from your dashboard.
            </p>
          )}
          <div className="mt-6 flex gap-3">
            <Button asChild className="rounded-full">
              <Link to="/dashboard">Go to my dashboard</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/store/$slug" params={{ slug: seller.slug }}>View my storefront</Link>
            </Button>
          </div>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <SellerOnboarding />
      <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="font-serif text-3xl">Open your free shop</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tell us about your business. You can refine everything later from your dashboard.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="bn">Business name</Label>
            <Input id="bn" required value={businessName} onChange={(e) => { setBusinessName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }} />
          </div>
          <div>
            <Label htmlFor="sl">Storefront URL</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/store/</span>
              <Input id="sl" required value={slug} onChange={(e) => {
                const v = slugify(e.target.value);
                if (v.includes("http") || v.includes("wa-me")) return; // block WhatsApp URLs
                setSlug(v);
              }} placeholder="e.g. skrii-treads" />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">3–60 chars, letters/numbers/hyphens only. Derived from business name if left empty. This is your permanent SEO URL.</p>
          </div>
          <div>
            <Label htmlFor="desc">Short description</Label>
            <Textarea id="desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="wa">WhatsApp number (optional)</Label>
            <Input id="wa" placeholder="+30 …" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </div>
          <Button type="submit" disabled={submitting} className="w-full rounded-full">
            {submitting ? "Submitting…" : "Open my free shop"}
          </Button>
        </form>
      </section>
    </PageShell>
  );
}
