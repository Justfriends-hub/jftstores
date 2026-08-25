# Sunstone Marketplace

Build a multi-vendor marketplace called “Just Friends store. 

You can throw the initials JFTS.”.

You are building a complete MVP. Think creatively and suggest improvements as you build, but prioritize clean, bug-free, glitch-free code above all else. No half-implementations. Every feature you add must work fully before moving to the next.

PLATFORM OVERVIEW

A marketplace where small WhatsApp/Instagram sellers get free storefronts. Customers discover sellers via shared links, shop across multiple stores, and complete one unified checkout — all under the “Son of Sun Greece” brand.

TECH STACK

	•	Next.js (App Router)

	•	Tailwind CSS

	•	Supabase (auth + database + storage)

	•	Stripe (payments)

	•	TypeScript throughout

	•	Shadcn/ui for components

URL STRUCTURE

	•	/ — Homepage

	•	/stores — Browse all stores

	•	/store/[slug] — Individual seller store

	•	/search — Global search

	•	/cart — Cart page

	•	/checkout — Checkout page

	•	/dashboard — Seller dashboard (protected)

	•	/admin — Admin panel (protected)

	•	/login and /register

DATABASE SCHEMA (Supabase)

Create these tables:

users — id, email, full_name, role (customer/seller/admin), whatsapp_number, created_at

sellers — id, user_id (FK), business_name, slug (unique), description, logo_url, banner_url, theme_id, whatsapp_number, status (pending/approved/suspended), category, created_at

themes — id, name, preview_image_url, css_config (JSON)

products — id, seller_id (FK), name, description, price, images (array), stock, category, variants (JSON), is_active, created_at

cart_items — id, session_id or user_id, product_id (FK), seller_id (FK), quantity, created_at

orders — id, customer_id (FK), total_amount, status (pending/paid/fulfilled/cancelled), stripe_payment_id, created_at

order_items — id, order_id (FK), seller_id (FK), product_id (FK), quantity, price_at_purchase

store_visits — id, seller_id, visited_at, source (direct/whatsapp/search)

USER ROLES & AUTH

	•	Supabase Auth with email/password

	•	Role stored in users table

	•	Protected routes: dashboard (seller only), admin (admin only)

	•	Guests can browse and add to cart using session ID stored in localStorage

HOMEPAGE (/)

	•	Full “Son of Sun Greece” branded hero section — warm Mediterranean aesthetic, sun motifs, clean and premium feel

	•	Tagline: “Shop small. Live warm. Discover Greece’s best small businesses in one place.”

	•	CTA buttons: “Browse Stores” and “Start Your Free Store”

	•	Featured stores section (curated by admin)

	•	How it works section (3 steps for customers, 3 steps for sellers)

	•	Footer with platform links

STORE PAGE (/store/[slug]) — CRITICAL RULES

This is the most important page. Follow these rules strictly:

	1.	Global header stays at the top always — “Son of Sun Greece” logo, search bar, cart icon with item count

	2.	Below global header: seller’s own store renders fully — their banner, logo, business name, description, their theme colors and layout, their products in a grid

	3.	Each store is its own world — do NOT show other sellers’ products on this page

	4.	Product cards on the store page show: image, name, price, “Add to Cart” button, “Chat on WhatsApp” button (opens WhatsApp with pre-filled message including product name and “via Son of Sun Greece”)

	5.	At the very bottom of the store page, after all products, add a clearly separated section: a single button — “🛍️ Check Out Other Stores” — that links to /stores. Style it attractively but make it feel like an exit point, not part of the store itself. It should feel like a gentle platform nudge, not the seller’s content.

	6.	No store content from other sellers bleeds into this page at all

BROWSE STORES PAGE (/stores)

	•	Grid of store cards: banner thumbnail, logo, business name, category, short description, “Visit Store” button

	•	Filter by category

	•	Search stores by name

	•	Show approved sellers only

GLOBAL CART

	•	Cart persists across all store pages

	•	Stored in Supabase for logged-in users, localStorage for guests

	•	Items from multiple sellers can exist in cart simultaneously

	•	Cart icon in header shows live item count

	•	Cart page groups items by seller with subtotals per seller + grand total

CHECKOUT

	•	Single checkout page

	•	Items grouped by seller clearly

	•	Stripe payment integration

	•	Guest checkout allowed (email required)

	•	On success: order created in DB, confirmation page shown, each involved seller gets notified (use Supabase edge function or email)

SELLER DASHBOARD (/dashboard)

	•	Store setup wizard on first login (business name, slug, description, logo, banner, category, theme picker)

	•	Theme picker: show 6–8 pre-built theme previews, seller clicks to apply

	•	Product management: add/edit/delete products, multiple image upload, stock management, variants

	•	Orders section: view incoming orders, mark as fulfilled

	•	Basic analytics: total views, total sales, top products

	•	WhatsApp link generator: generates a pre-filled WhatsApp message with their store link

	•	Store preview button: “Preview My Store”

ADMIN PANEL (/admin)

	•	Seller approval queue (approve/suspend sellers)

	•	All orders overview

	•	Platform-wide analytics

	•	Featured stores management (pick which stores show on homepage)

	•	Simple content moderation tools

THEME SYSTEM

Build 6 starter themes with distinct personalities:

	1.	Aegean Blue — deep blues, white, minimal

	2.	Santorini White — pure white, gold accents, airy

	3.	Olive Grove — earthy greens, warm beige

	4.	Sunset Terracotta — terracotta, burnt orange, warm

	5.	Midnight Athens — dark mode, deep navy, silver

	6.	Bloom — soft pink, floral, feminine

Each theme affects: store banner style, product card style, color palette, font pairing. Global header stays unchanged regardless of theme.

WHATSAPP INTEGRATION

Every product has a “Chat on WhatsApp” button. When clicked, opens:

https://wa.me/[seller_whatsapp]?text=Hi! I'm interested in [product name] — I found it on Son of Sun Greece: sonofsungreece.com/store/[slug]

DESIGN PRINCIPLES

	•	Mobile-first. Most users arrive from WhatsApp on phones.

	•	Warm Mediterranean palette for the main platform (sun golds, ocean blues, warm whites)

	•	Each seller’s theme is their own but always inside the global shell

	•	Fast loading — optimize images, lazy load product grids

	•	Accessible — proper contrast, alt text, focus states

CODE QUALITY RULES — NON-NEGOTIABLE

	•	No unused imports, variables, or dead code

	•	Every async operation must have proper error handling

	•	No TypeScript any types — define all interfaces properly

	•	Loading states on every data-fetching component

	•	Empty states on every list/grid (e.g., “No products yet”)

	•	Form validation on every form

	•	No console.log left in production code

	•	Components must be properly separated — no 500-line files

	•	Test every user flow mentally before implementing — if a step can break, handle it

BUILD ORDER

Build in this exact order so everything integrates cleanly:

	1.	Supabase setup + all tables + RLS policies

	2.	Auth (register/login/roles)

	3.	Homepage

	4.	Browse Stores page

	5.	Store page (the critical one — build this perfectly)

	6.	Global cart logic

	7.	Checkout + Stripe

	8.	Seller dashboard

	9.	Admin panel

	10.	Polish: loading states, empty states, error boundaries, mobile optimization

FINAL INSTRUCTION TO LOVABLE

You are encouraged to suggest improvements, add thoughtful UX details, and make design decisions where the spec leaves room. But every feature must be complete and working before moving on. No placeholders. No TODO comments in final code. Clean, production-ready output only.

Paste that in and let it run. Come back when it generates the first version so we can review and give it the next round of instructions.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://jftstores.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/40283be6-ce6d-4540-af5d-45d59414f7c8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
