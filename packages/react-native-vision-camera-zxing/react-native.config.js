// https://github.com/react-native-community/cli/blob/main/docs/dependencies.md
//
// This package has no Android directory at all: every Hybrid Object is implemented in C++, so
// React Native builds `cpp/CMakeLists.txt` as part of the app's own native build.

/**
 * @type {import('@react-native-community/cli-types').UserDependencyConfig}
 */
module.exports = {
  dependency: {
    platforms: {
      ios: {},
      android: {
        // No android/ directory: point the CLI at the folder holding this library's CMakeLists.
        sourceDir: 'cmake',
        cxxModuleCMakeListsModuleName: 'VisionCameraZxing',
        cxxModuleCMakeListsPath: 'CMakeLists.txt',
        cxxModuleHeaderName: 'VisionCameraZxingModule',
      },
    },
  },
}
