# react-native-vision-camera-zxing

A [VisionCamera](https://github.com/mrousavy/react-native-vision-camera) v5 barcode scanner powered by [zxing-cpp](https://github.com/zxing-cpp/zxing-cpp), implemented as pure C++ Nitro HybridObjects. Frames are decoded straight from the camera's pixel buffer (Y plane, zero-copy) - no ML Kit, no base64, no temporary files.

```sh
npm install react-native-vision-camera-zxing react-native-nitro-image
```

Requires VisionCamera Core, Nitro Modules and Nitro Image. For frame processors also install `react-native-vision-camera-worklets` and `react-native-worklets`.

```ts
import { useBarcodeScanner } from 'react-native-vision-camera-zxing'

const scanner = useBarcodeScanner({ barcodeFormats: ['all-formats'] })
const frameOutput = useFrameOutput({
  pixelFormat: 'yuv',
  onFrame(frame) {
    'worklet'
    const barcodes = scanner.scanCodes(frame)
    frame.dispose()
    console.log(barcodes.map((b) => `${b.format}: ${b.displayValue}`))
  },
})
```

Still images: `await scanner.scanCodesInImageAsync(image)` with a Nitro `Image`.

## Building from source

zxing-cpp is vendored as a git submodule at `cpp/zxing-core`. When cloning the repository run `git submodule update --init`; the npm package already contains the sources.

## Coordinates

`Barcode.cornerPoints` / `boundingBox` are in the upright (rotated by `Frame.orientation`) frame coordinate system, matching `react-native-vision-camera-barcode-scanner`.
