project(VisionCameraZxing)
cmake_minimum_required(VERSION 3.16.0)

set (PACKAGE_NAME VisionCameraZxing)
set (CMAKE_VERBOSE_MAKEFILE ON)
set (CMAKE_CXX_STANDARD 20)

# zxing-cpp readers only, as a static archive linked into our shared library
set (ZXING_READERS ON)
set (ZXING_WRITERS OFF)
set (BUILD_SHARED_LIBS OFF)
add_subdirectory(${CMAKE_SOURCE_DIR}/../cpp/zxing-core/core ${CMAKE_BINARY_DIR}/zxing-core EXCLUDE_FROM_ALL)

file(GLOB SHARED_CPP_SOURCES CONFIGURE_DEPENDS "${CMAKE_SOURCE_DIR}/../cpp/*.cpp")

# Define C++ library and add all sources
add_library(${PACKAGE_NAME} SHARED
        src/main/cpp/cpp-adapter.cpp
        ${SHARED_CPP_SOURCES}
)

# Add Nitrogen specs :)
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/VisionCameraZxing+autolinking.cmake)

# Set up local includes
include_directories(
        "src/main/cpp"
        "../cpp"
)

find_library(LOG_LIB log)
find_package(react-native-vision-camera REQUIRED)   # <-- for the HybridFrameSpec
find_package(react-native-nitro-image REQUIRED)     # <-- for the HybridImageSpec

# Link all libraries together
target_link_libraries(
        ${PACKAGE_NAME}
        ${LOG_LIB}
        android                                   # <-- Android core
        ZXing::ZXing
        react-native-vision-camera::VisionCamera
        react-native-nitro-image::NitroImage
)
