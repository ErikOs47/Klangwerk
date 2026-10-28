#!/usr/bin/env bash
# Baut native/bin/sg-vst3host.exe unter Linux (Cross-Build mit MinGW-w64).
# Braucht: git, cmake, ninja, mingw-w64. Das Steinberg VST3 SDK (MIT) wird in native/vst3host/.sdk geholt.
set -euo pipefail
cd "$(dirname "$0")/.."
SDK_TAG=v3.8.1_build_84
SDK=native/vst3host/.sdk
if [ ! -d "$SDK/pluginterfaces" ]; then
  rm -rf "$SDK"
  git clone -q --depth 1 --branch "$SDK_TAG" https://github.com/steinbergmedia/vst3sdk.git "$SDK"
  git -C "$SDK" submodule -q update --init --depth 1 base pluginterfaces public.sdk
fi
cmake -S native/vst3host -B build/vst3host -G Ninja -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_TOOLCHAIN_FILE="$PWD/native/vst3host/mingw-toolchain.cmake" -DVST3_SDK_DIR="$PWD/$SDK"
cmake --build build/vst3host
mkdir -p native/bin
x86_64-w64-mingw32-strip -o native/bin/sg-vst3host.exe build/vst3host/sg-vst3host.exe
echo "native/bin/sg-vst3host.exe gebaut"
