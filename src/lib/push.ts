/**
 * Web Push helpers — service worker delivery so users get notifications
 * even when the site is closed.
 *
 * Wiring:
 *  1. Set VITE_VAPID_PUBLIC_KEY (generated via `npx web-push generate-vapid-keys`).
 *  2. Call `ensureServiceWorker()` once at app start (skipped in iframe/preview).
 *  3. Call `subscribeToPush()` from the UI after login or first meaningful action.
 *  4. Server (later) reads `push_subscriptions` and uses `web-push` to deliver.
 */
import { supabase } from "@/integrations/supabase/client";

const SW_URL = "/sw.js";

function isPreviewOrIframe(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const inIframe = window.self !== window.top;
    const previewHost =
      window.location.hostname.includes("id-preview--") ||
      window.location.hostname.includes("lovableproject.com");
    return inIframe || previewHost;
  } catch {
    return true;
  }
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported() || isPreviewOrIframe()) return null;
  try {
    return await navigator.serviceWorker.register(SW_URL);
  } catch (e) {
    console.warn("[push] SW registration failed", e);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export async function subscribeToPush(opts?: { roleTag?: "customer" | "seller" }): Promise<boolean> {
  if (!pushSupported()) return false;
  const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapid) {
    console.warn("[push] VITE_VAPID_PUBLIC_KEY not configured");
    return false;
  }
  const reg = await ensureServiceWorker();
  if (!reg) return false;

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;

  const key = urlBase64ToUint8Array(vapid);
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
  });

  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh ?? arrayBufferToBase64(sub.getKey("p256dh"));
  const auth = json.keys?.auth ?? arrayBufferToBase64(sub.getKey("auth"));
  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: sub.endpoint,
      p256dh,
      auth,
      user_id: userData.user?.id ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      role_tag: opts?.roleTag ?? null,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    console.warn("[push] failed to store subscription", error);
    return false;
  }
  return true;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}
