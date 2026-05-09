// Lightweight structured logger for cross-environment debugging
// Use to trace upload/AI call flows in production where DevTools is unavailable

type Level = 'info' | 'warn' | 'error'

function fmt(feature: string, reqId: string, level: Level, ...rest: unknown[]) {
  const ts = new Date().toISOString()
  const prefix = `[${ts}][${feature}][${reqId}]`
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(prefix, ...rest)
}

export function makeReqId(): string {
  return Math.random().toString(36).slice(2, 8)
}

export function makeLogger(feature: string, reqId: string = makeReqId()) {
  return {
    reqId,
    info:  (...args: unknown[]) => fmt(feature, reqId, 'info', ...args),
    warn:  (...args: unknown[]) => fmt(feature, reqId, 'warn', ...args),
    error: (...args: unknown[]) => fmt(feature, reqId, 'error', ...args),
    /** Time since start of this logger, in ms */
    elapsed: ((start: number) => () => Date.now() - start)(Date.now()),
  }
}

/** Estimate JSON-encoded size in bytes — for uploads we care about post-stringify size */
export function estimateJsonSize(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size
  } catch {
    return -1
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 0) return 'unknown'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`
}
