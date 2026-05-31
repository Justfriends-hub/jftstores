import { BRAND } from "./constants";

/**
 * Builds a wa.me link with pre-filled message.
 * Normalizes the phone number by stripping non-digits.
 */
export function buildWhatsAppLink(opts: {
  phone: string;
  productName?: string;
  storeSlug?: string;
}): string {
  const digits = opts.phone.replace(/[^\d]/g, "");
  const parts: string[] = ["Hi!"];
  if (opts.productName) {
    parts.push(`I'm interested in ${opts.productName}`);
  } else {
    parts.push("I'd love to chat about your store");
  }
  if (opts.storeSlug) {
    parts.push(
      `— I found it on ${BRAND.name}: ${BRAND.domain}/store/${opts.storeSlug}`
    );
  } else {
    parts.push(`— via ${BRAND.name}`);
  }
  const text = encodeURIComponent(parts.join(" "));
  return `https://wa.me/${digits}?text=${text}`;
}
