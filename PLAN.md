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

## Prototyp v0.1 (fertig)

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

Bekannte Grenzen von v0.1:
- Audioaufnahmen werden noch nicht dauerhaft gespeichert (nach Neustart weg)
- Kein Export als WAV/MP3
- Keine Effekte (Hall, Delay, EQ)
- Aufnahme-Latenz wird noch nicht ausgeglichen

## Nächste Schritte

1. **Projekte als Datei speichern/öffnen** inkl. Audioaufnahmen (`.klangwerk`-Ordner)
2. **Export (Bounce)** als WAV und MP3
3. **Mixer-Fenster** mit Effekten pro Spur: EQ, Kompressor, Hall, Delay
4. **Sampler-Instrumente** mit freien Sample-Bibliotheken (Flügel, Gitarre, echte Drumkits)
5. **Aufnahme-Feinschliff**: Latenzausgleich, Vorzähler, Takes im Cycle
6. **Automation** (Lautstärke-Kurven usw.)
7. **Web-App/iPhone**: Touch-Bedienung, Installation als PWA
8. **VST3-Plug-ins** in der Windows-Version

## Starten

- Windows: `Klangwerk-0.1.0-win.zip` entpacken, `Klangwerk.exe` starten
- Entwicklung: `npm install`, dann `npm start`
- Windows-Build: `npm run dist:win`
