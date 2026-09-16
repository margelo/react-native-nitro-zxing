#!/usr/bin/env bash
# Builds zxing-cpp's Android wrapper (Kotlin API + libzxingcpp_android.so via CMake/NDK) from the
# submodule and lays the result out as a one-artifact Maven repository, so the app can depend on
# it by coordinate like any other library while the C++ is compiled from source.
set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${1:?usage: build-android-aar.sh <maven-repo-output-dir>}"
WRAPPER="$PLUGIN_DIR/zxing-cpp/wrappers/android"
VERSION="3.1.1-local"

# NativePHP's Android project compiles with Kotlin 2.0, which cannot read metadata from libraries
# built with the wrapper's default Kotlin 2.3. Build with 2.0 instead, without dirtying the submodule.
KOTLIN_VERSION="${ZXING_KOTLIN_VERSION:-2.0.0}"
CATALOG="$WRAPPER/gradle/libs.versions.toml"
cp "$CATALOG" "$CATALOG.orig"
trap 'mv "$CATALOG.orig" "$CATALOG"' EXIT
sed -i '' -E "s/^kotlin = \"[0-9.]+\"/kotlin = \"$KOTLIN_VERSION\"/" "$CATALOG"

(cd "$WRAPPER" && ./gradlew -q :zxingcpp:assembleRelease)

AAR="$WRAPPER/zxingcpp/build/outputs/aar/zxingcpp-release.aar"
DEST="$OUT_DIR/io/github/zxing-cpp/android/$VERSION"
mkdir -p "$DEST"
cp "$AAR" "$DEST/android-$VERSION.aar"
cat > "$DEST/android-$VERSION.pom" <<POM
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>io.github.zxing-cpp</groupId>
  <artifactId>android</artifactId>
  <version>$VERSION</version>
  <packaging>aar</packaging>
  <dependencies>
    <dependency>
      <groupId>androidx.camera</groupId>
      <artifactId>camera-core</artifactId>
      <version>1.4.2</version>
    </dependency>
  </dependencies>
</project>
POM
echo "zxing-cpp android $VERSION -> $DEST"
