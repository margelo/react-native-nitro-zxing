import { useIsFocused, useNavigation } from '@react-navigation/native'
import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { Image } from 'react-native-nitro-image'
import type { BarcodeScanner as ZXingScanner } from 'react-native-nitro-zxing'
import { useBarcodeScanner as useZXingBarcodeScanner } from 'react-native-nitro-zxing'
import type { Frame } from 'react-native-vision-camera'
import {
  Camera,
  useCameraDevice,
  useFrameOutput,
  usePhotoOutput,
} from 'react-native-vision-camera'
import type { BarcodeScanner as MLKitScanner } from 'react-native-vision-camera-barcode-scanner'
import { useBarcodeScanner as useMLKitBarcodeScanner } from 'react-native-vision-camera-barcode-scanner'
import { scheduleOnRN } from 'react-native-worklets'
import { SampleCollector } from '../bench/collector'
import { loadTestImage } from '../bench/loadTestImage'
import { type Comparison, speedup, verdict } from '../bench/types'
import { useIsActive } from '../hooks/useIsActive'

type Engine = 'zxing' | 'mlkit'
const LIVE_MS_PER_ENGINE = 6000
const IMAGE_REPEATS = 30

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

export function BenchmarkScreen() {
  const navigation = useNavigation()
  const device = useCameraDevice('back')
  const isAppActive = useIsActive()
  const isFocused = useIsFocused()
  const isActive = isAppActive && isFocused
  const zxing = useZXingBarcodeScanner({ barcodeFormats: ['all-formats'] })
  const mlkit = useMLKitBarcodeScanner({ barcodeFormats: ['all-formats'] })
  const photoOutput = usePhotoOutput({})

  const [engine, setEngine] = useState<Engine>('zxing')
  const [phase, setPhase] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [comparisons, setComparisons] = useState<Comparison[]>([])
  const [error, setError] = useState('')
  const live = useRef<{ collector: SampleCollector; active: boolean }>({
    collector: new SampleCollector(),
    active: false,
  })

  const onLiveSample = useCallback(
    (sampleEngine: string, timeMs: number, value: string) => {
      if (!live.current.active) return
      live.current.collector.add(sampleEngine, timeMs, value)
    },
    [],
  )

  const onFrame = useCallback(
    (frame: Frame) => {
      'worklet'
      const scanner = engine === 'zxing' ? zxing : mlkit
      const start = performance.now()
      const barcodes = scanner.scanCodes(frame)
      const timeMs = performance.now() - start
      frame.dispose()
      const value = barcodes
        .map((b) => b.displayValue ?? b.rawValue ?? '')
        .filter((v) => v !== '')
        .sort()
        .join(' | ')
      // Tag every sample with the engine that produced it, so a frame arriving
      // mid-switch can never be counted against the wrong engine.
      scheduleOnRN(onLiveSample, engine, timeMs, value)
    },
    [engine, zxing, mlkit, onLiveSample],
  )

  const frameOutput = useFrameOutput({ pixelFormat: 'yuv', onFrame })

  const scanImage = useCallback(
    async (
      collector: SampleCollector,
      name: Engine,
      scanner: ZXingScanner | MLKitScanner,
      image: Image,
      repeats: number,
    ) => {
      // Warm up so one-time setup is not charged to the first measured scan.
      await scanner.scanCodesInImageAsync(image)
      for (let i = 0; i < repeats; i++) {
        const start = performance.now()
        const barcodes = await scanner.scanCodesInImageAsync(image)
        const timeMs = performance.now() - start
        const value = barcodes
          .map((b) => b.displayValue ?? b.rawValue ?? '')
          .filter((v) => v !== '')
          .sort()
          .join(' | ')
        collector.add(name, timeMs, value)
      }
    },
    [],
  )

  const runAll = useCallback(async () => {
    if (isRunning) return
    setIsRunning(true)
    setComparisons([])
    setError('')
    const results: Comparison[] = []
    try {
      // 1. Live camera frames - each engine gets its own window on the same scene.
      const collector = new SampleCollector()
      live.current = { collector, active: false }
      let resolution = ''
      for (const name of ['zxing', 'mlkit'] as const) {
        setPhase(`Live camera — ${name}`)
        setEngine(name)
        await delay(700) // let the new frame callback take effect
        live.current.active = true
        await delay(LIVE_MS_PER_ENGINE)
        live.current.active = false
        await delay(150)
      }
      resolution = `${frameOutput.currentResolution?.width ?? 0}x${frameOutput.currentResolution?.height ?? 0}`
      results.push({
        title: 'Live camera',
        detail: `${resolution} YUV frames · ${LIVE_MS_PER_ENGINE / 1000}s each`,
        zxing: collector.result('zxing'),
        mlkit: collector.result('mlkit'),
      })
      setComparisons([...results])

      // 2. One photo, scanned by both engines - identical full-resolution input.
      setPhase('Photo capture — taking picture')
      const photo = await photoOutput.capturePhoto({}, {})
      const photoImage = await photo.toImageAsync()
      photo.dispose()
      const photoCollector = new SampleCollector()
      for (const [name, scanner] of [
        ['zxing', zxing],
        ['mlkit', mlkit],
      ] as const) {
        setPhase(`Photo capture — ${name}`)
        await scanImage(photoCollector, name, scanner, photoImage, 3)
      }
      results.push({
        title: 'Photo capture',
        detail: `${photoImage.width}x${photoImage.height} still · 3 scans each`,
        zxing: photoCollector.result('zxing'),
        mlkit: photoCollector.result('mlkit'),
      })
      photoImage.dispose()
      setComparisons([...results])

      // 3. Bundled QR asset - deterministic, identical bytes for both engines.
      setPhase('Bundled image')
      const asset = await loadTestImage(
        require('../assets/qr-code-margelo.png'),
      )
      const assetCollector = new SampleCollector()
      for (const [name, scanner] of [
        ['zxing', zxing],
        ['mlkit', mlkit],
      ] as const) {
        setPhase(`Bundled image — ${name}`)
        await scanImage(assetCollector, name, scanner, asset, IMAGE_REPEATS)
      }
      results.push({
        title: 'Bundled QR image',
        detail: `${asset.width}x${asset.height} PNG · ${IMAGE_REPEATS} scans each`,
        zxing: assetCollector.result('zxing'),
        mlkit: assetCollector.result('mlkit'),
      })
      asset.dispose()
      setComparisons([...results])
      console.log(`[bench-json] ${JSON.stringify(results)}`)
    } catch (e) {
      setError(String(e))
    } finally {
      live.current.active = false
      setPhase('')
      setIsRunning(false)
    }
  }, [isRunning, photoOutput, zxing, mlkit, scanImage, frameOutput])

  if (device == null) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>No Camera device!</Text>
      </View>
    )
  }

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Camera
          style={styles.preview}
          device={device}
          isActive={isActive}
          outputs={[frameOutput, photoOutput]}
        />
        <View style={styles.headerText}>
          <Text style={styles.title}>ZXing vs ML Kit</Text>
          <Text style={styles.subtitle}>
            {isRunning
              ? phase
              : comparisons.length > 0
                ? 'Done — aim at a barcode and run again to re-measure'
                : 'Aim at a barcode, then run the suite'}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.runButton, isRunning && styles.runButtonDisabled]}
          onPress={runAll}
          disabled={isRunning}
          testID="run-benchmark"
        >
          {isRunning ? (
            <ActivityIndicator color="black" />
          ) : (
            <Text style={styles.runText}>Run benchmark</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          testID="bench-back"
        >
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.results}
        contentContainerStyle={styles.resultsInner}
      >
        {error !== '' && <Text style={styles.error}>{error}</Text>}
        {comparisons.length === 0 && !isRunning && (
          <Text style={styles.hint} testID="bench-results">
            The suite measures three inputs: live camera frames, one
            full-resolution photo scanned by both engines, and a bundled QR
            image. Each result shows the decoded value, so a fast-but-wrong
            reader is visible immediately.
          </Text>
        )}
        {comparisons.map((c) => (
          <ComparisonCard key={c.title} comparison={c} />
        ))}
      </ScrollView>
    </View>
  )
}

function ComparisonCard({ comparison }: { comparison: Comparison }) {
  const factor = speedup(comparison)
  const agreement = verdict(comparison)
  const verdictStyle =
    agreement === 'match'
      ? styles.verdictGood
      : agreement === 'none'
        ? styles.verdictNeutral
        : styles.verdictBad
  const verdictText =
    agreement === 'match'
      ? `✓ Both decoded "${comparison.zxing.values.join(' | ')}"`
      : agreement === 'mismatch'
        ? `✗ Different values — zxing "${comparison.zxing.values.join(' | ')}" vs ML Kit "${comparison.mlkit.values.join(' | ')}"`
        : agreement === 'zxing-only'
          ? `⚠︎ Only zxing decoded "${comparison.zxing.values.join(' | ')}"`
          : agreement === 'mlkit-only'
            ? `⚠︎ Only ML Kit decoded "${comparison.mlkit.values.join(' | ')}"`
            : '⚠︎ Neither engine decoded anything — no value to compare'

  return (
    <View style={styles.card} testID={`bench-${comparison.title}`}>
      <Text style={styles.cardTitle}>{comparison.title}</Text>
      <Text style={styles.cardDetail}>{comparison.detail}</Text>
      <View style={styles.cardRow}>
        <EngineCard name="ZXing" result={comparison.zxing} highlight />
        <EngineCard name="ML Kit" result={comparison.mlkit} />
      </View>
      {factor != null && (
        <Text style={styles.speedup}>
          {factor >= 1
            ? `⚡ ZXing ${factor.toFixed(1)}× faster (median)`
            : `ML Kit ${(1 / factor).toFixed(1)}× faster (median)`}
        </Text>
      )}
      <Text style={[styles.verdict, verdictStyle]}>{verdictText}</Text>
    </View>
  )
}

function EngineCard({
  name,
  result,
  highlight,
}: {
  name: string
  result: import('../bench/types').EngineResult
  highlight?: boolean
}) {
  return (
    <View style={[styles.engine, highlight === true && styles.engineHighlight]}>
      <Text style={styles.engineName}>{name}</Text>
      <Text style={styles.engineMedian}>
        {result.stats.samples === 0
          ? '—'
          : `${result.stats.medianMs.toFixed(1)}`}
        <Text style={styles.engineUnit}> ms</Text>
      </Text>
      <Text style={styles.engineMeta}>
        avg {result.stats.avgMs.toFixed(1)} · p95{' '}
        {result.stats.p95Ms.toFixed(1)}
      </Text>
      <Text style={styles.engineMeta}>
        {result.inputs} scans · {(result.detectRate * 100).toFixed(0)}% decoded
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0b0b0d' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0b0b0d',
  },
  header: { flexDirection: 'row', padding: 16, paddingTop: 56, gap: 14 },
  preview: { width: 96, height: 128, borderRadius: 12, overflow: 'hidden' },
  headerText: { flex: 1, justifyContent: 'center' },
  title: { color: 'white', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#9ca3af', fontSize: 13, marginTop: 6 },
  actions: { flexDirection: 'row', paddingHorizontal: 16, gap: 10 },
  runButton: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  runButtonDisabled: { opacity: 0.6 },
  runText: { color: 'black', fontWeight: '600', fontSize: 16 },
  backButton: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  backText: { color: 'white', fontSize: 15 },
  results: { flex: 1, marginTop: 14 },
  resultsInner: { padding: 16, paddingTop: 0, gap: 14 },
  hint: { color: '#6b7280', fontSize: 13, lineHeight: 19 },
  error: { color: '#f87171', fontSize: 13 },
  card: {
    backgroundColor: '#15161a',
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  cardTitle: { color: 'white', fontSize: 17, fontWeight: '600' },
  cardDetail: { color: '#6b7280', fontSize: 12, marginTop: -6 },
  cardRow: { flexDirection: 'row', gap: 10 },
  engine: {
    flex: 1,
    backgroundColor: '#1d1f25',
    borderRadius: 12,
    padding: 12,
  },
  engineHighlight: { borderWidth: 1, borderColor: '#2563eb' },
  engineName: { color: '#9ca3af', fontSize: 12, fontWeight: '600' },
  engineMedian: {
    color: 'white',
    fontSize: 26,
    fontWeight: '700',
    marginTop: 2,
  },
  engineUnit: { fontSize: 13, fontWeight: '400', color: '#9ca3af' },
  engineMeta: { color: '#6b7280', fontSize: 11, marginTop: 2 },
  speedup: { color: '#fbbf24', fontSize: 14, fontWeight: '600' },
  verdict: { fontSize: 12, lineHeight: 17 },
  verdictGood: { color: '#4ade80' },
  verdictBad: { color: '#f87171' },
  verdictNeutral: { color: '#9ca3af' },
})
