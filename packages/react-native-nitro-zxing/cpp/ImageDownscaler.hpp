#pragma once

#include "ImageView.h"

#include <cstdint>
#include <vector>

namespace margelo::nitro::camera::zxing {

/**
 * Box-averages `image` down by an integer `factor` into a compact luminance buffer,
 * converting colour input to luminance in the same pass.
 *
 * Averaging (rather than dropping pixels) keeps barcode edges intact: plain subsampling
 * aliases the fine bar/module pattern and can make a readable code undecodable.
 *
 * @returns the pixel data; `outView` is a view onto it and stays valid while it is alive.
 */
std::vector<uint8_t> downscaleToLuminance(const ZXing::ImageView& image, int factor, ZXing::ImageView& outView);

} // namespace margelo::nitro::camera::zxing
