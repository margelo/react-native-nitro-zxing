#pragma once

#include "HybridBarcodeScannerSpec.hpp"
#include "TargetBarcodeFormat.hpp"

#include "ZXingDecoder.hpp"

#include <vector>

namespace margelo::nitro::camera::zxing {

class HybridBarcodeScanner final : public HybridBarcodeScannerSpec {
public:
  explicit HybridBarcodeScanner(const std::vector<TargetBarcodeFormat>& formats);

  std::vector<std::shared_ptr<HybridBarcodeSpec>> scanCodes(const std::shared_ptr<camera::HybridFrameSpec>& frame) override;
  std::shared_ptr<Promise<std::vector<std::shared_ptr<HybridBarcodeSpec>>>> scanCodesAsync(const std::shared_ptr<camera::HybridFrameSpec>& frame) override;
  std::shared_ptr<Promise<std::vector<std::shared_ptr<HybridBarcodeSpec>>>>
  scanCodesInImageAsync(const std::shared_ptr<image::HybridImageSpec>& image) override;

private:
  ZXingDecoder _liveDecoder;
  ZXingDecoder _imageDecoder;
};

} // namespace margelo::nitro::camera::zxing
