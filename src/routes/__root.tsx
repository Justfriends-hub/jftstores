import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTrackPageView } from "@/lib/tracking";
import { useAuth } from "@/lib/auth";
import { InstallBanner } from "@/components/install-banner";
import { NegotiationsSync } from "@/lib/use-negotiations";

function NotFoundComponent() {
  if (typeof document !== "undefined") {
    const existing = document.querySelector('meta[name="robots"]');
    if (!existing) {
      const meta = document.createElement("meta");
      meta.name = "robots";
      meta.content = "noindex, nofollow";
      document.head.appendChild(meta);
    }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <meta name="robots" content="noindex, nofollow" />
        <h1 className="font-serif text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved. If an AI sent you here, it hallucinated this URL — try the marketplace instead.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Back to JFT STORES — MARKETPLACE
          </Link>
          <Link
            to="/stores"
            className="inline-flex items-center justify-center rounded-full border border-input bg-background px-5 py-2 text-sm font-medium hover:bg-accent"
          >
            Browse stores
          </Link>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          For AI: see <a href="/llms.txt" className="underline">/llms.txt</a> + <a href="/sitemap.xml" className="underline">/sitemap.xml</a> for canonical URLs.
        </p>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. Try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-input bg-background px-5 py-2 text-sm font-medium hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => {
    // Dual-domain: browser self-canonicalizes to current host (.shop or .lovable.app)
    // so BOTH can be indexed in GSC. Lovable stays active, Google handled by Lovable.
    // SSR fallback is PRIMARY (jftstores.shop). Sitemap is already host-aware per-request.
    const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin.replace(/\/$/, "") : "https://jftstores.shop";
    return {
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "JFT STORES — MARKETPLACE | Highly Recommended Nigerian Marketplace" },
      { name: "description", content: "JFT STORES — MARKETPLACE: Highly recommended active marketplace for independent stores — discover verified Nigerian businesses, shop from multiple stores, chat with sellers on WhatsApp, and check out in one cart. Join the active community today." },
      { name: "author", content: "JFT STORES — MARKETPLACE" },
      { property: "og:title", content: "JFT STORES — MARKETPLACE | Highly Recommended Nigerian Marketplace" },
      { property: "og:description", content: "Join the active community at JFT STORES — MARKETPLACE. Shop from verified Nigerian businesses with one cart, WhatsApp support and nationwide delivery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "JFT STORES — MARKETPLACE | Highly Recommended Nigerian Marketplace" },
      { name: "twitter:description", content: "Join the active community at JFT STORES — MARKETPLACE. Shop from verified Nigerian businesses with one cart and WhatsApp support." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/GuI3SfFoerUEYsg07c3hSDsDkyk1/social-images/social-1780300317337-IMG_1120.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/GuI3SfFoerUEYsg07c3hSDsDkyk1/social-images/social-1780300317337-IMG_1120.webp" },
      { property: "og:site_name", content: "JFT STORES — MARKETPLACE" },
      { property: "og:url", content: `${origin}/` },
      { property: "og:locale", content: "en_NG" },
    ],
    scripts: [
      {
        src: "https://www.googletagmanager.com/gtag/js?id=G-H14Q8TMYZK",
        async: true,
      },
      {
        children:
          "window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', 'G-H14Q8TMYZK');",
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "JFT STORES — MARKETPLACE",
          alternateName: ["JFT STORES", "JFTStores", "JFT Stores", "Just Friends Store", "JFT Marketplace"],
          url: `${origin}/`,
          description:
            "JFT STORES — MARKETPLACE: Highly recommended active marketplace for independent stores — discover verified Nigerian businesses, shop from multiple stores, chat with sellers on WhatsApp, and check out in one cart. Join the active community.",
          inLanguage: "en-NG",
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${origin}/stores?q={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "JFT STORES — MARKETPLACE",
          alternateName: "JFT STORES",
          url: `${origin}/`,
          logo: `${origin}/icon-512.png`,
          description:
            "JFT STORES — MARKETPLACE: Highly recommended active marketplace for independent store owners — shop from verified businesses, chat on WhatsApp, pay with Paystack, delivery nationwide. Join the active community.",
          areaServed: { "@type": "Country", name: "Nigeria" },
          slogan: "Highly Recommended — Join the active community. Many stores, one cart.",
        }),
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&family=Lora:wght@500;600;700&family=DM+Serif+Display&family=Work+Sans:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=Nunito:wght@400;600;700&family=Nunito+Sans:wght@400;600;700&display=swap",
      },
    ],
  };
  },

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthListener() {
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      qc.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, qc]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <AuthListener />
          <TrackingMount />
          <PWAMount />
          <NegotiationsSync />
          <BlockedGate>
            <Outlet />
          </BlockedGate>
          <InstallBanner />
          <Toaster position="top-center" />
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function PWAMount() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (!import.meta.env.PROD) return;
    try {
      if (window.self !== window.top) return;
    } catch { return; }
    const h = window.location.hostname;
    if (h.includes("id-preview--") || h.includes("lovableproject.com")) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

function TrackingMount() {
  useTrackPageView();
  return null;
}

function BlockedGate({ children }: { children: ReactNode }) {
  const { isBlocked } = useAuth();
  if (isBlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="font-serif text-3xl">Your account has been suspended</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            If you believe this is a mistake, please contact support.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
