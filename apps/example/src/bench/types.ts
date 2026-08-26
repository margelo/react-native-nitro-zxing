import type { LatencyStats } from './stats'

export interface EngineResult {
  stats: LatencyStats
  /** Distinct decoded values, most frequent first. Empty when nothing was decoded. */
  values: string[]
  /** Share of scanned inputs that produced at least one barcode, 0..1. */
  detectRate: number
  /** Inputs scanned (frames, or repetitions for a still image). */
  inputs: number
}

export interface Comparison {
  title: string
  detail: string
  zxing: EngineResult
  mlkit: EngineResult
}

export function speedup(c: Comparison): number | undefined {
  if (c.zxing.stats.samples === 0 || c.mlkit.stats.samples === 0)
    return undefined
  if (c.zxing.stats.medianMs === 0) return undefined
  return c.mlkit.stats.medianMs / c.zxing.stats.medianMs
}

/**
 * A benchmark is only meaningful if both engines read the same thing, so the
 * comparison reports whether their decoded values agree.
 */
export type Verdict =
  | 'match'
  | 'mismatch'
  | 'zxing-only'
  | 'mlkit-only'
  | 'none'

export function verdict(c: Comparison): Verdict {
  const z = c.zxing.values.join(' | ')
  const m = c.mlkit.values.join(' | ')
  if (z === '' && m === '') return 'none'
  if (z === '') return 'mlkit-only'
  if (m === '') return 'zxing-only'
  return z === m ? 'match' : 'mismatch'
}
