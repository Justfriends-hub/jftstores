import { Button } from "@/components/ui/button";

export const CONVERSATION_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "negotiating", label: "Negotiating" },
  { key: "price_agreed", label: "Price agreed" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
] as const;

export type ConversationFilter = (typeof CONVERSATION_FILTERS)[number]["key"];

export function ConversationFilters({
  value,
  onChange,
  counts,
}: {
  value: ConversationFilter;
  onChange: (v: ConversationFilter) => void;
  counts: Record<string, number>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CONVERSATION_FILTERS.map((f) => {
        const n = f.key === "all"
          ? Object.values(counts).reduce((a, b) => a + b, 0)
          : (counts[f.key] ?? 0);
        return (
          <Button
            key={f.key}
            type="button"
            size="sm"
            variant={value === f.key ? "default" : "outline"}
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => onChange(f.key)}
          >
            {f.label} <span className="ml-1 opacity-70">{n}</span>
          </Button>
        );
      })}
    </div>
  );
}
