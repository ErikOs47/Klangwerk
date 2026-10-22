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

## Version 0.6 (fertig)

- Automation wie in Logic: Taste „A“ im Spurkopf öffnet eine Spur darunter für Lautstärke, Panorama, Filter (Höhen), Hall-Send und Delay-Send. Klick setzt Punkte, Ziehen mit der Maus zeichnet eine Kurve, Punkte lassen sich verschieben, Doppelklick löscht. Regler in Spurkopf und Mixer laufen beim Abspielen mit
- Regionen bearbeiten: am linken Rand den Anfang kürzen, mit B oder „Teilen“ an der Abspielposition schneiden, Alt+Klick schneidet an der Mausposition (für Audio, Instrumente und Drums)
- Audio: Ein- und Ausblenden über die Griffe an der Region oder im Editor, Pegel pro Region, Normalisieren, Umkehren
- Marker-Leiste unter dem Lineal für Intro, Strophe, Refrain: Klick springt hin, Shift+Klick setzt den Cycle auf den Teil, Ziehen verschiebt, Doppelklick auf den Namen benennt um; „,“ und „.“ springen zum vorigen/nächsten Marker
- Kopieren, Ausschneiden, Einfügen (Strg+C/X/V) an der Abspielposition, auch auf eine andere Spur
- Drum-Bibliothek: jedes Instrument einzeln aus jedem Kit wählbar (z. B. Kick aus Trap, Snare aus 808), auch im Drum-Editor unter „Klang aus“; Suche nach Kit oder Instrument
- Neue Sounds:
  - 17 Instrumente (jetzt 74): Wurlitzer, Spielzeug-Klavier, Lo-Fi Keys, FM-Bass, Moog-Bass, Mundharmonika, Pfeifen, Shimmer-Pad, Chor (Ooh), Synth-Brass, Violine, 12-saitige Gitarre, Ukulele, Mandoline, Glockenspiel, Röhrenglocken, Riser
  - 6 neue Drumkits (jetzt 11): 909, Trap, Jazz (Besen), Boom Bap, Industrial, Percussion
  - 4 neue Drum-Instrumente (jetzt 12): Crash, Ride, Shaker, Conga
  - 5 neue Pattern: Jazz-Swing, Shuffle, Bossa Nova, Afrobeat, Drum & Bass

## Version 0.7 (fertig)

- Sampler: Instrumente aus echten Aufnahmen. Etwa alle drei Halbtöne liegt ein Sample, dazwischen wird umgestimmt; Bläser, Streicher und Orgeln halten lange Töne per Schleife. Leiser angeschlagene Noten klingen auch dunkler
- Eigenes Sample: in der Bibliothek „Eigenes Sample laden …“ macht aus jeder Audiodatei ein spielbares Instrument. Der Grundton wird erkannt und lässt sich unter Klang & Effekte ändern, dazu „Ton halten (Schleife)“. Das Sample wird im Projekt mitgespeichert
- Samples werden erst geladen, wenn eine Spur sie nutzt; der Export wartet darauf
- Fehler behoben: Klang & Effekte (wie schon der EQ) wechseln jetzt mit, wenn man eine andere Spur antippt. Jeder Klick in einen Spurkopf wählt die Spur aus, auch auf Name, Instrument und Regler
- Fehler behoben: Doppelklick in eine Spur öffnet die neue Region jetzt immer im Editor (vorher blieb z. B. Klang & Effekte offen); am Touchscreen klappt Doppeltippen
- Regionen löschen: Knopf „Region löschen“ oben im Editor (neben dem Namen), weiterhin auch mit Entf
- Verschieben: Die Region folgt beim Ziehen Finger bzw. Maus, auch auf eine andere Spur; die Zielspur leuchtet auf, auf einer unpassenden Spur wird die Region blass
- Neue Sounds: 20 echte Instrumente (jetzt 94 Klänge): Konzertflügel, Westerngitarre, Konzertgitarre, E-Gitarre (Jazz), E-Bass, Kontrabass, Cello, Geige, Konzertharfe, Querflöte, Klarinette, Saxophon, Fagott, Trompete, Posaune, Waldhorn, Tuba, Pfeifenorgel, Harmonium, Xylophon
- Quelle der Samples: [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) von Nicholas Brosowsky, CC-BY 3.0. `node scripts/fetch-samples.js` lädt und verkleinert sie neu (braucht curl und ffmpeg)

## Version 0.8 (fertig)

- Neue Aufnahme-Engine: Das Mikrofon wird direkt im Audio-Graphen mitgeschnitten, dadurch hat jedes Sample eine feste Zeit und die Aufnahme sitzt genau auf dem Raster
- Vorzähler: Aus, 1 oder 2 Takte (unter Geräte, wird im Projekt gespeichert), mit großer Anzeige und Klicks auch ohne Metronom
- Latenzausgleich: automatisch aus der Ausgabelatenz geschätzt, als eigener Wert einstellbar oder per „Latenz messen“ (drei Klicks über die Lautsprecher, das Mikrofon hört mit). Gilt pro Gerät. MIDI-Noten werden um die Ausgabelatenz früher eingetragen
- Takes im Cycle: Mit eingeschaltetem Cycle entsteht pro Durchgang ein Take (Audio und MIDI). Die Region zeigt „Take 2/3“, im Editor wählst du den Take aus oder behältst nur einen
- Neue Sounds: 7 echte Drumcomputer als Samples (jetzt 18 Kits): TR-808, LinnDrum LM-2, Casio RZ-1, Roland CR-8000, MFB-512, Yamaha MR-10, Casio SK-1. Einzelne Klänge daraus lassen sich wie gewohnt mit anderen Kits mischen; fehlende Instrumente ergänzt ein passendes Synth-Kit
- Quelle der Drum-Samples: [smpldsnds/drum-machines](https://github.com/smpldsnds/drum-machines), gemeinfrei. `node scripts/fetch-drums.js` lädt sie neu

## Grundsatz

Jedes Update bringt auch neue Sounds mit.

## Fahrplan

1. **v0.9 Web-App/iPhone**: Installation als PWA, Touch-Bedienung weiter verbessern
2. **Später**: VST3-Plug-ins in der Windows-Version

## Starten

- Windows: `Klangwerk-0.8.0-win.zip` entpacken, `Klangwerk.exe` starten
- Entwicklung: `npm install`, dann `npm start`
- Windows-Build: `npm run dist:win`
