#!/bin/bash
# Carica il modulo e riavvia. Se Nakama non riparte, rimette quello di prima da
# solo: un modulo che non compila manda il server in ciclo di riavvio, e il
# gioco resta giu' finche' qualcuno non se ne accorge.
set -u
CHIAVE="$HOME/.ssh/hextale"
# L'indirizzo NON sta scritto qui: questo repository e' pubblico, e
# hextalegame.com serve i suoi file. Si passa da fuori:
#   HEXTALE_SRV=root@... bash server/nakama/schiera.sh
SRV="${HEXTALE_SRV:-}"
if [ -z "$SRV" ]; then echo "manca HEXTALE_SRV (es. HEXTALE_SRV=root@1.2.3.4)"; exit 1; fi
S="ssh -i $CHIAVE -o StrictHostKeyChecking=no -o BatchMode=yes"
LOCALE="C:/Users/masil/Desktop/Hextale/game-assets/server/nakama/index.js"
REMOTO=/opt/nakama/data/modules/index.js

$S $SRV "cp $REMOTO $REMOTO.rete-precedente"
scp -i "$CHIAVE" -o StrictHostKeyChecking=no "$LOCALE" "$SRV:$REMOTO" > /dev/null || { echo "copia fallita"; exit 1; }
$S $SRV "cd /opt/nakama && docker compose restart nakama" > /dev/null 2>&1
sleep 16

STATO=$($S $SRV "cd /opt/nakama && docker compose ps nakama --format '{{.Status}}'")
FATALI=$($S $SRV "cd /opt/nakama && docker compose logs --since 40s nakama 2>&1 | grep -c 'level\":\"fatal'")

if echo "$STATO" | grep -qi "healthy" && [ "$FATALI" = "0" ]; then
  echo "SCHIERATO — $STATO"
  $S $SRV "cd /opt/nakama && docker compose logs --since 40s nakama 2>&1 | grep -oE 'Registered JavaScript runtime (RPC|Match|Matchmaker)[^\"]*' | sort -u"
else
  echo "NON PARTE ($STATO, fatali: $FATALI) — rimetto quello di prima"
  $S $SRV "cp $REMOTO.rete-precedente $REMOTO && cd /opt/nakama && docker compose restart nakama" > /dev/null 2>&1
  sleep 14
  echo "ripristinato: $($S $SRV "cd /opt/nakama && docker compose ps nakama --format '{{.Status}}'")"
  echo "--- perche' non partiva ---"
  $S $SRV "cd /opt/nakama && docker compose logs --since 120s nakama 2>&1 | grep -oE 'error\":\"[^\"]{0,300}' | sort -u | head -3"
  exit 1
fi
