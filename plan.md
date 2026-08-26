# react-native-vision-camera-zxing — implementation plan

## Context

New standalone bun monorepo (`margelo/react-native-vision-camera-zxing`, currently empty) that ships a VisionCamera v5 barcode scanner decoding with **zxing-cpp 3.1.1** instead of ML Kit. The `BarcodeScanner` / `Barcode` / factory are **pure C++ Nitro HybridObjects** (`ios: 'c++', android: 'c++'`) — no Swift/Kotlin in the package. Public TS API mirrors `packages/react-native-vision-camera-barcode-scanner` in the reference monorepo (`/Users/riteshshukla/Desktop/development/opensource/react-native-vision-camera`, hereafter `REF`) **minus the `CameraOutput` part** (`createBarcodeScannerOutput`, `useBarcodeScannerOutput`, `CodeScanner`, `BarcodeScannerOutputOptions`, `BarcodeScannerOutputResolution`) which is deferred. Repo layout mirrors `REF` (lean: no docs site / fake-camera app / patches / DeviceFarm). Node modules hoisted at root (`bunfig.toml` `linker = "hoisted"`). Decoding is zero-copy from pixel buffers — no base64, no files.

User decisions: C++ HybridObjects, no `CameraOutput` for now; zxing-cpp as git submodule compiled on both platforms; Nitro registry name `ZXingBarcodeScannerFactory`; lean mirror; test on Samsung `RZCW30KE1NB` (barcode physically under its camera), Android emulator `Pixel_8_API_35` via `-virtualscene-poster`, iOS simulator via `serve-sim camera --file`; ML Kit vs zxing speed comparison on the Samsung.

Facts the design rests on:
- C++ HybridObjects can call Swift/Kotlin-implemented HybridObjects through their generated C++ specs (`REF/packages/react-native-vision-camera-resizer/android/src/main/cpp/HybridResizer.cpp` calls `frame->getNativeBuffer()`; worklets package takes a Swift `NativeThread` in C++ on iOS). The reverse (Swift/Kotlin consuming a C++ HybridObject) is unsupported in Nitro 0.37 — which is why the Swift/Kotlin `CameraOutput` is deferred.
- `HybridFrameSpec` (C++): `getWidth/getHeight/getBytesPerRow/getPixelFormat/getOrientation/getIsPlanar/getPlanes()/getPixelBuffer()`. `HybridFramePlaneSpec`: `getBytesPerRow()`, `getPixelBuffer()` → `std::shared_ptr<ArrayBuffer>` wrapping plane 0 zero-copy on both platforms (iOS `CVPixelBufferGetBaseAddressOfPlane` after the Frame's read-only lock; Android CameraX direct `ByteBuffer`). Android plane `width/height` are stride-derived → always use the Frame's `getWidth/getHeight`.
- `VideoPixelFormat` values: `yuv-420-8-bit-{video,full}` (planar → Y plane = `ImageFormat::Lum`), `rgb-bgra-8-bit`, `rgb-rgba-8-bit`, `rgb-rgb-8-bit` (non-planar → `getPixelBuffer()` + `getBytesPerRow()`), others → throw.
- Nitro Image `HybridImageSpec` (C++): `toRawPixelData(allowGpu=false)` → `RawPixelData { buffer, width, height, pixelFormat: 'RGBA'|'BGRA'|'ARGB'|'ABGR'|X-variants }` (one copy inside nitro-image; still-image path only).
- Nitro autolinking key must equal the spec interface name → interface `ZXingBarcodeScannerFactory` + `export type BarcodeScannerFactory = ZXingBarcodeScannerFactory`.
- zxing-cpp `Version.h` lives at `wrappers/ios/Sources/Wrapper/Version.h` (CMake generates it for Android; podspec needs that header search path).
- ML Kit returns coordinates in the *upright* (rotated) image space (REF passes `frame.orientation` to ML Kit). We decode a zero-copy `ImageView.rotated(degrees)` view (up 0 / right 90 / down 180 / left 270, clockwise) so coordinates match and the first 1D scan pass hits upright codes.

## Implementation order

0. This file (`plan.md`) at repo root; commit nothing unless asked.
1. Repo scaffold: root files, `config/`, `scripts/`, `agents/`, `.github/`, `bunfig.toml`, submodule `cpp/zxing-core` @ v3.1.1.
2. Package `src/` + `nitro.json` + `package.json` → `bun install`, `bun specs` (generated C++ specs + enums).
3. `cpp/` HybridObjects + decoder → podspec/CMake wiring → build iOS sim + Android.
4. `apps/example` (scanner screen via frame processor + benchmark screen) → Samsung, emulator, iOS simulator.
5. Verify (agent-device), benchmark, README tables, final report.

## Repo layout (mirror of REF, lean)

```
README.md  LICENSE(MIT)  package.json  bun.lock  bunfig.toml  biome.json  .gitignore  .gitmodules  plan.md
config/{.clang-format,.editorconfig,.swift-format,tsconfig.json}      # copy from REF/config
scripts/{clang-format,swift-format,kotlin-format,release,try-install-lockfiles}.sh  # copy, rename package refs
agents/AGENTS.md                                                        # copy/adapt
.github/workflows/{lint-cpp,lint-swift,lint-kotlin,build-android-release,build-ios-release}.yml  # copy, adapt paths; checkout with submodules
packages/react-native-vision-camera-zxing/
apps/example/                                                           # fork of REF/apps/simple-camera, trimmed
```

Root `package.json`: copy `REF/package.json`; name `react-native-vision-camera-zxing-monorepo`; workspaces `packages/react-native-vision-camera-zxing`, `apps/example`; scripts `bootstrap`, `specs`, `build`, `example` (`bun --cwd apps/example`), `zxing` (`bun --cwd packages/react-native-vision-camera-zxing`), `release`, `lint-*`; same devDependencies; release-it bumper paths reduced to the two workspaces; drop `patchedDependencies`.

## Package: `packages/react-native-vision-camera-zxing`

Fork `REF/packages/react-native-vision-camera-barcode-scanner` config files, then:

### Config
- `package.json`: name `react-native-vision-camera-zxing`, version `0.1.0`, description "Barcode scanning plugin for react-native-vision-camera powered by zxing-cpp.", keywords `mlkit` → `zxing`, repo/bugs/homepage → `margelo/react-native-vision-camera-zxing`. devDeps pin `react-native-vision-camera 5.2.3`, `react-native-nitro-image 0.15.2`, nitro 0.37.0, RN 0.85.3, react 19.2.3, TS 6.0.3; same peerDeps. `files` += `"cpp/*.hpp"`, `"cpp/*.cpp"`, `"cpp/zxing-core/core"`, `"cpp/zxing-core/wrappers/ios/Sources/Wrapper/Version.h"`, `"cpp/zxing-core/LICENSE"`; `scripts.prepack`: `test -f cpp/zxing-core/core/CMakeLists.txt || (echo 'run: git submodule update --init' && exit 1)`. Drop `react-native-builder-bob` block.
- `nitro.json`: `cxxNamespace ["camera","zxing"]`, `iosModuleName "VisionCameraZxing"`, `androidNamespace ["camera","zxing"]`, `androidCxxLibName "VisionCameraZxing"`, autolinking `"ZXingBarcodeScannerFactory": { "all": { "language": "c++", "implementationClassName": "HybridBarcodeScannerFactory" } }` (pattern: `REF/packages/react-native-vision-camera-worklets/nitro.json`).
- `android/build.gradle`, `gradle.properties`, `fix-prefab.gradle`, `AndroidManifest.xml`: copy with `VisionCameraZxing_` prefix / namespace `com.margelo.nitro.camera.zxing`; drop ML Kit + `camera-core` deps; keep nitro-modules, vision-camera, nitro-image project deps; `packagingOptions` unchanged. `VisionCameraZxingPackage.kt` is the only Kotlin file (generated-OnLoad trigger, copied from REF pattern).
- `tsconfig.json`, `babel.config.js`, `react-native.config.js`, `.gitignore`, `.watchmanconfig`, `README.md` (rewrite; mention `git submodule update --init`): copy.
- `.gitmodules` (root): `packages/react-native-vision-camera-zxing/cpp/zxing-core` → `https://github.com/zxing-cpp/zxing-cpp.git` @ `v3.1.1` (local tarball `~/Downloads/zxing-cpp-3.1.1` for reference only).

### `src/` (copied from REF, output APIs removed)
Files: `index.ts`, `factory.ts` (`createBarcodeScanner` only), `useBarcodeScanner.ts`, `specs/{Barcode.nitro.ts, BarcodeFormat.ts, BarcodeScanner.nitro.ts, BarcodeScannerFactory.nitro.ts, BarcodeValueType.ts, Point.ts, Rect.ts}`. Dropped: `useBarcodeScannerOutput.ts`, `views/CodeScanner.tsx`, `specs/BarcodeScannerOutputResolution.ts`.
Deviations from REF text:
- All three `.nitro.ts` specs: `HybridObject<{ ios: 'c++'; android: 'c++' }>`.
- `BarcodeScannerFactory.nitro.ts`: `export interface ZXingBarcodeScannerFactory` (only `createBarcodeScanner(options: BarcodeScannerOptions): BarcodeScanner`) + `export type BarcodeScannerFactory = ZXingBarcodeScannerFactory`; `BarcodeScannerOutputOptions` removed.
- `factory.ts`: `NitroModules.createHybridObject<ZXingBarcodeScannerFactory>('ZXingBarcodeScannerFactory')`.
- JSDoc "uses MLKit Barcodes" → "uses ZXing"; links to removed APIs dropped.
`Barcode` (`format`, `boundingBox`, `cornerPoints`, `displayValue?`, `rawBytes?`, `rawValue?`, `valueType`), `BarcodeScanner` (`scanCodes(frame)`, `scanCodesAsync(frame)`, `scanCodesInImageAsync(image)`), `BarcodeFormat`, `TargetBarcodeFormat`, `BarcodeValueType`, `Point`, `Rect`, `useBarcodeScanner` stay verbatim.

### C++ (`cpp/`, namespace `margelo::nitro::camera::zxing`)
- `cpp/zxing-core/` — submodule (only `core/` + `wrappers/ios/Sources/Wrapper/Version.h` used).
- `HybridBarcodeScannerFactory.{hpp,cpp}` — `final : HybridZXingBarcodeScannerFactorySpec`; `createBarcodeScanner(options)` → `std::make_shared<HybridBarcodeScanner>(options.barcodeFormats)`.
- `HybridBarcodeScanner.{hpp,cpp}` — `final : HybridBarcodeScannerSpec`; holds `ZXing::ReaderOptions` built once from the target formats. `scanCodes(frame)`: `FrameImageView view(frame); return toHybridBarcodes(decode(view.imageView(), _options))`. `scanCodesAsync(frame)`: build `FrameImageView` **synchronously on the caller thread** (all Swift/Kotlin calls happen there; it owns `shared_ptr<HybridFrameSpec>` + `shared_ptr<ArrayBuffer>` to keep the pixels alive), then `Promise<…>::async([view = std::move(view), opts]{ decode })`. `scanCodesInImageAsync(image)`: `auto raw = image->toRawPixelData(false)` synchronously (`// ponytail: pixel copy on caller thread; chain toRawPixelDataAsync if it shows in profiles`), then `Promise::async` decoding an `ImageView(raw.buffer->data(), raw.width, raw.height, formatFor(raw.pixelFormat))`.
- `HybridBarcode.{hpp,cpp}` — `final : HybridBarcodeSpec` over a `DecodedBarcode`: `getFormat/getValueType/getRawValue/getDisplayValue` (empty → `std::nullopt`), `getRawBytes` lazy `ArrayBuffer::copy(vector)`, `getCornerPoints` (4 `Point`s), `getBoundingBox` (min/max of corners), `getExternalMemorySize()` = bytes + strings.
- `FrameImageView.{hpp,cpp}` — RAII adapter `Frame → ZXing::ImageView`: if `getIsPlanar()` (yuv-420-8-bit-{video,full}) → `planes = frame->getPlanes(); buf = planes[0]->getPixelBuffer(); ImageView(buf->data(), frame->getWidth(), frame->getHeight(), Lum, planes[0]->getBytesPerRow())`; else `rgb-bgra-8-bit` → `BGRA`, `rgb-rgba-8-bit` → `RGBA`, `rgb-rgb-8-bit` → `RGB` via `frame->getPixelBuffer()` + `frame->getBytesPerRow()`; `private`/depth/raw/unknown → `throw std::runtime_error("Unsupported Frame pixelFormat …, use pixelFormat 'yuv'")`. Applies `.rotated(degrees(frame->getOrientation()))`. Mirroring ignored (`// ponytail: zxing decodes mirrored symbols; REF ignores isMirrored on Android too`).
- `ZXingDecoder.{hpp,cpp}` — `struct DecodedBarcode { BarcodeFormat format; BarcodeValueType valueType; std::string rawValue /*TextMode::Plain*/, displayValue /*TextMode::HRI*/; std::vector<uint8_t> rawBytes; std::array<ZXing::PointI,4> corners; }`; `ReaderOptions makeReaderOptions(const std::vector<TargetBarcodeFormat>&)` (`ALL_FORMATS` → the 13 explicit symbologies, never `ZXing::All`; nitro→ZXing 1:1 by symbology so QR/PDF417/Aztec/Code39/ITF variants are included); `std::vector<DecodedBarcode> decode(const ZXing::ImageView&, const ReaderOptions&)` → `ReadBarcodes`, skip `!isValid()`, ZXing→nitro via `switch (b.symbology())`, `EANUPC` → `switch (b.format())` EAN13/EAN8/UPCA/UPCE, default `UNKNOWN`. `// ponytail: ReaderOptions at zxing defaults; expose tryHarder/tryRotate if live-scan CPU matters.`
- `BarcodeValueTypeClassifier.{hpp,cpp}` — `classify(std::string_view plainText, BarcodeFormat)`: case-insensitive prefixes (`http://`,`https://`→URL; `mailto:`,`MATMSG:`→EMAIL; `tel:`→PHONE; `sms:`,`smsto:`→SMS; `geo:`→GEO; `WIFI:`→WIFI; `BEGIN:VCARD`,`MECARD:`→CONTACT_INFO; `BEGIN:VEVENT`,`BEGIN:VCALENDAR`→CALENDAR_EVENT; `@\n`+PDF_417→DRIVER_LICENSE), EAN_13 starting `978`/`979`→ISBN, EAN_13/EAN_8/UPC_A/UPC_E→PRODUCT, else TEXT. `// ponytail: prefix heuristic, no vCard/WiFi parsing.`
- `android/src/main/cpp/cpp-adapter.cpp` — `JNI_OnLoad` → `registerAllNatives()` (copy of REF). No other platform code anywhere.

### Native build
- `VisionCameraZxing.podspec` (from `REF/packages/react-native-vision-camera-worklets/*.podspec`): `platforms ios => min_ios_version_supported, visionos => 1.0`; explicit globs — never `cpp/**` (submodule has other wrappers/tests): `source_files = ["ios/**/*.{m,mm}", "cpp/*.{hpp,cpp}", "cpp/zxing-core/core/src/**/*.{h,c,cpp}"]`, `exclude_files = ["cpp/zxing-core/core/src/libzint/**", "cpp/zxing-core/core/src/ZXingC.cpp"]`; set **before** `add_nitrogen_files(s)`: `private_header_files = ["cpp/*.hpp", "cpp/zxing-core/core/src/**/*.h"]`; `compiler_flags = "-DZXING_INTERNAL -Wno-comma"`; `pod_target_xcconfig HEADER_SEARCH_PATHS = "$(PODS_TARGET_SRCROOT)/cpp/zxing-core/core/src" "$(PODS_TARGET_SRCROOT)/cpp/zxing-core/wrappers/ios/Sources/Wrapper"`; deps `VisionCamera`, `NitroImage`, `React-jsi`, `React-callinvoker`, `install_modules_dependencies`. No frameworks needed.
- `android/CMakeLists.txt`: before the nitrogen include: `set(ZXING_READERS ON) set(ZXING_WRITERS OFF) set(BUILD_SHARED_LIBS OFF)` + `add_subdirectory(${CMAKE_SOURCE_DIR}/../cpp/zxing-core/core ${CMAKE_BINARY_DIR}/zxing-cpp EXCLUDE_FROM_ALL)`; `add_library(VisionCameraZxing SHARED src/main/cpp/cpp-adapter.cpp ../cpp/*.cpp)`; `include(…VisionCameraZxing+autolinking.cmake)`; include `../cpp`; `find_package(react-native-vision-camera)`, `find_package(react-native-nitro-image)`; link `log android ZXing::ZXing react-native-vision-camera::VisionCamera react-native-nitro-image::NitroImage`. (zxing forces PIC; `Version.h` generated into the binary dir which is a PUBLIC include of `ZXing::ZXing`; writers OFF ⇒ no zint/FetchContent/network; fbjni linked by the generated cmake.)

## Example app `apps/example`
Fork `REF/apps/simple-camera` (package.json, metro/babel/tsconfig, `ios/Podfile`, `android/*` with `../../../node_modules` paths intact, `Gemfile`, `app.json`, `index.js`, `src/{App.tsx, screens/PermissionsScreen.tsx, hooks/useIsActive.ts, components/…}`). Deps: `react-native-vision-camera 5.2.3`, `react-native-nitro-modules 0.37.0`, `react-native-nitro-image 0.15.2`, `react-native-vision-camera-worklets` + `react-native-worklets` (versions from REF's simple-camera; needed for `useFrameOutput`), `react-native-vision-camera-zxing: ../../packages/react-native-vision-camera-zxing`, `react-native-vision-camera-barcode-scanner 5.2.3` (bench only). Drop location/resizer/skia/harness. `ScannerScreen`: `useCameraDevice('back')` + `useBarcodeScanner({ barcodeFormats: ['all-formats'] })` + `useFrameOutput({ pixelFormat: 'yuv', onFrame(frame) { 'worklet'; const codes = scanner.scanCodes(frame); frame.dispose(); scheduleOnRN(setCodes, codes.map(c => `${c.format}: ${c.displayValue}`)) } })` + `<Camera outputs={[frameOutput]} />` + `<Text testID="scanned-codes">` (what agent-device `snapshot` reads). App id `com.margelo.visioncamerazxing.example`.

## Benchmark: ML Kit vs zxing on the Samsung (deliverable)

`BenchmarkScreen` (`apps/example/src/screens/BenchmarkScreen.tsx`, `src/bench/*.ts`). Both engines via their own `useBarcodeScanner({ barcodeFormats: ['all-formats'] })` (ML Kit from `react-native-vision-camera-barcode-scanner`, zxing from ours), same `useFrameOutput({ pixelFormat: 'yuv' })`, engines toggled one at a time. **Release** build on `RZCW30KE1NB` (SM-E146B, Android 15, arm64), same barcode under the camera, same lighting. Results rendered as `<Text testID="bench-results">` and `console.log`ged as JSON (captured via `adb logcat`):

1. **Live frame-processor latency** — inside the worklet: `t0 = performance.now(); codes = scanner.scanCodes(frame); dt = performance.now() - t0`; aggregate over 10 s per engine: avg / median / p95 ms per frame, frames/s processed, detection rate (frames with ≥1 code), frame resolution. Sample process CPU (`adb shell top -b -n 10 -d 1 -p <pid>`) and PSS (`adb shell dumpsys meminfo <pkg>`) during each window.
2. **Static image latency** — same bundled test PNG loaded once via `react-native-nitro-image` `loadImage(...)`; per engine: 5 warm-ups, then 50× `await scanner.scanCodesInImageAsync(image)` timed; avg / median / p95 ms; decoded format+value must match across engines.
3. Log both engines' `cornerPoints` for the same code to confirm the coordinate convention matches.

Output: tables in root `README.md` `## Benchmarks` (device, build type, date) and in the final report.

## Verification

1. `bun install` (root `node_modules` only), `bun specs` (nitrogen → generated `HybridZXingBarcodeScannerFactorySpec`, `HybridBarcodeScannerSpec`, `HybridBarcodeSpec`, enums), `bun run build`, `bun typecheck`, `bun lint-js`, `bun lint-cpp`.
2. Test images: build zxing-cpp writer in scratchpad (`cmake -S ~/Downloads/zxing-cpp-3.1.1 -B <scratch>/zxing-build -DZXING_READERS=OFF -DZXING_WRITERS=ON -DZXING_EXAMPLES=OFF`, tiny `gen.cpp` with `CreateBarcodeFromText` + `WriteBarcodeToSVG` → `qlmanage -t -s 1200` → PNG; fallback BMP + `sips`). Produce QR (`https://margelo.com`), EAN-13 (`4006381333931`), Code-128 (`ZXING-123`).
3. Android build: `bun example android` for the Samsung; AAR ships only `libVisionCameraZxing.so`; `readelf -l` shows 16384 LOAD alignment.
4. Samsung: `agent-device open com.margelo.visioncamerazxing.example --platform android --serial RZCW30KE1NB`, `snapshot` → decoded text from the barcode under the camera; `screenshot` as proof.
5. Emulator: relaunch `Pixel_8_API_35` with `emulator -avd Pixel_8_API_35 -virtualscene-poster wall=<qr.png> -virtualscene-poster table=<ean13.png>`; install, open, snapshot → `qr-code: https://margelo.com`.
6. iOS simulator (iPhone 17 Pro, booted): `bun example ios`; `npx serve-sim camera com.margelo.visioncamerazxing.example --file <qr.png> --no-mirror`; snapshot → decoded value. If serve-sim's swizzle doesn't satisfy VisionCamera device enumeration, report it and exercise the iOS C++ path via `scanCodesInImageAsync` on a bundled image instead.
7. Field sanity: `format`, `rawValue`, `displayValue`, `valueType` (`url` QR, `product` EAN-13, `text` Code-128), `cornerPoints` length 4, `boundingBox` within the rotated frame; portrait vs landscape; front camera; `scanCodesAsync` from the worklet; `scanCodesInImageAsync`.
8. Benchmark (above): `bun example android --mode release`, open `BenchmarkScreen` via agent-device, run both measurements, capture text + logcat JSON + top/meminfo, write tables into `README.md`.
