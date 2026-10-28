# Sound Groot – Plan

Eine DAW (Programm zum Musikmachen und Aufnehmen) mit einer Bedienung nach dem Vorbild von Logic Pro.
Zuerst als Windows-Programm, später auch als Web-App fürs iPhone.

## Technik

| Baustein | Wahl | Warum |
|---|---|---|
| Audio-Engine | Web Audio API (JavaScript) | Läuft identisch in der Windows-App, in Chrome/Edge und in Safari auf dem iPhone |
| Windows-Programm | Electron | Verpackt dieselbe App als `Klangwerk.exe`, erlaubt Mikrofon und MIDI ohne Rückfrage |
| iPhone | dieselbe App als Web-App (PWA) | Kein zweiter Code. Einschränkung: Safari kann kein Web-MIDI |
| Plug-ins | Web Audio Modules 2.0 (WAM), offener Web-Standard | Laufen in der Windows-App, im Browser und auf dem iPhone gleich |
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

## Version 0.85 (fertig): Sampler mit MPC-Pads

- Audiodatei auf die Arrangierfläche ziehen: linke Hälfte = normale Audiospur, rechte Hälfte = neue Sampler-Spur. Auf eine bestehende Sampler-Spur gezogen, kommt die Datei als weiteres Sample dazu. Auch per „+ Spur → Sampler (MPC-Pads)“, über die Bibliothek oder mit „Im Sampler öffnen“ aus einer Audio-Region
- Chops: Die Datei wird automatisch an den Anschlägen geschnitten (Empfindlichkeit wählbar) oder gleichmäßig in 4/8/16/32 Teile bzw. nach Schlägen (bei bekanntem Tempo). Mit der Schere (oder Alt-Klick) an jeder Stelle teilen, Ränder ziehen, Chops verschieben, auf freier Fläche einen neuen Chop aufziehen, zoomen (Strg+Mausrad)
- Jeder Chop einzeln: Name, Tonhöhe (±24 Halbtöne, wie an der MPC wird höher auch schneller), Feinstimmung, Pegel, Ein- und Ausblenden, Filter, Rückwärts, Modus (ganz abspielen, nur solange gedrückt, Schleife), Duplizieren, Löschen
- Reihenfolge: Chips unten per Ziehen neu ordnen, „Auf Pads verteilen“ legt sie in dieser Reihenfolge auf die Pads, „Als Region einfügen“ setzt sie hintereinander als Noten in den Song
- 16 Pads (4×4) wie an der MPC: antippen, mit der Tastatur (1–4, Q–R, A–F, Y–V; mit Umschalt bleiben die normalen Kürzel), per MIDI-Keyboard oder Pad-Controller ab Note 36 (die übliche Pad-Belegung). Chips auf ein Pad ziehen, Pads untereinander tauschen, Rechtsklick leert ein Pad. „Chops schneiden sich ab“ (Mono/Choke) und „Volle Lautstärke“ einstellbar
- Aufnahme: Pads einspielen wie Noten (Shift+R, mit Vorzähler und Takes). Die Pad-Region öffnet sich im Piano-Roll mit 16 Pad-Zeilen statt Tasten, mit Velocity und allen Werkzeugen
- Alles wird mitgespeichert (Projektdatei und automatisch im Browser), Export und Rückgängig funktionieren wie gewohnt
- Neue Sounds: 12 Loops zum Choppen (Funk-, Boom-Bap- und Shuffle-Break, Cajón, Conga & Bongos, Soul-Piano, Vibraphon, Kalimba, Marimba, Harfe, Orgel, Saxophon), 10 echte Instrumente (jetzt 104 Klänge): Vibraphon, Marimba, Kalimba, Balafon, Tenorsaxophon, Mundharmonika, Okarina, Cembalo, Renaissance-Orgel, Keltische Harfe, und 2 akustische Kits (jetzt 20 Kits): Akustik-Set und Percussion (Cajón, Shaker, Tamburin, Congas, Claves, Agogo, Triangel)
- Quelle: [Versilian Community Sample Library](https://github.com/sgossner/VCSL), CC0 (gemeinfrei). `node scripts/fetch-vcsl.js` lädt die Aufnahmen und baut daraus Instrumente, Kits und Loops

## Version 0.9 (fertig): Sound Groot und Web-App fürs iPhone

- Neuer Name **Sound Groot** mit Bonsai-Logo (Krone aus Pegelbalken in Prismafarben), Ladebildschirm im Browser und eigenes Startfenster unter Windows. Projektdateien heißen jetzt `.soundgroot`, alte `.klangwerk`-Dateien öffnen weiter. Gespeicherte Songs und Einstellungen bleiben erhalten
- Web-App (PWA): Auf dem iPhone in Safari „Teilen → Zum Home-Bildschirm“, dann startet Sound Groot im Vollbild mit eigenem Icon (Hinweis kommt beim ersten Besuch). In Chrome und Edge über „Datei → Als App installieren“
- Offline: App und alle bereits genutzten Sounds sind gespeichert. „Datei → Alle Sounds offline speichern“ lädt den Rest (ca. 21 MB). Nach einem Update fragt die App, ob sie neu laden soll; nur geänderte Sounds werden neu geladen
- Bildschirm-Keyboard (Knopf oben rechts): zum Spielen ohne MIDI-Keyboard, etwa auf dem iPhone. Mehrere Finger gleichzeitig, über die Tasten gleiten, weiter unten angeschlagen klingt lauter, Oktave wechseln, „Halten“ lässt Töne weiterklingen. Auf Drum-Spuren 12 Pads, auf Sampler-Spuren die 16 MPC-Pads. Spielt und nimmt auf wie ein MIDI-Keyboard
- iPhone-Feinschliff: Ränder für Notch und Home-Leiste, kein Zoomen der ganzen Seite, kein Hineinzoomen beim Tippen in Felder, Handy quer zeigt Arrangement und Keyboard ohne Editor
- Veröffentlichung: `.github/workflows/pages.yml` stellt die Web-App bei jedem Merge auf main über GitHub Pages bereit
- Neue Sounds: 10 echte Instrumente (jetzt 114 Klänge): FM-E-Piano und Clavi-Synth (Yamaha TX81Z), Klavier (Upright), Kirchenorgel, Glockenspiel, Röhrenglocken, Handglocken, Đàn Tranh (Zither), Blockflöte, Mbira; 2 neue Kits (jetzt 22): Welt-Percussion (Darbuka, Rahmentrommel, Schlitztrommel, Cabasa, Guiro …) und Orchester (Große Trommel, Pauken, Gong, Becken, Röhrenglocke, Ratsche …). Quelle: VCSL, CC0. `node scripts/fetch-vcsl.js instruments <ids>` baut einzelne neu

## Version 0.95 (fertig): Externe Plugins (WAM 2.0)

- Plugin-Host für **Web Audio Modules 2.0**, den offenen Plugin-Standard fürs Web. Läuft in der Windows-App, im Browser und auf dem iPhone
- Effekt-Plugins als **Inserts** pro Spur (Tab „Klang & Effekte“): beliebig viele hintereinander, nach dem Kompressor und vor dem Lautstärkeregler. Ein/Aus, Reihenfolge mit ↑ ↓, entfernen mit ×
- **Instrument-Plugins**: auf einer Instrument-Spur unter „Instrument-Plugin“ oder in der Bibliothek unter „Plugin-Instrumente“ wählen. Noten aus Regionen, MIDI-Keyboard, Computertastatur und Bildschirm-Keyboard spielen dann das Plugin
- **Plugin-Fenster**: Klick auf den Plugin-Namen öffnet die Oberfläche, die das Plugin mitbringt. Verschiebbar, am Handy scrollbar
- Einstellungen der Plugins werden im Projekt gespeichert (auch in `.soundgroot`-Dateien) und beim Export (WAV/MP3) mitgerendert
- **Eigene Plugins per Link**: „Eigenes Plugin per Link“ nimmt die Adresse eines WAM-Plugins (Ordner oder `index.js`), z. B. aus der Sammlung auf webaudiomodules.com. Die Liste eigener Plugins wird pro Gerät gemerkt
- Mitgeliefert (laufen offline): Synth-101 (Analog-Synth nach SH-101), Spectrum: Modal (Physical Modelling), Simple Delay, Simple Distortion, Simple EQ. Quelle: [burns-audio-wam](https://github.com/boourns/burns-audio-wam) von Tom Burns, MIT. `node scripts/fetch-plugins.js` lädt sie und das WAM-SDK neu

## Version 1.0 (fertig): Groove, Mixer-Ausbau, Undo-Verlauf, Time-Stretch

- **Quantisieren und Groove** (Piano Roll, Knopf „Quantisieren“ und ▾ daneben, Taste Q): Raster, Stärke in %, Swing (50–75 %), Notenlängen mitquantisieren. „Humanize“ verschiebt Timing und Anschlag leicht zufällig. Optional wird nach einer MIDI-Aufnahme automatisch quantisiert. Alles lässt sich mit Strg+Z zurücknehmen
- **Swing und Humanize für Drums**: zwei Regler im Step-Sequencer, wirken beim Abspielen und im Export
- **Sampler-Chops im Raster**: Auto-Chop „Auf 16tel“ setzt die Schnitte genau ins Raster des Loop-Tempos
- **Gruppen-Busse**: „+ Gruppe“ im Mixer, dann pro Spur unten „→ Gruppe“ wählen. Jede Gruppe hat Fader, Pan, Mute/Solo und einen „Glue“-Kompressor
- **Sidechain-Kompression**: im Kompressor eine Auslöser-Spur wählen (z. B. Kick), Preset „Pumpen (Sidechain)“, optional nur die Bässe des Auslösers. Anzeige der Pegelreduktion
- **LUFS-Lautheit** (EBU R128): kurzfristig und gesamt am Master-Kanal und oben im Display, nach dem Export im Hinweis. Ziel für Streaming: etwa −14 LUFS
- **Undo-Verlauf**: Knopf mit der Uhr oben zeigt alle Bearbeitungsschritte mit Namen, ein Klick springt zu jedem Schritt. Wiederholen mit Strg+Umschalt+Z oder Strg+Y
- **Autosave und Absturz-Wiederherstellung**: jede Änderung wird sofort gespeichert, alle zwei Minuten entsteht zusätzlich eine Sicherung (bis zu 20). Nach einem Absturz meldet sich die App und bietet ältere Sicherungen an
- **Time-Stretch**: Audio-Regionen passen sich ohne Tonhöhenänderung ans Songtempo an („Tempo folgen“, Original-BPM erkennen) oder werden frei gedehnt (50–200 %, auch per Alt+Ziehen am rechten Rand). Loops aus der Bibliothek lassen sich als Audio-Region ins Songtempo legen. Läuft im Hintergrund (WSOLA)
- Neue Sounds: 6 echte Instrumente: Flügel (Kawai), Strumstick, Psalter gestrichen und gezupft, Saxello, Kalimba (Tansania); neues Kit „Studio-Set 2 (echt)“ mit weiteren Kicks, Snares, Toms, Becken und Bremstrommel; 8 neue Loops (House-Groove, Halftime-Break, Bossa, Reggae One-Drop, House-Piano, Folk-Strumming, Saxello-Linie, Psalter-Fläche). Quelle: VCSL, CC0

## Version 1.1 (fertig): Taktarten, lange Drum-Patterns, Malen im Drum-Editor

- **Taktart des Songs** oben im Display (Feld „Taktart“): 2/4, 3/4, 4/4, 5/4, 6/4, 7/4, 3/8, 5/8, 6/8, 7/8, 9/8, 12/8. Lineal, Raster, Metronom (Betonung auf der Eins), Vorzähler, Positionsanzeige, Marker, Cycle und das Einrasten richten sich danach. Beim Umstellen bleibt alles im selben Takt, Drum-Patterns werden Takt für Takt umgebaut. Mit Strg+Z zurück
- **Drum-Patterns mit 1 bis 16 Takten** (Feld „Länge“ im Step-Sequencer). Beim Verlängern wird das bisherige Pattern wiederholt, danach lassen sich die Takte einzeln abwandeln. Im Raster stehen Takt und Zählzeit (z. B. 2.3), Takte sind sichtbar abgesetzt
- **Malen durch Ziehen**: im Step-Sequencer mit gedrückter Maus (oder dem Finger) über eine Reihe ziehen belegt alle Felder auf dem Weg, auf einem gesetzten Feld begonnen löscht das Ziehen. Im Drum-Editor eines Instruments malt Ziehen die Schläge in der Tonhöhe, in der man begonnen hat, mit dem Werkzeug „Löschen“ wird gelöscht
- 8 neue Patterns für andere Taktarten: Walzer, Ballade 3/4, Jazz-Walzer, 6/8 Ballade, 6/8 Marsch, 12/8 Blues, 5/4 Groove, 7/8 Groove. Patterns in der Taktart des Songs stehen in der Liste oben
- Neue Sounds: 8 echte Instrumente (DX-Piano TX81Z, Nyunga Nyunga, Klavier Knight, Bassblockflöte, chromatische Mundharmonika, Vibraphon weich, Röhren-Glockenspiel, Cembalo mit Lautenzug); Kit „Marsch-Set (echt)“ mit Marschtrommel, Tenortrommeln, Triangel und Schellenbaum; 8 Loops in anderen Taktarten (Walzer-Drums, Walzer-Klavier, Glockenspiel-Walzer, Ballade 6/8, Marsch 6/8, Mbira-Arpeggio 6/8, Groove 5/4, Groove 7/8). Quelle: VCSL, CC0

## Version 1.2 (fertig): Mehr Sounds und übersichtlichere Bibliothek

- **Bibliothek nach Instrumentenfamilien**: Synth-Klänge und echte Aufnahmen stehen gemeinsam in 11 Familien (Klavier & Tasten, Orgel & Akkordeon, Gitarre & Zupfinstrumente, Bass, Streicher, Blechbläser, Holzbläser & Flöten, Mallets/Glocken/Pauken, Chor & Flächen, Weltmusik, Lead & Synth). Die Familien starten zugeklappt, die des aktuellen Klangs ist offen; der Klappzustand bleibt gespeichert, ⇕ klappt alle auf oder zu
- **Filter-Leiste**: Alle · ★ Favoriten · Zuletzt · Echt · Synth (bei Drums: Alle · Favoriten · Echt · Synth, bei Loops: Alle · Favoriten · Zuletzt)
- **Favoriten**: Stern an jedem Sound, Kit, einzelnen Drum-Sound und Loop. Gilt für alle Songs
- **Vorhören ohne Auswählen**: ▶ an jedem Eintrag spielt den Sound bzw. das Kit an, Loops laufen einmal im Originaltempo (nochmal klicken stoppt)
- Suche zeigt die Anzahl der Sounds und findet auch Familien („bläser“, „echt“, „synth“) und bei Loops die Taktart („6/8“)
- Drumkits getrennt in „Synth-Kits“ und „Echte Kits (Samples)“
- Neue Sounds: **49 echte Instrumente** aus dem FluidR3-GM-Soundfont (CC-BY 3.0): E-Piano (Rhodes-Art), Honky-Tonk, Clavinet, Celesta, Spieluhr, Hackbrett, Hammond- und Rock-Orgel, Akkordeon, Bandoneon, E-Gitarre clean/gedämpft/Crunch/verzerrt, Banjo, Akustik-, Fretless-, Slap-, Plektrum- und Synth-Bass, Bratsche, Streicher-Ensemble, Tremolo, Pizzicato, Synth-Streicher, Chor Aah/Ooh, Bläsersatz, gedämpfte Trompete, Alt- und Baritonsax, Oboe, Englischhorn, Piccolo, Panflöte, Shakuhachi, Pauken, Orchester-Hit, Steel Drum, Sitar, Koto, Shamisen, Dudelsack, Fiddle, Shehnai, drei Pads und Kristall; 2 neue Drumcomputer-Kits: Sequential Circuits Drumtraks und 808 Mini (gemeinfrei)

## Version 1.3 (fertig): MPC Beats und andere DAWs anbinden

- **MIDI-Dateien importieren**: .mid ins Arrangement ziehen oder unter Datei → „MIDI-Datei importieren …“. Jede MIDI-Spur wird eine eigene Spur, Kanal 10 wird ein Drum-Pattern, Instrumente bekommen über das General-MIDI-Programm einen passenden Klang. Auf eine bestehende Spur gezogen kommen die passenden Noten dorthin (Drums auf Drum- und Sampler-Spuren), der Rest auf neue Spuren. Triolen und der Swing aus MPC Beats werden erkannt (Swing-Regler der Region). Hat die Datei ein anderes Tempo oder eine andere Taktart, fragt Sound Groot, ob der Song sie übernehmen soll
- **MIDI-Dateien exportieren**: Datei → „Song als MIDI exportieren“ (alle Instrument-, Drum- und Sampler-Spuren) und „Als MIDI“ oben im Editor für eine einzelne Region. Drums und Pads liegen auf Kanal 10 mit General-MIDI-Noten, so dass MPC Beats und andere DAWs sie richtig zuordnen
- **Ordner-Browser** in der Bibliothek (Filter „Ordner“): Sample-Ordner durchblättern, ▶ vorhören, per Klick laden oder auf eine Spur ziehen, Suche über alle Unterordner. In der Windows-App werden die installierten MPC-Expansions (C:\ProgramData\Akai\MPC\Expansions) automatisch gefunden, weitere Ordner per „Ordner hinzufügen …“. Im Browser (Chrome/Edge) über „Ordner wählen …“
- **MPC-Programme (.xpm)**: Drum-Programme werden zur Sampler-Spur mit allen 16 Pads (Stimmung, Lautstärke, Rückwärts, One-Shot, MIDI-Notenbelegung der MPC), jede belegte Bank wird eine eigene Spur. Keygroup-Programme werden zum spielbaren Instrument mit allen Samples über die Tastatur verteilt (inkl. Schleifen)
- Sampler: kurze Einzelklänge (unter 1,5 s) landen ungeschnitten auf einem Pad; MIDI-Pads folgen der Notenbelegung eines MPC-Kits
- Mehr General-MIDI-Drumnoten werden erkannt (Bongos, Timbales, Agogo, Claves, Woodblock, Guiro, Tamburin)
- Neue Sounds: 9 echte Instrumente aus dem FluidR3-GM-Soundfont (CC-BY 3.0): E-Flügel, Perkussive Orgel, Gitarren-Flageolett, Flasche (geblasen), Glöckchen, Agogo, Taiko-Trommel, Holzblock, Synth-Chor. Damit hat jedes General-MIDI-Programm einen passenden Klang
- Nicht möglich: MPC Beats direkt fernsteuern oder seine eingebauten AIR-Plugins nutzen. MPC-Sounds bleiben auf deinem PC und werden nicht in Sound Groot eingebaut (Lizenz)

## Version 1.4 (fertig): VST3-Plugins in der Windows-App

- **VST3-Plugins** (Effekte und Instrumente) laufen in der Windows-App in denselben Plätzen wie die Web-Plugins: Spur wählen → „Klang & Effekte“ → „Einfügen“ (Effekte) bzw. „Instrument-Plugin“. In den Listen stehen sie unter „VST3 auf diesem PC“
- **Suche**: beim Start werden `C:\Programme\Gemeinsame Dateien\VST3` und `%LOCALAPPDATA%\Programs\Common\VST3` durchsucht, weitere Ordner per „Ordner hinzufügen …“. Nur neue oder geänderte Plugins werden neu geprüft; was sich nicht laden lässt, steht mit Grund in der Liste
- **Eigene Fenster**: „Oberfläche öffnen“ zeigt die Original-Oberfläche des Plugins in einem eigenen Windows-Fenster (mit Größenänderung und hoher Auflösung, wenn das Plugin das kann)
- **Abgeschirmt**: jedes Plugin läuft in einem eigenen Prozess (`sg-vst3host.exe`). Stürzt eins ab, läuft Sound Groot weiter, das Plugin wird überbrückt und lässt sich per Klick neu starten
- **Zustand** (alle Einstellungen und Presets im Plugin) wird im Projekt gespeichert und beim Öffnen und beim Export wiederhergestellt. Liegt ein Plugin auf einem anderen PC woanders, wird es über seine Kennung trotzdem gefunden
- **Latenzausgleich**: Der Weg zum Plugin hat einen kleinen Puffer (meist 10–30 ms). Instrument-Plugins bekommen ihre Noten um genau diesen Puffer früher, bei Effekt-Plugins werden alle anderen Spuren (und das Metronom) gleich verzögert, so bleibt alles sample-genau zusammen. Bei Aussetzern wird der Puffer automatisch größer („Puffer verkleinern“ setzt ihn zurück)
- **Export** (WAV/MP3) rendert mit allen VST3-Plugins schneller als Echtzeit, sample-genau wie beim Abspielen
- Tempo, Taktart und Abspielposition gehen an die Plugins (für Tempo-synchrone Delays, Arpeggiatoren usw.)
- **MPC Beats als Plugin**: ist MPC Beats als VST3 installiert, steht es in der Instrument-Liste und spielt die Noten einer Spur
- Grenzen: nur 64-Bit-VST3 (kein VST2, keine 32-Bit-Plugins), nur der Haupt-Stereo-Ein- und -Ausgang (kein Sidechain-Eingang, keine Mehrfach-Ausgänge), im Browser und auf dem iPhone gibt es kein VST3
- Technik: Host in C++ mit dem Steinberg VST3 SDK (seit Version 3.8 MIT-Lizenz), Quelle in `native/vst3host`, gebaut mit `npm run build:vst3host` (MinGW) oder per GitHub-Action unter Windows (MSVC, mit Tests)
- Neue Sounds: **19 Synth-Klänge** aus dem FluidR3-GM-Soundfont (CC-BY 3.0): Lead Square, Lead Sägezahn, Calliope, Chiff-Lead, Charang, Voice-Lead, Quinten-Lead, Bass-Lead, Synth-Bass 2, Synth-Bläser, E-Piano DX, Polysynth, Pad gestrichen, Pad metallisch, Pad Sweep, Atmosphäre, Brightness, Echoes, Sci-Fi. Damit klingen auch die Lead-, Pad- und Effekt-Programme aus MIDI-Dateien echt

## Grundsatz

Jedes Update bringt auch neue Sounds mit.

## Fahrplan

1. **Als Nächstes**: Taktartwechsel mitten im Song, Drums live über Pads einspielen, Touch-Gesten im Piano Roll (langes Drücken für Menüs), Feinschliff nach Tests auf dem iPhone

## Starten

- Windows: `SoundGroot-1.4.0-win.zip` entpacken, `Sound Groot.exe` starten
- iPhone/Browser: https://erikos47.github.io/Klangwerk/ öffnen, dann „Zum Home-Bildschirm“
- Entwicklung: `npm install`, dann `npm start`
- Windows-Build: `npm run dist:win`
