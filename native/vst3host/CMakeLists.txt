# VST3-Host für Sound Groot (nur Windows). Baut gegen das Steinberg VST3 SDK (MIT-Lizenz seit Version 3.8),
# ohne dessen eigene CMake-Skripte: nur die Dateien, die ein Host braucht.
#   cmake -S native/vst3host -B build/vst3host -DVST3_SDK_DIR=<Pfad zum vst3sdk>
# scripts/build-vst3host.sh holt das SDK und baut unter Linux mit MinGW, die GitHub-Action unter Windows mit MSVC.
cmake_minimum_required(VERSION 3.20)
project(sg-vst3host CXX RC)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
if(NOT VST3_SDK_DIR)
  message(FATAL_ERROR "VST3_SDK_DIR fehlt")
endif()
set(S ${VST3_SDK_DIR})

add_executable(sg-vst3host
  sg-vst3host.cpp
  sg-vst3host.rc
  ${S}/base/source/baseiids.cpp
  ${S}/base/source/fbuffer.cpp
  ${S}/base/source/fdebug.cpp
  ${S}/base/source/fobject.cpp
  ${S}/base/source/fstreamer.cpp
  ${S}/base/source/fstring.cpp
  ${S}/base/source/updatehandler.cpp
  ${S}/base/thread/source/flock.cpp
  ${S}/base/thread/source/fcondition.cpp
  ${S}/pluginterfaces/base/conststringtable.cpp
  ${S}/pluginterfaces/base/coreiids.cpp
  ${S}/pluginterfaces/base/funknown.cpp
  ${S}/pluginterfaces/base/ustring.cpp
  ${S}/public.sdk/source/common/commoniids.cpp
  ${S}/public.sdk/source/common/commonstringconvert.cpp
  ${S}/public.sdk/source/common/memorystream.cpp
  ${S}/public.sdk/source/common/threadchecker_win32.cpp
  ${S}/public.sdk/source/vst/vstinitiids.cpp
  ${S}/public.sdk/source/vst/utility/stringconvert.cpp
  ${S}/public.sdk/source/vst/hosting/connectionproxy.cpp
  ${S}/public.sdk/source/vst/hosting/eventlist.cpp
  ${S}/public.sdk/source/vst/hosting/hostclasses.cpp
  ${S}/public.sdk/source/vst/hosting/module.cpp
  ${S}/public.sdk/source/vst/hosting/module_win32.cpp
  ${S}/public.sdk/source/vst/hosting/parameterchanges.cpp
  ${S}/public.sdk/source/vst/hosting/pluginterfacesupport.cpp
  ${S}/public.sdk/source/vst/hosting/plugprovider.cpp
  ${S}/public.sdk/source/vst/hosting/processdata.cpp
)
target_include_directories(sg-vst3host PRIVATE ${S})
target_compile_definitions(sg-vst3host PRIVATE RELEASE=1 UNICODE _UNICODE NOMINMAX WIN32_LEAN_AND_MEAN)
target_link_libraries(sg-vst3host PRIVATE ws2_32 ole32 shell32 user32 gdi32)
if(MSVC)
  target_compile_options(sg-vst3host PRIVATE /utf-8 /W3)
  set_property(TARGET sg-vst3host PROPERTY MSVC_RUNTIME_LIBRARY "MultiThreaded")
  # Konsolenprogramm mit wmain, aber ohne Konsolenfenster
  target_link_options(sg-vst3host PRIVATE /SUBSYSTEM:WINDOWS /ENTRY:wmainCRTStartup)
else()
  target_link_options(sg-vst3host PRIVATE -municode -mwindows -static -static-libgcc -static-libstdc++)
endif()

# Test-Plugins (nur für die eigenen Tests, nicht Teil der App): cmake … -DSG_TESTPLUG=ON
option(SG_TESTPLUG "Test-Plugins bauen" OFF)
if(SG_TESTPLUG)
  add_library(sg-testplug MODULE
    test/sg-testplug.cpp
    ${S}/base/source/baseiids.cpp
    ${S}/base/source/fbuffer.cpp
    ${S}/base/source/fdebug.cpp
    ${S}/base/source/fobject.cpp
    ${S}/base/source/fstreamer.cpp
    ${S}/base/source/fstring.cpp
    ${S}/base/source/updatehandler.cpp
    ${S}/base/thread/source/flock.cpp
    ${S}/base/thread/source/fcondition.cpp
    ${S}/pluginterfaces/base/conststringtable.cpp
    ${S}/pluginterfaces/base/coreiids.cpp
    ${S}/pluginterfaces/base/funknown.cpp
    ${S}/pluginterfaces/base/ustring.cpp
    ${S}/public.sdk/source/common/commoniids.cpp
    ${S}/public.sdk/source/common/pluginview.cpp
    ${S}/public.sdk/source/main/dllmain.cpp
    ${S}/public.sdk/source/main/pluginfactory.cpp
    ${S}/public.sdk/source/vst/vstinitiids.cpp
    ${S}/public.sdk/source/vst/vstbus.cpp
    ${S}/public.sdk/source/vst/vstcomponentbase.cpp
    ${S}/public.sdk/source/vst/vstparameters.cpp
    ${S}/public.sdk/source/vst/vstsinglecomponenteffect.cpp
  )
  target_include_directories(sg-testplug PRIVATE ${S})
  target_compile_definitions(sg-testplug PRIVATE RELEASE=1 UNICODE _UNICODE NOMINMAX _USE_MATH_DEFINES)
  set_target_properties(sg-testplug PROPERTIES PREFIX "" SUFFIX ".vst3")
  if(NOT MSVC)
    target_link_options(sg-testplug PRIVATE -static -static-libgcc -static-libstdc++)
  endif()
endif()
