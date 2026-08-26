#pragma once

#include "BarcodeFormat.hpp"
#include "BarcodeValueType.hpp"

#include "ContentType.h"

#include <string_view>

namespace margelo::nitro::camera::zxing {

BarcodeValueType classifyValueType(std::string_view plainText, BarcodeFormat format, ZXing::ContentType contentType);

} // namespace margelo::nitro::camera::zxing
