// What an error report may contain, and which errors are not worth reporting. Pure, so it is tested.

export interface ErrorReport {
  message: string;
  stack: string | null;
  path: string;
  build: string;
  agent: string;
}

/** Network blips and browser noise: expected, and not a bug in the app. */
export function isNoise(message: string): boolean {
  return /ResizeObserver loop|Script error|Failed to fetch|Load failed|NetworkError|network connection was lost|The Internet connection appears to be offline|AbortError|cancelled|Non-Error promise rejection/i.test(message);
}

const cut = (v: unknown, n: number): string => (typeof v === "string" ? v.slice(0, n) : "");

/** Validate and trim a report from the phone. Anything that does not look like one is dropped. */
export function cleanReport(raw: unknown): ErrorReport | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const message = cut(r.message, 300).trim();
  if (!message || isNoise(message)) return null;
  const stack = cut(r.stack, 1500).trim();
  return { message, stack: stack || null, path: cut(r.path, 120), build: cut(r.build, 60), agent: cut(r.agent, 160) };
}
