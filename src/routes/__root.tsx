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

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Back to Son of Sun Greece
          </Link>
        </div>
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
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Justfriendstore — Shop small. Live warm." },
      { name: "description", content: "Discover jfts best small businesses in one place. Browse independent stores, message sellers on WhatsApp, and check out in one cart." },
      { name: "author", content: "Son of Sun Greece" },
      { property: "og:title", content: "Justfriendstore — Shop small. Live warm." },
      { property: "og:description", content: "Discover jfts best small businesses in one place. Browse independent stores, message sellers on WhatsApp, and check out in one cart." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Justfriendstore — Shop small. Live warm." },
      { name: "twitter:description", content: "Discover jfts best small businesses in one place. Browse independent stores, message sellers on WhatsApp, and check out in one cart." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/GuI3SfFoerUEYsg07c3hSDsDkyk1/social-images/social-1780300317337-IMG_1120.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/GuI3SfFoerUEYsg07c3hSDsDkyk1/social-images/social-1780300317337-IMG_1120.webp" },
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
  }),
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
