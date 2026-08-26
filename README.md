# react-native-vision-camera-zxing

Barcode scanning for [VisionCamera](https://github.com/mrousavy/react-native-vision-camera) v5, powered by [zxing-cpp](https://github.com/zxing-cpp/zxing-cpp) and implemented as pure C++ [Nitro](https://github.com/mrousavy/nitro) HybridObjects. The camera's luminance plane is decoded in place - no ML Kit, no base64, no temp files.

```sh
npm install react-native-vision-camera-zxing react-native-vision-camera react-native-nitro-modules react-native-nitro-image
```

```ts
import { useFrameOutput } from 'react-native-vision-camera'
import { useBarcodeScanner } from 'react-native-vision-camera-zxing'

const scanner = useBarcodeScanner({ barcodeFormats: ['all-formats'] })
const frameOutput = useFrameOutput({
  pixelFormat: 'yuv',
  onFrame(frame) {
    'worklet'
    const barcodes = scanner.scanCodes(frame)
    frame.dispose()
  },
})
```

The API mirrors `react-native-vision-camera-barcode-scanner` (`Barcode`, `BarcodeScanner`, `useBarcodeScanner`, `createBarcodeScanner`) - a drop-in swap of the decoder. The `CameraOutput` variant is not included yet.

## Repository

- `packages/react-native-vision-camera-zxing` - the library (`cpp/` C++ HybridObjects, `cpp/zxing-core` zxing-cpp git submodule)
- `apps/example` - example + benchmark app

```sh
git clone --recursive https://github.com/margelo/react-native-vision-camera-zxing
bun install
bun specs      # nitrogen codegen
bun example android
bun example ios
```

## Benchmarks

ML Kit (`react-native-vision-camera-barcode-scanner`) vs this package, measured with the example
app's **Benchmark** screen on a **Samsung SM-E146B (Android 15, arm64), release build**, both engines
configured identically (`barcodeFormats: ['all-formats']`) and fed the *same* inputs. Every row is
value-verified: the benchmark records what each engine decoded and only reports a comparison when
both agree.

| Input | zxing | ML Kit | |
|---|---|---|---|
| Live camera frames (1280×720 YUV) | **13.1 ms** | 34.4 ms | **2.6× faster** |
| Photo capture (3060×4080 still) | **21.7 ms** | 59.3 ms | **2.7× faster** |
| Bundled QR image (256×256 PNG) | **0.95 ms** | 9.7 ms | **10.2× faster** |

Median per scan; both engines decoded identical values at a 100% detection rate in every row.
zxing also ships a 1.3 MB `.so` and has no runtime model download — ML Kit fetches its scanner
model on first use.

### How it stays fast

Decoding cost scales with the number of pixels scanned and with how many heuristics are enabled,
so the decoder runs an **escalating ladder**: the cheapest configuration first, and a more
expensive one only if the previous attempt found nothing. Concretely:

- **Stills** are scaled down through the platform's own image scaler before scanning — a 12 MP
  capture carries far more detail than a barcode needs, and Google's own ML Kit guidance says not
  to feed a detector native-resolution captures. Corner points are mapped back to the original
  image, so callers still get coordinates in the image they passed in.
- **Live frames** skip the expensive rotation-aware pass on most frames and run it periodically
  instead, so the per-frame cost stays close to the cheap scan while rotated codes are still
  picked up within a few frames.
- One multi-format scan per attempt, rather than several per-symbology scans: zxing shares a
  single binarization across formats, so splitting the work up costs more, not less.
