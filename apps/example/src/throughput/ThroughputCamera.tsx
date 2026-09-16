import type { ThroughputReporter } from 'example-throughput-native'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Platform, StyleSheet } from 'react-native'
import { useBarcodeScanner as useZXingBarcodeScanner } from 'react-native-nitro-zxing'
import {
  type CameraController,
  type CameraSessionConfig,
  type Frame,
  NativePreviewView,
  useCamera,
  useCameraDevice,
  useFrameOutput,
  usePreviewOutput,
} from 'react-native-vision-camera'
import { useBarcodeScanner as useMLKitBarcodeScanner } from 'react-native-vision-camera-barcode-scanner'
import { scheduleOnRN } from 'react-native-worklets'
import { benchmark } from './benchmark'

export type Engine = 'zxing' | 'mlkit'
// Stable across progress renders: both hooks use the array identity to memoize.
const QR_FORMATS: 'qr-code'[] = ['qr-code']
const RESOLUTION =
  Platform.OS === 'android'
    ? { width: 640, height: 480 }
    : { width: 1280, height: 720 }

interface Props {
  reporter: ThroughputReporter
  engine: Engine
  onError: (error: string) => void
  onConfiguration: (settings: string) => void
}

/** Mounted afresh for each run; camera/scanner warm-up ends at the first accepted QR. */
export const ThroughputCamera = memo(function ThroughputCamera({
  reporter,
  engine,
  onError,
  onConfiguration,
}: Props) {
  const device = useCameraDevice('back')
  const zxing = useZXingBarcodeScanner({ barcodeFormats: QR_FORMATS })
  const mlkit = useMLKitBarcodeScanner({ barcodeFormats: QR_FORMATS })
  const [readyController, setReadyController] = useState<CameraController>()
  const [settings, setSettings] = useState('Configuring camera…')
  const [tuning, setTuning] = useState('')
  const previewOutput = usePreviewOutput()

  const onFrame = useCallback(
    (frame: Frame) => {
      'worklet'
      try {
        const scanner = engine === 'zxing' ? zxing : mlkit
        const codes = scanner.scanCodes(frame)
        const value = codes[0]?.rawValue ?? codes[0]?.displayValue
        // No scheduleOnRN/fetch/React state in the successful scan loop.
        if (value != null) reporter.submit(value)
      } catch (error) {
        scheduleOnRN(onError, String(error))
      } finally {
        frame.dispose()
      }
    },
    [engine, zxing, mlkit, reporter, onError],
  )
  const frameOutput = useFrameOutput({
    targetResolution: RESOLUTION,
    pixelFormat: 'yuv',
    dropFramesWhileBusy: true,
    enablePhysicalBufferRotation: false,
    enablePreviewSizedOutputBuffers: false,
    allowDeferredStart: false,
    onFrame,
  })
  const outputs = useMemo(
    () => [previewOutput, frameOutput],
    [previewOutput, frameOutput],
  )
  const constraints = useMemo(
    () => [
      { resolutionBias: frameOutput },
      { fps: 60 },
      { pixelFormat: 'yuv-420-8-bit-full' as const },
    ],
    [frameOutput],
  )
  const onConfig = useCallback((config: CameraSessionConfig) => {
    setSettings(
      `Requested ${RESOLUTION.width}×${RESOLUTION.height} @ 60 FPS; selected ${config.selectedFPS ?? 'automatic'} FPS, ${config.nativePixelFormat}`,
    )
  }, [])
  const cameraError = useCallback(
    (error: Error) => onError(error.message),
    [onError],
  )
  const controller = useCamera({
    device: device ?? 'back',
    outputs,
    constraints,
    isActive: readyController != null,
    onSessionConfigSelected: onConfig,
    onError: cameraError,
  })

  useEffect(() => {
    if (controller == null) return
    let canceled = false
    benchmark
      .configureCamera(controller)
      .then((description) => {
        if (canceled) return
        const size = frameOutput.currentResolution
        setTuning(
          `${description}; output ${size == null ? 'unknown' : `${size.width}×${size.height}`}`,
        )
        setReadyController(controller)
      })
      .catch((error: Error) => {
        if (!canceled) cameraError(error)
      })
    return () => {
      canceled = true
    }
  }, [controller, frameOutput, cameraError])

  useEffect(() => {
    onConfiguration(`${settings}\n${tuning}`)
  }, [settings, tuning, onConfiguration])

  return (
    <NativePreviewView
      style={StyleSheet.absoluteFill}
      previewOutput={previewOutput}
    />
  )
})
