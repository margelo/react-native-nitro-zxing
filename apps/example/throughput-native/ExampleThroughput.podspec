Pod::Spec.new do |s|
  s.name = 'ExampleThroughput'
  s.version = '0.0.0'
  s.summary = 'Native transport for the example throughput benchmark'
  s.homepage = 'https://github.com/margelo/react-native-nitro-zxing'
  s.license = 'MIT'
  s.author = 'Margelo'
  s.source = { :git => s.homepage }
  s.platforms = { :ios => '15.5' }
  s.source_files = 'ios/**/*.swift'
  load 'nitrogen/generated/ios/ExampleThroughput+autolinking.rb'
  add_nitrogen_files(s)
  s.dependency 'VisionCamera'
  install_modules_dependencies(s)
end
