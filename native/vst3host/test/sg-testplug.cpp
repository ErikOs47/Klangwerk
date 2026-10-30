// Test-Plugins für den VST3-Host (nicht Teil der App): „SG Testsynth“ (Instrument, Sinus) und „SG Testgain“ (Effekt).
// Beide haben einen Regler, speichern ihn als Zustand und bringen eine winzige Win32-Oberfläche mit einem Knopf mit,
// der den Regler über performEdit verstellt. So lassen sich Laden, Klang, Noten, Zustand und Editor ohne fremde Plugins prüfen.
#include <windows.h>
#include "public.sdk/source/vst/vstsinglecomponenteffect.h"
#include "public.sdk/source/main/pluginfactory.h"
#include "public.sdk/source/common/pluginview.h"
#include "pluginterfaces/vst/ivstevents.h"
#include "pluginterfaces/vst/ivstparameterchanges.h"
#include "pluginterfaces/base/ibstream.h"
#include <cmath>

using namespace Steinberg;
using namespace Steinberg::Vst;

static const FUID SynthUID(0x5347A001, 0x11112222, 0x33334444, 0x55556666);
static const FUID GainUID(0x5347A002, 0x11112222, 0x33334444, 0x55556666);

class TestView : public CPluginView {
 public:
  TestView(EditController* c) : CPluginView(nullptr), ctrl(c) { rect = ViewRect(0, 0, 240, 90); }
  tresult PLUGIN_API isPlatformTypeSupported(FIDString t) override { return strcmp(t, kPlatformTypeHWND) == 0 ? kResultTrue : kResultFalse; }
  void attachedToParent() override {
    btn = CreateWindowW(L"BUTTON", L"Lauter", WS_CHILD | WS_VISIBLE, 20, 20, 200, 50, (HWND)systemWindow, (HMENU)1, nullptr, nullptr);
    SetWindowSubclass();
  }
  void removedFromParent() override { if (btn) DestroyWindow(btn); btn = nullptr; }
  void click() {
    ParamValue v = std::fmin(1.0, ctrl->getParamNormalized(0) + 0.1);
    ctrl->setParamNormalized(0, v); ctrl->beginEdit(0); ctrl->performEdit(0, v); ctrl->endEdit(0);
  }
 private:
  // Der Elternfenster-Prozess gehört dem Host, deshalb den Klick über einen Timer abfragen statt das Fenster umzuleiten
  void SetWindowSubclass() { SetTimer(btn, 1, 50, [](HWND w, UINT, UINT_PTR, DWORD) {
      if (SendMessageW(w, BM_GETSTATE, 0, 0) & BST_PUSHED) { auto* v = (TestView*)GetWindowLongPtrW(w, GWLP_USERDATA); if (v && !v->down) { v->down = true; v->click(); } }
      else if (auto* v = (TestView*)GetWindowLongPtrW(w, GWLP_USERDATA)) v->down = false; });
    SetWindowLongPtrW(btn, GWLP_USERDATA, (LONG_PTR)this); }
  EditController* ctrl; HWND btn = nullptr; bool down = false;
};

class TestPlug : public SingleComponentEffect {
 public:
  TestPlug(bool synth) : synth(synth) {}
  tresult PLUGIN_API initialize(FUnknown* ctx) override {
    tresult r = SingleComponentEffect::initialize(ctx); if (r != kResultOk) return r;
    if (!synth) addAudioInput(STR16("In"), SpeakerArr::kStereo);
    addAudioOutput(STR16("Out"), SpeakerArr::kStereo);
    if (synth) addEventInput(STR16("MIDI"), 16);
    parameters.addParameter(synth ? STR16("Lautstaerke") : STR16("Gain"), nullptr, 0, 0.5, ParameterInfo::kCanAutomate, 0);
    return kResultOk;
  }
  tresult PLUGIN_API setupProcessing(ProcessSetup& s) override { sr = s.sampleRate; return SingleComponentEffect::setupProcessing(s); }
  tresult PLUGIN_API process(ProcessData& d) override {
    if (auto* pc = d.inputParameterChanges)
      for (int32 i = 0; i < pc->getParameterCount(); i++) {
        auto* q = pc->getParameterData(i); ParamValue v; int32 off;
        if (q && q->getParameterId() == 0 && q->getPoint(q->getPointCount() - 1, off, v) == kResultOk) vol = v;
      }
    if (auto* ev = d.inputEvents)
      for (int32 i = 0; i < ev->getEventCount(); i++) {
        Event e; ev->getEvent(i, e);
        if (e.type == Event::kNoteOnEvent) { note = e.noteOn.pitch; amp = e.noteOn.velocity; }
        if (e.type == Event::kNoteOffEvent && e.noteOff.pitch == note) note = -1;
      }
    if (d.numOutputs < 1 || d.numSamples < 1) return kResultOk;
    double f = note >= 0 ? 440.0 * std::pow(2.0, (note - 69) / 12.0) : 0;
    for (int32 s = 0; s < d.numSamples; s++) {
      float y;
      if (synth) { y = note >= 0 ? (float)(std::sin(ph) * amp * vol) : 0.f; ph += 2 * M_PI * f / sr; }
      else y = 0;
      for (int32 c = 0; c < d.outputs[0].numChannels; c++)
        d.outputs[0].channelBuffers32[c][s] = synth ? y : d.inputs[0].channelBuffers32[c][s] * (float)(vol * 2);
    }
    return kResultOk;
  }
  tresult PLUGIN_API setState(IBStream* s) override { double v; int32 n = 0; if (s->read(&v, 8, &n) == kResultOk && n == 8) { vol = v; setParamNormalized(0, v); } return kResultOk; }
  tresult PLUGIN_API getState(IBStream* s) override { double v = vol; return s->write(&v, 8, nullptr); }
  IPlugView* PLUGIN_API createView(FIDString name) override { return strcmp(name, ViewType::kEditor) == 0 ? new TestView(this) : nullptr; }
  static FUnknown* newSynth(void*) { return (IAudioProcessor*)new TestPlug(true); }
  static FUnknown* newGain(void*) { return (IAudioProcessor*)new TestPlug(false); }
 private:
  bool synth; double sr = 48000, ph = 0, vol = 0.5; int note = -1; float amp = 0;
};

bool InitModule() { return true; }
bool DeinitModule() { return true; }

BEGIN_FACTORY_DEF("Sound Groot", "https://erikos47.github.io/Klangwerk/", "")
DEF_CLASS2(INLINE_UID_FROM_FUID(SynthUID), PClassInfo::kManyInstances, kVstAudioEffectClass, "SG Testsynth", 0, "Instrument|Synth", "1.0", kVstVersionString, TestPlug::newSynth)
DEF_CLASS2(INLINE_UID_FROM_FUID(GainUID), PClassInfo::kManyInstances, kVstAudioEffectClass, "SG Testgain", 0, "Fx", "1.0", kVstVersionString, TestPlug::newGain)
END_FACTORY
