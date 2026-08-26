#include "ZXingDecoder.hpp"

#include "BarcodeValueTypeClassifier.hpp"
#include "ImageDownscaler.hpp"

#include "Barcode.h"
#include "BarcodeFormat.h"
#include "ReadBarcode.h"

#include <algorithm>
#include <stdexcept>

namespace margelo::nitro::camera::zxing {

namespace {

  /// How often the rotation-aware fallback runs while scanning live frames.
  constexpr uint64_t kLiveRotationPeriod = 4;

  ZXing::BarcodeFormat toZXingFormat(TargetBarcodeFormat format) {
    switch (format) {
      case TargetBarcodeFormat::CODE_128:
        return ZXing::BarcodeFormat::Code128;
      case TargetBarcodeFormat::CODE_39:
        return ZXing::BarcodeFormat::Code39;
      case TargetBarcodeFormat::CODE_93:
        return ZXing::BarcodeFormat::Code93;
      case TargetBarcodeFormat::CODABAR:
        return ZXing::BarcodeFormat::Codabar;
      case TargetBarcodeFormat::DATA_MATRIX:
        return ZXing::BarcodeFormat::DataMatrix;
      case TargetBarcodeFormat::EAN_13:
        return ZXing::BarcodeFormat::EAN13;
      case TargetBarcodeFormat::EAN_8:
        return ZXing::BarcodeFormat::EAN8;
      case TargetBarcodeFormat::ITF:
        return ZXing::BarcodeFormat::ITF;
      case TargetBarcodeFormat::QR_CODE:
        return ZXing::BarcodeFormat::QRCode;
      case TargetBarcodeFormat::UPC_A:
        return ZXing::BarcodeFormat::UPCA;
      case TargetBarcodeFormat::UPC_E:
        return ZXing::BarcodeFormat::UPCE;
      case TargetBarcodeFormat::PDF_417:
        return ZXing::BarcodeFormat::PDF417;
      case TargetBarcodeFormat::AZTEC:
        return ZXing::BarcodeFormat::Aztec;
      case TargetBarcodeFormat::ALL_FORMATS:
        break;
    }
    throw std::invalid_argument("Unknown TargetBarcodeFormat: " + std::to_string(static_cast<int>(format)));
  }

  constexpr std::array<TargetBarcodeFormat, 13> kAllFormats = {
      TargetBarcodeFormat::CODE_128, TargetBarcodeFormat::CODE_39, TargetBarcodeFormat::CODE_93, TargetBarcodeFormat::CODABAR, TargetBarcodeFormat::DATA_MATRIX,
      TargetBarcodeFormat::EAN_13,   TargetBarcodeFormat::EAN_8,   TargetBarcodeFormat::ITF,     TargetBarcodeFormat::QR_CODE, TargetBarcodeFormat::UPC_A,
      TargetBarcodeFormat::UPC_E,    TargetBarcodeFormat::PDF_417, TargetBarcodeFormat::AZTEC,
  };

  BarcodeFormat toNitroFormat(const ZXing::Barcode& barcode) {
    switch (barcode.symbology()) {
      case ZXing::BarcodeFormat::Code128:
        return BarcodeFormat::CODE_128;
      case ZXing::BarcodeFormat::Code39:
        return BarcodeFormat::CODE_39;
      case ZXing::BarcodeFormat::Code93:
        return BarcodeFormat::CODE_93;
      case ZXing::BarcodeFormat::Codabar:
        return BarcodeFormat::CODABAR;
      case ZXing::BarcodeFormat::DataMatrix:
        return BarcodeFormat::DATA_MATRIX;
      case ZXing::BarcodeFormat::ITF:
        return BarcodeFormat::ITF;
      case ZXing::BarcodeFormat::QRCode:
        return BarcodeFormat::QR_CODE;
      case ZXing::BarcodeFormat::PDF417:
        return BarcodeFormat::PDF_417;
      case ZXing::BarcodeFormat::Aztec:
        return BarcodeFormat::AZTEC;
      case ZXing::BarcodeFormat::EANUPC:
        switch (barcode.format()) {
          case ZXing::BarcodeFormat::EAN8:
            return BarcodeFormat::EAN_8;
          case ZXing::BarcodeFormat::UPCA:
            return BarcodeFormat::UPC_A;
          case ZXing::BarcodeFormat::UPCE:
            return BarcodeFormat::UPC_E;
          default:
            return BarcodeFormat::EAN_13;
        }
      default:
        return BarcodeFormat::UNKNOWN;
    }
  }

  ZXing::ReaderOptions makeOptions(const std::vector<ZXing::BarcodeFormat>& formats, bool tryHarder, bool tryRotate, bool tryDownscale) {
    ZXing::ReaderOptions options;
    options.setFormats(ZXing::BarcodeFormats(std::vector<ZXing::BarcodeFormat>(formats)));
    options.setTryHarder(tryHarder);
    options.setTryRotate(tryRotate);
    options.setTryInvert(tryHarder);
    options.setTryDownscale(tryDownscale);
    return options;
  }

  DecodedBarcode toDecodedBarcode(const ZXing::Barcode& barcode, int scale) {
    DecodedBarcode decoded;
    decoded.format = toNitroFormat(barcode);
    decoded.rawValue = barcode.text(ZXing::TextMode::Plain);
    decoded.displayValue = barcode.text(ZXing::TextMode::HRI);
    decoded.rawBytes = barcode.bytes();
    const ZXing::Position& position = barcode.position();
    for (size_t i = 0; i < 4; i++) {
      // Map back to the coordinate system of the image the caller passed in.
      decoded.corners[i] = scale * position[i];
    }
    decoded.valueType = classifyValueType(decoded.rawValue, decoded.format, barcode.contentType());
    return decoded;
  }

} // namespace

ZXingDecoder::ZXingDecoder(const std::vector<TargetBarcodeFormat>& formats, Mode mode) {
  if (formats.empty()) {
    throw std::invalid_argument("Target barcodeFormats cannot be empty!");
  }
  std::vector<ZXing::BarcodeFormat> zxingFormats;
  for (TargetBarcodeFormat format : formats) {
    if (format == TargetBarcodeFormat::ALL_FORMATS) {
      for (TargetBarcodeFormat all : kAllFormats) {
        zxingFormats.push_back(toZXingFormat(all));
      }
    } else {
      zxingFormats.push_back(toZXingFormat(format));
    }
  }

  if (mode == Mode::Live) {
    // Most frames either contain a readable code or none at all, so start with the cheapest
    // scan and only pay for rotation handling when that finds nothing.
    _attempts.push_back({makeOptions(zxingFormats, false, false, false), 0, 1});
    // Rotation handling costs several times a plain scan, so look for rotated codes periodically
    // instead of on every frame that finds nothing.
    _attempts.push_back({makeOptions(zxingFormats, false, true, false), 0, kLiveRotationPeriod});
  } else {
    // A still is usually many megapixels: scan a reduced copy first, then the full image, and
    // only then the expensive heuristics that help with blurred or inverted captures.
    _attempts.push_back({makeOptions(zxingFormats, false, false, true), kStillWorkingEdge, 1});
    _attempts.push_back({makeOptions(zxingFormats, false, true, true), 0, 1});
    _attempts.push_back({makeOptions(zxingFormats, true, true, true), 0, 1});
  }
}

std::vector<DecodedBarcode> ZXingDecoder::decode(const ZXing::ImageView& image) const {
  const uint64_t call = _calls->fetch_add(1, std::memory_order_relaxed);
  for (const Attempt& attempt : _attempts) {
    if (attempt.period > 1 && call % attempt.period != 0) {
      continue;
    }
    const int longestEdge = std::max(image.width(), image.height());
    const int factor = attempt.maxEdge > 0 ? longestEdge / attempt.maxEdge : 1;

    ZXing::Barcodes barcodes;
    int scale = 1;
    if (factor > 1) {
      ZXing::ImageView scaled;
      // Keep the pixels alive for as long as the view is read.
      std::vector<uint8_t> pixels = downscaleToLuminance(image, factor, scaled);
      barcodes = ZXing::ReadBarcodes(scaled, attempt.options);
      scale = factor;
    } else {
      barcodes = ZXing::ReadBarcodes(image, attempt.options);
    }

    std::vector<DecodedBarcode> decoded;
    for (const ZXing::Barcode& barcode : barcodes) {
      if (barcode.isValid()) {
        decoded.push_back(toDecodedBarcode(barcode, scale));
      }
    }
    if (!decoded.empty()) {
      return decoded;
    }
  }
  return {};
}

} // namespace margelo::nitro::camera::zxing
