import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { sendBroadcast } from "@/lib/notifications.functions";

export const Route = createFileRoute("/admin/broadcasts")({
  component: BroadcastsPage,
});

type Target = "everyone" | "customers" | "sellers" | "store";

type Broadcast = {
  id: string; title: string; body: string; target: string;
  recipients_count: number; created_at: string; target_seller_id: string | null;
};

type SellerOpt = { id: string; business_name: string };

function BroadcastsPage() {
  const send = useServerFn(sendBroadcast);
  const [form, setForm] = useState({ title: "", body: "", url: "" });
  const [target, setTarget] = useState<Target>("everyone");
  const [storeId, setStoreId] = useState<string>("");
  const [stores, setStores] = useState<SellerOpt[]>([]);
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [counts, setCounts] = useState({ everyone: 0, customers: 0, sellers: 0 });
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);

  async function loadAll() {
    const [{ data: br }, { data: ss }, { count: ec }, { count: cc }, { count: sc }] = await Promise.all([
      supabase.from("broadcasts").select("id, title, body, target, recipients_count, created_at, target_seller_id").order("created_at", { ascending: false }).limit(50),
      supabase.from("sellers").select("id, business_name").order("business_name"),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "customer"),
      supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "seller"),
    ]);
    setHistory((br ?? []) as Broadcast[]);
    setStores((ss ?? []) as SellerOpt[]);
    setCounts({ everyone: ec ?? 0, customers: cc ?? 0, sellers: sc ?? 0 });
  }
  useEffect(() => { void loadAll(); }, []);

  const estimate = target === "store" ? "?" : counts[target as "everyone" | "customers" | "sellers"];

  async function onSend() {
    setSending(true);
    try {
      const res = await send({
        data: {
          title: form.title.trim(),
          body: form.body.trim(),
          url: form.url.trim() || undefined,
          target,
          targetSellerId: target === "store" ? storeId : null,
        },
      });
      toast.success(`Sent to ${res.recipients} ${res.recipients === 1 ? "user" : "users"}`);
      setForm({ title: "", body: "", url: "" });
      setConfirm(false);
      void loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setSending(false); }
  }

  const canSend = form.title.trim() && form.body.trim() && (target !== "store" || storeId);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-serif text-2xl">Broadcasts</h1>
        <p className="text-sm text-muted-foreground">Send a notification to your users. They'll see it in the bell icon and get a push (if subscribed).</p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={form.title} maxLength={120} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="🎉 New summer collection just dropped" />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea value={form.body} maxLength={800} rows={3} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} placeholder="Check out the new arrivals from our makers…" />
          </div>
          <div>
            <Label>Link (optional)</Label>
            <Input value={form.url} maxLength={500} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="/stores" />
          </div>
          <div>
            <Label>Target audience</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mt-2">
              {([
                { v: "everyone", l: "Everyone", n: counts.everyone },
                { v: "customers", l: "Customers", n: counts.customers },
                { v: "sellers", l: "Store owners", n: counts.sellers },
                { v: "store", l: "Specific store", n: null },
              ] as const).map((o) => (
                <button key={o.v} type="button" onClick={() => setTarget(o.v)}
                  className={`rounded-lg border-2 p-3 text-left text-sm transition ${target === o.v ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30"}`}>
                  <div className="font-medium">{o.l}</div>
                  {o.n !== null && <div className="text-xs text-muted-foreground">{o.n} users</div>}
                </button>
              ))}
            </div>
            {target === "store" && (
              <select className="mt-2 w-full h-10 rounded-md border bg-background px-3 text-sm" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                <option value="">Pick a store…</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.business_name}</option>)}
              </select>
            )}
          </div>

          {form.title && form.body && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">Preview</p>
              <p className="text-sm font-medium">{form.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{form.body}</p>
            </div>
          )}

          <div className="flex justify-end">
            <Button disabled={!canSend || sending} onClick={() => setConfirm(true)} className="rounded-full">
              Send broadcast
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="font-serif text-lg mb-3">History</h2>
        <Card>
          <CardContent className="p-0">
            {history.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No broadcasts sent yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead className="text-right">Reached</TableHead>
                    <TableHead>Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <p className="font-medium">{b.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{b.body}</p>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{b.target}</Badge></TableCell>
                      <TableCell className="text-right">{b.recipients_count}</TableCell>
                      <TableCell className="text-xs">{new Date(b.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this broadcast?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to send to approximately {estimate} {estimate === 1 ? "user" : "users"}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onSend} disabled={sending}>{sending ? "Sending…" : "Send"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
