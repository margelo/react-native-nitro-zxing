// https://github.com/react-native-community/cli/blob/main/docs/dependencies.md
//
// This package has no Android Gradle module: every Hybrid Object is implemented in C++, so
// React Native compiles `android/CMakeLists.txt` straight into the app's libappmodules.so.

/**
 * @type {import('@react-native-community/cli-types').UserDependencyConfig}
 */
module.exports = {
  dependency: {
    platforms: {
      ios: {},
      android: {
        cxxModuleCMakeListsModuleName: 'VisionCameraZxing',
        cxxModuleCMakeListsPath: 'CMakeLists.txt',
        cxxModuleHeaderName: 'VisionCameraZxingModule',
      },
    },
  },
}
