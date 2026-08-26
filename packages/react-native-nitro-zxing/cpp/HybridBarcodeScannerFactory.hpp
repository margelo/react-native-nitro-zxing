#pragma once

#include "HybridZXingBarcodeScannerFactorySpec.hpp"

namespace margelo::nitro::camera::zxing {

class HybridBarcodeScannerFactory final : public HybridZXingBarcodeScannerFactorySpec {
public:
  HybridBarcodeScannerFactory() : HybridObject(TAG) {}

  std::shared_ptr<HybridBarcodeScannerSpec> createBarcodeScanner(const BarcodeScannerOptions& options) override;
};

} // namespace margelo::nitro::camera::zxing
