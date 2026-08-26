# Repository agent guidance

- `packages/react-native-nitro-zxing` is a Nitro Module implemented in C++ (`cpp/`). zxing-cpp lives in the `cpp/zxing-core` git submodule - never edit or format files inside it; run `git submodule update --init` after cloning.
- After changing `src/specs/*.nitro.ts`, run `bun specs` and commit `nitrogen/generated`.
- `apps/example` is the example and benchmark app (`ScannerScreen`, `BenchmarkScreen`). Benchmark numbers in the README come from a release build on a physical device.
- Keep PRs small: single atomically testable/mergeable/revertable changes.
