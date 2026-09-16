# react-native-nitro-zxing: a C++ barcode scanner for VisionCamera

## Why we wrote it

It started with one thread in the Margelo community Discord. Several people couldn't run VisionCamera's ML Kit barcode scanner on the iOS Simulator. That's not a VisionCamera bug. Google simply hasn't added simulator support ([googlesamples/mlkit#810](https://github.com/googlesamples/mlkit/issues/810)). We wanted to unblock those users.

We also wanted to battle-test [margelo/react-native-skills](https://github.com/margelo/react-native-skills). After tightening the API-design and Nitro skills, AI one-shotted a working zxing-cpp module. The public API is byte-identical to `react-native-vision-camera-barcode-scanner`, so switching is an import change.

## How it differs from ML Kit

1. **Runs on the simulator.** zxing-cpp is plain C++, with no model download and no vendor SDK.
2. **Faster.** zxing-cpp is a classical decoder working on the frame's luma plane, with no ML model in the loop. That's cheaper per frame. Numbers below.
3. **One codebase.** iOS and Android share the same `.cpp`. No Swift or Kotlin in the package.
4. **Better at off-angle codes.** zxing's detector is more forgiving of skewed captures.

## Numbers

Samsung SM-E146B (Android 15), release build, both engines fed the same frames with `barcodeFormats: ['all-formats']`. Every row is value-verified: a comparison only counts when both engines decoded the same thing.

| Input | zxing | ML Kit | |
|---|---|---|---|
| Live camera frames (1280×720 YUV) | **13.1 ms** | 34.4 ms | 2.6× |
| Photo capture (3060×4080) | **21.7 ms** | 59.3 ms | 2.7× |
| Bundled QR image (256×256 PNG) | **0.95 ms** | 9.7 ms | 10.2× |

## Should you drop the ML Kit package?

No, not necessarily.

- If your app already depends on ML Kit core (say, for face detection), stick with `react-native-vision-camera-barcode-scanner`. An extra native dependency buys you nothing.
- ML Kit is backed by Google, handles rotated frames better, and is generally regarded as the higher-accuracy decoder. If you scan a lot of odd orientations, test both on your own data.
- Be honest about what the speed buys you. If your app scans every frame, 13 ms versus 34 ms is the difference between keeping up and dropping frames. If you scan on an interval, say once every few seconds, a 20 ms gap per scan won't be noticeable.

Both packages expose the same API, so trying the other one is a one-line change.

```sh
bun add react-native-nitro-zxing
```
