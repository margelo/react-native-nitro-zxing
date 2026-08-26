import { computeStats } from './stats'
import type { EngineResult } from './types'

interface EngineSamples {
  timings: number[]
  values: Map<string, number>
  hits: number
  scans: number
}

/**
 * Collects per-scan timings and decoded values, keyed by the engine that produced them.
 * Samples carry their own engine tag so results stay correct even if a sample arrives
 * while the UI is switching engines.
 */
export class SampleCollector {
  private readonly engines = new Map<string, EngineSamples>()

  private forEngine(engine: string): EngineSamples {
    const existing = this.engines.get(engine)
    if (existing != null) return existing
    const created: EngineSamples = {
      timings: [],
      values: new Map(),
      hits: 0,
      scans: 0,
    }
    this.engines.set(engine, created)
    return created
  }

  add(engine: string, timeMs: number, value: string): void {
    const samples = this.forEngine(engine)
    samples.timings.push(timeMs)
    samples.scans += 1
    if (value !== '') {
      samples.hits += 1
      samples.values.set(value, (samples.values.get(value) ?? 0) + 1)
    }
  }

  result(engine: string): EngineResult {
    const samples = this.engines.get(engine)
    if (samples == null) {
      return { stats: computeStats([]), values: [], detectRate: 0, inputs: 0 }
    }
    const values = [...samples.values.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value]) => value)
    return {
      stats: computeStats(samples.timings),
      values,
      detectRate: samples.scans === 0 ? 0 : samples.hits / samples.scans,
      inputs: samples.scans,
    }
  }
}
