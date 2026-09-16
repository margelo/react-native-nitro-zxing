# Native reporting throughput benchmark

This is the React Native companion to [NativePHP PR #3](https://github.com/margelo/react-native-nitro-zxing/pull/3), as reviewed at `571c5273eaafd2d1354f887f6a9e8bbff9fc37e1`. It runs against the same `scripts/qr-server.ts` protocol. Build this branch's example app and the NativePHP PR on the **same physical phone**, in release mode.

## What the loop measures

The loop includes the server advancing its QR, browser rendering, display refresh, camera exposure/delivery, decoding, and HTTP acknowledgement. It does not isolate framework call overhead or ZXing decode time.

VisionCamera invokes a frame worklet, which calls the existing synchronous Nitro scanner and then `reporter.submit(value)`. Deduplication, JSON, HTTP, response parsing, accepted-scan counting, and timing happen natively. There is no per-successful-scan `scheduleOnRN`, `fetch`, or React state update. The UI polls snapshots every 100 ms; polling does not determine completion time. The worklet and two Nitro calls remain part of the React Native pipeline.

Both ZXing and ML Kit use this same reporter and camera configuration. Their QR format arrays have stable identities, so progress renders do not recreate scanners. The native helper is a private example workspace, not a new barcode-library API.

## Warm-up and timing

Each Start creates a fresh native reporter and connection pool/session. It POSTs `/reset`, then completes a GET `/scan` with the same client to warm HTTP. GET does not advance the server. The camera and scanners are mounted only for a run, after HTTP preparation. A run ends/unmounts on completion, Stop, navigation away, backgrounding, camera failure, or report failure.

The first accepted `{"ok":true}` response is count **1** at **t=0**. Completion is timestamped natively at accepted response **1000**, using a monotonic clock. This intentionally matches PR #3's counting convention: **1000 confirmations, 999 timed intervals**. Do not label it 1000 timed round trips, or compare it to the old reset-to-completion clock. There is no extra timed warm-up, repeated heartbeat, or decoder cache carried from one mounted run to the next. Normal process/library/OS caches can remain warm in both apps.

Android uses one OkHttp client/pool and a serial report worker. iOS uses one ephemeral URLSession, one connection per host, and a serial report worker. Both fully consume responses so HTTP connections can be reused. Request/connect timeout is 2 seconds; total request timeout is 4 seconds. Reports fail the run on transport/protocol errors. There is no application-level POST retry: the server protocol cannot safely distinguish a rejected code from an accepted request whose reply was lost.

This is the same optimization category as PR #3, not an identical transport implementation: that PR uses a raw Android socket with a TCP-only warm-up and a Swift URLSession with a fire-and-forget GET warm-up. This example awaits HTTP warm-up and uses its native client for reset too. All that work, plus the first real scan, is outside the measured interval in both apps. PR #3 also dispatches confirmation to native UI code; this example timestamps the acknowledgement on its report worker before UI polling.

## Camera profile

| Setting | Android | iOS |
| --- | --- | --- |
| Camera | VisionCamera default back camera | VisionCamera default back wide-angle camera |
| Frame target | 640×480, matching PR #3's analysis target | 1280×720, matching PR #3's session target |
| FPS target | 60 via VisionCamera session constraints | 60 via VisionCamera session constraints |
| Resolution priority | Frame output before preview | Frame output before preview |
| Pixel buffers | YUV; prefer 8-bit full-range stream where available | YUV; prefer 8-bit full-range stream |
| Busy frames | Drop; no growing frame queue | Drop; no growing frame queue |
| Physical buffer rotation / preview-sized buffers | Disabled | Disabled |
| Deferred output start | Disabled | Disabled |
| AE / exposure bias / ISO | No additional overrides | Maximum automatic exposure 1/250 s (clamped to active-format capabilities); bias and ISO unchanged |
| AF | No additional overrides | Continuous AF, smooth AF off, near range, each where supported |
| AWB / zoom / torch / stabilization / HDR | No additional overrides | No additional overrides |

iOS tuning uses VisionCamera's public `NativeCameraController` on its session queue before starting capture. It does not open a second camera or force a format behind VisionCamera's back. The exposure cap is not a fixed shutter speed or locked ISO.

**Targets are not hardware guarantees.** VisionCamera negotiates the closest supported session. The screen retains selected FPS, native pixel format, output resolution, and applied iOS tuning after a run. Verify these against NativePHP's actual capture configuration on the test phone. In particular, PR #3's Android fixed 60/30 selection and its iOS exact-format search have different fallback rules. A fallback here must not be presented as matched 60 FPS. Selected FPS also does not prove delivered FPS under load.

Remaining differences include CameraX versions and stream negotiation, native capture ownership, frame rotation/stride handling, and ZXing reader options. This PR leaves the production decoder unchanged: RN's live fast pass disables downscaling and has periodic rotate fallback; NativePHP enables downscaling and limits output to one symbol. Consequently, these changes remove obvious reporting/timing/camera-target asymmetries, but do not establish an isolated or perfectly controlled framework benchmark.

## Run and validate

1. `bun install --frozen-lockfile`, `bun run build`, `bun example specs:throughput`, then install Pods or sync Gradle. Use Node >= 20.19.4 for the RN tooling.
2. Start `bun example qr-server` on the LAN computer and show its browser QR fullscreen. Enter that computer's origin (for example `http://192.168.1.12:3000`) in the app. Use one scanner app at a time; external resets invalidate a run.
3. Use release builds. Record the selected camera configuration, phone, OS, display refresh, lighting/distance, and thermal state. Verify the two apps' actual output dimensions and frame cadence match before interpreting a difference as framework overhead.
4. Check that aiming/setup leaves the clock at zero until confirmation 1, repeated frames of the same QR count once, and completion freezes at 1000. Cancel and restart, leave the screen, and background the app while a request is pending: no old run may affect a new result. Disconnect the server during a run and confirm a visible failure, not a completed score.
5. Alternate repeated RN/NativePHP runs on the same phone, allowing comparable thermal recovery. Keep the individual results and distribution; do not claim a speedup from one pair of runs. No physical-device performance result is supplied by this PR.

To measure 1000 intervals instead, both apps must perform an untimed confirmation followed by **1000 additional** accepted scans. Changing that protocol on only this side would undo timing parity with PR #3.
