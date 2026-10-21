# Klangwerk

Eine DAW (Programm zum Musikmachen und Aufnehmen) nach dem Vorbild von Logic Pro.
Läuft als Windows-Programm (Electron) und im Browser; später auch als Web-App fürs iPhone.

## Starten

```bash
npm install
npm start          # startet die Desktop-App
npm run build      # erzeugt dist/index.html für den Browser
npm run dist:win   # baut release/Klangwerk-<version>-win.zip
```

Die ganze App steckt in `src/app.html`. Plan und nächste Schritte: siehe [PLAN.md](PLAN.md).
