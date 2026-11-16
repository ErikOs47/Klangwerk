// sg-vst3host: lädt genau ein VST-Plugin in einem eigenen Prozess, damit ein abstürzendes Plugin Sound Groot nicht mitreißt.
// Geladen werden VST3 (.vst3) und ältere VST-Plugins der Version 2 (.dll, 64 Bit).
//
//   sg-vst3host --scan <Pfad.vst3|.dll>            Listet die Klangklassen des Moduls als JSON-Zeilen und beendet sich.
//   sg-vst3host --run <Pfad.vst3|.dll> --cid <ID> --sr <Abtastrate> --token <Zufallswort> [--title <Fenstertitel>]
//
// Im Modus --run gilt:
//   - Die erste Zeile auf stdout ist {"ready":true,"port":…,…} oder {"error":"…"}.
//   - Steuerbefehle kommen zeilenweise über stdin: "<nr> <befehl> [argument]", Antwort "<nr> ok [daten]" oder "<nr> err <text>".
//     Befehle: getstate, setstate <base64>, params, edit, close, quit. Ungefragte Meldungen beginnen mit "- " (z. B. "- edited").
//     params liefert die automatisierbaren Parameter als JSON: [{"id":…,"n":Name,"u":Einheit,"d":Standard,"v":Wert,"s":Stufen}], Werte normiert 0…1.
//   - Audio läuft über einen WebSocket auf 127.0.0.1:<port>/<token>, ein Binärpaket pro Block (Aufbau siehe processPacket).
//   - Endet stdin (Sound Groot beendet oder abgestürzt), beendet sich auch der Host.

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <ole2.h>
#include <fcntl.h>
#include <io.h>

#include "public.sdk/source/vst/hosting/module.h"
#include "public.sdk/source/vst/hosting/plugprovider.h"
#include "public.sdk/source/vst/hosting/hostclasses.h"
#include "public.sdk/source/vst/hosting/processdata.h"
#include "public.sdk/source/vst/hosting/eventlist.h"
#include "public.sdk/source/vst/hosting/parameterchanges.h"
#include "public.sdk/source/vst/utility/stringconvert.h"
#include "public.sdk/source/common/memorystream.h"
#include "pluginterfaces/base/funknownimpl.h"
#include "pluginterfaces/gui/iplugview.h"
#include "pluginterfaces/gui/iplugviewcontentscalesupport.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/ivsteditcontroller.h"
#include "pluginterfaces/vst/ivstmidicontrollers.h"
#include "pluginterfaces/vst/ivstprocesscontext.h"
#include "pluginterfaces/vst/ivstevents.h"
#include "vst2abi.h"

#include <atomic>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <iostream>
#include <map>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

using namespace Steinberg;
using namespace Steinberg::Vst;

// ---------------------------------------------------------------- Hilfsfunktionen
static std::mutex outMx;
static void sendLine(const std::string& s) {
  std::lock_guard<std::mutex> lk(outMx);
  fwrite(s.data(), 1, s.size(), stdout); fputc('\n', stdout); fflush(stdout);
}
static std::string jsonStr(const std::string& s) {
  std::string o = "\"";
  for (unsigned char c : s) {
    if (c == '"' || c == '\\') { o += '\\'; o += (char)c; }
    else if (c < 0x20) { char b[8]; snprintf(b, sizeof b, "\\u%04x", c); o += b; }
    else o += (char)c;
  }
  return o + "\"";
}
static const char* B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
static std::string b64enc(const uint8_t* p, size_t n) {
  std::string o; o.reserve((n + 2) / 3 * 4);
  for (size_t i = 0; i < n; i += 3) {
    uint32_t v = p[i] << 16 | (i + 1 < n ? p[i + 1] << 8 : 0) | (i + 2 < n ? p[i + 2] : 0);
    o += B64[v >> 18 & 63]; o += B64[v >> 12 & 63];
    o += i + 1 < n ? B64[v >> 6 & 63] : '='; o += i + 2 < n ? B64[v & 63] : '=';
  }
  return o;
}
static std::vector<uint8_t> b64dec(const std::string& s) {
  std::vector<uint8_t> o; uint32_t v = 0; int bits = 0;
  for (char c : s) {
    const char* k = strchr(B64, c); if (!k || !c) continue;
    v = v << 6 | (uint32_t)(k - B64); bits += 6;
    if (bits >= 8) { bits -= 8; o.push_back((uint8_t)(v >> bits)); }
  }
  return o;
}
// SHA-1, nur für den WebSocket-Handshake
static std::string sha1(const std::string& msg) {
  uint32_t h[5] = {0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0};
  std::string m = msg; uint64_t bl = (uint64_t)msg.size() * 8;
  m += (char)0x80; while (m.size() % 64 != 56) m += (char)0;
  for (int i = 7; i >= 0; i--) m += (char)(bl >> (i * 8));
  auto rol = [](uint32_t x, int n) { return x << n | x >> (32 - n); };
  for (size_t off = 0; off < m.size(); off += 64) {
    uint32_t w[80];
    for (int i = 0; i < 16; i++) w[i] = (uint8_t)m[off + i * 4] << 24 | (uint8_t)m[off + i * 4 + 1] << 16 | (uint8_t)m[off + i * 4 + 2] << 8 | (uint8_t)m[off + i * 4 + 3];
    for (int i = 16; i < 80; i++) w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    uint32_t a = h[0], b = h[1], c = h[2], d = h[3], e = h[4];
    for (int i = 0; i < 80; i++) {
      uint32_t f, k;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
      else { f = b ^ c ^ d; k = 0xCA62C1D6; }
      uint32_t t = rol(a, 5) + f + e + k + w[i]; e = d; d = c; c = rol(b, 30); b = a; a = t;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e;
  }
  std::string o;
  for (uint32_t x : h) for (int i = 3; i >= 0; i--) o += (char)(x >> (i * 8));
  return o;
}
static std::wstring widen(const std::string& s) {
  int n = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, nullptr, 0);
  std::wstring w(n > 0 ? n - 1 : 0, L'\0');
  if (n > 1) MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, &w[0], n);
  return w;
}
static std::string narrow(const wchar_t* w) {
  int n = WideCharToMultiByte(CP_UTF8, 0, w, -1, nullptr, 0, nullptr, nullptr);
  std::string s(n > 0 ? n - 1 : 0, '\0');
  if (n > 1) WideCharToMultiByte(CP_UTF8, 0, w, -1, &s[0], n, nullptr, nullptr);
  return s;
}
static bool hasWord(const std::string& list, const char* w) {
  size_t p = 0;
  while ((p = list.find(w, p)) != std::string::npos) {
    size_t e = p + strlen(w);
    if ((p == 0 || list[p - 1] == '|') && (e == list.size() || list[e] == '|')) return true;
    p = e;
  }
  return false;
}

// ---------------------------------------------------------------- Scan
static int scan(const std::string& path) {
  std::string err;
  auto mod = VST3::Hosting::Module::create(path, err);
  if (!mod) { sendLine("{\"error\":" + jsonStr(err.empty() ? "Modul nicht ladbar" : err) + "}"); return 1; }
  auto factory = mod->getFactory();
  auto fi = factory.info();
  for (auto& ci : factory.classInfos()) {
    if (ci.category() != kVstAudioEffectClass) continue;
    std::string sub = ci.subCategoriesString();
    sendLine("{\"cid\":" + jsonStr(ci.ID().toString()) + ",\"name\":" + jsonStr(ci.name()) +
             ",\"vendor\":" + jsonStr(ci.vendor().empty() ? fi.vendor() : ci.vendor()) + ",\"version\":" + jsonStr(ci.version()) +
             ",\"sub\":" + jsonStr(sub) + ",\"inst\":" + (hasWord(sub, "Instrument") ? "true" : "false") + "}");
  }
  return 0;
}

// ---------------------------------------------------------------- Plugin
static VST3::Hosting::Module::Ptr gModule;
static IPtr<PlugProvider> gProvider;
static IPtr<IComponent> gComp;
static IPtr<IAudioProcessor> gProc;
static IPtr<IEditController> gCtrl;
static double gRate = 48000;
static const int32 kMaxBlock = 4096;
static HostProcessData gData;
static EventList gEvents(1024);
static ParameterChanges gParamsIn(512), gParamsOut(512);
static ParameterChangeTransfer gEdits(512);
static std::mutex procMx;                 // Audio-Thread vs. Zustand laden/speichern
static int32 gMidiMap[16][130];           // MIDI-CC (0–127), Aftertouch (128), Pitchbend (129) -> Parameter, -1 = keiner
static int gInCh = 0, gOutCh = 0;
static std::atomic<int32> gLatency{0};
static HWND gMsgWnd = nullptr, gEditWnd = nullptr;
static std::string gTitle = "Plugin";
static std::atomic<bool> gEditNote{false};
static IPtr<IPlugView> gView;
static std::mutex gAutoMx;                // Automation aus Sound Groot: letzte Werte, damit die Plugin-Oberfläche mitläuft
static std::map<ParamID, double> gAutoVals;

// Antworten des Plugins an den Host: Regleränderungen aus seiner Oberfläche gehen an den Audio-Thread weiter
class ComponentHandler : public U::ImplementsNonDestroyable<U::Directly<IComponentHandler>> {
 public:
  tresult PLUGIN_API beginEdit(ParamID) override { return kResultOk; }
  tresult PLUGIN_API performEdit(ParamID id, ParamValue v) override { gEdits.addChange(id, v, 0); return kResultOk; }
  tresult PLUGIN_API endEdit(ParamID) override { gEditNote = true; return kResultOk; }
  tresult PLUGIN_API restartComponent(int32 flags) override {
    if (flags & kLatencyChanged) {
      std::lock_guard<std::mutex> lk(procMx);
      gProc->setProcessing(false); gComp->setActive(false); gComp->setActive(true); gProc->setProcessing(true);
      gLatency = (int32)gProc->getLatencySamples();
      sendLine("- latency " + std::to_string(gLatency.load()));
    }
    if (flags & (kParamValuesChanged | kReloadComponent)) gEditNote = true;
    return kResultOk;
  }
};
static ComponentHandler gHandler;

// ---------------------------------------------------------------- VST2 (.dll)
// Ältere Plugins haben statt der VST3-Schnittstellen eine C-Struktur mit Funktionszeigern (siehe vst2abi.h).
// Alles Übrige (WebSocket, Befehle, Fenster) teilt sich der Host mit VST3.
enum { WM_CMD = WM_APP + 1, WM_EOF = WM_APP + 2, WM_V2SIZE = WM_APP + 3 };
static bool isDll(const std::string& p) {
  if (p.size() < 4) return false;
  std::string e = p.substr(p.size() - 4); for (auto& c : e) c = (char)tolower((unsigned char)c);
  return e == ".dll";
}
namespace v2 {
using namespace v2abi;
static AEffect* fx = nullptr;
static HMODULE lib = nullptr;
static TimeInfo ti{};
static bool wasPlaying = false;
static std::vector<std::vector<float>> inBuf, outBuf;
static std::vector<float*> inPtr, outPtr;
static MidiEvent evStore[kMaxEvents];
static Events evList;

static intptr_t hostCb(AEffect*, int32_t op, int32_t index, intptr_t value, void* ptr, float) {
  switch (op) {
    case amAutomate: gEditNote = true; return 0;
    case amVersion: return 2400;
    case amGetTime: return (intptr_t)&ti;
    case amSizeWindow: if (gMsgWnd) PostMessageW(gMsgWnd, WM_V2SIZE, (WPARAM)index, (LPARAM)value); return 1;
    case amGetSampleRate: return (intptr_t)gRate;
    case amGetBlockSize: return kMaxBlock;
    case amGetAutomationState: return 1;
    case amGetVendorString: case amGetProductString: if (ptr) strcpy((char*)ptr, "Sound Groot"); return 1;
    case amGetVendorVersion: return 1700;
    case amCanDo: {
      static const char* yes[] = {"sendVstEvents", "sendVstMidiEvent", "sendVstTimeInfo", "receiveVstEvents", "receiveVstMidiEvent", "sizeWindow", "startStopProcess"};
      if (ptr) for (auto y : yes) if (!strcmp((const char*)ptr, y)) return 1;
      return 0;
    }
    case amGetLanguage: return 2;
    case amUpdateDisplay: case amEndEdit: gEditNote = true; return 1;
    case amBeginEdit: return 1;
  }
  return 0;
}
static intptr_t disp(int32_t op, int32_t index = 0, intptr_t value = 0, void* ptr = nullptr, float opt = 0) { return fx->dispatcher(fx, op, index, value, ptr, opt); }
// Texte der Plugins kommen in der Windows-Codepage, Sound Groot rechnet mit UTF-8
static std::string text(int32_t op, int32_t index = 0) {
  char b[512] = {0}; disp(op, index, 0, b); b[255] = 0;
  wchar_t w[512]; int n = MultiByteToWideChar(CP_ACP, 0, b, -1, w, 512);
  std::string s = n > 0 ? narrow(w) : "";
  while (!s.empty() && (unsigned char)s.back() <= ' ') s.pop_back();
  size_t a = 0; while (a < s.size() && (unsigned char)s[a] <= ' ') a++;
  return s.substr(a);
}
static std::string load(const std::string& path) {
  lib = LoadLibraryExW(widen(path).c_str(), nullptr, LOAD_WITH_ALTERED_SEARCH_PATH);
  if (!lib) {
    DWORD e = GetLastError();
    if (e == ERROR_BAD_EXE_FORMAT) return "32-Bit-Plugin (Sound Groot lädt nur 64-Bit-Plugins)";
    return "DLL ließ sich nicht laden (Windows-Fehler " + std::to_string(e) + (e == ERROR_MOD_NOT_FOUND ? ", eine benötigte DLL fehlt)" : ")");
  }
  typedef AEffect* (*Entry)(HostCallback);
  Entry en = (Entry)(void*)GetProcAddress(lib, "VSTPluginMain");
  if (!en) en = (Entry)(void*)GetProcAddress(lib, "main");
  if (!en) return "Kein VST-Plugin";
  fx = en(hostCb);
  if (!fx || fx->magic != kMagic) { fx = nullptr; return "Kein VST-Plugin"; }
  return "";
}
static std::string plugName(const std::string& path) {
  std::string n = text(effGetEffectName); if (n.empty()) n = text(effGetProductString);
  if (n.empty()) { size_t a = path.find_last_of("\\/"), b = path.rfind('.'); n = path.substr(a == std::string::npos ? 0 : a + 1, b - (a == std::string::npos ? 0 : a + 1)); }
  return n;
}
static bool isSynth() { return (fx->flags & fIsSynth) || disp(effGetPlugCategory) == kCategSynth; }
static int scan(const std::string& path) {
  std::string err = load(path);
  if (!err.empty()) { sendLine("{\"error\":" + jsonStr(err) + "}"); return 1; }
  disp(effOpen);
  if (disp(effGetPlugCategory) == kCategShell) { sendLine("{\"error\":\"Sammel-Plugin (mehrere Plugins in einer DLL) wird nicht unterstützt\"}"); return 1; }
  if (!(fx->flags & fCanReplacing) || fx->numOutputs < 1) { sendLine("{\"error\":\"Plugin ist zu alt oder hat keinen Audio-Ausgang\"}"); return 1; }
  char cid[40]; snprintf(cid, sizeof cid, "5653543200000000%08X00000000", (unsigned)fx->uniqueID);
  bool inst = isSynth();
  sendLine(std::string("{\"cid\":\"") + cid + "\",\"name\":" + jsonStr(plugName(path)) + ",\"vendor\":" + jsonStr(text(effGetVendorString)) +
           ",\"version\":" + jsonStr(std::to_string(fx->version)) + ",\"sub\":" + (inst ? "\"Instrument\"" : "\"Fx\"") + ",\"inst\":" + (inst ? "true" : "false") + ",\"v2\":true}");
  // Manche Plugins hängen oder stürzen beim Schließen: das Ergebnis steht schon da
  std::thread([] { Sleep(2000); ExitProcess(0); }).detach();
  disp(effClose);
  return 0;
}
static std::string setup(const std::string& path) {
  std::string err = load(path); if (!err.empty()) return err;
  disp(effOpen);
  if (!(fx->flags & fCanReplacing)) return "Plugin ist zu alt (kein processReplacing)";
  if (fx->numOutputs < 1) return "Plugin hat keinen Audio-Ausgang";
  disp(effSetSampleRate, 0, 0, nullptr, (float)gRate);
  disp(effSetBlockSize, 0, kMaxBlock);
  disp(effSetProcessPrecision, 0, 0);
  inBuf.assign(std::max(0, fx->numInputs), std::vector<float>(kMaxBlock, 0.f));
  outBuf.assign(fx->numOutputs, std::vector<float>(kMaxBlock, 0.f));
  for (auto& b : inBuf) inPtr.push_back(b.data());
  for (auto& b : outBuf) outPtr.push_back(b.data());
  if (inPtr.empty()) inPtr.push_back(nullptr);
  disp(effMainsChanged, 0, 1);
  disp(effStartProcess);
  gInCh = fx->numInputs; gOutCh = fx->numOutputs; gLatency = fx->initialDelay;
  return "";
}
static bool process(const uint8_t* p, size_t n, std::vector<uint8_t>& out);
static std::string getState() {
  std::vector<uint8_t> blob = {'S', 'G', 'V', '2', 0, 0, 0, 0, 0};
  std::lock_guard<std::mutex> lk(procMx);
  int32_t prog = (int32_t)disp(effGetProgram); memcpy(blob.data() + 5, &prog, 4);
  if (fx->flags & fProgramChunks) {
    void* d = nullptr; intptr_t sz = disp(effGetChunk, 0, 0, &d);
    blob[4] = 1; if (d && sz > 0) blob.insert(blob.end(), (uint8_t*)d, (uint8_t*)d + sz);
  } else for (int32_t i = 0; i < fx->numParams; i++) { float v = fx->getParameter(fx, i); blob.insert(blob.end(), (uint8_t*)&v, (uint8_t*)&v + 4); }
  return b64enc(blob.data(), blob.size());
}
static bool setState(const std::string& b64) {
  auto blob = b64dec(b64);
  if (blob.size() < 9 || memcmp(blob.data(), "SGV2", 4) != 0) return false;
  std::lock_guard<std::mutex> lk(procMx);
  int32_t prog; memcpy(&prog, blob.data() + 5, 4);
  if (blob[4] == 1) { if (blob.size() > 9) disp(effSetChunk, 0, (intptr_t)(blob.size() - 9), blob.data() + 9); }
  else {
    if (prog >= 0 && prog < fx->numPrograms) disp(effSetProgram, 0, prog);
    for (int32_t i = 0; i < fx->numParams && 9 + (size_t)i * 4 + 4 <= blob.size(); i++) { float v; memcpy(&v, blob.data() + 9 + (size_t)i * 4, 4); fx->setParameter(fx, i, v); }
  }
  return true;
}
static std::string paramList() {
  std::string o = "[";
  for (int32_t i = 0; i < fx->numParams && i < 1024; i++) {
    float v = fx->getParameter(fx, i);
    char num[96]; snprintf(num, sizeof num, "%d,\"d\":%.6g,\"v\":%.6g,\"s\":0", i, v, v);
    std::string nm = text(effGetParamName, i); if (nm.empty()) nm = "Parameter " + std::to_string(i + 1);
    o += std::string(i ? "," : "") + "{\"id\":" + num + ",\"n\":" + jsonStr(nm) + ",\"u\":" + jsonStr(text(effGetParamLabel, i)) + "}";
  }
  return o + "]";
}
static void shutdown() {
  std::lock_guard<std::mutex> lk(procMx);
  disp(effStopProcess); disp(effMainsChanged, 0, 0); disp(effClose); fx = nullptr;
}
}  // namespace v2

static int busChannels(BusDirection dir) {
  if (gComp->getBusCount(kAudio, dir) < 1) return 0;
  BusInfo bi{}; gComp->getBusInfo(kAudio, dir, 0, bi);
  return bi.channelCount;
}

static std::string setup(const std::string& path, const std::string& cid) {
  std::string err;
  gModule = VST3::Hosting::Module::create(path, err);
  if (!gModule) return err.empty() ? "Modul nicht ladbar" : err;
  auto factory = gModule->getFactory();
  auto want = VST3::UID::fromString(cid);
  for (auto& ci : factory.classInfos()) {
    if (ci.category() != kVstAudioEffectClass || (want && *want != ci.ID())) continue;
    gProvider = owned(new PlugProvider(factory, ci, true));
    if (!gProvider->initialize()) { gProvider = nullptr; return "Plugin ließ sich nicht starten"; }
    break;
  }
  if (!gProvider) return "Klasse nicht gefunden";
  gComp = gProvider->getComponentPtr();
  gCtrl = gProvider->getControllerPtr();
  gProc = U::cast<IAudioProcessor>(gComp);
  if (!gProc) return "Kein Audio-Prozessor";
  if (gCtrl) gCtrl->setComponentHandler(&gHandler);

  // Stereo bevorzugt; wenn das Plugin ablehnt, bleibt seine eigene Anordnung
  std::vector<SpeakerArrangement> ins(gComp->getBusCount(kAudio, kInput)), outs(gComp->getBusCount(kAudio, kOutput));
  for (size_t i = 0; i < ins.size(); i++) gProc->getBusArrangement(kInput, (int32)i, ins[i]);
  for (size_t i = 0; i < outs.size(); i++) gProc->getBusArrangement(kOutput, (int32)i, outs[i]);
  if (!ins.empty()) ins[0] = SpeakerArr::kStereo;
  if (!outs.empty()) outs[0] = SpeakerArr::kStereo;
  gProc->setBusArrangements(ins.data(), (int32)ins.size(), outs.data(), (int32)outs.size());
  for (int32 i = 0; i < gComp->getBusCount(kAudio, kInput); i++) gComp->activateBus(kAudio, kInput, i, i == 0);
  for (int32 i = 0; i < gComp->getBusCount(kAudio, kOutput); i++) gComp->activateBus(kAudio, kOutput, i, i == 0);
  if (gComp->getBusCount(kEvent, kInput) > 0) gComp->activateBus(kEvent, kInput, 0, true);
  gInCh = busChannels(kInput); gOutCh = busChannels(kOutput);
  if (gOutCh < 1) return "Plugin hat keinen Audio-Ausgang";

  ProcessSetup ps{kRealtime, kSample32, kMaxBlock, gRate};
  if (gProc->setupProcessing(ps) != kResultOk) return "Abtastrate wird nicht unterstützt";
  if (!gData.prepare(*gComp, kMaxBlock, kSample32)) return "Puffer konnten nicht angelegt werden";
  gComp->setActive(true);
  gProc->setProcessing(true);
  gLatency = (int32)gProc->getLatencySamples();

  for (auto& ch : gMidiMap) for (auto& p : ch) p = -1;
  if (auto mm = U::cast<IMidiMapping>(gCtrl))
    for (int16 c = 0; c < 16; c++)
      for (int16 cc = 0; cc < 130; cc++) { ParamID id; if (mm->getMidiControllerAssignment(0, c, cc, id) == kResultTrue) gMidiMap[c][cc] = (int32)id; }
  return "";
}

// ---------------------------------------------------------------- Audio
static inline uint16_t rd16(const uint8_t* p) { uint16_t v; memcpy(&v, p, 2); return v; }
static inline uint32_t rd32(const uint8_t* p) { uint32_t v; memcpy(&v, p, 4); return v; }
static inline double rdf64(const uint8_t* p) { double v; memcpy(&v, p, 8); return v; }

// Paket von Sound Groot (alles little endian):
//   0 u32 Blocknummer   4 u16 Frames   6 u8 Eingangskanäle   7 u8 Flags (1 = läuft, 2 = alle Noten aus)
//   8 f64 Tempo   16 f64 Position in Vierteln   24 f64 Position in Samples
//  32 u16 Anzahl MIDI-Ereignisse   34 u8 Taktzähler   35 u8 Taktnenner   36 u32 frei
//  40 je Ereignis 8 Bytes: u16 Versatz im Block, Status, Daten 1, Daten 2, 3 frei
//     Status 0x01 = Parameter-Automation: belegt zwei Plätze, im zweiten stehen u32 Parameter-ID und f32 Wert (normiert)
//  danach float32-Samples, Kanal für Kanal
// Antwort: u32 Blocknummer, u16 Frames, u8 Ausgangskanäle, u8 frei, dann float32-Samples Kanal für Kanal.
static bool processPacket(const uint8_t* p, size_t n, std::vector<uint8_t>& out) {
  if (v2::fx) return v2::process(p, n, out);
  if (n < 40) return false;
  uint32_t seq = rd32(p); int frames = rd16(p + 4), nIn = p[6], flags = p[7];
  int nEv = rd16(p + 32);
  if (frames < 1 || frames > kMaxBlock || n < 40 + (size_t)nEv * 8 + (size_t)nIn * frames * 4) return false;
  const float* in = (const float*)(p + 40 + nEv * 8);
  int outCh = std::min(gOutCh, 2);
  out.assign(8 + (size_t)2 * frames * 4, 0);
  memcpy(out.data(), &seq, 4); memcpy(out.data() + 4, &frames, 2); out[6] = 2;
  float* o = (float*)(out.data() + 8);

  std::lock_guard<std::mutex> lk(procMx);
  gEvents.clear(); gParamsIn.clearQueue(); gParamsOut.clearQueue();
  gEdits.transferChangesTo(gParamsIn);
  auto event = [&](int off, int st, int d1, int d2) {
    int type = st & 0xF0, ch = st & 15;
    Event e{}; e.busIndex = 0; e.sampleOffset = off; e.ppqPosition = 0; e.flags = Event::kIsLive;
    if (type == 0x90 && d2 > 0) { e.type = Event::kNoteOnEvent; e.noteOn = {(int16)ch, (int16)d1, 0.f, d2 / 127.f, 0, -1}; gEvents.addEvent(e); }
    else if (type == 0x80 || type == 0x90) { e.type = Event::kNoteOffEvent; e.noteOff = {(int16)ch, (int16)d1, d2 / 127.f, -1, 0.f}; gEvents.addEvent(e); }
    else {
      int cc = type == 0xB0 ? d1 : type == 0xD0 ? 128 : type == 0xE0 ? 129 : -1;
      if (cc < 0 || gMidiMap[ch][cc] < 0) return;
      double v = type == 0xB0 ? d2 / 127.0 : type == 0xD0 ? d1 / 127.0 : (d1 | d2 << 7) / 16383.0;
      int32 qi; if (auto q = gParamsIn.addParameterData((ParamID)gMidiMap[ch][cc], qi)) { int32 pi; q->addPoint(off, v, pi); }
    }
  };
  if (flags & 2) for (int m = 0; m < 128; m++) event(0, 0x80, m, 0);
  for (int i = 0; i < nEv; i++) {
    const uint8_t* e = p + 40 + i * 8; int off = std::min<int>(rd16(e), frames - 1);
    if (e[2] == 0x01) {
      if (++i >= nEv) break;
      ParamID id = rd32(e + 8); float v; memcpy(&v, e + 12, 4); v = std::min(1.f, std::max(0.f, v));
      int32 qi; if (auto q = gParamsIn.addParameterData(id, qi)) { int32 pi; q->addPoint(off, v, pi); }
      std::lock_guard<std::mutex> al(gAutoMx); gAutoVals[id] = v;
      continue;
    }
    event(off, e[2], e[3], e[4]);
  }

  ProcessContext pc{};
  double tempo = rdf64(p + 8), ppq = rdf64(p + 16), num = p[34] ? p[34] : 4, den = p[35] ? p[35] : 4;
  pc.state = ProcessContext::kTempoValid | ProcessContext::kTimeSigValid | ProcessContext::kProjectTimeMusicValid | ProcessContext::kBarPositionValid | ((flags & 1) ? ProcessContext::kPlaying : 0);
  pc.sampleRate = gRate; pc.projectTimeSamples = (TSamples)rdf64(p + 24);
  pc.tempo = tempo > 0 ? tempo : 120; pc.projectTimeMusic = ppq;
  pc.timeSigNumerator = (int32)num; pc.timeSigDenominator = (int32)den;
  double bar = num * 4 / den; pc.barPositionMusic = std::floor(ppq / bar) * bar;

  gData.numSamples = frames;
  gData.inputEvents = &gEvents; gData.inputParameterChanges = &gParamsIn; gData.outputParameterChanges = &gParamsOut;
  gData.processContext = &pc;
  if (gData.numInputs > 0) {
    auto& b = gData.inputs[0]; b.silenceFlags = 0;
    for (int c = 0; c < b.numChannels; c++) {
      float* dst = b.channelBuffers32[c];
      if (nIn > 0) memcpy(dst, in + (size_t)std::min(c, nIn - 1) * frames, frames * 4); else memset(dst, 0, frames * 4);
    }
  }
  for (int32 i = 1; i < gData.numInputs; i++) for (int c = 0; c < gData.inputs[i].numChannels; c++) memset(gData.inputs[i].channelBuffers32[c], 0, frames * 4);
  if (gProc->process(gData) != kResultOk) return true;   // Stille zurückgeben
  auto& ob = gData.outputs[0];
  for (int c = 0; c < 2; c++) memcpy(o + (size_t)c * frames, ob.channelBuffers32[std::min(c, outCh - 1)], frames * 4);
  return true;
}

// Dasselbe Paket für ein VST2-Plugin: MIDI als Ereignisliste, Automation direkt als Parameterwert
bool v2::process(const uint8_t* p, size_t n, std::vector<uint8_t>& out) {
  if (n < 40) return false;
  uint32_t seq = rd32(p); int frames = rd16(p + 4), nIn = p[6], flags = p[7], nEv = rd16(p + 32);
  if (frames < 1 || frames > kMaxBlock || n < 40 + (size_t)nEv * 8 + (size_t)nIn * frames * 4) return false;
  const float* in = (const float*)(p + 40 + nEv * 8);
  out.assign(8 + (size_t)2 * frames * 4, 0);
  memcpy(out.data(), &seq, 4); memcpy(out.data() + 4, &frames, 2); out[6] = 2;
  float* o = (float*)(out.data() + 8);

  std::lock_guard<std::mutex> lk(procMx);
  if (!fx) return true;
  int ne = 0;
  auto midi = [&](int off, int st, int d1, int d2) {
    if (ne >= kMaxEvents) return;
    MidiEvent& e = evStore[ne]; memset(&e, 0, sizeof e);
    e.type = 1; e.byteSize = (int32_t)sizeof(MidiEvent); e.deltaFrames = off;
    e.midiData[0] = (char)st; e.midiData[1] = (char)d1; e.midiData[2] = (char)d2;
    evList.events[ne++] = &e;
  };
  if (flags & 2) for (int ch = 0; ch < 16; ch++) { midi(0, 0xB0 | ch, 123, 0); midi(0, 0xB0 | ch, 120, 0); }
  for (int i = 0; i < nEv; i++) {
    const uint8_t* e = p + 40 + i * 8; int off = std::min<int>(rd16(e), frames - 1);
    if (e[2] == 0x01) {
      if (++i >= nEv) break;
      int32_t id = (int32_t)rd32(e + 8); float v; memcpy(&v, e + 12, 4);
      if (id >= 0 && id < fx->numParams) fx->setParameter(fx, id, std::min(1.f, std::max(0.f, v)));
      continue;
    }
    midi(off, e[2], e[3], e[4]);
  }
  double tempo = rdf64(p + 8), ppq = rdf64(p + 16), num = p[34] ? p[34] : 4, den = p[35] ? p[35] : 4, bar = num * 4 / den;
  bool playing = flags & 1;
  ti.samplePos = rdf64(p + 24); ti.sampleRate = gRate; ti.tempo = tempo > 0 ? tempo : 120; ti.ppqPos = ppq;
  ti.barStartPos = std::floor(ppq / bar) * bar; ti.timeSigNumerator = (int32_t)num; ti.timeSigDenominator = (int32_t)den;
  ti.flags = tPpqValid | tTempoValid | tBarsValid | tTimeSigValid | (playing ? tPlaying : 0) | (playing != wasPlaying ? tChanged : 0);
  wasPlaying = playing;
  if (ne) { evList.numEvents = ne; evList.reserved = 0; disp(effProcessEvents, 0, 0, &evList); }
  for (size_t c = 0; c < inBuf.size(); c++) {
    if (nIn > 0 && c < 2) memcpy(inBuf[c].data(), in + (size_t)std::min<int>((int)c, nIn - 1) * frames, frames * 4);
    else memset(inBuf[c].data(), 0, frames * 4);
  }
  fx->processReplacing(fx, inPtr.data(), outPtr.data(), frames);
  for (int c = 0; c < 2; c++) memcpy(o + (size_t)c * frames, outBuf[std::min<size_t>(c, outBuf.size() - 1)].data(), frames * 4);
  return true;
}

// ---------------------------------------------------------------- WebSocket (nur ein Gegenüber, nur lokal)
static bool recvAll(SOCKET s, void* buf, size_t n) {
  char* p = (char*)buf;
  while (n) { int r = recv(s, p, (int)std::min<size_t>(n, 1 << 20), 0); if (r <= 0) return false; p += r; n -= r; }
  return true;
}
static bool sendFrame(SOCKET s, int op, const uint8_t* data, size_t n) {
  uint8_t h[10]; size_t hl = 2; h[0] = (uint8_t)(0x80 | op);
  if (n < 126) h[1] = (uint8_t)n;
  else if (n < 65536) { h[1] = 126; h[2] = (uint8_t)(n >> 8); h[3] = (uint8_t)n; hl = 4; }
  else { h[1] = 127; for (int i = 0; i < 8; i++) h[2 + i] = (uint8_t)((uint64_t)n >> (56 - 8 * i)); hl = 10; }
  std::vector<uint8_t> f(h, h + hl); f.insert(f.end(), data, data + n);
  const char* p = (const char*)f.data(); size_t left = f.size();
  while (left) { int r = send(s, p, (int)left, 0); if (r <= 0) return false; p += r; left -= r; }
  return true;
}
static void serveClient(SOCKET c, const std::string& token) {
  std::string req; char ch;
  while (req.size() < 8192 && req.find("\r\n\r\n") == std::string::npos) { if (recv(c, &ch, 1, 0) != 1) return; req += ch; }
  std::string key; size_t k = req.find("Sec-WebSocket-Key:");
  if (k == std::string::npos) k = req.find("sec-websocket-key:");
  if (k != std::string::npos) { size_t a = req.find_first_not_of(' ', k + 18), e = req.find("\r\n", a); key = req.substr(a, e - a); }
  if (req.compare(0, 6 + token.size(), "GET /" + token + " ") != 0 || key.empty()) {
    const char* no = "HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n"; send(c, no, (int)strlen(no), 0); return;
  }
  std::string acc = sha1(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11");
  std::string resp = "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " +
                     b64enc((const uint8_t*)acc.data(), acc.size()) + "\r\n\r\n";
  send(c, resp.data(), (int)resp.size(), 0);
  std::vector<uint8_t> msg, frame, out;
  for (;;) {
    uint8_t h[2]; if (!recvAll(c, h, 2)) return;
    int op = h[0] & 15; bool fin = h[0] & 0x80; uint64_t len = h[1] & 127;
    if (len == 126) { uint8_t b[2]; if (!recvAll(c, b, 2)) return; len = b[0] << 8 | b[1]; }
    else if (len == 127) { uint8_t b[8]; if (!recvAll(c, b, 8)) return; len = 0; for (int i = 0; i < 8; i++) len = len << 8 | b[i]; }
    if (len > (64u << 20)) return;
    uint8_t mask[4] = {0, 0, 0, 0}; if ((h[1] & 0x80) && !recvAll(c, mask, 4)) return;
    frame.resize((size_t)len); if (len && !recvAll(c, frame.data(), (size_t)len)) return;
    for (size_t i = 0; i < frame.size(); i++) frame[i] ^= mask[i & 3];
    if (op == 8) { sendFrame(c, 8, nullptr, 0); return; }
    if (op == 9) { sendFrame(c, 10, frame.data(), frame.size()); continue; }
    if (op == 10) continue;
    if (op != 0) msg.clear();
    msg.insert(msg.end(), frame.begin(), frame.end());
    if (!fin) continue;
    if (processPacket(msg.data(), msg.size(), out) && !sendFrame(c, 2, out.data(), out.size())) return;
    msg.clear();
  }
}
// Audio-Thread: bei Windows als „Pro Audio“ einstufen, sonst wenigstens hohe Priorität
static void boostThread() {
  SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_TIME_CRITICAL);
  if (HMODULE av = LoadLibraryW(L"avrt.dll")) {
    typedef HANDLE(WINAPI * AvSet)(LPCWSTR, LPDWORD);
    if (auto f = (AvSet)GetProcAddress(av, "AvSetMmThreadCharacteristicsW")) { DWORD i = 0; f(L"Pro Audio", &i); }
  }
}
static void netThread(SOCKET ls, std::string token) {
  for (;;) {
    SOCKET c = accept(ls, nullptr, nullptr);
    if (c == INVALID_SOCKET) return;
    BOOL one = TRUE; setsockopt(c, IPPROTO_TCP, TCP_NODELAY, (const char*)&one, sizeof one);
    // Jede Verbindung in eigenem Thread (z. B. nach Neuladen der App); procMx hält die Blöcke auseinander
    std::thread([c, token] { boostThread(); serveClient(c, token); closesocket(c); }).detach();
  }
}

// ---------------------------------------------------------------- Zustand
static std::string getState() {
  if (v2::fx) return v2::getState();
  MemoryStream cs, es;
  { std::lock_guard<std::mutex> lk(procMx); gComp->getState(&cs); }
  if (gCtrl) gCtrl->getState(&es);
  std::vector<uint8_t> blob = {'S', 'G', 'V', '3'};
  for (MemoryStream* m : {&cs, &es}) {
    uint32_t n = (uint32_t)m->getSize(); blob.insert(blob.end(), (uint8_t*)&n, (uint8_t*)&n + 4);
    blob.insert(blob.end(), (uint8_t*)m->getData(), (uint8_t*)m->getData() + n);
  }
  return b64enc(blob.data(), blob.size());
}
static bool setState(const std::string& b64) {
  if (v2::fx) return v2::setState(b64);
  auto blob = b64dec(b64);
  if (blob.size() < 12 || memcmp(blob.data(), "SGV3", 4) != 0) return false;
  uint32_t n1 = rd32(blob.data() + 4); if (8 + (size_t)n1 + 4 > blob.size()) return false;
  uint32_t n2 = rd32(blob.data() + 8 + n1); if (12 + (size_t)n1 + n2 > blob.size()) return false;
  MemoryStream cs(blob.data() + 8, n1), es(blob.data() + 12 + n1, n2);
  { std::lock_guard<std::mutex> lk(procMx); gComp->setState(&cs); }
  if (gCtrl) {
    cs.seek(0, IBStream::kIBSeekSet, nullptr);
    gCtrl->setComponentState(&cs);
    if (n2) gCtrl->setState(&es);
  }
  return true;
}

// ---------------------------------------------------------------- Editor-Fenster
static const DWORD kEditStyle = WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX | WS_CLIPCHILDREN;
static float dpiScale(HWND w) {
  typedef UINT(WINAPI * GetDpi)(HWND);
  static auto f = (GetDpi)GetProcAddress(GetModuleHandleW(L"user32.dll"), "GetDpiForWindow");
  return f && w ? f(w) / 96.f : 1.f;
}
static void fitWindow(const ViewRect& r) {
  RECT wr{0, 0, r.getWidth(), r.getHeight()};
  DWORD st = (DWORD)GetWindowLongPtrW(gEditWnd, GWL_STYLE);
  AdjustWindowRectEx(&wr, st, FALSE, 0);
  SetWindowPos(gEditWnd, nullptr, 0, 0, wr.right - wr.left, wr.bottom - wr.top, SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE);
}
class PlugFrame : public U::ImplementsNonDestroyable<U::Directly<IPlugFrame>> {
 public:
  tresult PLUGIN_API resizeView(IPlugView* view, ViewRect* r) override {
    if (!gEditWnd || !r || busy) return kResultFalse;
    busy = true; fitWindow(*r); view->onSize(r); busy = false;
    return kResultTrue;
  }
  bool busy = false;
};
static PlugFrame gFrame;
static void closeEditor() {
  if (v2::fx && gEditWnd) { KillTimer(gMsgWnd, 2); v2::disp(v2abi::effEditClose); }
  if (gView) { gView->setFrame(nullptr); gView->removed(); gView = nullptr; }
  if (gEditWnd) { HWND w = gEditWnd; gEditWnd = nullptr; DestroyWindow(w); sendLine("- closed"); }
}
static LRESULT CALLBACK editProc(HWND w, UINT m, WPARAM wp, LPARAM lp) {
  switch (m) {
    case WM_CLOSE: closeEditor(); return 0;
    case WM_SIZE:
      if (gView && !gFrame.busy && wp != SIZE_MINIMIZED) {
        ViewRect r{0, 0, LOWORD(lp), HIWORD(lp)};
        if (gView->checkSizeConstraint(&r) == kResultTrue) { gFrame.busy = true; gView->onSize(&r); gFrame.busy = false; }
      }
      return 0;
    case 0x02E0:  // WM_DPICHANGED
      if (auto cs = U::cast<IPlugViewContentScaleSupport>(gView)) cs->setContentScaleFactor(HIWORD(wp) / 96.f);
      if (auto* r = (RECT*)lp) SetWindowPos(w, nullptr, r->left, r->top, r->right - r->left, r->bottom - r->top, SWP_NOZORDER | SWP_NOACTIVATE);
      return 0;
  }
  return DefWindowProcW(w, m, wp, lp);
}
static void fitClient(int w, int h) {
  RECT wr{0, 0, w, h};
  AdjustWindowRectEx(&wr, (DWORD)GetWindowLongPtrW(gEditWnd, GWL_STYLE), FALSE, 0);
  SetWindowPos(gEditWnd, nullptr, 0, 0, wr.right - wr.left, wr.bottom - wr.top, SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE);
}
// VST2: Das Plugin zeichnet seine Oberfläche in unser Fenster und will regelmäßig angestoßen werden
static std::string openEditorV2() {
  using namespace v2abi;
  if (!(v2::fx->flags & fHasEditor)) return "Plugin hat keine Oberfläche";
  gEditWnd = CreateWindowExW(0, L"SGVst3Editor", widen(gTitle).c_str(), kEditStyle, CW_USEDEFAULT, CW_USEDEFAULT, 400, 300, nullptr, nullptr, GetModuleHandleW(nullptr), nullptr);
  if (!gEditWnd) return "Fenster konnte nicht erstellt werden";
  Rect* r = nullptr; v2::disp(effEditGetRect, 0, 0, &r);
  if (r && r->right > r->left && r->bottom > r->top) fitClient(r->right - r->left, r->bottom - r->top);
  v2::disp(effEditOpen, 0, 0, gEditWnd);
  r = nullptr; v2::disp(effEditGetRect, 0, 0, &r);
  if (r && r->right > r->left && r->bottom > r->top) fitClient(r->right - r->left, r->bottom - r->top);
  SetTimer(gMsgWnd, 2, 30, nullptr);
  ShowWindow(gEditWnd, SW_SHOWNORMAL); SetForegroundWindow(gEditWnd);
  return "";
}
static std::string openEditor() {
  if (gEditWnd) { ShowWindow(gEditWnd, SW_RESTORE); SetForegroundWindow(gEditWnd); return ""; }
  if (v2::fx) return openEditorV2();
  if (!gCtrl) return "Plugin hat keine Oberfläche";
  gView = owned(gCtrl->createView(ViewType::kEditor));
  if (!gView || gView->isPlatformTypeSupported(kPlatformTypeHWND) != kResultTrue) { gView = nullptr; return "Plugin hat keine Oberfläche"; }
  bool resizable = gView->canResize() == kResultTrue;
  DWORD st = kEditStyle | (resizable ? WS_THICKFRAME | WS_MAXIMIZEBOX : 0);
  gEditWnd = CreateWindowExW(0, L"SGVst3Editor", widen(gTitle).c_str(), st, CW_USEDEFAULT, CW_USEDEFAULT, 400, 300, nullptr, nullptr, GetModuleHandleW(nullptr), nullptr);
  if (!gEditWnd) { gView = nullptr; return "Fenster konnte nicht erstellt werden"; }
  if (auto cs = U::cast<IPlugViewContentScaleSupport>(gView)) cs->setContentScaleFactor(dpiScale(gEditWnd));
  gView->setFrame(&gFrame);
  if (gView->attached(gEditWnd, kPlatformTypeHWND) != kResultTrue) { gView = nullptr; DestroyWindow(gEditWnd); gEditWnd = nullptr; return "Oberfläche ließ sich nicht öffnen"; }
  ViewRect r{}; if (gView->getSize(&r) == kResultTrue) fitWindow(r);
  ShowWindow(gEditWnd, SW_SHOWNORMAL); SetForegroundWindow(gEditWnd);
  return "";
}

// Automatisierbare Parameter für die Automation in Sound Groot (höchstens 1024, ohne versteckte und nur lesbare)
static std::string paramList() {
  if (v2::fx) return v2::paramList();
  std::string o = "[";
  if (gCtrl) for (int32 i = 0, n = 0; i < gCtrl->getParameterCount() && n < 1024; i++) {
    ParameterInfo pi{}; if (gCtrl->getParameterInfo(i, pi) != kResultOk) continue;
    if (!(pi.flags & ParameterInfo::kCanAutomate) || (pi.flags & (ParameterInfo::kIsReadOnly | ParameterInfo::kIsHidden | ParameterInfo::kIsBypass))) continue;
    char num[96]; snprintf(num, sizeof num, "%u,\"d\":%.6g,\"v\":%.6g,\"s\":%d", (unsigned)pi.id, pi.defaultNormalizedValue, gCtrl->getParamNormalized(pi.id), (int)pi.stepCount);
    o += std::string(n++ ? "," : "") + "{\"id\":" + num + ",\"n\":" + jsonStr(VST3::StringConvert::convert(pi.title)) + ",\"u\":" + jsonStr(VST3::StringConvert::convert(pi.units)) + "}";
  }
  return o + "]";
}

// ---------------------------------------------------------------- Steuerung über stdin
static void handleCommand(const std::string& line) {
  size_t a = line.find(' '); std::string id = line.substr(0, a), rest = a == std::string::npos ? "" : line.substr(a + 1);
  size_t b = rest.find(' '); std::string cmd = rest.substr(0, b), arg = b == std::string::npos ? "" : rest.substr(b + 1);
  if (cmd == "getstate") sendLine(id + " ok " + getState());
  else if (cmd == "params") sendLine(id + " ok " + paramList());
  else if (cmd == "setstate") sendLine(id + (setState(arg) ? " ok" : " err Zustand ungültig"));
  else if (cmd == "edit") { auto e = openEditor(); sendLine(id + (e.empty() ? " ok" : " err " + e)); }
  else if (cmd == "close") { closeEditor(); sendLine(id + " ok"); }
  else if (cmd == "title") { gTitle = arg; if (gEditWnd) SetWindowTextW(gEditWnd, widen(gTitle).c_str()); sendLine(id + " ok"); }
  else if (cmd == "quit") { sendLine(id + " ok"); PostQuitMessage(0); }
  else sendLine(id + " err unbekannter Befehl");
}
static LRESULT CALLBACK msgProc(HWND w, UINT m, WPARAM wp, LPARAM lp) {
  if (m == WM_CMD) { std::string* s = (std::string*)lp; handleCommand(*s); delete s; return 0; }
  if (m == WM_EOF) { PostQuitMessage(0); return 0; }
  if (m == WM_V2SIZE) { if (gEditWnd && wp > 0 && lp > 0) fitClient((int)wp, (int)lp); return 0; }
  if (m == WM_TIMER && wp == 2) { if (v2::fx && gEditWnd) v2::disp(v2abi::effEditIdle); return 0; }
  if (m == WM_TIMER) {
    if (gEditNote.exchange(false)) sendLine("- edited");
    // Automatisierte Werte auch in der Plugin-Oberfläche zeigen
    std::map<ParamID, double> av; { std::lock_guard<std::mutex> al(gAutoMx); av.swap(gAutoVals); }
    if (gCtrl) for (auto& [id, v] : av) gCtrl->setParamNormalized(id, v);
    return 0;
  }
  return DefWindowProcW(w, m, wp, lp);
}

static int run(const std::string& path, const std::string& cid, const std::string& token) {
  OleInitialize(nullptr);
  typedef BOOL(WINAPI * SetCtx)(HANDLE);
  if (auto f = (SetCtx)GetProcAddress(GetModuleHandleW(L"user32.dll"), "SetProcessDpiAwarenessContext")) f((HANDLE)-4);
  HINSTANCE hi = GetModuleHandleW(nullptr);
  WNDCLASSEXW wc{sizeof wc}; wc.lpfnWndProc = msgProc; wc.hInstance = hi; wc.lpszClassName = L"SGVst3Msg"; RegisterClassExW(&wc);
  WNDCLASSEXW ec{sizeof ec}; ec.lpfnWndProc = editProc; ec.hInstance = hi; ec.lpszClassName = L"SGVst3Editor";
  ec.hCursor = LoadCursor(nullptr, IDC_ARROW); ec.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);
  ec.hIcon = LoadIcon(hi, MAKEINTRESOURCE(1)); RegisterClassExW(&ec);
  gMsgWnd = CreateWindowExW(0, L"SGVst3Msg", L"", 0, 0, 0, 0, 0, HWND_MESSAGE, nullptr, hi, nullptr);

  static HostApplication hostApp;
  PluginContextFactory::instance().setPluginContext(&hostApp);
  const bool old = isDll(path);
  std::string err = old ? v2::setup(path) : setup(path, cid);
  if (!err.empty()) { sendLine("{\"error\":" + jsonStr(err) + "}"); return 1; }

  WSADATA wd; WSAStartup(MAKEWORD(2, 2), &wd);
  SOCKET ls = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
  sockaddr_in sa{}; sa.sin_family = AF_INET; sa.sin_addr.s_addr = htonl(INADDR_LOOPBACK); sa.sin_port = 0;
  int sl = sizeof sa;
  if (bind(ls, (sockaddr*)&sa, sizeof sa) || listen(ls, 2) || getsockname(ls, (sockaddr*)&sa, &sl)) { sendLine("{\"error\":\"Kein lokaler Port frei\"}"); return 1; }
  std::thread(netThread, ls, token).detach();

  bool editor = false, inst = false; std::string pname, pvendor;
  if (old) { editor = v2::fx->flags & v2abi::fHasEditor; inst = v2::isSynth(); pname = v2::plugName(path); pvendor = v2::text(v2abi::effGetVendorString); }
  else {
    if (gCtrl) if (auto v = owned(gCtrl->createView(ViewType::kEditor))) editor = true;
    auto& ci = gProvider->getClassInfo();
    pname = ci.name(); pvendor = ci.vendor(); inst = hasWord(ci.subCategoriesString(), "Instrument");
  }
  sendLine(std::string("{\"ready\":true,\"port\":") + std::to_string(ntohs(sa.sin_port)) + ",\"name\":" + jsonStr(pname) +
           ",\"vendor\":" + jsonStr(pvendor) + ",\"inst\":" + (inst ? "true" : "false") +
           ",\"ins\":" + std::to_string(gInCh) + ",\"outs\":" + std::to_string(gOutCh) + ",\"latency\":" + std::to_string(gLatency.load()) +
           ",\"editor\":" + (editor ? "true" : "false") + "}");

  std::thread([] {
    std::string line;
    while (std::getline(std::cin, line)) {
      if (!line.empty() && line.back() == '\r') line.pop_back();
      PostMessageW(gMsgWnd, WM_CMD, 0, (LPARAM) new std::string(line));
    }
    PostMessageW(gMsgWnd, WM_EOF, 0, 0);
  }).detach();
  SetTimer(gMsgWnd, 1, 100, nullptr);

  MSG m;
  while (GetMessageW(&m, nullptr, 0, 0) > 0) { TranslateMessage(&m); DispatchMessageW(&m); }
  closeEditor();
  // Manche Plugins hängen beim Aufräumen; der Prozess endet ohnehin, also nicht ewig warten
  std::thread([] { Sleep(3000); ExitProcess(0); }).detach();
  if (old) { v2::shutdown(); ExitProcess(0); }
  {
    std::lock_guard<std::mutex> lk(procMx);
    gProc->setProcessing(false); gComp->setActive(false);
  }
  gData.unprepare(); gProc = nullptr; gCtrl = nullptr; gComp = nullptr; gProvider = nullptr; gModule.reset();
  ExitProcess(0);
}

int wmain(int argc, wchar_t** argv) {
  _setmode(_fileno(stdout), _O_BINARY);
  _setmode(_fileno(stdin), _O_BINARY);
  std::string mode, path, cid, token;
  for (int i = 1; i < argc; i++) {
    std::string a = narrow(argv[i]), v = i + 1 < argc ? narrow(argv[i + 1]) : "";
    if (a == "--scan" || a == "--run") { mode = a; path = v; i++; }
    else if (a == "--cid") { cid = v; i++; }
    else if (a == "--sr") { gRate = atof(v.c_str()); i++; }
    else if (a == "--token") { token = v; i++; }
    else if (a == "--title") { gTitle = v; i++; }
  }
  // Ein abstürzendes Plugin soll keinen Windows-Fehlerdialog öffnen, Sound Groot merkt das Prozessende selbst
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  if (mode == "--scan" && !path.empty()) return isDll(path) ? v2::scan(path) : scan(path);
  if (mode == "--run" && !path.empty() && !token.empty() && gRate > 0) return run(path, cid, token);
  fprintf(stderr, "Aufruf: sg-vst3host --scan <Pfad.vst3|.dll> | --run <Pfad.vst3|.dll> --cid <ID> --sr <Rate> --token <Wort>\n");
  return 2;
}
