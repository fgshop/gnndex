type StreamStatusBadgeProps = {
  connected: boolean;
  className?: string;
  connectedLabel?: string;
  disconnectedLabel?: string;
};

export function StreamStatusBadge({
  connected,
  className = "",
  connectedLabel = "SSE live stream",
  disconnectedLabel = "Polling fallback (15s)"
}: StreamStatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        connected
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
          : "border-amber-500/30 bg-amber-500/10 text-amber-500",
        className
      ].join(" ")}
    >
      {connected ? connectedLabel : disconnectedLabel}
    </span>
  );
}
