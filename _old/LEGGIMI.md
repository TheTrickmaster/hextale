# `_old` — quello che non usa piu' nessuno

Non e' un cestino: e' un ripostiglio. I file qui dentro **non sono nominati da
nessuna parte** nel gioco, nel modulo del server o nell'applicazione desktop —
ma il sito e questi file sono la stessa cosa, quindi cancellarli sarebbe stato
un gesto senza ritorno per risparmiare qualche megabyte.

La struttura delle cartelle e' quella di prima: rimettere qualcosa al suo posto
vuol dire spostarlo indietro dello stesso percorso.

## Come si e' deciso

Con `node strumenti/controlla-asset.js`, e poi a mano su ogni singolo file,
perche' il programma da solo non basta: qui i nomi vengono **composti**
(`'archetype-icon-' + tratto + '-' + variante + '.png'`) e due file diversi
hanno spesso **lo stesso nome** in due cartelle diverse. Cercare il nome e
basta avrebbe salvato dei morti e condannato dei vivi.

La prova che vale e' quindi un'altra: **da che porta si entra in quella
cartella?**

- `main-menu/` ci si entra SOLO da `menuFileCandidati(...)`, che riceve sette
  nomi scritti a mano, piu' `MENU_BASE+'radial-glow.png'`. Gli altri nove file
  non hanno modo di essere chiesti. (C'era anche `adattaSegnalibroAlDisegno`,
  che prende un nome variabile: non la chiama nessuno.)
- `audio/music/` sono sei URL scritti per esteso. Le altre quattro tracce non
  compaiono.
- `audio/sfx/` e' una mappa di nomi. Attenzione: `arcane`, `chain`, `drain`,
  `howl` e `card-pick` SONO nella mappa anche se non li suona nessuno, quindi
  restano dove sono — sono registrati, non orfani.
- `buttons/` compare solo nelle copie vecchie del gioco dentro `versions/`:
  e' l'arte dei pulsanti `.sab-*`, che non si usano piu' da un pezzo.
- `loading-screen/loading-bg.png`: il fondale adesso e' `start-screen-bg.png`.
  Il vecchio nome sopravvive in un commento, e un commento non e' un uso.

## Cosa NON e' finito qui, pur sembrando morto

`player-ui/` ha una porta che accetta un nome qualunque: un avatar salvato come
nome di file (`avatarCandidati`) diventa `PLAYER_UI_BASE + quel nome`. Finche'
quella riga esiste, qualunque file di quella cartella puo' essere chiesto da un
account vecchio, e nessuno di loro si puo' dichiarare morto guardando il codice.
