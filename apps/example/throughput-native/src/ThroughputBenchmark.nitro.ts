import type { HybridObject } from 'react-native-nitro-modules'
import type { CameraController } from 'react-native-vision-camera'
import type { ThroughputReporter } from './ThroughputReporter.nitro'

/** Options for a new benchmark run. */
export interface ThroughputOptions {
  /** Origin of the LAN QR server, without a path. */
  serverURL: string
  /** Number of accepted codes, including the first untimed confirmation. */
  target: number
}

/** Example-only utilities; these are not part of react-native-nitro-zxing. */
export interface ThroughputBenchmark
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /** Resets the server and warms a fresh persistent client before returning it. */
  createReporter(options: ThroughputOptions): Promise<ThroughputReporter>
  /** Applies the PR #3 iOS AE/AF overrides on VisionCamera's own session queue. */
  configureCamera(controller: CameraController): Promise<string>
}
