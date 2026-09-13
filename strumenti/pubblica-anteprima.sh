#!/bin/bash
# v0.80.15 — PUBBLICA LA VERSIONE IN PROVA SU hextalegame.com/anteprima/
#
#   bash strumenti/pubblica-anteprima.sh "cosa c'e' di nuovo"
#
# Chi gioca su /play/ non si accorge di niente: qui si pubblica SOLO
# anteprima/index.html, cioe' una copia di play/index.html cosi' com'e' sul
# computer. play/index.html, patch-notes.txt, i banchi e l'archivio restano non
# committati fino al rilascio vero, che Lorenzo decide (vedi LEGGIMI, "Anteprima
# e rilascio").
#
# Perche' nessuno viene ricaricato: ogni client guarda patch-notes.txt per sapere
# se e' uscita una versione nuova. Qui quel file non si tocca, quindi per /play/
# non esce niente di nuovo.
set -euo pipefail
cd "$(dirname "$0")/.."

MESSAGGIO="${1:-anteprima}"
ORIGINE="play/index.html"
COPIA="anteprima/index.html"

# La copia deve sapere di essere l'anteprima: senza la bandierina cercherebbe
# avversari in rete e incontrerebbe giocatori con un'altra versione.
grep -q "const ANTEPRIMA = " "$ORIGINE" || { echo "FERMO: $ORIGINE non ha la bandierina ANTEPRIMA"; exit 1; }
if grep -q $'\r' "$ORIGINE"; then echo "FERMO: $ORIGINE ha dei CRLF"; exit 1; fi

mkdir -p anteprima
cp "$ORIGINE" "$COPIA"
VERSIONE=$(grep -oE 'id="build-version-badge"[^>]*>v[0-9.]+' "$COPIA" | grep -oE 'v[0-9.]+$')

git add "$COPIA"
if git diff --cached --quiet -- "$COPIA"; then
  echo "niente di nuovo: $COPIA e' gia' uguale a quella pubblicata"
  exit 0
fi
# Si committa SOLO la copia, anche se altro e' in stato di modifica.
git commit -q -m "anteprima $VERSIONE — $MESSAGGIO

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- "$COPIA"
git push -q
echo "pubblicata: https://hextalegame.com/anteprima/ ($VERSIONE preview)"
