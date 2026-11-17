# Sound Groot – Übergabe für KI-Assistenten (Claude Code: Opus, Sonnet, Cloud-Sessions)

Musik-App im Stil von GarageBand: Arrangement, Drummer/Step-Sequencer, Piano Roll, Sampler (MPC-artig), Audio-Aufnahme,
Mixer, Effekte, Export. Läuft als **Windows-App (Electron)**, als **Web-App/PWA (iPhone, Browser)** und offline.
Repo heißt aus historischen Gründen `Klangwerk`; Produktname ist **Sound Groot**. Aktuelle Version: siehe `package.json`.
Änderungsverlauf und Fahrplan: `PLAN.md`. Bedienung für Nutzer: `README.md`.

**Sprache:** Der Nutzer schreibt Deutsch. Antworten, UI-Texte, Code-Kommentare und Commit-Messages sind Deutsch.

---

## 1. Schnellstart

```bash
npm install
npm run build          # src/ -> dist/ (setzt Version, Service-Worker-Listen ein)
npm start              # Build + Electron
npm run dist:win       # Windows-Zip (electron-builder) -> release/
npm run build:vst3host # VST-Host mit MinGW bauen (Linux) -> build/vst3host/
```

Tests (siehe Abschnitt 6): `bash tests/run-all.sh`, `node tests/lint.js`, `xvfb-run -a node tests/e2e.js`.

---

## 2. Architektur

### Dateien

| Pfad | Inhalt |
|---|---|
| `src/app.html` | **Die gesamte App** (~8 400 Zeilen): HTML, CSS und ein großes `<script>` (IIFE). Kein Framework, kein Bundler. Abschnitte sind mit `// ================= Name =================` markiert (`grep -n "^// =====" src/app.html`). |
| `src/sw.js` | Service Worker. `__VERSION__`, `__SHELL__`, `__SAMPLES__` werden von `scripts/build.js` ersetzt. Shell-Cache pro Version, Sound-Cache mit Hash-Schlüssel. |
| `src/splash.html` | Startbildschirm (Electron). |
| `src/samples/*.js` | Instrument-/Drum-Samples als JS (setzen `KW_SMP`), Herkunft und Lizenzen in `src/samples/QUELLE.txt`. Werden lazy geladen. Format 1: `{midi: mp3}` (mono, eine Stärke, wird auf Spitze normalisiert). Format 2 (`hq-*.js`, `drums-hq*.js`): `{v:2, z:[[midi, obereVelocity, mp3]…]}` bzw. `{v:2, p:{kick:[[obereVelocity,[mp3…]]…]}}` – Stereo, Anschlagstufen, Round Robin, Pegel wie aufgenommen. |
| `src/plugins/` | WAM-2.0-Plugins: fremde (delay, distortion, simpleEQ, synth101, modal; Lizenz `LICENSE.txt`) und **eigene** in `src/plugins/sg/` (13 Effekte, gemeinsamer AudioWorklet `core.js` → Prozessor `sg-fx`). |
| `src/vendor/` | `wam-sdk.js`, `lame.min.js` (MP3) mit Lizenzen. |
| `scripts/build.js` | Baut `dist/`: kopiert, setzt `SG_VERSION` aus `package.json`, erzeugt SHELL- (vorab gecacht, inkl. `plugins/sg`) und SAMPLES-Liste. |
| `scripts/fetch-*.js` | Holen/erzeugen Sounds (VCSL, GM-Soundfont, Drumkits) und Fremd-Plugins. Nur bei Sound-Updates nötig. `fetch-plugins.js` darf `plugins/sg` **nicht** löschen. `fetch-hq.js` baut die Studio-Klänge (Format 2) aus sfzinstruments/VSCO-2 (Git-Partial-Clone, nur gebrauchte Dateien; Cache `$SG_HQ_CACHE`), mischt Drum-Mikrofone und gleicht Kit-Pegel an (`MIXDB`). |
| `main.js` | Electron-Hauptprozess: Fenster, Dateisystem-Brücke (`sgfs:*`), VST-Verwaltung (`vst:*`), CPU (`sys:cpu`). |
| `preload.js` | `contextBridge`: `window.sgfs`, `window.sgvst`, `window.sgsys`. Die Seite hat **keinen** Node-Zugriff. |
| `native/vst3host/` | `sg-vst3host.cpp`: eigener Plugin-Host-Prozess (ein Plugin pro Prozess) für VST3 und VST2. `vst2abi.h` = eigene Beschreibung der VST2-Binärschnittstelle (**kein Steinberg-SDK-Code für VST2**). Tests + Test-Plugins in `test/`. |
| `native/bin/sg-vst3host.exe` | Eingecheckter, fertiger Host (wird in die Windows-App gepackt). Nach Änderungen am Host neu bauen und einchecken. |
| `.github/workflows/` | `pages.yml` (Web-App auf GitHub Pages bei Push auf `main`), `windows.yml` (Host mit MSVC bauen, testen, App bauen, Release `v<Version>`), `vst3host.yml`. |
| `tests/` | Playwright-Tests, Fuzzer, Electron-E2E, Lint (Abschnitt 6). |

### Audio-Engine (Web Audio API, in `app.html`)

- **Globaler Zustand:** `P` = aktuelles Projekt, `ctx` = AudioContext, `master`, `buses` (Hall/Delay), `chans` (Map Spur-ID → Kanalzug), `gchans` (Gruppen), `session` (laufende Wiedergabe).
- **Kanalzug** (`chan(tr)`): `input → EQ-Bänder → Filter → comp (DynamicsCompressor) → makeup → duck → insIn → [Plugins] → insOut → pdc (Delay, Latenzausgleich) → vol → mute → pan → (master | Gruppe)`, plus Sends `revS`/`delS`.
- **Summe** (`buildMaster`): `master → Kompressor → Soft-Clip → analyser → Ziel`.
- **Scheduler** (`schedule(b0, b1, t0)`, Abschnitt „Transport / Scheduler“): plant Noten/Drums/Audio im Voraus in Beats; Positionen über die Taktart-Karte, Zeiten über die Tempo-Karte (`at(b)`).
- **Tempo-Karte**: `P.bpm` gilt ab Beat 0, `P.tempos = [{b, bpm}]` sind Tempowechsel. Beat ↔ Sekunde **nur** über `beatToSec, secToBeat, secsBetween, beatAfter, bpmAt, spbAt, tsegAt, tempoChangesIn` (es gibt kein `spb()` mehr). Tempo-Änderungen beim Abspielen über `tempoEdit(fn)` (alte Abschnitte behalten ihr Tempo), setzen über `setTempoAt(b, bpm|null)` / `setBpmAt(b, bpm)`. Audio-Regionen: `regSecs, srcBetween, beatOfSrc, audioPieces, stOf(r, b)`; Regionen mit `r.tempo` lesen ihre Aufnahme gleichmäßig pro Viertel und werden je Tempo-Abschnitt gedehnt.
- **Export/Einfrieren** (`renderSong` → `renderSongNow`): baut den kompletten Graphen in einem `OfflineAudioContext` neu, indem **die globalen Variablen `ctx`, `master`, `chans` … vorübergehend umgehängt** werden (im `finally` zurück). Währenddessen ist die Bedienung über `setRendering()` gesperrt (`#busy`). Vorlauf `PRE = 0.5 s` (wärmt die Kompressoren an) und die Kompressor-Vorausschau (`compLat` = 6 ms pro Kompressor) werden vorn abgeschnitten.
- **AudioWorklets** (als Text eingebettet bzw. Datei): `sg-duck` (Sidechain), `sg-vst` (Audio-Brücke zum VST-Host), `sg-fx` (eigene Effekte).
- **Plugins:** WAM 2.0 (`wamCreate`), VST über `window.sgvst` (Abschnitt „VST3-Plugins“). VST-Audio läuft per WebSocket zwischen Worklet und Host-Prozess; Steuerung zeilenweise über stdin (`<nr> <befehl> [arg]` → `<nr> ok|err …`; Befehle: getstate, setstate, params, edit, close, title, quit). Export mit VST: `vstBarrier` hält das Offline-Rendern alle `VST_OFF` = 4096 Samples an.
- **Latenzausgleich** (`applyPdc`): jede Spur wird auf den längsten Weg verzögert (VST-Latenz + 6 ms für Gruppen-Kompressor). `outLatency()` berücksichtigt das für Aufnahme und Metronom.

### Datenmodell (`P`, gespeichert als JSON)

```
P = { bpm, bars, master, metro, countIn, loop:{on,start,end}, markers:[{id,b,name,color}],
      sig:[n,d]?, sigs:[{bar, sig:[n,d]}]?, groups:[{id,name,vol,pan,mute,solo,glue}]?, tracks:[…] }
track = { id, type:'synth'|'drums'|'audio'|'sampler', name, color, vol, pan, mute, solo, out?(Gruppen-ID),
          regions:[…], fx, eq, ins:[Plugin-Slots], auto:{param:[{b,v}]}, frozen?, preset/kit/… je nach Typ }
region = { id, start, len (in Beats), name, … }
  synth/sampler: notes:[{p,s,l,v}], takes?, comp?
  drums:         steps:{kick:[…]…} (Velocity 0..1), pitch, trip, pb (Pattern-Takte), sig, swing, human, v2
  audio:         buf (ID), off, gain, fi/fo (Blenden), Stretch-Felder
```

- Zeiten im Projekt sind **Beats (Viertel)**. Takt ↔ Beat nur über die Taktart-Helfer: `sigSegs, segAt, sigAt, barStart, barPos, barNo, snapBar, ceilBar, nearBar, nearBeat, barLen, gridLines, setSig`.
- **`normProject(p)`** ist die einzige Stelle, die fremde/alte Daten säubert. Jeder neue Projekt-Pfad (Öffnen, Sicherung, Vorlage, Import) muss durch sie laufen. Sie wirft bei Nicht-Objekten und behält Array-Identität, wenn alles gültig ist.
- **Undo:** `pushUndo()` **vor** jeder Änderung (vollständiger JSON-Schnappschuss, max. 100), `restoreState()` danach `applyEngine()`.
- **Speicher:** Projekt in `localStorage['klangwerk.project']`, Audio-Aufnahmen in IndexedDB `klangwerk`, Einstellungen unter `klangwerk.*`. **Die Schlüssel nicht umbenennen** (alte Nutzerdaten gingen verloren).
- Projektdatei: `{ format:'klangwerk', project, audio:{id:{sr, ch:[base64 Int16]}} }`, Endung `.soundgroot.json`.

---

## 3. Coding-Konventionen

- **Ein-Datei-App beibehalten.** Kein Framework, kein Bundler, keine neuen Laufzeit-Abhängigkeiten ohne Rücksprache. Externe Bibliotheken liegen lokal in `src/vendor/` (App muss offline laufen).
- **Stil wie im Bestand:** kompakt, `const`/Arrow-Funktionen, kurze lokale Namen (`tr` Spur, `r` Region, `c` Kanalzug, `b` Beat, `t` Zeit in s), `$()` für `querySelector`. Lange Zeilen sind üblich. Keine Semikolon-/Formatierungs-Umbauten an fremdem Code.
- **Kommentare auf Deutsch**, erklären *warum*, nicht *was*.
- **UI-Texte:** Deutsch, Du-Form, einfache Sprache ohne Fachchinesisch, Einzahl/Mehrzahl korrekt („1 Spur“, „2 Spuren“). Bedienung orientiert sich an GarageBand (Rechtsklick/Langdruck-Menüs, Smart Controls, Bibliothek links, Editor unten).
- **Jede Änderung muss am Handy funktionieren** (Touch, 390×844 hoch und quer) und offline.
- **Audio-Parameter:** sofort setzen (`.value`) beim Aufbau/Export, weich (`setTargetAtTime`) bei Live-Änderungen – siehe `applyMix(now)`.
- **Neue Graph-Knoten** nur über `ctx` anlegen (nie einen festen Kontext merken), sonst landen sie beim Export im falschen Kontext.
- **Fehler nie verschlucken, die den Nutzer betreffen:** `toast(...)` mit verständlicher Meldung; technische Details per `console.warn`.
- **Lizenzen:** Nur Sounds/Code mit freier Lizenz (CC0, CC-BY, MIT …), Quelle in `src/samples/QUELLE.txt` bzw. `src/plugins/LICENSE.txt`. Keine Nachbildung fremder Marken/Produkte.
- **Grundsatz des Nutzers:** Jedes Update bringt auch neue Sounds mit.
- **Versionierung:** `package.json` (Semver) → `npm run build` übernimmt sie. Jede Version bekommt einen Abschnitt in `PLAN.md` (neu, behoben, Grenzen); `README.md` (Zip-Name) anpassen.
- **Git:** Commit-Messages auf Deutsch. Nicht force-pushen. PRs nur auf Wunsch. Merge auf `main` löst GitHub Pages und das Windows-Release aus.
- **Größere Edits** an `app.html` am sichersten als exakte Ersetzung (eindeutiger Ausschnitt), danach `npm run build` und Tests.

---

## 4. Bekannte Schwachstellen / Risiken

1. **Monolith `src/app.html`** mit globalem, veränderlichem Zustand. Nebenwirkungen sind schwer zu überblicken; immer nach allen Aufrufern greppen.
2. **Export hängt globale Variablen um** (`ctx`, `master`, `chans`, `gchans`, `session`). Jeder asynchrone Code, der während des Renderns läuft (Timer, UI-Handler), sieht den Offline-Kontext. Abgesichert durch `setRendering()`; neue Einstiegspunkte (Tasten, Buttons, MIDI) müssen `rendering` prüfen.
3. **Kompressor-Latenz ist eine Annahme:** `compLat` = 6 ms (Chromium-DynamicsCompressor-Vorausschau, empirisch gemessen). Ändert Chromium das, verrutscht der Export um ein paar Samples → `tests/timing.js`, `tests/lat.js` schlagen an.
4. **Undo per Voll-Schnappschuss:** bei großen Projekten speicherhungrig (100 × JSON). Audio liegt nicht im Schnappschuss, nur Referenzen.
5. **localStorage-Limit** (~5 MB) für das Projekt-JSON; sehr große MIDI-/Drum-Projekte können an die Grenze kommen.
6. **VST:** nur 64-Bit; Shell-Plugins (mehrere Effekte in einer .dll, z. B. Waves) und Dongle-Kopierschutz können scheitern; kein Sidechain-Eingang für Plugins; Live-Audio hat zusätzliche Pufferlatenz (`vstLat`, wächst bei Aussetzern bis 4×). **Nur unter Wine und mit eigenen Test-Plugins getestet, nie auf echtem Windows mit Fremd-Plugins.**
7. **iPhone nie auf echtem Gerät getestet** (nur emuliert in Chromium). Safari-Eigenheiten (AudioContext-Freigabe, Speicherdruck, Service-Worker-Updates) sind ungeprüft.
8. **Tempowechsel springen** (keine Rampen). Audio ohne „Folgt dem Songtempo“ behält seine Länge in Sekunden; die Wellenform solcher Regionen wird über Tempowechsel hinweg nur angenähert gezeichnet. Studio-Klänge sind groß (Flügel ~11 MB, Format 2) – erster Abruf am Handy dauert.
9. Ein Drum-Pattern hat genau eine Taktart; MIDI-importierte Drums werden an Taktartwechseln nicht geteilt.
10. Aufnahme-Latenz wird automatisch geschätzt (`outLatency() + 12 ms`); auf manchen Geräten muss der Nutzer manuell korrigieren.
11. Lint: 0 Fehler, 0 Warnungen.
12. Browser-Tests laufen **nicht** in CI (nur der VST-Host wird in CI getestet).

---

## 5. Offene To-dos

- [ ] PR für 1.8.0 mergen → prüfen, ob `windows.yml` das Release v1.8.0 baut (v1.7.1 wurde erfolgreich gebaut). Die Zip wird durch die Studio-Klänge rund 50 MB größer.
- [ ] Allmähliche Tempoübergänge (Rampen) in der Tempo-Karte.
- [ ] Regionen loopen durch Ziehen an der oberen rechten Ecke.
- [ ] Mehrfachauswahl von Regionen.
- [ ] Test auf echtem iPhone und echtem Windows-PC mit Fremd-Plugins (z. B. Vital, Surge XT, TAL-Plugins).
- [ ] Browser-Tests (`tests/run-all.sh`) als GitHub-Action.
- [ ] Undo speichersparender (Diffs statt Voll-Schnappschuss), falls Projekte groß werden.
- [ ] Neue Sounds im nächsten Update (Grundsatz).

---

## 6. Tests

Alle Browser-Tests brauchen vorher `npm run build` (sie servieren `dist/`) und Playwright (`require('playwright')`).
Ergebnisse/Downloads landen in `tests/out/` (ignoriert).

| Befehl | Prüft |
|---|---|
| `bash tests/run-all.sh` | Alle Browser-Regressionstests + Fuzzer. Jeder Block endet mit „keine Fehler“. |
| `node tests/t.js <b> <h> <png\|-> <test.js> [touch]` | Einzelner Test; `test.js` exportiert `async page => {}`. |
| `node tests/fuzz.js <seed> <schritte> [b h] [touch]` | Zufallsbedienung, meldet JS-Fehler mit den letzten Schritten. |
| `tests/timing.js`, `swing.js`, `lat.js`, `mute.js`, `tempo.js` | Export samplegenau (Anschläge, Swing, Gruppen-Latenz, Stumm/Solo, Tempowechsel inkl. Lineal-Bedienung, Abspielen, MIDI, gedehntes Audio). |
| `tests/templates.js` | Öffnet jede Vorlage, spielt und exportiert sie (Lautheit, Fehler). |
| `tests/sounds.js` | Rendert Instrumente/Kits einzeln: LUFS, Spitze, Stereo, Pegel je Anschlagstufe (`SG_SOUNDS="s_hq-piano kit:s_hqjazz"`). |
| `tests/export.js` | Alle Formate + Normalisierung (braucht `ffmpeg`/`ffprobe`). |
| `tests/undo.js`, `file.js`, `freeze.js`, `rec.js`, `sig.js`, `audio.js`, `sidechain.js`, `pwa.js`, `phone.js` | Undo/Redo, Projektdateien (auch kaputte), Einfrieren, Aufnahme/Takes, Taktartwechsel, Audio-Editor, Sidechain, Offline, Handy. |
| `node tests/lint.js` | ESLint über App, Service Worker, Electron, Effekt-Worklet. Einmalig `npm i --no-save eslint@9 globals`. |
| `xvfb-run -a node tests/e2e.js` | Echte Electron-App + VST-Host unter Wine + Test-Plugins (VST3/VST2), inkl. Export. Vorher `npm run build:vst3host`. |
| `WINEDEBUG=-all xvfb-run -a node native/vst3host/test/host-test.js build/vst3host/sg-vst3host.exe <vst3> <synth.dll> <gain.dll>` | 35 Host-Tests. |

**Vor jedem Commit mindestens:** `npm run build`, `node tests/lint.js`, die Tests zum geänderten Bereich; bei Audio-/Export-Änderungen immer `timing.js` und `lat.js`.
