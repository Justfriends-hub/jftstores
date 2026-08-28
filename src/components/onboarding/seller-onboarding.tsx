import { Store, Palette, PackagePlus, BadgeCheck, LayoutDashboard, ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { GlassOnboarding, type Step } from "./glass-onboarding";
import { useOnboarding } from "@/lib/onboarding";
import { useEffect, useState } from "react";

const steps: Step[] = [
  {
    icon: <Store className="h-6 w-6" />,
    eyebrow: "Welcome seller",
    title: "Your free storefront in minutes",
    desc: "No fees to start. Get a beautiful, themed shop that lives at jftstores.shop/store/your-name.",
    accent: "linear-gradient(135deg, oklch(0.85 0.14 85), oklch(0.92 0.12 75))",
    bullet: ["Free to open, no monthly fee", "Your own slug + WhatsApp link", "One cart handles checkout for you"],
  },
  {
    icon: <BadgeCheck className="h-6 w-6 text-[var(--ocean)]" />,
    eyebrow: "Step 1 — Create",
    title: "Name it and claim your URL",
    desc: "Pick a business name, slug, and short description. Add WhatsApp so buyers can reach you.",
    accent: "linear-gradient(135deg, oklch(0.88 0.13 250), oklch(0.82 0.10 240))",
    bullet: ["Slug auto-generates from name", "WhatsApp optional but boosts sales", "You can edit everything later"],
  },
  {
    icon: <PackagePlus className="h-6 w-6" />,
    eyebrow: "Step 2 — Products",
    title: "Add products with photos & stock",
    desc: "Upload images, set price, category and stock. Inactive products stay hidden until you publish.",
    accent: "linear-gradient(135deg, oklch(0.90 0.12 150), oklch(0.82 0.14 85))",
    bullet: ["Drag images, set NGN price", "Low stock shows ‘Only 3 left’", "Negotiations sync to buyer carts"],
  },
  {
    icon: <Palette className="h-6 w-6" />,
    eyebrow: "Step 3 — Theme",
    title: "Pick a vibe, we handle the CSS",
    desc: "Choose a theme — colors, fonts, radius, banner — all scoped to your store. Preview live instantly.",
    accent: "linear-gradient(135deg, oklch(0.82 0.16 40), oklch(0.78 0.14 35))",
    bullet: ["Banner + logo + palette", "Scoped via CSS vars, no global bleed", "Mobile-perfect out of the box"],
  },
  {
    icon: <LayoutDashboard className="h-6 w-6" />,
    eyebrow: "Step 4 — Grow",
    title: "Dashboard: orders, messages, settings",
    desc: "Your store goes live instantly — join the highly recommended, active community and manage everything from /dashboard.",
    accent: "linear-gradient(135deg, oklch(0.88 0.12 250), oklch(0.92 0.10 85))",
    bullet: ["Create → live instantly — highly recommended", "Orders + fulfillment toggles", "Buyer messages with unread badges"],
  },
];

export function SellerOnboarding({ onDone }: { onDone?: () => void }) {
  const { shouldShow, complete } = useOnboarding("seller");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (shouldShow) {
      const t = setTimeout(() => setOpen(true), 700);
      return () => clearTimeout(t);
    }
  }, [shouldShow]);

  if (!shouldShow) return null;

  return (
    <GlassOnboarding
      open={open}
      steps={steps}
      ctaLabel="Create my shop"
      onCta={() => { onDone?.(); navigate({ to: "/sell" }); }}
      onComplete={() => { setOpen(false); complete(); onDone?.(); }}
      onSkip={() => { setOpen(false); complete(); }}
    />
  );
}

export function SellerOnboardingTrigger({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className ?? "inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/60 px-3 py-1 text-xs backdrop-blur hover:bg-white"}
      >
        <Sparkles className="h-3 w-3" /> How selling works <ArrowRight className="h-3 w-3" />
      </button>
      <GlassOnboarding open={open} steps={steps} ctaLabel="Create my shop" onComplete={() => setOpen(false)} onSkip={() => setOpen(false)} />
    </>
  );
}
