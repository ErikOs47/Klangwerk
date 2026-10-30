# Sound Groot

Eine DAW (Programm zum Musikmachen und Aufnehmen) nach dem Vorbild von Logic Pro.
Läuft als Windows-Programm (Electron), im Browser und als Web-App auf dem iPhone (zum Home-Bildschirm hinzufügen, läuft auch offline).

## Starten

```bash
npm install
npm start          # startet die Desktop-App
npm run build      # erzeugt dist/ für den Browser (mit Manifest und Service Worker)
npm run dist:win   # baut release/SoundGroot-<version>-win.zip
```

Externe Plugins im Format Web Audio Modules 2.0 (WAM) lassen sich pro Spur als Effekt oder Instrument einsetzen, fünf freie Plugins liegen in `src/plugins/` (`node scripts/fetch-plugins.js`).

In der Windows-App gehen zusätzlich VST3-Plugins (Effekte und Instrumente). Jedes läuft in einem eigenen Prozess, `sg-vst3host.exe` (C++, Steinberg VST3 SDK, MIT-Lizenz), Quelle in `native/vst3host/`:

```bash
npm run build:vst3host   # Linux: baut native/bin/sg-vst3host.exe mit MinGW-w64 (holt das SDK)
node native/vst3host/test/host-test.js native/bin/sg-vst3host.exe <Test-Plugin>   # Tests (unter Linux mit Wine)
```

`npm run dist:win` packt die exe mit ein. Die GitHub-Action „VST3-Host“ baut und testet sie unter Windows mit MSVC.

Export: WAV 16/24/32 Bit, FLAC, MP3, Stems als ZIP, Normalisieren auf Spitze oder −14 LUFS (Datei → Exportieren, Strg+E). Alle Tastenkürzel stehen in den Einstellungen (Zahnrad, F1).

Die ganze App steckt in `src/app.html`. Plan und nächste Schritte: siehe [PLAN.md](PLAN.md).
