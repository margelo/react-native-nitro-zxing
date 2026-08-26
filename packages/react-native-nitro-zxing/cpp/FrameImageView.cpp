#include "FrameImageView.hpp"

#include <stdexcept>
#include <string>

namespace margelo::nitro::camera::zxing {

namespace {

  // Clockwise rotation that makes the buffer upright: `orientation` describes how the content is
  // currently rotated (VisionCamera maps CameraX's rotationDegrees=90 to LEFT), so we rotate back.
  int rotationDegrees(camera::CameraOrientation orientation) {
    switch (orientation) {
      case camera::CameraOrientation::UP:
        return 0;
      case camera::CameraOrientation::LEFT:
        return 90;
      case camera::CameraOrientation::DOWN:
        return 180;
      case camera::CameraOrientation::RIGHT:
        return 270;
    }
    return 0;
  }

} // namespace

FrameImageView::FrameImageView(const std::shared_ptr<camera::HybridFrameSpec>& frame) : _frame(frame) {
  if (frame == nullptr || !frame->getIsValid()) {
    throw std::runtime_error("The given Frame is invalid or has already been disposed!");
  }
  const int width = static_cast<int>(frame->getWidth());
  const int height = static_cast<int>(frame->getHeight());
  const camera::PixelFormat pixelFormat = frame->getPixelFormat();

  switch (pixelFormat) {
    case camera::PixelFormat::YUV_420_8_BIT_VIDEO:
    case camera::PixelFormat::YUV_420_8_BIT_FULL: {
      // Luminance is plane 0 - read it in place, no conversion needed.
      _planes = frame->getPlanes();
      if (_planes.empty()) {
        throw std::runtime_error("The given YUV Frame has no planes!");
      }
      _buffer = _planes[0]->getPixelBuffer();
      const int rowStride = static_cast<int>(_planes[0]->getBytesPerRow());
      const uint8_t* data = _buffer->data();
      _view = ZXing::ImageView(data, width, height, ZXing::ImageFormat::Lum, rowStride);
      break;
    }
    case camera::PixelFormat::RGB_BGRA_8_BIT:
    case camera::PixelFormat::RGB_RGBA_8_BIT:
    case camera::PixelFormat::RGB_RGB_8_BIT: {
      _buffer = frame->getPixelBuffer();
      const int rowStride = static_cast<int>(frame->getBytesPerRow());
      ZXing::ImageFormat format = ZXing::ImageFormat::RGB;
      if (pixelFormat == camera::PixelFormat::RGB_BGRA_8_BIT) {
        format = ZXing::ImageFormat::BGRA;
      } else if (pixelFormat == camera::PixelFormat::RGB_RGBA_8_BIT) {
        format = ZXing::ImageFormat::RGBA;
      }
      const uint8_t* data = _buffer->data();
      _view = ZXing::ImageView(data, width, height, format, rowStride);
      break;
    }
    default:
      throw std::runtime_error("Unsupported Frame pixelFormat (" + std::to_string(static_cast<int>(pixelFormat)) +
                               ")! Use a Frame Output with pixelFormat 'yuv' or 'rgb'.");
  }

  // ponytail: isMirrored is ignored - zxing decodes mirrored symbols and the ML Kit reference ignores it on Android too.
  const int rotation = rotationDegrees(frame->getOrientation());
  _view = _view.rotated(rotation);
}

} // namespace margelo::nitro::camera::zxing
