import type { HybridObject } from 'react-native-nitro-modules'

/** Lifecycle of a {@linkcode ThroughputReporter}. */
export type ThroughputState = 'running' | 'completed' | 'stopped' | 'failed'

/** A native snapshot; UI polling never drives the benchmark clock. */
export interface ThroughputSnapshot {
  state: ThroughputState
  count: number
  elapsedMs: number
  error?: string
}

/** One run's persistent transport and monotonic acknowledgement clock. */
export interface ThroughputReporter
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /** Called directly from the frame worklet. Duplicate values are ignored natively. */
  submit(value: string): void
  /** The first accepted scan is count 1 at t=0, matching NativePHP PR #3. */
  getSnapshot(): ThroughputSnapshot
  /** Cancels outstanding requests and prevents further reports; safe to repeat. */
  stop(): void
}
