export function StatusPill({ tone = "neutral", children }: { tone?: "neutral" | "ok" | "warn" | "risk"; children: React.ReactNode }) {
  const className =
    tone === "ok"
      ? "border-teal/25 bg-teal/10 text-teal"
      : tone === "warn"
        ? "border-amber/30 bg-amber/10 text-amber"
        : tone === "risk"
          ? "border-rose/30 bg-rose/10 text-rose"
          : "border-line bg-field text-ink";
  return <span className={`inline-flex items-center rounded-[8px] border px-2.5 py-1 text-xs font-bold ${className}`}>{children}</span>;
}
