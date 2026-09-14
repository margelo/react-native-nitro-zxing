# react-native-nitro-zxing

Barcode scanning for [VisionCamera](https://github.com/mrousavy/react-native-vision-camera) v5, powered by [zxing-cpp](https://github.com/zxing-cpp/zxing-cpp) and implemented as pure C++ [Nitro](https://github.com/mrousavy/nitro) HybridObjects. The camera's luminance plane is decoded in place - no ML Kit, no base64, no temp files.

```sh
npm install react-native-nitro-zxing react-native-vision-camera react-native-nitro-modules react-native-nitro-image
```

```ts
import { useFrameOutput } from 'react-native-vision-camera'
import { useBarcodeScanner } from 'react-native-nitro-zxing'

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

The API is similar to `react-native-vision-camera-barcode-scanner` .


## Benchmarks


| Input | zxing | ML Kit | |
|---|---|---|---|
| Live camera frames (1280×720 YUV) | **13.1 ms** | 34.4 ms | **2.6× faster** |
| Photo capture (3060×4080 still) | **21.7 ms** | 59.3 ms | **2.7× faster** |
| Bundled QR image (256×256 PNG) | **0.95 ms** | 9.7 ms | **10.2× faster** |


