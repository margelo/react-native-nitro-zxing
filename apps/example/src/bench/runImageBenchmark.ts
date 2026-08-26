import type { Image } from 'react-native-nitro-image'
import type { BarcodeScanner as MLKitScanner } from 'react-native-vision-camera-barcode-scanner'
import type { BarcodeScanner as ZXingScanner } from 'react-native-vision-camera-zxing'
import { computeStats, type LatencyStats } from './stats'

export interface ImageBenchmarkResult {
  engine: string
  stats: LatencyStats
  decoded: string[]
  cornerPoints: string
}

const WARMUP = 5
const ITERATIONS = 50

export async function runImageBenchmark(
  engine: string,
  scanner: ZXingScanner | MLKitScanner,
  image: Image,
): Promise<ImageBenchmarkResult> {
  for (let i = 0; i < WARMUP; i++) {
    await scanner.scanCodesInImageAsync(image)
  }
  const samples: number[] = []
  let decoded: string[] = []
  let cornerPoints = ''
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now()
    const barcodes = await scanner.scanCodesInImageAsync(image)
    samples.push(performance.now() - start)
    decoded = barcodes.map(
      (b) => `${b.format}: ${b.displayValue ?? b.rawValue}`,
    )
    cornerPoints = JSON.stringify(barcodes[0]?.cornerPoints ?? [])
  }
  return { engine, stats: computeStats(samples), decoded, cornerPoints }
}
