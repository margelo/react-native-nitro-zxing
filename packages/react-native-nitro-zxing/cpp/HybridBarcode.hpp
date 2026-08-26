#pragma once

#include "HybridBarcodeSpec.hpp"
#include "ZXingDecoder.hpp"

namespace margelo::nitro::camera::zxing {

class HybridBarcode final : public HybridBarcodeSpec {
public:
  explicit HybridBarcode(DecodedBarcode barcode) : HybridObject(TAG), _barcode(std::move(barcode)) {}

  BarcodeFormat getFormat() override;
  Rect getBoundingBox() override;
  std::vector<Point> getCornerPoints() override;
  std::optional<std::string> getDisplayValue() override;
  std::optional<std::shared_ptr<ArrayBuffer>> getRawBytes() override;
  std::optional<std::string> getRawValue() override;
  BarcodeValueType getValueType() override;
  size_t getExternalMemorySize() noexcept override;

private:
  DecodedBarcode _barcode;
  std::shared_ptr<ArrayBuffer> _rawBytes;
};

} // namespace margelo::nitro::camera::zxing
