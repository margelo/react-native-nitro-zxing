#include "VisionCameraZxingModule.h"

#include "VisionCameraZxingOnLoad.hpp"

namespace facebook::react {

VisionCameraZxingModule::VisionCameraZxingModule(std::shared_ptr<CallInvoker> jsInvoker)
    : TurboModule(kModuleName, std::move(jsInvoker)) {}

} // namespace facebook::react

namespace margelo::nitro::camera::zxing {
namespace {

/**
 * Registers this module's Hybrid Objects when the library it is linked into is loaded.
 *
 * Every Hybrid Object here is implemented in C++, so registration only touches Nitro's
 * registry: there are no JNI methods to bind, and so no `JNI_OnLoad`, `System.loadLibrary`
 * or Java/Kotlin package class is involved.
 */
struct AutoRegister {
  AutoRegister() {
    registerAllNatives();
  }
};

const AutoRegister autoRegister;

} // namespace
} // namespace margelo::nitro::camera::zxing
