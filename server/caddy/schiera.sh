#!/bin/bash
# Mette il Caddyfile sul server e lo ricarica. Se il nuovo non e' valido, o se
# dopo il ricaricamento il sito non risponde, rimette quello di prima: Caddy e'
# il muso di api.hextalegame.com, e un Caddyfile storto manda giu' il gioco per
# tutti finche' qualcuno non se ne accorge.
set -u
CHIAVE="$HOME/.ssh/hextale"
SRV="${HEXTALE_SRV:-}"
if [ -z "$SRV" ]; then echo "manca HEXTALE_SRV (es. HEXTALE_SRV=root@1.2.3.4)"; exit 1; fi
S="ssh -i $CHIAVE -o StrictHostKeyChecking=no -o BatchMode=yes"
LOCALE="C:/Users/masil/Desktop/Hextale/game-assets/server/caddy/Caddyfile"
REMOTO=/opt/nakama/Caddyfile

$S $SRV "cp $REMOTO $REMOTO.precedente"
scp -i "$CHIAVE" -o StrictHostKeyChecking=no "$LOCALE" "$SRV:$REMOTO" > /dev/null || { echo "copia fallita"; exit 1; }

# Prima si CHIEDE a Caddy se il file gli va bene, e solo dopo si ricarica: una
# validazione costa un secondo, un muso caduto costa il gioco.
VALIDO=$($S $SRV "cd /opt/nakama && docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile 2>&1 | tail -3")
if ! echo "$VALIDO" | grep -qi "valid"; then
  echo "IL CADDYFILE NON E' VALIDO — rimetto quello di prima"
  echo "$VALIDO"
  $S $SRV "cp $REMOTO.precedente $REMOTO"
  exit 1
fi

$S $SRV "cd /opt/nakama && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile" > /dev/null 2>&1
sleep 3
STATO=$(curl -s -o /dev/null -w "%{http_code}" https://api.hextalegame.com/)
if [ "$STATO" = "000" ]; then
  echo "IL SITO NON RISPONDE PIU' — rimetto quello di prima"
  $S $SRV "cp $REMOTO.precedente $REMOTO && cd /opt/nakama && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile" > /dev/null 2>&1
  exit 1
fi
echo "SCHIERATO — api.hextalegame.com risponde $STATO"
