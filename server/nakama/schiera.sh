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

# ── v0.80.15 — PRIMA DI RIAVVIARE: C'E' QUALCUNO IN GIOCO? ─────────────────────
# Il riavvio di Nakama chiude ogni collegamento e ogni partita in corso (Lorenzo:
# "ci sono dei giocatori online e non voglio che vengano disconnessi"). Si chiede
# a hx_giocatori quanti hanno battuto negli ultimi secondi. La chiamata parte da
# DENTRO al contenitore di Caddy, che ha la chiave del runtime nel suo ambiente:
# la chiave non passa da qui e non si stampa. Senza un utente, hx_giocatori
# conta e basta, non segna nessuno come presente.
# Se c'e' qualcuno ci si ferma; per riavviare lo stesso: HEXTALE_FORZA=1.
ONLINE=$($S $SRV "cd /opt/nakama && docker compose exec -T caddy sh -c 'wget -qO- --header=\"Content-Type: application/json\" --post-data=\"{}\" \"http://nakama:7350/v2/rpc/hx_giocatori?unwrap&http_key=\$NAKAMA_HTTP_KEY\"'" 2>/dev/null | grep -oE '"giocatori": *[0-9]+' | grep -oE '[0-9]+$')
if [ -z "$ONLINE" ]; then
  echo "giocatori online: non so dirlo (hx_giocatori non ha risposto)"
else
  echo "giocatori online adesso: $ONLINE"
fi
if [ "${ONLINE:-0}" != "0" ] && [ "${HEXTALE_FORZA:-}" != "1" ]; then
  echo "FERMO: il riavvio li butterebbe fuori. Rilancia con HEXTALE_FORZA=1 per riavviare lo stesso."
  exit 2
fi

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
