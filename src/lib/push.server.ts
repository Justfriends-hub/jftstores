// Server-only Web Push delivery using VAPID + aes128gcm payload encryption.
// Implemented with Web Crypto so it runs on Cloudflare Workers (no node crypto).

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const VAPID_PUBLIC =
  process.env.VAPID_PUBLIC_KEY ||
  "BD7-g9CGmVA4AgNEyoCaJc4R0RB_l9Nvc69loRNxXIa99cMmA0dFNJuuDJOGPz8ryB3RoVJ_H0JPvQDNZRXEWpM";
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

function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

async function importVapidPrivateKey(): Promise<CryptoKey> {
  const d = b64UrlDecode(VAPID_PRIVATE);
  const pub = b64UrlDecode(VAPID_PUBLIC);
  // P-256 public key is 65 bytes: 0x04 || X(32) || Y(32)
  const jwk: JsonWebKey = {
    kty: "EC", crv: "P-256",
    d: b64UrlEncode(d),
    x: b64UrlEncode(pub.slice(1, 33)),
    y: b64UrlEncode(pub.slice(33, 65)),
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

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", toArrayBuffer(ikm), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: toArrayBuffer(salt), info: toArrayBuffer(info) },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

/** RFC 8291 aes128gcm encryption of a push payload. */
async function encryptPayload(
  plaintext: Uint8Array,
  uaPublicRaw: Uint8Array,
  authSecret: Uint8Array,
): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const asKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", asKeys.publicKey));

  const uaPublicKey = await crypto.subtle.importKey(
    "raw", toArrayBuffer(uaPublicRaw), { name: "ECDH", namedCurve: "P-256" }, false, [],
  );
  const sharedBits = await crypto.subtle.deriveBits({ name: "ECDH", public: uaPublicKey }, asKeys.privateKey, 256);
  const ecdhSecret = new Uint8Array(sharedBits);

  const enc = new TextEncoder();
  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublicRaw, asPublicRaw);
  const prk = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  const cek = await hkdf(salt, prk, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, prk, enc.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", toArrayBuffer(cek), "AES-GCM", false, ["encrypt"]);
  const record = concat(plaintext, new Uint8Array([0x02])); // final record padding delimiter
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(nonce) }, aesKey, toArrayBuffer(record)),
  );

  // header: salt(16) | rs(4) | idlen(1) | keyid(as public, 65)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublicRaw.length]), asPublicRaw, ciphertext);
}

type PushPayload = { title: string; body: string; url?: string; tag?: string; icon?: string };

type SubRow = { id: string; endpoint: string; p256dh: string | null; auth: string | null };

async function deliver(sub: SubRow, payload: PushPayload): Promise<void> {
  const audience = new URL(sub.endpoint).origin;
  const authHeader = await vapidAuthHeader(audience);
  const headers: Record<string, string> = {
    Authorization: authHeader,
    TTL: "86400",
    Urgency: "normal",
  };

  let body: BodyInit | undefined;
  if (sub.p256dh && sub.auth) {
    const encrypted = await encryptPayload(
      new TextEncoder().encode(JSON.stringify(payload)),
      b64UrlDecode(sub.p256dh),
      b64UrlDecode(sub.auth),
    );
    headers["Content-Encoding"] = "aes128gcm";
    headers["Content-Type"] = "application/octet-stream";
    body = toArrayBuffer(encrypted);
  } else {
    headers["Content-Length"] = "0";
  }

  const res = await fetch(sub.endpoint, { method: "POST", headers, body });
  if (res.status === 404 || res.status === 410) {
    await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
  } else if (!res.ok) {
    console.error(`[push] delivery failed [${res.status}]: ${await res.text()}`);
  }
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  if (userIds.length === 0) return;

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (!subs || subs.length === 0) return;

  await Promise.allSettled(
    (subs as SubRow[]).map((sub) =>
      deliver(sub, payload).catch((e) => console.error("push delivery error", e)),
    ),
  );
}
