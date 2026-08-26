#include "HybridBarcode.hpp"

#include <algorithm>

namespace margelo::nitro::camera::zxing {

BarcodeFormat HybridBarcode::getFormat() {
  return _barcode.format;
}

Rect HybridBarcode::getBoundingBox() {
  const auto& corners = _barcode.corners;
  auto [minX, maxX] = std::minmax({corners[0].x, corners[1].x, corners[2].x, corners[3].x});
  auto [minY, maxY] = std::minmax({corners[0].y, corners[1].y, corners[2].y, corners[3].y});
  return Rect(minX, maxX, minY, maxY);
}

std::vector<Point> HybridBarcode::getCornerPoints() {
  std::vector<Point> points;
  points.reserve(_barcode.corners.size());
  for (const ZXing::PointI& corner : _barcode.corners) {
    points.emplace_back(corner.x, corner.y);
  }
  return points;
}

std::optional<std::string> HybridBarcode::getDisplayValue() {
  if (_barcode.displayValue.empty()) {
    return std::nullopt;
  }
  return _barcode.displayValue;
}

std::optional<std::shared_ptr<ArrayBuffer>> HybridBarcode::getRawBytes() {
  if (_barcode.rawBytes.empty()) {
    return std::nullopt;
  }
  if (_rawBytes == nullptr) {
    _rawBytes = ArrayBuffer::copy(_barcode.rawBytes);
  }
  return _rawBytes;
}

std::optional<std::string> HybridBarcode::getRawValue() {
  if (_barcode.rawValue.empty()) {
    return std::nullopt;
  }
  return _barcode.rawValue;
}

BarcodeValueType HybridBarcode::getValueType() {
  return _barcode.valueType;
}

size_t HybridBarcode::getExternalMemorySize() noexcept {
  return _barcode.rawBytes.size() + _barcode.rawValue.size() + _barcode.displayValue.size();
}

} // namespace margelo::nitro::camera::zxing
