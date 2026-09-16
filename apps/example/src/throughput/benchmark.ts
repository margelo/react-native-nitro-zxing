import type { ThroughputBenchmark } from 'example-throughput-native'
import { NitroModules } from 'react-native-nitro-modules'

export const benchmark = NitroModules.createHybridObject<ThroughputBenchmark>(
  'ThroughputBenchmark',
)
