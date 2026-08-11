import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, MessageCircle, ArrowRight } from "lucide-react";
import { PageShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { NegotiateButton } from "@/components/chat/chat-drawer";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your cart — Just Friends Store" },
      { name: "description", content: "Review your selections from independent shops and check out in one place." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Your cart — Just Friends Store" },
      { property: "og:description", content: "Review your selections from independent shops and check out in one place." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { bySeller, setQty, remove, total, originalTotal, savings, count, clear } = useCart();

  return (
    <PageShell>
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl">Your cart</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {count === 0 ? "Nothing here yet." : `${count} item${count === 1 ? "" : "s"} from ${bySeller.length} shop${bySeller.length === 1 ? "" : "s"}.`}
            </p>
          </div>
          {count > 0 && (
            <button onClick={clear} className="text-xs text-muted-foreground hover:text-foreground">Clear cart</button>
          )}
        </div>

        {count === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-border bg-card p-12 text-center">
            <p className="font-serif text-xl">Your basket is sun-empty</p>
            <p className="mt-2 text-sm text-muted-foreground">Discover shops and add a few treasures.</p>
            <Button asChild className="mt-5 rounded-full">
              <Link to="/stores">Browse stores <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              {bySeller.map((g) => (
                <div key={g.sellerId} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
                    <Link to="/store/$slug" params={{ slug: g.sellerSlug }} className="text-sm font-semibold hover:underline">
                      {g.sellerName}
                    </Link>
                    {g.sellerWhatsApp && (
                      <a
                        href={buildWhatsAppLink({ phone: g.sellerWhatsApp, storeSlug: g.sellerSlug })}
                        target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-95"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    )}
                  </div>
                  <ul className="divide-y divide-border">
                    {g.items.map((it) => {
                      const negotiated = typeof it.negotiatedPrice === "number" && it.negotiatedPrice < it.price;
                      const unit = negotiated ? it.negotiatedPrice! : it.price;
                      return (
                        <li key={it.productId} className="flex gap-4 p-4">
                          <div
                            className="h-20 w-20 shrink-0 rounded-xl bg-muted"
                            style={it.image ? { backgroundImage: `url(${it.image})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold">{it.productName}</div>
                                {negotiated ? (
                                  <div className="text-xs">
                                    <span className="line-through text-muted-foreground">₦{it.price.toLocaleString()}</span>{" "}
                                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">₦{unit.toLocaleString()}</span>
                                  </div>
                                ) : (
                                  <div className="text-xs text-muted-foreground">₦{it.price.toLocaleString()}</div>
                                )}
                              </div>
                              <button onClick={() => remove(it.productId)} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1 rounded-full border border-border">
                                <button onClick={() => setQty(it.productId, it.quantity - 1)} className="grid h-8 w-8 place-items-center hover:bg-muted"><Minus className="h-3.5 w-3.5" /></button>
                                <span className="w-7 text-center text-sm font-semibold">{it.quantity}</span>
                                <button onClick={() => setQty(it.productId, it.quantity + 1)} className="grid h-8 w-8 place-items-center hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button>
                              </div>
                              <div className="text-sm font-semibold">₦{(unit * it.quantity).toLocaleString()}</div>
                            </div>
                            {!negotiated && (
                              <div className="mt-2">
                                <NegotiateButton sellerId={it.sellerId} productId={it.productId} className="h-8 text-xs" label="Negotiate Price 💬" />
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex items-center justify-between border-t border-border bg-muted/30 px-5 py-3 text-sm">
                    <span className="text-muted-foreground">Shop subtotal</span>
                    <span className="font-semibold">₦{g.subtotal.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>

            <aside className="h-fit rounded-2xl border border-border bg-card p-5 md:sticky md:top-24">
              <h2 className="font-serif text-lg">Order summary</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Items</dt><dd>{count}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Shops</dt><dd>{bySeller.length}</dd></div>
                {savings > 0 && (
                  <>
                    <div className="flex justify-between text-xs"><dt className="text-muted-foreground">Original</dt><dd className="line-through">₦{originalTotal.toLocaleString()}</dd></div>
                    <div className="flex justify-between text-xs text-emerald-700 dark:text-emerald-400"><dt>Savings</dt><dd>-₦{savings.toLocaleString()}</dd></div>
                  </>
                )}
                <div className="flex justify-between border-t border-border pt-3 text-base font-semibold"><dt>Total</dt><dd>₦{total.toLocaleString()}</dd></div>
              </dl>
              <Button asChild className="mt-5 w-full rounded-full h-12 text-base" size="lg">
                <Link to="/checkout">
                  {savings > 0 ? `Proceed to Checkout — ₦${total.toLocaleString()}` : "Proceed to checkout"}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <p className="mt-3 text-[11px] text-muted-foreground text-center">
                Secure payment via Paystack. You'll be asked to sign in if you haven't already.
              </p>
            </aside>
          </div>
        )}
      </section>
    </PageShell>
  );
}
