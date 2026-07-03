import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { PAYSTACK_PUBLIC_KEY } from "@/lib/paystack-config";
import { verifyPaystackAndCreateOrder, computeVerifiedTotal } from "@/lib/checkout.functions";
import { NegotiateButton } from "@/components/chat/chat-drawer";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Just Friends Store" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { items, total, originalTotal, savings, count, bySeller, clear } = useCart();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const verify = useServerFn(verifyPaystackAndCreateOrder);
  const computeTotal = useServerFn(computeVerifiedTotal);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    setEmail((e) => e || user.email || "");
    setName((n) => n || (user.user_metadata?.full_name as string) || "");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && user && count === 0 && !paying) {
      // empty cart — bounce back
      navigate({ to: "/cart", replace: true });
    }
  }, [count, loading, user, paying, navigate]);

  async function handlePay() {
    if (!name.trim() || !email.trim() || !phone.trim()) {
      toast.error("Please fill in your name, email and phone number");
      return;
    }
    if (count === 0) return;
    setPaying(true);
    try {
      // Get server-verified total (applies accepted negotiations, ignores expired)
      const { total: verifiedTotal } = await computeTotal({
        data: {
          items: items.map((i) => ({
            productId: i.productId, sellerId: i.sellerId, productName: i.productName,
            price: i.price, quantity: i.quantity, negotiationId: i.negotiationId ?? null,
          })),
        },
      });
      const { default: PaystackPop } = await import("@paystack/inline-js");
      const ref = `JFS-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const paystack = new PaystackPop();
      paystack.newTransaction({
        key: PAYSTACK_PUBLIC_KEY,
        email: email.trim(),
        amount: Math.round(verifiedTotal * 100),
        currency: "NGN",
        reference: ref,
        firstName: name.trim(),
        phone: phone.trim(),
        onSuccess: (tx: { reference: string }) => {
          void (async () => {
            try {
              const res = await verify({
                data: {
                  reference: tx.reference,
                  customerName: name.trim(),
                  customerEmail: email.trim(),
                  customerPhone: phone.trim(),
                  items: items.map((i) => ({
                    productId: i.productId,
                    sellerId: i.sellerId,
                    productName: i.productName,
                    price: i.price,
                    quantity: i.quantity,
                    negotiationId: i.negotiationId ?? null,
                  })),
                },
              });
              clear();
              toast.success("Payment confirmed");
              navigate({ to: "/checkout/success", search: { order: res.orderId ?? "" } });
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not verify payment");
              setPaying(false);
            }
          })();
        },
        onCancel: () => {
          toast("Payment cancelled");
          setPaying(false);
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start payment");
      setPaying(false);
    }
  }

  if (loading) return <PageShell><div className="mx-auto max-w-5xl px-4 py-12">Loading…</div></PageShell>;

  return (
    <PageShell>
      <section className="mx-auto max-w-5xl px-4 py-8 sm:py-12 sm:px-6 pb-32 md:pb-12">
        <Link to="/cart" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to cart
        </Link>
        <h1 className="mt-3 font-serif text-3xl sm:text-4xl">Checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground">Secure payment powered by Paystack.</p>

        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_360px]">
          {/* Order summary - shows first on mobile */}
          <aside className="order-1 md:order-2 h-fit rounded-2xl border border-border bg-card p-5">
            <h2 className="font-serif text-lg">Order summary</h2>
            <div className="mt-4 space-y-4 max-h-[50vh] overflow-y-auto">
              {bySeller.map((g) => (
                <div key={g.sellerId} className="border-b border-border pb-3 last:border-0">
                  <div className="text-xs font-semibold text-muted-foreground">{g.sellerName}</div>
                  <ul className="mt-2 space-y-3">
                    {g.items.map((it) => {
                      const negotiated = typeof it.negotiatedPrice === "number" && it.negotiatedPrice < it.price;
                      const line = (negotiated ? it.negotiatedPrice! : it.price) * it.quantity;
                      return (
                        <li key={it.productId} className="flex gap-3 text-sm">
                          <div
                            className="h-12 w-12 shrink-0 rounded-lg bg-muted"
                            style={it.image ? { backgroundImage: `url(${it.image})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{it.productName}</div>
                            {negotiated ? (
                              <>
                                <div className="text-xs text-muted-foreground line-through">₦{(it.price * it.quantity).toLocaleString()}</div>
                                <div className="text-xs text-emerald-700 dark:text-emerald-400">-₦{((it.price - it.negotiatedPrice!) * it.quantity).toLocaleString()}</div>
                                <div className="text-sm font-semibold">× {it.quantity} · ₦{line.toLocaleString()}</div>
                              </>
                            ) : (
                              <div className="text-xs text-muted-foreground">× {it.quantity} · ₦{line.toLocaleString()}</div>
                            )}
                            {!negotiated && (
                              <div className="mt-1.5">
                                <NegotiateButton sellerId={it.sellerId} productId={it.productId} className="h-8 text-xs px-3" label="Negotiate Price 💬" />
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-2 flex justify-between text-xs">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold">₦{g.subtotal.toLocaleString()}</span>
                  </div>
                  {g.savings > 0 && (
                    <div className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                      You saved ₦{g.savings.toLocaleString()} here 🎉
                    </div>
                  )}
                </div>
              ))}
            </div>
            {savings > 0 && (
              <div className="mt-3 text-xs text-emerald-700 dark:text-emerald-400 text-right">
                Total savings: -₦{savings.toLocaleString()} 🎉
              </div>
            )}
            <div className="mt-2 flex items-baseline justify-between border-t border-border pt-3">
              <span className="text-sm text-muted-foreground">Grand total</span>
              <div className="text-right">
                {savings > 0 && <div className="text-xs text-muted-foreground line-through">₦{originalTotal.toLocaleString()}</div>}
                <span className="font-serif text-2xl">₦{total.toLocaleString()}</span>
              </div>
            </div>
          </aside>

          {/* Customer details */}
          <div className="order-2 md:order-1 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="font-serif text-lg">Your details</h2>
            <p className="mt-1 text-xs text-muted-foreground">Sellers use these to confirm and ship your order.</p>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Adaeze Okeke" autoComplete="name" className="mt-1 h-11" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className="mt-1 h-11" />
              </div>
              <div>
                <Label htmlFor="phone">Phone number</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 800 000 0000" autoComplete="tel" className="mt-1 h-11" />
              </div>
            </div>

            <Button
              onClick={handlePay}
              disabled={paying || count === 0}
              size="lg"
              className="mt-6 hidden md:flex w-full rounded-full text-base"
            >
              {paying ? "Processing…" : `Pay ₦${total.toLocaleString()} with Paystack`}
            </Button>
            <p className="mt-3 hidden md:flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Encrypted · verified server-side
            </p>
          </div>
        </div>
      </section>

      {/* Sticky pay button on mobile */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <Button
          onClick={handlePay}
          disabled={paying || count === 0}
          size="lg"
          className="w-full rounded-full text-base h-12"
        >
          {paying ? "Processing…" : `Pay ₦${total.toLocaleString()}`}
        </Button>
      </div>
    </PageShell>
  );
}
