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

## Il giro dopo (v0.79.20)

Le cartelle `main-menu/` e `player-ui/` non esistono piu': Lorenzo le ha
ripulite e quel che restava e' finito in `ui/`. Qui dentro sono rimasti i tre
doppioni, cioe' i soli file che sarebbero andati a sovrascriverne uno gia'
presente in `ui/`:

- `main-menu/magic-ink-icon.png` — byte per byte identico a quello di `ui/`.
- `main-menu/fairy-dust-icon.png` — la stessa illustrazione riesportata (29736
  byte contro 29668): messe una accanto all'altra non si distinguono.
- `player-ui/sound-icon.png` — questo e' un disegno DIVERSO, un altoparlante
  azzurro invece di quello dorato del resto dell'interfaccia. Non lo chiedeva
  piu' nessuno: il gioco passa da `uiFileCandidati`, cioe' dalla copia in
  `ui/`. Questa e' l'arte vecchia.

E quattro file che Lorenzo aveva tolto sono tornati al loro posto, in `ui/`:
`damage-anim.mp4`, `damage-bubble-dark.png`, `damage-bubble-light.png` e
`healing-bubble.png`. Non erano morti: li usa ancora showHpDamagePopup, che e'
la bolla del danno di ogni scontro. Se vanno tolti davvero, va tolta prima
quella.

## Cosa NON e' finito qui, pur sembrando morto

`audio/sfx/` tiene cinque suoni che non suona nessuno — `arcane`, `chain`,
`drain`, `howl`, `card-pick` — ma che stanno nella mappa dei suoni: sono
registrati, non orfani. Toglierli vorrebbe dire togliere anche la riga che li
nomina, ed e' una decisione sulle abilita', non sugli asset.
