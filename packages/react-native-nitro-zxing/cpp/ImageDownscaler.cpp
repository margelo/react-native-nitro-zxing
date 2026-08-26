#include "ImageDownscaler.hpp"

namespace margelo::nitro::camera::zxing {

std::vector<uint8_t> downscaleToLuminance(const ZXing::ImageView& image, int factor, ZXing::ImageView& outView) {
  const int width = image.width() / factor;
  const int height = image.height() / factor;
  const int pixelStride = image.pixStride();
  const int redIndex = ZXing::RedIndex(image.format());
  const int greenIndex = ZXing::GreenIndex(image.format());
  const int blueIndex = ZXing::BlueIndex(image.format());
  const bool isLuminance = image.format() == ZXing::ImageFormat::Lum;
  const unsigned samples = static_cast<unsigned>(factor) * static_cast<unsigned>(factor);

  std::vector<uint8_t> pixels(static_cast<size_t>(width) * static_cast<size_t>(height));
  for (int y = 0; y < height; y++) {
    for (int x = 0; x < width; x++) {
      unsigned sum = 0;
      for (int blockY = 0; blockY < factor; blockY++) {
        const uint8_t* row = image.data(x * factor, y * factor + blockY);
        for (int blockX = 0; blockX < factor; blockX++) {
          const uint8_t* pixel = row + blockX * pixelStride;
          sum += isLuminance ? *pixel : ZXing::RGBToLum(pixel[redIndex], pixel[greenIndex], pixel[blueIndex]);
        }
      }
      pixels[static_cast<size_t>(y) * static_cast<size_t>(width) + static_cast<size_t>(x)] = static_cast<uint8_t>(sum / samples);
    }
  }
  outView = ZXing::ImageView(pixels.data(), width, height, ZXing::ImageFormat::Lum);
  return pixels;
}

} // namespace margelo::nitro::camera::zxing
