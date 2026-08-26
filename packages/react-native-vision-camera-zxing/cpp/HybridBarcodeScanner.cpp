#include "HybridBarcodeScanner.hpp"

#include "FrameImageView.hpp"
#include "HybridBarcode.hpp"
#include "ZXingDecoder.hpp"

#include <NitroImage/PixelFormat.hpp>
#include <NitroImage/RawPixelData.hpp>

#include <algorithm>
#include <cmath>
#include <stdexcept>

namespace margelo::nitro::camera::zxing {

namespace {

  using HybridBarcodes = std::vector<std::shared_ptr<HybridBarcodeSpec>>;

  HybridBarcodes toHybridBarcodes(std::vector<DecodedBarcode>&& decoded) {
    HybridBarcodes barcodes;
    barcodes.reserve(decoded.size());
    for (DecodedBarcode& barcode : decoded) {
      barcodes.push_back(std::make_shared<HybridBarcode>(std::move(barcode)));
    }
    return barcodes;
  }

  ZXing::ImageFormat toZXingImageFormat(image::PixelFormat format) {
    switch (format) {
      case image::PixelFormat::ARGB:
      case image::PixelFormat::XRGB:
        return ZXing::ImageFormat::ARGB;
      case image::PixelFormat::BGRA:
      case image::PixelFormat::BGRX:
        return ZXing::ImageFormat::BGRA;
      case image::PixelFormat::ABGR:
      case image::PixelFormat::XBGR:
        return ZXing::ImageFormat::ABGR;
      case image::PixelFormat::RGBA:
      case image::PixelFormat::RGBX:
        return ZXing::ImageFormat::RGBA;
      case image::PixelFormat::RGB:
        return ZXing::ImageFormat::RGB;
      case image::PixelFormat::BGR:
        return ZXing::ImageFormat::BGR;
      case image::PixelFormat::UNKNOWN:
        break;
    }
    throw std::runtime_error("The given Image has an unknown pixel format!");
  }

} // namespace

HybridBarcodeScanner::HybridBarcodeScanner(const std::vector<TargetBarcodeFormat>& formats)
    : HybridObject(TAG), _liveDecoder(formats, ZXingDecoder::Mode::Live), _imageDecoder(formats, ZXingDecoder::Mode::Still) {}

HybridBarcodes HybridBarcodeScanner::scanCodes(const std::shared_ptr<camera::HybridFrameSpec>& frame) {
  FrameImageView view(frame);
  return toHybridBarcodes(_liveDecoder.decode(view.imageView()));
}

std::shared_ptr<Promise<HybridBarcodes>> HybridBarcodeScanner::scanCodesAsync(const std::shared_ptr<camera::HybridFrameSpec>& frame) {
  // All Frame access happens here on the caller's thread. The view holds the Frame (and its planes)
  // alive, so the pixel memory stays owned by the Frame for the whole async decode - no copy needed.
  auto view = std::make_shared<FrameImageView>(frame);
  return Promise<HybridBarcodes>::async([view, decoder = _liveDecoder]() -> HybridBarcodes { return toHybridBarcodes(decoder.decode(view->imageView())); });
}

std::shared_ptr<Promise<HybridBarcodes>> HybridBarcodeScanner::scanCodesInImageAsync(const std::shared_ptr<image::HybridImageSpec>& image) {
  // A multi-megapixel still carries far more detail than a barcode needs, and scan cost grows
  // with the pixel count, so shrink it first using the platform's own (optimized) scaler.
  // Corner points are scaled back below, so callers still get coordinates in the image they passed.
  const double longestEdge = std::max(image->getWidth(), image->getHeight());
  std::shared_ptr<image::HybridImageSpec> source = image;
  double cornerScale = 1.0;
  if (longestEdge > ZXingDecoder::kStillWorkingEdge) {
    const double ratio = ZXingDecoder::kStillWorkingEdge / longestEdge;
    source = image->resize(std::round(image->getWidth() * ratio), std::round(image->getHeight() * ratio));
    cornerScale = image->getWidth() / source->getWidth();
  }

  image::RawPixelData raw = source->toRawPixelData(false);
  std::shared_ptr<ArrayBuffer> buffer = raw.buffer;
  if (!buffer->isOwner()) {
    // A non-owning ArrayBuffer only borrows its memory, and that memory is only guaranteed to be
    // valid for this synchronous call. Take ownership before handing it to the decode thread.
    buffer = ArrayBuffer::copy(buffer);
  }
  const int width = static_cast<int>(raw.width);
  const int height = static_cast<int>(raw.height);
  const ZXing::ImageFormat format = toZXingImageFormat(raw.pixelFormat);
  // Resolve the address here: a platform-backed ArrayBuffer reaches its memory through the JVM,
  // which is only available on this thread - the decode thread just reads the resolved pointer.
  const uint8_t* data = buffer->data();
  return Promise<HybridBarcodes>::async([buffer, data, width, height, format, cornerScale, decoder = _imageDecoder]() -> HybridBarcodes {
    ZXing::ImageView view(data, width, height, format);
    std::vector<DecodedBarcode> decoded = decoder.decode(view);
    if (cornerScale != 1.0) {
      for (DecodedBarcode& barcode : decoded) {
        for (ZXing::PointI& corner : barcode.corners) {
          corner = ZXing::PointI{static_cast<int>(std::lround(corner.x * cornerScale)), static_cast<int>(std::lround(corner.y * cornerScale))};
        }
      }
    }
    return toHybridBarcodes(std::move(decoded));
  });
}

} // namespace margelo::nitro::camera::zxing
