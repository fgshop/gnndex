import type { SseRetryInfo } from "@/lib/sse-stream";

type StreamReconnectNoticeProps = {
  retryInfo: SseRetryInfo | null;
  className?: string;
};

export function StreamReconnectNotice({ retryInfo, className = "" }: StreamReconnectNoticeProps) {
  if (!retryInfo) {
    return null;
  }

  const seconds = Math.max(1, Math.round(retryInfo.delayMs / 1000));

  return (
    <div
      className={[
        "rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-500",
        className
      ].join(" ")}
    >
      Stream reconnecting (attempt {retryInfo.attempt}). Next retry in {seconds}s.
    </div>
  );
}
