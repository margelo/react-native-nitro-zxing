export interface LatencyStats {
  samples: number
  avgMs: number
  medianMs: number
  p95Ms: number
  minMs: number
  maxMs: number
}

export function computeStats(samples: number[]): LatencyStats {
  const sorted = [...samples].sort((a, b) => a - b)
  const at = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0
  const sum = sorted.reduce((a, b) => a + b, 0)
  return {
    samples: sorted.length,
    avgMs: sorted.length === 0 ? 0 : sum / sorted.length,
    medianMs: at(0.5),
    p95Ms: at(0.95),
    minMs: sorted[0] ?? 0,
    maxMs: sorted[sorted.length - 1] ?? 0,
  }
}

export function formatStats(name: string, stats: LatencyStats): string {
  return `${name}: n=${stats.samples} avg=${stats.avgMs.toFixed(2)}ms median=${stats.medianMs.toFixed(2)}ms p95=${stats.p95Ms.toFixed(2)}ms min=${stats.minMs.toFixed(2)}ms max=${stats.maxMs.toFixed(2)}ms`
}
