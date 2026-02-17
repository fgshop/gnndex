export type HeadersOrFactory =
  | Record<string, string>
  | (() => Record<string, string> | Promise<Record<string, string>>);

export type SseStreamOptions = {
  url: string;
  headers?: HeadersOrFactory;
  signal: AbortSignal;
  onOpen?: () => void;
  onData: (data: string) => void;
};

export type SseRetryInfo = {
  attempt: number;
  delayMs: number;
  error?: unknown;
};

export type SseBackoffOptions = SseStreamOptions & {
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxRetries?: number;
  onRetry?: (info: SseRetryInfo) => void;
  onGiveUp?: () => void;
};

async function waitFor(ms: number, signal: AbortSignal) {
  if (signal.aborted) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeoutId = window.setTimeout(() => {
      resolve();
    }, ms);

    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeoutId);
        resolve();
      },
      { once: true }
    );
  });
}

async function resolveHeaders(h?: HeadersOrFactory): Promise<Record<string, string>> {
  if (!h) return {};
  if (typeof h === "function") return await h();
  return h;
}

export async function streamSse(options: SseStreamOptions) {
  const resolved = await resolveHeaders(options.headers);
  const response = await fetch(options.url, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      ...resolved
    },
    signal: options.signal
  });

  if (!response.ok || !response.body) {
    throw new Error(`SSE request failed (${response.status})`);
  }

  options.onOpen?.();

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      return;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
      const dataLines = rawEvent
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());
      if (dataLines.length === 0) {
        continue;
      }

      options.onData(dataLines.join("\n"));
    }
  }
}

export async function streamSseWithBackoff(options: SseBackoffOptions) {
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 30000;
  const maxRetries = options.maxRetries ?? Infinity;
  let failures = 0;

  while (!options.signal.aborted) {
    try {
      await streamSse({
        url: options.url,
        headers: options.headers,
        signal: options.signal,
        onOpen: () => {
          failures = 0;
          options.onOpen?.();
        },
        onData: options.onData
      });

      if (options.signal.aborted) {
        return;
      }
    } catch (error) {
      if (options.signal.aborted) {
        return;
      }

      failures += 1;

      if (failures > maxRetries) {
        options.onGiveUp?.();
        return;
      }

      const delayMs = Math.min(baseDelayMs * 2 ** (failures - 1), maxDelayMs);
      options.onRetry?.({ attempt: failures, delayMs, error });
      await waitFor(delayMs, options.signal);
      continue;
    }

    failures += 1;

    if (failures > maxRetries) {
      options.onGiveUp?.();
      return;
    }

    const delayMs = Math.min(baseDelayMs * 2 ** (failures - 1), maxDelayMs);
    options.onRetry?.({ attempt: failures, delayMs });
    await waitFor(delayMs, options.signal);
  }
}
