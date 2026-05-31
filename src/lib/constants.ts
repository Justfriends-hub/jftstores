export const BRAND = {
  name: "Son of Sun Greece",
  short: "JFTS",
  tagline: "Shop small. Live warm. Discover Greece's best small businesses in one place.",
  domain: "sonofsungreece.com",
} as const;

export const STORE_CATEGORIES = [
  "Fashion & Apparel",
  "Beauty & Skincare",
  "Home & Decor",
  "Food & Drink",
  "Art & Crafts",
  "Jewelry",
  "Kids & Baby",
  "Wellness",
  "Other",
] as const;

export type StoreCategory = typeof STORE_CATEGORIES[number];

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
