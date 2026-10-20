require "json"
require "pathname"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# NitroModules' public headers include some of its non-public headers by bare name (e.g.
# ArrayBuffer.hpp includes "BorrowingReference.hpp"). Other pods find those through header maps,
# which this pod turns off below, so we search NitroModules' sources directly instead.
nitro_modules_dir = File.dirname(Pod::Executable.execute_command('node', ['-p',
  'require.resolve("react-native-nitro-modules/package.json", {paths: [process.argv[1]]})',
  __dir__]).strip)
nitro_modules_cpp_dir = Pathname.new(File.join(nitro_modules_dir, "cpp"))
  .relative_path_from(Pod::Config.instance.project_pods_root).to_s

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
  # Turning header maps off also drops the overlay that maps each framework header back to its
  # source file. Without it, use_frameworks! builds see NitroModules' headers twice (the copy in
  # NitroModules.framework and the source file found via the search path), so add it back.
  product_headers_vfs = '"$(CPP_HEADERMAP_PRODUCT_HEADERS_VFS_FILE)"'
  s.pod_target_xcconfig = {
    "HEADER_SEARCH_PATHS" => [
      '"$(PODS_TARGET_SRCROOT)/cpp/zxing-core/core/src"',
      '"$(PODS_TARGET_SRCROOT)/cpp/zxing-core/wrappers/ios/Sources/Wrapper"',
      # Our own headers, which static builds also find through Pods/Headers/Private
      '"$(PODS_TARGET_SRCROOT)/cpp"',
      '"$(PODS_TARGET_SRCROOT)/nitrogen/generated/shared/c++"',
      "\"$(PODS_ROOT)/#{nitro_modules_cpp_dir}/**\"",
    ].join(" "),
    # Header maps resolve by basename across all pods (e.g. React's Point.h or another
    # barcode pod's BarcodeFormat.hpp would shadow ours); use the search paths above instead.
    "USE_HEADERMAP" => "NO",
    "OTHER_CFLAGS" => "$(inherited) -ivfsoverlay #{product_headers_vfs}",
    "OTHER_CPLUSPLUSFLAGS" => "$(inherited) -ivfsoverlay #{product_headers_vfs}",
    "OTHER_SWIFT_FLAGS" => "$(inherited) -Xcc -ivfsoverlay -Xcc #{product_headers_vfs}",
  }

  load 'nitrogen/generated/ios/VisionCameraZxing+autolinking.rb'
  add_nitrogen_files(s)

  s.dependency 'VisionCamera'
  s.dependency 'NitroImage'
  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  install_modules_dependencies(s)
end
