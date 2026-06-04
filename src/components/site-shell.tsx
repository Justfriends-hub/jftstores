import { Link } from "@tanstack/react-router";
import { ShoppingBag, Search, Sun, User, LogOut, Store } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { BRAND } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const { user, isSeller, isAdmin, signOut } = useAuth();
  const { count } = useCart();
  const [q, setQ] = useState("");

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-serif text-lg font-semibold tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--sun)] text-[var(--sun-foreground)] shadow-sm">
            <Sun className="h-5 w-5" />
          </span>
          <span className="hidden sm:inline">{BRAND.name}</span>
          <span className="sm:hidden">{BRAND.short}</span>
        </Link>

        <form
          action="/stores"
          method="get"
          className="ml-auto flex flex-1 max-w-md items-center rounded-full border border-border bg-card pl-3 pr-1 shadow-sm focus-within:ring-2 focus-within:ring-ring"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search stores or products…"
            className="h-10 w-full bg-transparent px-2 text-sm placeholder:text-muted-foreground focus:outline-none"
          />
        </form>

        <nav className="hidden items-center gap-1 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link to="/stores">Browse stores</Link>
          </Button>
        </nav>

        <Link
          to="/cart"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
          aria-label="Cart"
        >
          <ShoppingBag className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--terracotta)] px-1 text-[10px] font-semibold text-[var(--terracotta-foreground)]">
              {count}
            </span>
          )}
        </Link>

        <NotificationBell />

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-xs text-muted-foreground">{user.email}</div>
              <DropdownMenuSeparator />
              {isSeller ? (
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">
                    <Store className="mr-2 h-4 w-4" /> My dashboard
                  </Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem asChild>
                  <Link to="/sell">
                    <Store className="mr-2 h-4 w-4" /> Open a store
                  </Link>
                </DropdownMenuItem>
              )}
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link to="/admin">
                    <Store className="mr-2 h-4 w-4" /> Admin panel
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild variant="default" size="sm" className="hidden sm:inline-flex">
            <Link to="/login">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-background">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-serif text-lg">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--sun)] text-[var(--sun-foreground)]">
              <Sun className="h-4 w-4" />
            </span>
            {BRAND.name}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{BRAND.tagline}</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Shop</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/stores" className="hover:text-foreground">Browse stores</Link></li>
            <li><Link to="/cart" className="hover:text-foreground">Your cart</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Sell with us</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/sell" className="hover:text-foreground">Open a free storefront</Link></li>
            <li><Link to="/login" className="hover:text-foreground">Seller sign in</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">About</h4>
          <p className="mt-3 text-sm text-muted-foreground">
            Built for the makers of Greece. Discover small shops, message them on WhatsApp,
            and check out in one place.
          </p>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {BRAND.name}. Crafted with sun & sea.
      </div>
    </footer>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
