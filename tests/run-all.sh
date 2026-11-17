#!/usr/bin/env bash
# Kompletter Browser-Regressionslauf. Vorher: npm run build. Jede Zeile muss mit „keine Fehler“ enden.
cd "$(dirname "$0")"
for t in timing swing lat mute tempo export undo file freeze rec sig audio sidechain templates; do
  echo "== $t"; timeout 300 node t.js 1440 900 - $t.js 2>&1 | tail -12
done
echo "== pwa"; timeout 300 node pwa.js 2>&1 | tail -6
echo "== phone"; timeout 300 node t.js 390 844 - phone.js touch 2>&1 | tail -8
echo "== fuzz";  timeout 300 node fuzz.js 81 900 | tail -1; timeout 300 node fuzz.js 82 700 390 844 touch | tail -1
