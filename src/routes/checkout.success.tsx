import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { PageShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { getOrderSummary } from "@/lib/checkout.functions";

export const Route = createFileRoute("/checkout/success")({
  validateSearch: (s: Record<string, unknown>) => ({ order: typeof s.order === "string" ? s.order : "" }),
  head: () => ({ meta: [{ title: "Order confirmed — Just Friends Store" }] }),
  component: SuccessPage,
});

type Summary = Awaited<ReturnType<typeof getOrderSummary>>;

function SuccessPage() {
  const { order: orderId } = useSearch({ from: "/checkout/success" });
  const fetchSummary = useServerFn(getOrderSummary);
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) { setErr("Missing order reference"); return; }
    void fetchSummary({ data: { orderId } })
      .then(setData)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Could not load order"));
  }, [orderId, fetchSummary]);

  return (
    <PageShell>
      <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-serif text-3xl">Thank you!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your payment was confirmed. The shop owners have been notified and will reach out to arrange delivery.
          </p>

          {err && <p className="mt-6 text-sm text-destructive">{err}</p>}

          {data && (
            <div className="mt-6 text-left">
              <div className="rounded-2xl border border-border p-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Order ID</span><span className="font-mono text-xs">{data.order.id.slice(0, 8)}…</span></div>
                <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono text-xs">{data.order.payment_reference}</span></div>
                <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Total paid</span><span className="font-semibold">₦{Number(data.order.total_amount).toLocaleString()}</span></div>
              </div>
              <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
                {data.items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{it.product_name}</div>
                      <div className="text-xs text-muted-foreground">× {it.quantity}</div>
                    </div>
                    <div className="font-semibold">₦{(Number(it.price_at_purchase) * it.quantity).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild className="rounded-full"><Link to="/stores">Keep shopping <ArrowRight className="ml-1.5 h-4 w-4" /></Link></Button>
            <Button asChild variant="outline" className="rounded-full"><Link to="/">Back home</Link></Button>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
