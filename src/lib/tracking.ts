// Silent IP geolocation + page visit tracking. Non-blocking. Never asks for permission.
import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "jfts.session_id.v1";
const GEO_CACHE_KEY = "jfts.geo.v1";
const LAST_PAGE_KEY = "jfts.last_page.v1";
const REFERRAL_STORE_KEY = "jfts.referral_store.v1";

type Geo = {
  ip?: string;
  country_name?: string;
  country_code?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
};

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

async function getGeo(): Promise<Geo | null> {
  if (typeof window === "undefined") return null;
  try {
    const cached = sessionStorage.getItem(GEO_CACHE_KEY);
    if (cached) return JSON.parse(cached);
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) return null;
    const data = (await res.json()) as Geo;
    sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(data));
    return data;
  } catch {
    return null;
  }
}

function extractStoreSlug(pathname: string): string | null {
  const m = pathname.match(/^\/store\/([^/]+)/);
  return m ? m[1] : null;
}

export function useTrackPageView() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    (async () => {
      try {
        const sessionId = getSessionId();
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id ?? null;
        const geo = await getGeo();
        if (cancelled) return;

        const storeSlug = extractStoreSlug(pathname);
        const lastPage = sessionStorage.getItem(LAST_PAGE_KEY);
        const referrer = lastPage || document.referrer || null;

        // Insert page visit (fire and forget)
        void supabase.from("page_visits").insert({
          session_id: sessionId,
          user_id: userId,
          ip_address: geo?.ip ?? null,
          country: geo?.country_name ?? null,
          country_code: geo?.country_code ?? null,
          region: geo?.region ?? null,
          city: geo?.city ?? null,
          latitude: geo?.latitude ?? null,
          longitude: geo?.longitude ?? null,
          page_url: pathname,
          store_slug: storeSlug,
          referrer,
          user_agent: navigator.userAgent,
        });

        // Track journey (movement between pages/stores)
        if (lastPage && lastPage !== pathname) {
          const fromSlug = extractStoreSlug(lastPage);
          void supabase.from("user_journeys").insert({
            session_id: sessionId,
            user_id: userId,
            from_store_slug: fromSlug,
            from_page: lastPage,
            to_store_slug: storeSlug,
            to_page: pathname,
          });
        }
        sessionStorage.setItem(LAST_PAGE_KEY, pathname);

        // Capture referral store on first store visit
        if (storeSlug && !localStorage.getItem(REFERRAL_STORE_KEY)) {
          localStorage.setItem(REFERRAL_STORE_KEY, storeSlug);
        }

        // Update profile last_active + ip fields + referral on first auth'd visit
        if (userId) {
          const referralStore = localStorage.getItem(REFERRAL_STORE_KEY);
          void supabase
            .from("profiles")
            .update({
              last_active_at: new Date().toISOString(),
              ip_country: geo?.country_name ?? null,
              ip_region: geo?.region ?? null,
              ip_city: geo?.city ?? null,
              ...(referralStore ? { referral_store_slug: referralStore } : {}),
            })
            .eq("id", userId);
        }
      } catch {
        // Swallow all errors — tracking must never break the app
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname]);
}
