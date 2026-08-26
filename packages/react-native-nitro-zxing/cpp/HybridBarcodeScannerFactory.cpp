#include "HybridBarcodeScannerFactory.hpp"

#include "HybridBarcodeScanner.hpp"

namespace margelo::nitro::camera::zxing {

std::shared_ptr<HybridBarcodeScannerSpec> HybridBarcodeScannerFactory::createBarcodeScanner(const BarcodeScannerOptions& options) {
  return std::make_shared<HybridBarcodeScanner>(options.barcodeFormats);
}

} // namespace margelo::nitro::camera::zxing
