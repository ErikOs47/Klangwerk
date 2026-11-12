// Test-Plugins im älteren VST-Format (Version 2, .dll), nur für die Tests des Hosts.
// Ohne SYNTH: „SG Testgain2“ (Effekt, Parameter Gain 0…1 = ×0…2). Mit -DSYNTH: „SG Testsynth2“ (Sinus pro Note).
#include <windows.h>
#include <cmath>
#include <cstring>
#include "../vst2abi.h"
using namespace v2abi;

static HostCallback gHost;
static float gGain = 0.5f, gRate = 48000;
static int gNote = -1; static double gPhase = 0;
static HWND gChild = nullptr;
static Rect gRect = {0, 0, 120, 300};

static intptr_t dispatch(AEffect*, int32_t op, int32_t, intptr_t, void* ptr, float opt) {
  switch (op) {
    case effSetSampleRate: gRate = opt; return 0;
    case effGetParamName: strcpy((char*)ptr, "Gain"); return 0;
    case effGetParamLabel: strcpy((char*)ptr, ""); return 0;
    case effGetEffectName:
#ifdef SYNTH
      strcpy((char*)ptr, "SG Testsynth2"); return 1;
#else
      strcpy((char*)ptr, "SG Testgain2"); return 1;
#endif
    case effGetVendorString: strcpy((char*)ptr, "Sound Groot"); return 1;
    case effGetPlugCategory:
#ifdef SYNTH
      return kCategSynth;
#else
      return 1;
#endif
    case effCanBeAutomated: return 1;
    case effGetVstVersion: return 2400;
    case effEditGetRect: *(Rect**)ptr = &gRect; return 1;
    case effEditOpen: gChild = CreateWindowExW(0, L"STATIC", L"SG Test", WS_CHILD | WS_VISIBLE, 0, 0, 300, 120, (HWND)ptr, nullptr, nullptr, nullptr); return 1;
    case effEditClose: if (gChild) { DestroyWindow(gChild); gChild = nullptr; } return 1;
    case effProcessEvents: {
      Events* ev = (Events*)ptr;
      for (int i = 0; i < ev->numEvents; i++) {
        MidiEvent* e = ev->events[i]; if (e->type != 1) continue;
        int st = e->midiData[0] & 0xF0, d1 = e->midiData[1] & 127, d2 = e->midiData[2] & 127;
        if (st == 0x90 && d2 > 0) { gNote = d1; gPhase = 0; }
        else if (st == 0x80 || st == 0x90) { if (gNote == d1) gNote = -1; }
        else if (st == 0xB0 && (d1 == 123 || d1 == 120)) gNote = -1;
      }
      return 1;
    }
  }
  return 0;
}
static void setParam(AEffect*, int32_t, float v) { gGain = v; }
static float getParam(AEffect*, int32_t) { return gGain; }
static void process(AEffect* fx, float** in, float** out, int32_t n) {
#ifdef SYNTH
  double f = 440.0 * pow(2.0, (gNote - 69) / 12.0), step = 2 * 3.14159265358979323846 * f / gRate;
  for (int i = 0; i < n; i++) {
    float v = gNote >= 0 ? (float)(sin(gPhase) * gGain) : 0.f; if (gNote >= 0) gPhase += step;
    out[0][i] = v; out[1][i] = v;
  }
#else
  for (int c = 0; c < 2; c++) for (int i = 0; i < n; i++) out[c][i] = in[c][i] * gGain * 2;
#endif
}
static AEffect gFx;

extern "C" __declspec(dllexport) AEffect* VSTPluginMain(HostCallback host) {
  gHost = host;
  if (!host || host(nullptr, amVersion, 0, 0, nullptr, 0) == 0) return nullptr;
  memset(&gFx, 0, sizeof gFx);
  gFx.magic = kMagic; gFx.dispatcher = dispatch; gFx.setParameter = setParam; gFx.getParameter = getParam;
  gFx.processReplacing = process; gFx.numPrograms = 1; gFx.numParams = 1; gFx.numOutputs = 2; gFx.version = 1000;
#ifdef SYNTH
  gFx.numInputs = 0; gFx.flags = fHasEditor | fCanReplacing | fIsSynth; gFx.uniqueID = 0x53473253;  // 'SG2S'
#else
  gFx.numInputs = 2; gFx.flags = fHasEditor | fCanReplacing; gFx.uniqueID = 0x53473247;  // 'SG2G'
#endif
  return &gFx;
}
