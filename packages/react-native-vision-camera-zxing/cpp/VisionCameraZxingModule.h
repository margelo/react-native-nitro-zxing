#pragma once

// Android-only; see VisionCameraZxingModule.cpp.
#ifdef __ANDROID__

#include <ReactCommon/TurboModule.h>

#include <memory>

namespace facebook::react {

/**
 * React Native's pure-C++ autolinking keys a dependency on a C++ TurboModule, so this type
 * exists to give it something to reference. It exposes no methods: the library's real API is
 * its Nitro Hybrid Objects.
 *
 * Its constructor is deliberately defined out of line. React Native's generated autolinking
 * code references it, which is what pulls this translation unit into the app's library - and
 * with it the Hybrid Object registration that runs when that library is loaded.
 */
class VisionCameraZxingModule : public TurboModule {
public:
  static constexpr auto kModuleName = "VisionCameraZxing";

  explicit VisionCameraZxingModule(std::shared_ptr<CallInvoker> jsInvoker);
};

} // namespace facebook::react

#endif // __ANDROID__
