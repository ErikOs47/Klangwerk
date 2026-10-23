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

Die ganze App steckt in `src/app.html`. Plan und nächste Schritte: siehe [PLAN.md](PLAN.md).
