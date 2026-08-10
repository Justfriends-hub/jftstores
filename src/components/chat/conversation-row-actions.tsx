import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send, CheckCircle2, XCircle, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConversationActivity } from "@/components/chat/conversation-activity";
import { sendMessage, setConversationStatus } from "@/lib/chat.functions";


type Status = "active" | "negotiating" | "price_agreed" | "resolved" | "closed";

export function ConversationRowActions({
  conversationId,
  status,
  onChanged,
}: {
  conversationId: string;
  status: Status;
  onChanged?: () => void;
}) {
  const send = useServerFn(sendMessage);
  const setStatus = useServerFn(setConversationStatus);
  const [reply, setReply] = useState("");
  const [replyOpen, setReplyOpen] = useState(false);
  const [busy, setBusy] = useState<"reply" | "resolve" | "close" | "reopen" | null>(null);

  const isClosed = status === "closed";
  const isResolved = status === "resolved";

  async function submitReply(e: React.FormEvent | React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const t = reply.trim();
    if (!t) return;
    setBusy("reply");
    try {
      await send({ data: { conversationId, content: t } });
      setReply("");
      setReplyOpen(false);
      toast.success("Reply sent");
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send");
    } finally { setBusy(null); }
  }

  async function change(next: "active" | "resolved" | "closed", key: typeof busy) {
    setBusy(key);
    try {
      await setStatus({ data: { conversationId, status: next } });
      toast.success(
        next === "resolved" ? "Marked as resolved" :
        next === "closed" ? "Conversation closed" : "Conversation reopened",
      );
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally { setBusy(null); }
  }

  // Stop the outer <button> from capturing our clicks.
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5" onClick={stop}>
      {!isClosed && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 rounded-full px-3 text-xs"
          onClick={(e) => { stop(e); setReplyOpen((v) => !v); }}
        >
          <Send className="mr-1 h-3 w-3" /> Reply
        </Button>
      )}
      {!isResolved && !isClosed && (
        <Button
          type="button" size="sm" variant="outline"
          className="h-8 rounded-full px-3 text-xs"
          disabled={busy === "resolve"}
          onClick={(e) => { stop(e); void change("resolved", "resolve"); }}
        >
          {busy === "resolve" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
          Resolve
        </Button>
      )}
      {!isClosed && (
        <Button
          type="button" size="sm" variant="outline"
          className="h-8 rounded-full px-3 text-xs"
          disabled={busy === "close"}
          onClick={(e) => { stop(e); void change("closed", "close"); }}
        >
          {busy === "close" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <XCircle className="mr-1 h-3 w-3" />}
          Close
        </Button>
      )}
      {(isClosed || isResolved) && (
        <Button
          type="button" size="sm" variant="outline"
          className="h-8 rounded-full px-3 text-xs"
          disabled={busy === "reopen"}
          onClick={(e) => { stop(e); void change("active", "reopen"); }}
        >
          {busy === "reopen" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1 h-3 w-3" />}
          Reopen
        </Button>
      )}

      {replyOpen && !isClosed && (
        <form onSubmit={submitReply} onClick={stop} className="mt-1 flex w-full gap-2">
          <Input
            autoFocus
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onClick={stop}
            placeholder="Type a quick reply…"
            className="h-9"
          />
          <Button type="submit" size="sm" className="h-9 rounded-full px-3" disabled={busy === "reply" || !reply.trim()}>
            {busy === "reply" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </form>
      )}
    </div>
  );
}
