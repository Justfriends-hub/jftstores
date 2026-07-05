export function UnreadBadge({ count, className = "" }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span
      className={`inline-grid h-5 min-w-5 place-items-center rounded-full bg-[var(--terracotta)] px-1 text-[10px] font-semibold text-[var(--terracotta-foreground)] ${className}`}
      aria-label={`${count} unread`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
