// Binärschnittstelle älterer VST-Plugins (Version 2.x, .dll), soweit ein Host sie braucht.
// Eigene Beschreibung der Schnittstelle (Strukturaufbau und Befehlsnummern), kein Code aus dem Steinberg-SDK.
#pragma once
#include <cstdint>

namespace v2abi {

struct AEffect;
typedef intptr_t (*HostCallback)(AEffect*, int32_t op, int32_t index, intptr_t value, void* ptr, float opt);

struct AEffect {
  int32_t magic;  // 'VstP'
  intptr_t (*dispatcher)(AEffect*, int32_t op, int32_t index, intptr_t value, void* ptr, float opt);
  void (*processOld)(AEffect*, float** in, float** out, int32_t frames);
  void (*setParameter)(AEffect*, int32_t index, float value);
  float (*getParameter)(AEffect*, int32_t index);
  int32_t numPrograms, numParams, numInputs, numOutputs;
  int32_t flags;
  intptr_t reserved1, reserved2;
  int32_t initialDelay;
  int32_t realQualities, offQualities;
  float ioRatio;
  void* object;
  void* user;
  int32_t uniqueID;
  int32_t version;
  void (*processReplacing)(AEffect*, float** in, float** out, int32_t frames);
  void (*processDoubleReplacing)(AEffect*, double** in, double** out, int32_t frames);
  char future[56];
};

const int32_t kMagic = 0x56737450;  // 'VstP'
// AEffect::flags
enum { fHasEditor = 1, fCanReplacing = 1 << 4, fProgramChunks = 1 << 5, fIsSynth = 1 << 8 };
// Befehle an das Plugin (dispatcher)
enum {
  effOpen = 0, effClose = 1, effSetProgram = 2, effGetProgram = 3, effGetParamLabel = 6, effGetParamDisplay = 7, effGetParamName = 8,
  effSetSampleRate = 10, effSetBlockSize = 11, effMainsChanged = 12, effEditGetRect = 13, effEditOpen = 14, effEditClose = 15, effEditIdle = 19,
  effGetChunk = 23, effSetChunk = 24, effProcessEvents = 25, effCanBeAutomated = 26, effGetPlugCategory = 35, effGetEffectName = 45,
  effGetVendorString = 47, effGetProductString = 48, effGetVendorVersion = 49, effCanDo = 51, effGetVstVersion = 58,
  effStartProcess = 71, effStopProcess = 72, effSetProcessPrecision = 77
};
// Fragen des Plugins an den Host
enum {
  amAutomate = 0, amVersion = 1, amCurrentId = 2, amIdle = 3, amGetTime = 7, amProcessEvents = 8, amIOChanged = 13, amSizeWindow = 15,
  amGetSampleRate = 16, amGetBlockSize = 17, amGetInputLatency = 18, amGetOutputLatency = 19, amGetCurrentProcessLevel = 23,
  amGetAutomationState = 24, amGetVendorString = 32, amGetProductString = 33, amGetVendorVersion = 34, amCanDo = 37, amGetLanguage = 38,
  amUpdateDisplay = 42, amBeginEdit = 43, amEndEdit = 44
};
enum { kCategSynth = 2, kCategShell = 10 };

struct TimeInfo {
  double samplePos, sampleRate, nanoSeconds, ppqPos, tempo, barStartPos, cycleStartPos, cycleEndPos;
  int32_t timeSigNumerator, timeSigDenominator, smpteOffset, smpteFrameRate, samplesToNextClock, flags;
};
enum { tChanged = 1, tPlaying = 1 << 1, tPpqValid = 1 << 9, tTempoValid = 1 << 10, tBarsValid = 1 << 11, tTimeSigValid = 1 << 13 };

struct MidiEvent {
  int32_t type;  // 1 = MIDI
  int32_t byteSize;
  int32_t deltaFrames;
  int32_t flags;
  int32_t noteLength, noteOffset;
  char midiData[4];
  char detune, noteOffVelocity, reserved1, reserved2;
};
const int kMaxEvents = 1024;
struct Events {
  int32_t numEvents;
  intptr_t reserved;
  MidiEvent* events[kMaxEvents];
};
struct Rect { int16_t top, left, bottom, right; };

}  // namespace v2abi
