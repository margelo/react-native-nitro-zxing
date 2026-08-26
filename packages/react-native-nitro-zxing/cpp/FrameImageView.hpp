#pragma once

#include "ImageView.h"

#include <NitroModules/ArrayBuffer.hpp>
#include <VisionCamera/HybridFramePlaneSpec.hpp>
#include <VisionCamera/HybridFrameSpec.hpp>

#include <memory>
#include <vector>

namespace margelo::nitro::camera::zxing {

/**
 * Wraps a VisionCamera `Frame` as a zero-copy `ZXing::ImageView`, rotated upright by the Frame's orientation.
 * Keeps the Frame, its planes and the pixel `ArrayBuffer` alive for as long as this object lives.
 * All calls into the Frame happen in the constructor, so the Frame must still be valid when it runs.
 */
class FrameImageView final {
public:
  explicit FrameImageView(const std::shared_ptr<camera::HybridFrameSpec>& frame);

  const ZXing::ImageView& imageView() const noexcept {
    return _view;
  }

private:
  std::shared_ptr<camera::HybridFrameSpec> _frame;
  std::vector<std::shared_ptr<camera::HybridFramePlaneSpec>> _planes;
  std::shared_ptr<ArrayBuffer> _buffer;
  ZXing::ImageView _view;
};

} // namespace margelo::nitro::camera::zxing
