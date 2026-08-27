import { ShoppingBag, Store, MessageCircle, Sparkles, ArrowRight, Search } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { GlassOnboarding, type Step } from "./glass-onboarding";
import { useOnboarding } from "@/lib/onboarding";
import { useEffect, useState } from "react";

const steps: Step[] = [
  {
    icon: <Sparkles className="h-6 w-6 text-[var(--terracotta)]" />,
    eyebrow: "Welcome shopper",
    title: "One marketplace, many independent shops",
    desc: "Discover curated storefronts, chat with sellers on WhatsApp, and check out in one cart — no tab hopping.",
    accent: "linear-gradient(135deg, oklch(0.92 0.12 85), oklch(0.88 0.10 75))",
    bullet: ["Browse by category", "One cart, many sellers", "Pay once via Paystack"],
  },
  {
    icon: <Search className="h-6 w-6" />,
    eyebrow: "Step 1 — Browse",
    title: "Find shops you’ll love",
    desc: "Filter by Fashion, Beauty, Home, Food, Art, Jewelry and more. Featured shops are hand-picked and approved.",
    accent: "linear-gradient(135deg, oklch(0.88 0.14 250), oklch(0.78 0.12 240))",
    bullet: ["Try categories on the home grid", "Use search in the header", "Tap any card to enter a world"],
  },
  {
    icon: <MessageCircle className="h-6 w-6 text-[#25D366]" />,
    eyebrow: "Step 2 — Negotiate",
    title: "Chat & haggle on WhatsApp",
    desc: "Every store has WhatsApp built in. Ask for sizes, custom orders, or a better price before you add to cart.",
    accent: "linear-gradient(135deg, oklch(0.90 0.12 150), oklch(0.85 0.10 160))",
    bullet: ["Tap Chat on WhatsApp on any product", "Seller replies outside the app — frictionless", "Negotiated price can sync to your cart"],
  },
  {
    icon: <ShoppingBag className="h-6 w-6" />,
    eyebrow: "Step 3 — One cart",
    title: "Add from many shops, pay once",
    desc: "Mix products from different sellers. Your cart groups by store, shows savings, and checks out in one Paystack flow.",
    accent: "linear-gradient(135deg, oklch(0.82 0.16 40), oklch(0.92 0.10 85))",
  },
  {
    icon: <Store className="h-6 w-6" />,
    eyebrow: "You’re set",
    title: "Ready to explore?",
    desc: "Start browsing — or create a free storefront yourself in minutes if you sell on Instagram or WhatsApp.",
    accent: "linear-gradient(135deg, oklch(0.92 0.10 85), oklch(0.82 0.16 80))",
  },
];

export function ShopperOnboarding() {
  const { shouldShow, complete } = useOnboarding("shopper");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (shouldShow) {
      const t = setTimeout(() => setOpen(true), 900);
      return () => clearTimeout(t);
    }
  }, [shouldShow]);

  if (!shouldShow) return null;

  return (
    <GlassOnboarding
      open={open}
      steps={steps}
      ctaLabel="Start browsing"
      onCta={() => navigate({ to: "/stores" })}
      onComplete={() => { setOpen(false); complete(); }}
      onSkip={() => { setOpen(false); complete(); }}
    />
  );
}

export function ShopperOnboardingTrigger({ className }: { className?: string }) {
  const { reset } = useOnboarding("shopper");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className ?? "inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/60 px-3 py-1 text-xs backdrop-blur hover:bg-white"}
      >
        <Sparkles className="h-3 w-3" /> How it works <ArrowRight className="h-3 w-3" />
      </button>
      <GlassOnboarding open={open} steps={steps} ctaLabel="Start browsing" onComplete={() => setOpen(false)} onSkip={() => setOpen(false)} />
    </>
  );
}
