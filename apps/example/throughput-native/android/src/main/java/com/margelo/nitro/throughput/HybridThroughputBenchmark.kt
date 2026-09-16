package com.margelo.nitro.throughput

import com.margelo.nitro.camera.HybridCameraControllerSpec
import com.margelo.nitro.core.Promise

class HybridThroughputBenchmark : HybridThroughputBenchmarkSpec() {
  override fun createReporter(options: ThroughputOptions): Promise<HybridThroughputReporterSpec> =
    Promise.parallel {
      val reporter = HybridThroughputReporter(options)
      try {
        reporter.prepare()
        reporter
      } catch (error: Exception) {
        reporter.stop()
        throw error
      }
    }

  override fun configureCamera(controller: HybridCameraControllerSpec): Promise<String> =
    Promise.resolved("Android: default AE/AF/AWB; FPS and resolution negotiated by VisionCamera")
}
