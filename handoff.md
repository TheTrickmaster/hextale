# Hextale — handoff di sessione

Nota per chi riprende il lavoro (umano o assistente). Il file HTML resta
la fonte di verita' piu' aggiornata: i suoi commenti interni descrivono il
perche' di ogni scelta. Questo documento raccoglie solo le regole di
processo che non stanno dentro al codice.

---

## REGOLA FISSA — le patch notes si aggiornano SEMPRE

**A ogni consegna di una nuova versione del file HTML va aggiornato anche
`patch-notes.txt`. Senza eccezioni, anche per una modifica minima.**

Come si fa:

1. Si aggiunge in cima a `patch-notes.txt` un blocco per la nuova versione.
2. Si scrivono voci **corte, mirate e non tecniche**: cosa nota l'utente,
   non come e' stato risolto. ("La Collezione non torna piu' in cima
   quando si girano le carte", non "ripristino di scrollTop dopo il
   relayout della griglia".)
3. Si eliminano i blocchi piu' vecchi finche' non ne restano al massimo
   **10**. Il gioco ne mostra comunque solo 10 (`PATCH_NOTES_MAX`), ma il
   file va potato lo stesso per non farlo crescere all'infinito.
4. Si allinea il numero di versione del badge in fondo alla pagina
   (`#build-version-badge`) con quello del blocco appena scritto.
5. Lorenzo carica su GitHub sia l'HTML sia `patch-notes.txt`.

### Formato di `patch-notes.txt`

```
## v0.73.4
- Prima voce.
- Seconda voce.

## v0.73.3
- Un'altra voce.
```

Righe che non iniziano per `## ` o `- ` vengono ignorate senza rompere
niente. Il parser e' `analizzaPatchNotes()` nell'HTML.

### Come arrivano in gioco

Il file viene letto da GitHub tramite JSONP (`_githubJsonp`), decodificato
da base64 con `TextDecoder('utf-8')` e messo in cache in `localStorage`
(chiave `hextale.patchnotes`), cosi' se GitHub non risponde si mostra
comunque l'ultima lista conosciuta. Il riquadro compare una volta sola per
avvio, subito dopo la barra di caricamento. Il blocco che corrisponde al
badge della versione in uso viene evidenziato (`.patch-corrente`).

---

## Come si aggiunge un'abilita' (dalla v0.73.5)

Esistono **due registri**, e sceglierne uno sbagliato e' l'errore che costa di
piu':

- `EFFETTI_PIAZZAMENTO` — per gli effetti che cambiano dei **valori** (i propri,
  quelli dei vicini, quelli di chiunque). Vengono eseguiti due volte: una per
  finta su un clone del tavolo, per l'anteprima sotto il puntatore, e una per
  davvero. Chi entra qui ottiene l'anteprima gratis, su ogni carta coinvolta,
  senza scrivere una riga di codice per il disegno.
- `EFFETTI_PIAZZAMENTO_REALI` — per tutto il resto: una taglia sulla prossima
  pescata, una conquista annullata, qualunque cosa tiri un dado. Girano solo al
  piazzamento vero. Metterli nell'altro registro significa applicarli davvero
  ogni volta che il puntatore passa sopra una casella.

Se un effetto sceglie "a caso" fra piu' bersagli, il sorteggio deve passare da
`sorteggioStabile(lista, seme)`: con `Math.random()` l'anteprima indicherebbe un
bersaglio e il piazzamento ne premierebbe un altro, e per di piu' l'anteprima
cambierebbe idea a ogni ridisegno.

**Per cambiare i valori di una carta che non e' la propria si passa da
`modificaValori()`, mai scrivendo in `card.values` a mano.** Alcune carte non
tengono i propri valori li' come verita' definitiva: Biancaneve li ricalcola a
ogni disegno da un'istantanea di partenza piu' i Small in campo. Scriverle +1
in `values` e basta significa vederselo cancellare al primo ridisegno — cioe'
subito, e anche nell'anteprima, che fa lo stesso ricalcolo. `modificaValori`
sposta anche le istantanee, cosi' il ricalcolo riparte da un punto piu' alto e
il dono sopravvive.

Se un'abilita' deve **chiedere un bersaglio al giocatore**, si aggiunge a
`SCELTE_PIAZZAMENTO` e basta: da li' riceve gia' pronti il disegno dei comandi
(mirino sui bersagli, X rossa sull'origine), l'evidenziazione delle celle
selezionabili, il comportamento dell'IA e la chiusura per tempo scaduto. La
funzione registrata restituisce `null` quando non ci sono bersagli, e in quel
caso la finestra non si apre nemmeno — nessuna pausa e nessuna X da cliccare a
vuoto.

Fermare la partita e' la cosa piu' pericolosa che un'abilita' possa fare: se
nessuno chiude la finestra il gioco resta li' per sempre. Le tre agganciature
che lo impediscono sono `aiResolvePendingAbilityIfAny()` (l'IA chiude sempre;
se non sa valutare quell'abilita' sceglie a caso — vedi `VALUTAZIONI_IA`), il
ramo in `autoPlay()` (tempo scaduto = rinuncia) e la rete di sicurezza in cima
a `renderBoard()` (ridisegna quando l'intro dei tasselli finisce, altrimenti i
comandi non verrebbero mai disegnati). Ogni uscita passa da
`chiudiSceltaBersaglio()`, che e' l'unico posto da cui il turno riparte.

**Interfaccia condivisa.** Le celle su cui si puo' cliccare si evidenziano con
`evidenziaBersaglio()` (esagono D2BB8A al 30%, plus-lighter) — non si inventa
un'evidenziazione per abilita', o il giocatore deve re-imparare l'interfaccia a
ogni carta. Il suono del click e' un solo ascoltatore in cattura sul documento
(`abilitaSuonoClickGlobale`): copre i pulsanti che esistono, quelli creati dopo
e quelli disegnati dentro l'SVG, quindi non va aggiunto a mano da nessuna parte.

**Insegnare un'abilita' all'IA.** Il punteggio di una mossa e'
`danno - rischio + bonusAbilitaPerIA(...)`. Quel bonus ha due metа':

- la parte **generale** confronta il tavolo simulato con quello vero e premia i
  punti che finiscono sulle proprie carte, penalizzando quelli che finiscono su
  quelle avversarie. Ogni abilita' che sposta dei valori — in campo o in mano —
  viene capita da sola, senza scrivere niente;
- `BONUS_STRATEGICO_IA` serve solo alle abilita' il cui valore **non si vede sul
  tavolo** (una taglia sulla prossima pescata, una conquista da annullare). Il
  numero restituito e' in punti danno; per convertire potere in danno c'e'
  `VALORE_PUNTO_POTERE`.

Se l'abilita' apre una scelta, `VALUTAZIONI_IA[chiave]` decide il bersaglio;
senza voce li' dentro l'IA sceglie a caso, il che va bene per non bloccare la
partita ma non e' giocare.

Due trappole gia' pagate: **il rischio e' un colpo solo**, non la somma dei lati
esposti (l'avversario gioca una carta per turno — sommarli rendeva ogni attacco
sconveniente); e **non esiste un percorso di scelta "difensivo" separato**,
perche' premiare i lati al riparo manda le carte negli angoli quando il
tabellone e' tranquillo, cioe' quasi sempre. La prudenza sta gia' dentro
`aiEstimateCounterRisk`, pesata contro il guadagno invece che al posto suo.

**Cio' che si anima e cio' che dipende dallo stato del turno non stanno mai
sullo stesso elemento.** Una dissolvenza che punta a un valore variabile — per
esempio l'opacita' del fumo del Brucaliffo, che e' meta' per il proprietario e
piena per l'avversario — cambia bersaglio a meta' strada nell'istante in cui il
turno passa, e l'animazione salta di colpo al nuovo valore. Da fuori sembra che
si blocchi o che scatti alla fine. La cura e' annidare: un elemento porta
l'animazione (sempre verso un valore fisso), quello dentro porta il valore che
dipende dal turno, con una transizione per non cambiare di scatto.

## Plancia e ventagli non si ridisegnano se non e' cambiato niente

`renderBoard` e `renderHand` confrontano una FIRMA dello stato con quella
dell'ultimo disegno e, se coincide, escono subito. La firma non e' un elenco di
campi scelti a mano: di ogni carta si prende lo stato intero serializzato,
quindi **un campo nuovo su una carta entra nella firma da solo** e nessuno deve
ricordarsene. Vanno elencate a mano solo le cose che vivono fuori dalle carte
(turno, selezione, trascinamento, scelta di un bersaglio...), che stanno tutte
dentro `firmaTabellone()` e `firmaMano()` con il motivo scritto accanto.

**Se aggiungi qualcosa che il disegno legge e che non sta dentro una carta,
aggiungilo alla firma.** Per non doverci pensare: accendi `CONTROLLO_FIRME`
(dal menu debug) mentre provi la carta nuova. Con quello acceso nessun disegno
viene saltato, e il gioco confronta il risultato con quello precedente: se due
disegni diversi hanno la stessa firma lo scrive in console dicendo dove
differiscono. E' il modo per scoprire in dieci secondi un guasto che altrimenti
si manifesterebbe come "ogni tanto resta a schermo roba vecchia".

Il caso vero, per capirsi (v0.73.42): la mano aperta a tutto schermo col tasto
destro e' una geometria decisa dentro `renderHand`, ma lo stato che la comanda
(`handExpandState`) viveva solo in una variabile e non era in firma. Il gesto
accendeva la penombra — che e' una classe messa a mano su un div, non un
disegno — e chiedeva un render, ma la firma risultava identica e il disegno
veniva saltato: penombra sopra la mano ancora a ventaglio. **Se una cosa si
accende con una classe messa a mano E cambia anche il disegno, il pezzo messo a
mano ti convincera' che funziona.** Sono i guasti piu' difficili da vedere.

Una firma che non sa rispondere (carta non serializzabile) restituisce un
valore sempre diverso: si ridisegna, cioe' si torna al comportamento di prima.
Il caso peggiore e' non guadagnare nulla, mai mostrare qualcosa di vecchio.

**`will-change:transform` su qualcosa di NITIDO lo sfoca.** Promuovere un
elemento a livello di composizione vuol dire che il browser lo disegna una
volta alla risoluzione che ha in quel momento e poi ricampiona quel fotogramma
per ogni ingrandimento applicato sopra. E sopra c'e' sempre `#game-root`, che
scala l'intera pagina per adattarla allo schermo — su un monitor grande, ben
oltre 1. Contro la sfocatura da ingrandimento la promozione non e' la cura: e'
la causa. Va bene solo su cio' che e' gia' morbido (aloni sfocati, gradienti),
dove serve a contenere i ridisegni e la perdita di nitidezza non si vede.
Successo due volte: Collezione (v0.72.30) e carte del Book Pack (v0.73.32).

**Lo stato di un'animazione non si scrive sulla carta.** Chi disegna riceve una
COPIA (`renderBoard` passa `{...placed.card, owner}`), quindi qualunque cosa
scritta li' dentro vive il tempo di un disegno e poi sparisce. Leggere dalla
carta va benissimo; scriverci lo stato di un'animazione no — va in una mappa a
parte, come `_veloFumo`. Il sintomo, quando si sbaglia, e' un'animazione che
riparte da capo a ogni ridisegno e quindi sembra saltare.

**Un effetto che ha qualcosa da mostrare alza la soglia della pausa di fine
turno, non ci si somma.** `endTurn` si prende gia' un secondo perche' la
plancia stia ferma e si possa leggere: chi ha bisogno di piu' tempo chiama
`rimandaFineTurnoFino()`. Sommare la propria attesa a quella (come faceva la
v0.73.24) lascia la carta immobile a schermo per il tempo di troppo, e si legge
come un blocco.

**Le animazioni della carta sul tabellone stanno su quattro elementi annidati**
— `[data-conquered]` il salto, `flip-host` il giro, `recoil-host` il
contraccolpo, `wobble-host` il traballio — perche' animano tutte `transform` e
sullo stesso elemento si escluderebbero. Chi ne aggiunge una quinta aggiunga
anche il suo piano.

I **gruppi valore** sono l'identita' di una carta e non cambiano mai. Un effetto
che sposta i numeri deve muovere anche `groupSides` se cambia la disposizione
(vedi la rotazione di Alice), altrimenti un gruppo si ritrova a cavallo di due
valori diversi pur dovendone mostrare uno solo.

---

## Vincolo tecnico principale: `file://`

Lorenzo apre il gioco **facendo doppio clic sul file**, quindi l'origine e'
`file://`. Conseguenza: **`fetch()` non funziona**, per nessun URL e con
qualunque header CORS. Ogni lettura da rete deve passare da JSONP, cioe' da
un tag `<script>` iniettato:

- Google Sheets → `_foglioViaScript()` (gviz con `responseHandler`)
- GitHub API → `_githubJsonp(url, timeoutMs)` (parametro `callback=`)

Anche i download vanno costruiti a mano: l'attributo `download` viene
ignorato cross-origin, quindi si scarica il blob in base64 e si passa da
`URL.createObjectURL`.

---

## Verifica prima di consegnare

`node --check` non basta: controlla la sintassi, non l'esecuzione. Un
`const` usato prima della sua riga di dichiarazione (temporal dead zone)
passa il check ma manda in errore l'intero script al caricamento, e in quel
caso **nessun pulsante del gioco funziona piu'** — e' gia' successo con
`CARD_DB_GEMMA_RARITA` in v0.72.81.

Va quindi eseguito il file in jsdom con degli stub (`fetch`, `AudioContext`,
`HTMLMediaElement`, `getContext` del canvas, `Image`, `localStorage`),
verificando che dopo il caricamento esistano ancora le funzioni chiave:
`showPage`, `requestNewGame`, `closeDebugModal`, `openCardDbOverlay`,
`openPackOverlay`, `caricaPatchNotes`.

---

## Trappole gia' incontrate (per non ripeterle)

- Due `animation` sulla stessa proprieta' dello stesso elemento: vince
  l'ultima dichiarata. Ha causato due bug distinti (il flip della conquista
  e il fade-in del bagliore). Si separa in due elementi annidati.
- `animation-delay` senza `fill-mode: both`: durante l'attesa l'elemento
  mostra il suo stato base, e sembra uno scatto.
- `clip-path` viene applicato **dopo** `filter`, quindi ritaglia via la
  sfocatura. Servono due elementi annidati.
- `transform-style: preserve-3d` fa intersecare visivamente gli elementi
  complanari, che si "tagliano" a vicenda.
- `getComputedStyle().transform` restituisce `matrix3d()` sugli elementi
  compositati: va letto con `DOMMatrixReadOnly`, non con una regex.
- `mix-blend-mode` + `filter: blur()` + transform animata = scie di
  ridisegno.
- Ristrutturare l'HTML contando le graffe o i `</div>` non funziona su
  markup annidato: si usa un parser (jsdom) e si asserisce prima di
  scrivere, ad esempio contando i pulsanti del menu debug.

---

## Cartelle degli asset

- `cards/art/<nome-personaggio>/` — 4 livelli per fazione; se manca la
  cartella si usa il segnaposto della rana.
- `audio/voices/` — le voci si collegano da sole in base al nome.
- `card-parts/Archetypes/` — icone degli archetipi, in versione chiara e
  scura; si segue la fazione mostrata in quel momento.
- `packs/` — `pack-placeholder` per la bustina.

Il database delle carte vive sul Google Sheet (foglio `Cards DB`); serve
`Visible = Yes`. Le colonne non riconosciute vengono ignorate, quindi
aggiungerne di nuove non rompe niente.

### Come il foglio aggancia un'abilita' a un personaggio (dalla v0.73.49)

**Solo tramite la cella `Ability name`**, confrontata col `name` dichiarato in
`TILE_ABILITIES_DEF`. Nient'altro: nessuna colonna `Ability key`, nessuna
chiave tecnica scritta al posto del nome, nessun elenco di nomi vecchi.
Maiuscole, spazi e punteggiatura non contano.

- **Scambiare due abilita' fra personaggi**: si scambiano le due celle nel
  foglio. Nel codice non si tocca niente, perche' nessuna abilita' e' legata a
  un personaggio.
- **Rinominare un'abilita'**: si cambia il `name` nel registro **e** la cella,
  insieme. Cambiarne uno solo la scollega.

Una carta scollegata non si rompe: esce con `NO_SCRIPT` in rosso sotto al nome,
e la console elenca i nomi esatti che il registro conosce. E' rumoroso apposta.

Questa e' una scelta consapevole di **leggibilita' contro robustezza**: prima
comandava una chiave tecnica, che un rinominare non poteva scollegare, ma che
obbligava a tenere a mente due nomi per abilita' e a ricordare quale dei due
comandasse davvero — e nel momento in cui si scambiano abilita' fra personaggi,
diventava una fonte continua di confusione. Adesso quello che si legge nel
foglio e' quello che succede nel gioco.
