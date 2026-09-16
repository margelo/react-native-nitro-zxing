import AVFoundation
import Foundation
import NitroModules
import VisionCamera

final class HybridThroughputBenchmark: HybridThroughputBenchmarkSpec {
  func createReporter(options: ThroughputOptions) throws -> Promise<
    any HybridThroughputReporterSpec
  > {
    return Promise.parallel {
      let reporter = try HybridThroughputReporter(options: options)
      do {
        try reporter.prepare()
        return reporter
      } catch {
        reporter.stop()
        throw error
      }
    }
  }

  func configureCamera(controller: any HybridCameraControllerSpec) throws -> Promise<String> {
    guard let native = controller as? NativeCameraController else {
      throw RuntimeError.error(
        withMessage: "VisionCamera does not expose a native camera controller")
    }
    // This is VisionCamera's session queue, not an unrelated queue racing configuration.
    return Promise.parallel(native.queue) {
      let device = native.captureDevice
      try device.lockForConfiguration()
      defer { device.unlockForConfiguration() }
      var applied: [String] = []
      if device.isExposureModeSupported(.continuousAutoExposure) {
        let requested = CMTime(value: 1, timescale: 250)
        let duration = CMTimeMaximum(
          device.activeFormat.minExposureDuration,
          CMTimeMinimum(requested, device.activeFormat.maxExposureDuration))
        device.activeMaxExposureDuration = duration
        applied.append("AE cap \(duration.seconds * 1000) ms")
      }
      if device.isFocusModeSupported(.continuousAutoFocus) {
        device.focusMode = .continuousAutoFocus
        applied.append("continuous AF")
        if device.isSmoothAutoFocusSupported {
          device.isSmoothAutoFocusEnabled = false
          applied.append("smooth AF off")
        }
        if device.isAutoFocusRangeRestrictionSupported {
          device.autoFocusRangeRestriction = .near
          applied.append("near AF")
        }
      }
      return "iOS: " + applied.joined(separator: ", ")
    }
  }
}
