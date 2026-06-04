// Server-only Web Push delivery using VAPID.
// Implementation note: web-push npm package depends on Node crypto.
// For Cloudflare Workers we use the Web Crypto API directly to sign VAPID JWTs.
// This is a best-effort implementation — falls back to no-op if keys missing.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@justfriendstore.com";

function b64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64UrlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function importVapidPrivateKey(): Promise<CryptoKey> {
  const d = b64UrlDecode(VAPID_PRIVATE);
  const pub = b64UrlDecode(VAPID_PUBLIC);
  // P-256 public key is 65 bytes: 0x04 || X(32) || Y(32)
  const x = b64UrlEncode(pub.slice(1, 33));
  const y = b64UrlEncode(pub.slice(33, 65));
  const jwk: JsonWebKey = {
    kty: "EC", crv: "P-256",
    d: b64UrlEncode(d), x, y,
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function vapidAuthHeader(audience: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: VAPID_SUBJECT,
  };
  const headerB64 = b64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = b64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;
  const key = await importVapidPrivateKey();
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned));
  return `vapid t=${unsigned}.${b64UrlEncode(sig)}, k=${VAPID_PUBLIC}`;
}

type PushPayload = { title: string; body: string; url?: string };

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  if (userIds.length === 0) return;

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (!subs || subs.length === 0) return;

  // For each subscription, send unencrypted notification (some browsers accept this).
  // Full payload encryption (aes128gcm) requires more crypto work; we send
  // header-only push and the SW shows a generic notification — fallback for now.
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        const audience = new URL(sub.endpoint as string).origin;
        const auth = await vapidAuthHeader(audience);
        const res = await fetch(sub.endpoint as string, {
          method: "POST",
          headers: {
            Authorization: auth,
            "TTL": "86400",
            "Content-Length": "0",
          },
        });
        if (res.status === 404 || res.status === 410) {
          await supabaseAdmin.from("push_subscriptions").update({ is_active: false }).eq("id", sub.id);
        }
      } catch (e) {
        console.error("push delivery error", e);
      }
    })
  );
  // Note: payload is delivered via in-app notification (already inserted into notifications table).
  // SW shows generic title on push event when payload is empty.
  void payload;
}
