export const BRAND = {
  name: "JFT STORES — MARKETPLACE",
  short: "JFT STORES",
  tagline: "Highly Recommended — Join our active community and shop from verified independent stores. Many stores, one cart.",
  domain: "jftstores.lovable.app",
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
