require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "VisionCameraZxing"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported, :visionos => 1.0 }
  s.source       = { :git => "https://github.com/margelo/react-native-vision-camera-zxing.git", :tag => "v#{s.version}" }

  s.source_files = [
    # Autolinking/Registration (Objective-C++)
    "ios/**/*.{m,mm}",
    # Implementation (C++ objects)
    "cpp/*.{hpp,cpp}",
    # zxing-cpp readers (git submodule)
    "cpp/zxing-core/core/src/**/*.{h,c,cpp}",
  ]
  s.exclude_files = [
    "cpp/zxing-core/core/src/libzint/**",
    "cpp/zxing-core/core/src/ZXingC.cpp",
  ]
  s.private_header_files = [
    "cpp/*.hpp",
    "cpp/zxing-core/core/src/**/*.h",
  ]
  s.compiler_flags = "-DZXING_INTERNAL -Wno-comma"
  s.pod_target_xcconfig = {
    "HEADER_SEARCH_PATHS" => '"$(PODS_TARGET_SRCROOT)/cpp/zxing-core/core/src" "$(PODS_TARGET_SRCROOT)/cpp/zxing-core/wrappers/ios/Sources/Wrapper"',
    # Header maps resolve by basename across all pods (e.g. React's Point.h or another
    # barcode pod's BarcodeFormat.hpp would shadow ours); use the search paths above instead.
    "USE_HEADERMAP" => "NO",
  }

  load 'nitrogen/generated/ios/VisionCameraZxing+autolinking.rb'
  add_nitrogen_files(s)

  s.dependency 'VisionCamera'
  s.dependency 'NitroImage'
  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  install_modules_dependencies(s)
end
