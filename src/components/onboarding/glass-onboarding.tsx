import { useEffect, useState } from "react";
import { X, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Step = {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  desc: string;
  accent: string; // gradient
  bullet?: string[];
};

export function GlassOnboarding({
  open,
  steps,
  onComplete,
  onSkip,
  ctaLabel = "Get started",
  onCta,
}: {
  open: boolean;
  steps: Step[];
  onComplete: () => void;
  onSkip: () => void;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setMounted(true), 20);
      document.body.style.overflow = "hidden";
      return () => { clearTimeout(t); document.body.style.overflow = ""; };
    } else {
      setMounted(false);
      document.body.style.overflow = "";
    }
  }, [open]);

  useEffect(() => { if (!open) setIdx(0); }, [open]);

  if (!open) return null;
  const s = steps[idx];
  const isLast = idx === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      {/* backdrop — deep glass blur */}
      <div
        className={`absolute inset-0 bg-[#0f1a2e]/40 backdrop-blur-[14px] transition-opacity duration-500 ${mounted ? "opacity-100" : "opacity-0"}`}
        onClick={onSkip}
      />
      {/* animated orbs behind glass */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-[var(--sun)] opacity-35 blur-[70px] animate-float-slow" />
        <div className="absolute -bottom-40 -right-32 h-[520px] w-[520px] rounded-full bg-[var(--ocean)] opacity-25 blur-[80px] animate-float-slower" />
        <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--terracotta)] opacity-[0.12] blur-[90px]" />
      </div>

      {/* glass card */}
      <div
        className={`relative w-full max-w-[560px] overflow-hidden rounded-[28px] border border-white/20 bg-white/75 backdrop-blur-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.6)_inset] transition-all duration-500 ${mounted ? "translate-y-0 opacity-100 scale-100" : "translate-y-4 opacity-0 scale-[0.98]"}`}
      >
        {/* top highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[80%] -translate-x-1/2 rounded-full bg-white/40 blur-2xl" />

        {/* header */}
        <div className="relative flex items-center justify-between px-6 pt-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/60 px-3 py-1 text-[11px] font-semibold tracking-widest uppercase text-foreground/70 backdrop-blur">
            <Sparkles className="h-3 w-3 text-[var(--terracotta)]" /> Lawal&apos;s Marketplace
          </span>
          <button
            onClick={onSkip}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/60 backdrop-blur border border-white/40 text-foreground/60 hover:bg-white hover:text-foreground transition"
            aria-label="Skip"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* step content */}
        <div className="relative px-6 sm:px-8 pt-6 pb-2">
          <div
            className="mx-auto grid h-[88px] w-[88px] place-items-center rounded-[22px] border border-white/50 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur"
            style={{ background: s.accent }}
          >
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/90 shadow-sm text-foreground">
              {s.icon}
            </div>
          </div>

          <div className="mt-5 text-center">
            <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-[var(--terracotta)]">{s.eyebrow}</div>
            <h2 className="mt-2 font-serif text-[26px] leading-tight sm:text-[28px] text-foreground">{s.title}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{s.desc}</p>
            {s.bullet && (
              <ul className="mt-4 grid gap-2 text-left">
                {s.bullet.map((b) => (
                  <li key={b} className="flex gap-2 rounded-xl border border-white/50 bg-white/55 px-3 py-2.5 text-[13px] backdrop-blur">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ocean)]" /> {b}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* progress */}
        <div className="px-6 sm:px-8 pt-4">
          <div className="flex items-center justify-center gap-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? "w-8 bg-foreground" : i < idx ? "w-6 bg-foreground/40" : "w-6 bg-black/10"}`}
              />
            ))}
          </div>
          <div className="mt-2 text-center text-xs text-muted-foreground">
            {idx + 1} of {steps.length}
          </div>
        </div>

        {/* actions */}
        <div className="flex items-center justify-between gap-3 p-6 sm:p-8 pt-5">
          <Button
            variant="ghost"
            onClick={() => (idx === 0 ? onSkip() : setIdx((v) => v - 1))}
            className="rounded-full bg-white/60 backdrop-blur border border-white/50 hover:bg-white transition-all duration-200 active:scale-[0.97] [&_svg]:transition-transform [&_svg]:duration-200 hover:[&_svg]:-translate-x-0.5"
          >
            {idx === 0 ? "Skip" : <><ArrowLeft className="mr-1 h-4 w-4 shrink-0" /> Back</>}
          </Button>

          {!isLast ? (
            <Button
              onClick={() => setIdx((v) => v + 1)}
              className="rounded-full px-6 shadow-[0_8px_20px_rgba(0,0,0,0.15)] transition-all duration-300 active:scale-[0.96] [&_svg]:transition-transform [&_svg]:duration-500 active:[&_svg]:rotate-[360deg] hover:[&_svg]:rotate-12"
            >
              Next <ArrowRight className="ml-1 h-4 w-4 shrink-0" />
            </Button>
          ) : (
            <Button
              onClick={() => { onComplete(); onCta?.(); }}
              className="rounded-full px-6 bg-[var(--ocean)] text-white hover:opacity-90 shadow-[0_10px_24px_rgba(19,49,92,0.25)] transition-all duration-300 active:scale-[0.96] [&_svg]:transition-transform [&_svg]:duration-500 active:[&_svg]:rotate-[360deg] hover:[&_svg]:rotate-12"
            >
              {ctaLabel} <ArrowRight className="ml-1 h-4 w-4 shrink-0" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
