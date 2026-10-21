# Klangwerk – Plan

Eine DAW (Programm zum Musikmachen und Aufnehmen) mit einer Bedienung nach dem Vorbild von Logic Pro.
Zuerst als Windows-Programm, später auch als Web-App fürs iPhone.

## Technik

| Baustein | Wahl | Warum |
|---|---|---|
| Audio-Engine | Web Audio API (JavaScript) | Läuft identisch in der Windows-App, in Chrome/Edge und in Safari auf dem iPhone |
| Windows-Programm | Electron | Verpackt dieselbe App als `Klangwerk.exe`, erlaubt Mikrofon und MIDI ohne Rückfrage |
| iPhone | dieselbe App als Web-App (PWA) | Kein zweiter Code. Einschränkung: Safari kann kein Web-MIDI |
| Plug-ins (später) | VST3 über ein natives Node-Add-on | Nur in der Windows-Version möglich |

Leitregel: Alles, was nur unter Windows geht (VST3, Dateisystem, ASIO), kommt hinter eine Schnittstelle, damit die Web-Version ohne diese Teile weiter läuft.

## Version 0.1 (fertig)

- Steuerleiste mit Abspielen, Stopp, Aufnahme, Cycle, Metronom, Takt-Anzeige und Tempo
- Arrangement mit Spuren: Software-Instrument, Drummer, Audio
- Regionen verschieben, in der Länge ändern, zwischen Spuren ziehen, duplizieren
- 7 eingebaute Synth-Sounds: E-Piano, Synth-Bass, Pad, Lead, Pluck, Orgel, Strings
- Drumkit aus Synthese (Kick, Snare, Clap, Hi-Hats, Tom, Rimshot, Cowbell)
- Step-Sequencer mit Pattern-Vorlagen (Pop, Rock, House, Hip-Hop, Trap, Funk, Reggaeton, Fill)
- Piano Roll: Noten setzen, verschieben, Länge ändern, quantisieren, transponieren
- Musical Typing (Computertastatur als Klavier, wie in Logic)
- MIDI-Keyboard per USB: spielt und nimmt auf der ausgewählten Spur auf
- Audio-Aufnahme vom Mikrofon oder Audio-Interface, Eingang wählbar
- Audiodateien importieren (Button oder Drag & Drop)
- Lautstärke, Panorama, Mute, Solo pro Spur, Master-Pegel
- Rückgängig, automatisches Speichern des Projekts

## Version 0.2 (fertig)

- Datei-Menü: Neu, Öffnen, Speichern (Strg+S), Speichern unter. Projektdatei `.klangwerk` enthält auch alle Aufnahmen
- Aufnahmen und Importe überstehen einen Neustart (Browser-Speicher)
- Export des ganzen Songs als WAV (16 Bit, 44,1 kHz) oder MP3 (192 kbit/s), schneller als Echtzeit
- Instrument-Bibliothek mit 32 Sounds in 6 Kategorien: Tasten, Bass, Lead, Flächen, Streicher & Bläser, Gezupft & Glocken
- 5 Drumkits: Standard, 808, Akustik, Elektro, Lo-Fi
- Kanal-EQ pro Spur wie in Logic: 6 Bänder (Low Cut, Tiefen, 2× Mitten, Höhen, High Cut), Kurve mit der Maus ziehen, Mausrad für die Bandbreite, Live-Spektrum, 9 Vorlagen

Bekannte Grenzen:
- Aufnahme-Latenz wird noch nicht ausgeglichen
- Im Claude-Artefakt werden Exporte als .zip geliefert (dort sind nur bestimmte Dateitypen erlaubt)

## Version 0.3 (fertig)

- Neuer Bereich „Klang & Effekte“ pro Spur (Button „FX“ im Spurkopf)
- Kompressor pro Spur mit Pegelreduktions-Anzeige und 5 Vorlagen
- Gemeinsamer Hall (Raumgröße einstellbar) und tempo-synchrones Delay, jede Spur mit eigenem Send-Regler
- Klangregler für Instrumente: Helligkeit, Einschwingen, Ausklingen, Oktave
- 57 Instrumente in 9 Kategorien, neu u. a. Gitarren per Saiten-Simulation (Akustik, Nylon, E-Gitarre clean/verzerrt, Banjo), Kontrabass, Slap- und Wobble-Bass, Trompete, Saxophon, Klarinette, Oboe, Cello, Sitar, Koto, Steel Drum, Panflöte, Chiptune
- Sanfter Begrenzer am Master gegen Übersteuern

## Version 0.4 (fertig)

- Piano Roll mit Werkzeugen Zeichnen, Auswählen (Rechteck, Shift+Klick, Strg+A) und Löschen
- Am Touchscreen scrollt Wischen, nur Tippen setzt eine Note; am Rand ziehen ändert die Länge
- Länge und Anschlag der ausgewählten Noten oben einstellbar, dazu eine Anschlag-Spur unter dem Editor
- Triolen: Raster 1/4-, 1/8- und 1/16-Triolen, Button „In Triole teilen“, im Drum-Pattern lässt sich jeder Schlag einzeln auf Triolen umschalten
- Drum-Editor pro Instrument (Kick, Snare …): Tonhöhe ±12 Halbtöne und Anschlag für jeden einzelnen Schlag
- Editor-Höhe mit dem Griff verstellbar

## Version 0.5 (fertig)

- Neues Design: ruhiges Dark-Theme, einheitliche Regler und Icons, weiche Übergänge und Animationen
- Steuerleiste neu geordnet (Transport und Anzeige in der Mitte), passt sich an kleine Fenster und das Handy an
- Bibliothek als Seitenleiste (Taste I): Sounds mit Suche und Kategorien, Drumkits, Pattern per Klick; Pfeiltasten blättern durch die Sounds
- Mixer (Taste M): Kanalzüge mit Klang, EQ-Vorschau, Hall/Delay-Send, Panorama, Fader mit Pegelanzeige, Mute/Solo, dazu die Effekt-Busse und der Master
- Pegelanzeige in jedem Spurkopf
- Zoomen mit Strg + Mausrad oder zwei Fingern um die Stelle unter dem Zeiger, auch im Piano Roll und Drum-Editor (Buttons − / +)
- Beim Abspielen gleitet die Ansicht weich mit

## Fahrplan

1. **v0.6 Bearbeitung**: Automation (Lautstärke, Pan, Effekte als Kurven), Audio schneiden und blenden, Marker für Songteile, Kopieren/Einfügen über Spuren
2. **v0.7 Sampler-Instrumente** mit freien Sample-Bibliotheken (Flügel, Gitarre, echte Drumkits)
3. **v0.8 Aufnahme-Feinschliff**: Vorzähler, Latenzausgleich, Takes im Cycle
4. **v0.9 Web-App/iPhone**: Installation als PWA, Touch-Bedienung weiter verbessern
5. **Später**: VST3-Plug-ins in der Windows-Version

## Starten

- Windows: `Klangwerk-0.5.0-win.zip` entpacken, `Klangwerk.exe` starten
- Entwicklung: `npm install`, dann `npm start`
- Windows-Build: `npm run dist:win`
