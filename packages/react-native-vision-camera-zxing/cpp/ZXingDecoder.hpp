#pragma once

#include "BarcodeFormat.hpp"
#include "BarcodeValueType.hpp"
#include "TargetBarcodeFormat.hpp"

#include "ImageView.h"
#include "Point.h"
#include "ReaderOptions.h"

#include <array>
#include <atomic>
#include <cstdint>
#include <memory>
#include <string>
#include <vector>

namespace margelo::nitro::camera::zxing {

struct DecodedBarcode {
  BarcodeFormat format = BarcodeFormat::UNKNOWN;
  BarcodeValueType valueType = BarcodeValueType::UNKNOWN;
  std::string rawValue;
  std::string displayValue;
  std::vector<uint8_t> rawBytes;
  std::array<ZXing::PointI, 4> corners{};
};

/**
 * Decodes barcodes with zxing-cpp.
 *
 * Decoding cost grows with the number of pixels scanned and with how many heuristics are
 * enabled, so the decoder runs an escalating ladder of attempts: the cheapest configuration
 * first, and a more expensive one only if the previous attempt found nothing. A frame that
 * contains a readable code therefore pays only for the cheap attempt.
 *
 * While scanning live, most frames contain no readable code at all, so the expensive fallbacks
 * are spread across frames rather than run on every miss: a code they can find is still picked
 * up within a few frames, but the per-frame cost stays close to the cheap attempt.
 */
class ZXingDecoder final {
public:
  /**
   * - Live: tuned for camera frames arriving continuously, where latency per frame matters.
   * - Still: tuned for a single high-resolution capture, where a slower fallback is acceptable.
   */
  enum class Mode { Live, Still };

  /**
   * Longest edge a still image is scanned at. Larger captures are scaled down first: they cost
   * proportionally more to scan while carrying more detail than a barcode needs.
   */
  static constexpr int kStillWorkingEdge = 1280;

  explicit ZXingDecoder(const std::vector<TargetBarcodeFormat>& formats, Mode mode = Mode::Live);

  std::vector<DecodedBarcode> decode(const ZXing::ImageView& image) const;

private:
  struct Attempt {
    ZXing::ReaderOptions options;
    /// Longest edge to scan at, or 0 to scan the image at its native size.
    int maxEdge;
    /// Run this attempt on every Nth call. 1 runs it whenever the previous attempts found nothing.
    uint64_t period;
  };
  std::vector<Attempt> _attempts;
  /// Shared by copies of this decoder so one scanner keeps a single cadence.
  std::shared_ptr<std::atomic<uint64_t>> _calls = std::make_shared<std::atomic<uint64_t>>(0);
};

} // namespace margelo::nitro::camera::zxing
