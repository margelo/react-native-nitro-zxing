cmake_minimum_required(VERSION 3.16.0)
project(VisionCameraZxing)

set (PACKAGE_NAME VisionCameraZxing)
set (CMAKE_VERBOSE_MAKEFILE ON)
set (CMAKE_CXX_STANDARD 20)

# zxing-cpp readers only, as a static archive linked into this library
set (ZXING_READERS ON)
set (ZXING_WRITERS OFF)
set (BUILD_SHARED_LIBS OFF)
add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../cpp/zxing-core/core ${CMAKE_CURRENT_BINARY_DIR}/zxing-core EXCLUDE_FROM_ALL)

file(GLOB SHARED_CPP_SOURCES CONFIGURE_DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/../cpp/*.cpp")

# SHARED so the dynamic linker loads it (and runs the Hybrid Object registration) as soon as
# the app's libappmodules.so is loaded. React Native builds and packages it as part of the app's
# own CMake build, so this library still needs no Gradle module of its own.
add_library(${PACKAGE_NAME} SHARED ${SHARED_CPP_SOURCES})

# Add Nitrogen specs :)
include(${CMAKE_CURRENT_SOURCE_DIR}/../nitrogen/generated/android/VisionCameraZxing+autolinking.cmake)

target_include_directories(${PACKAGE_NAME} PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/../cpp")

find_library(LOG_LIB log)
find_package(react-native-vision-camera REQUIRED)   # <-- for the HybridFrameSpec
find_package(react-native-nitro-image REQUIRED)     # <-- for the HybridImageSpec

target_link_libraries(
        ${PACKAGE_NAME}
        ${LOG_LIB}
        android                                   # <-- Android core
        ZXing::ZXing
        react-native-vision-camera::VisionCamera
        react-native-nitro-image::NitroImage
)
