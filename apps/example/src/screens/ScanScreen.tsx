import { useIsFocused, useNavigation } from '@react-navigation/native'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import {
  Camera,
  useCameraDevice,
  useFrameOutput,
  usePhotoOutput,
} from 'react-native-vision-camera'
import { useBarcodeScanner } from 'react-native-vision-camera-zxing'
import { scheduleOnRN } from 'react-native-worklets'
import { useIsActive } from '../hooks/useIsActive'

export function ScanScreen() {
  const navigation = useNavigation()
  const device = useCameraDevice('back')
  const isAppActive = useIsActive()
  const isFocused = useIsFocused()
  const isActive = isAppActive && isFocused
  const scanner = useBarcodeScanner({ barcodeFormats: ['all-formats'] })
  const photoOutput = usePhotoOutput({})
  const [liveCodes, setLiveCodes] = useState<string[]>([])
  const [liveInfo, setLiveInfo] = useState('')
  const [photoResult, setPhotoResult] = useState<string>('')
  const [isCapturing, setIsCapturing] = useState(false)

  const onLive = useCallback(
    (codes: string[], timeMs: number, resolution: string) => {
      if (codes.length > 0) setLiveCodes(codes)
      setLiveInfo(`${resolution} - ${timeMs.toFixed(1)}ms`)
    },
    [],
  )

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    onFrame(frame) {
      'worklet'
      const start = performance.now()
      const barcodes = scanner.scanCodes(frame)
      const timeMs = performance.now() - start
      const resolution = `${frame.width}x${frame.height}`
      frame.dispose()
      const codes = barcodes.map(
        (b) => `${b.format}: ${b.displayValue ?? b.rawValue}`,
      )
      scheduleOnRN(onLive, codes, timeMs, resolution)
    },
  })

  const onCaptureAndScan = useCallback(async () => {
    if (isCapturing) return
    setIsCapturing(true)
    setPhotoResult('')
    let step = 'capture'
    try {
      const captureStart = performance.now()
      const photo = await photoOutput.capturePhoto({}, {})
      const captureMs = performance.now() - captureStart
      step = 'toImageAsync'
      const image = await photo.toImageAsync()
      photo.dispose()
      step = `scan ${image.width}x${image.height}`
      const scanStart = performance.now()
      const barcodes = await scanner.scanCodesInImageAsync(image)
      const scanMs = performance.now() - scanStart
      const dims = `${image.width}x${image.height}`
      step = 'dispose'
      image.dispose()
      if (barcodes.length === 0) {
        setPhotoResult(
          `${dims} photo - capture ${captureMs.toFixed(0)}ms, scan ${scanMs.toFixed(1)}ms - no barcodes`,
        )
      } else {
        const list = barcodes
          .map(
            (b) =>
              `${b.format} (${b.valueType}): ${b.displayValue ?? b.rawValue}`,
          )
          .join('\n')
        setPhotoResult(
          `${dims} photo - capture ${captureMs.toFixed(0)}ms, scan ${scanMs.toFixed(1)}ms\n${list}`,
        )
      }
    } catch (error) {
      setPhotoResult(`failed at [${step}]: ${String(error)}`)
    } finally {
      setIsCapturing(false)
    }
  }, [isCapturing, photoOutput, scanner])

  if (device == null) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>No Camera device!</Text>
      </View>
    )
  }

  return (
    <View style={styles.flex}>
      <Camera
        style={styles.flex}
        device={device}
        isActive={isActive}
        outputs={[frameOutput, photoOutput]}
      />

      <View style={styles.liveOverlay}>
        <Text style={styles.badge}>LIVE - zxing</Text>
        <Text style={styles.text} testID="scanned-codes">
          {liveCodes.length === 0 ? 'No barcodes yet' : liveCodes.join('\n')}
        </Text>
        <Text style={styles.info} testID="frame-info">
          {liveInfo}
        </Text>
      </View>

      <View style={styles.bottom}>
        {photoResult !== '' && (
          <Text style={styles.photoResult} testID="photo-result">
            {photoResult}
          </Text>
        )}
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.button, styles.capture]}
            onPress={onCaptureAndScan}
            disabled={isCapturing}
            testID="capture-scan"
          >
            {isCapturing ? (
              <ActivityIndicator color="black" />
            ) : (
              <Text style={styles.captureText}>Take Photo & Scan</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.button, styles.secondary]}
            onPress={() => navigation.navigate('Benchmark')}
            testID="go-benchmark"
          >
            <Text style={styles.secondaryText}>Benchmark</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  liveOverlay: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  badge: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  photoResult: {
    color: '#93c5fd',
    fontSize: 13,
    marginBottom: 12,
  },
  buttonRow: { flexDirection: 'row', gap: 12 },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capture: { flex: 2, backgroundColor: 'white' },
  captureText: { color: 'black', fontSize: 16, fontWeight: '600' },
  secondary: { flex: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  secondaryText: { color: 'white', fontSize: 15 },
  text: { color: 'white', fontSize: 15 },
  info: { color: '#aaa', fontSize: 12, marginTop: 4 },
})
