import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listConversationActivity } from "@/lib/chat.functions";

type Entry = { id: string; content: string; createdAt: string; byMe: boolean };

export function ConversationActivity({ conversationId }: { conversationId: string }) {
  const load = useServerFn(listConversationActivity);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || rows) return;
    let cancelled = false;
    setLoading(true);
    load({ data: { conversationId } })
      .then((d) => { if (!cancelled) setRows(d as Entry[]); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, rows, conversationId, load]);

  return (
    <div className="w-full" onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 rounded-full px-3 text-xs text-muted-foreground"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >
        <History className="mr-1 h-3 w-3" /> {open ? "Hide history" : "History"}
      </Button>
      {open && (
        <div className="mt-1 rounded-md border border-border bg-muted/30 p-3 text-xs">
          {loading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading history…</div>}
          {!loading && rows && rows.length === 0 && (
            <div className="text-muted-foreground">No status changes yet.</div>
          )}
          {!loading && rows && rows.length > 0 && (
            <ol className="space-y-1.5">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>{r.byMe ? "You — " : ""}{r.content}</span>
                  <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
