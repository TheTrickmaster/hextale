# Hextale — handoff di sessione

Nota per chi riprende il lavoro (umano o assistente). Il file HTML resta
la fonte di verita' piu' aggiornata: i suoi commenti interni descrivono il
perche' di ogni scelta. Questo documento raccoglie le regole di processo e le
informazioni che non stanno dentro al codice.

---

## Dove si trova cosa

Tutto vive in `game-assets/`, che e' anche il repository GitHub
(`TheTrickmaster/hextale`, pubblicato su `thetrickmaster.github.io/hextale/`).
**Si gioca da `https://hextalegame.com/play/`**; in radice non c'e' nessuna
pagina d'ingresso, e non deve tornarci — vedi la REGOLA FISSA sulla
pubblicazione.

| Cosa | Dove |
|---|---|
| Il gioco, indirizzo stabile | `play/index.html` — un unico file, ~26.000 righe |
| Le versioni, archivio | `versions/Hextale_<versione>.html` |
| Note di aggiornamento | `patch-notes.txt` |
| Questo documento | `handoff.md` |
| Banco di prova | `test/` — vedi piu' sotto |
| Applicazione desktop | `desktop/` — vedi piu' sotto |
| Illustrazioni carte | `cards/art/<personaggio>/` |
| Voci | `audio/voices/` |
| Interfaccia di gioco | `player-ui/`, `card-parts/`, `buttons/`, `tiles/` |
| Menu principale | `main-menu/` |
| Bustine | `cards/packs/` |
| Schermata iniziale | `loading-screen/` |

**Il database delle carte e' il SERVER (dalla v0.77.36).** Il Google Sheet
(foglio `Cards DB`) resta lo strumento con cui le carte si SCRIVONO, ma il
gioco non lo legge piu': legge il database, dove le carte entrano con
un'importazione. Vedi la sezione "Le carte vengono dal database" piu' sotto.
La copia interna nell'HTML e' l'ultimo ripiego, ed e' vecchia.

**Come si consegna una versione.** Si rinomina il file col numero nuovo, si
aggiorna il badge `#build-version-badge`, si scrive il blocco in
`patch-notes.txt`, e si mette il file al suo posto — `play/index.html` per
l'ultima, `versions/` per quella prima (vedi la REGOLA FISSA piu' sotto).
Il numero di versione sta in TRE posti che devono combaciare: il nome del file
in `versions/`, il badge `#build-version-badge`, e il `version` di
`desktop/package.json`.

---

## Stato attuale (v0.73.67)

**Fatto e funzionante:** partita completa contro IA e in locale, Collezione,
Book Packs, menu principale, schermata iniziale, salvataggio delle
impostazioni audio, controllo automatico degli aggiornamenti, guscio desktop.

**Abilita' programmate (12).** Eat the Rich (Robin Hood), Smol Friends
(Snow White), A Kind of Magic (Merlin), Eat me Drink me (Alice), Different
Reality (Cheshire Cat), Have I Gone Mad? (Mad Hatter), Smoke and Mirrors
(Morgana), Off With the Head! (Queen of Hearts), Spitting Image (Magic
Mirror), Exaketededly (The Caterpillar), Excalibur! (King Arthur), Immovable
(Excalibur) e Dancing Around (12 Dancing Princesses).

**Da programmare: 23 carte visibili.** Raggruppate per famiglia, perche' dentro
una famiglia il codice si somiglia:

- **Valori che cambiano** (11): Sleight of Hand, Bear Necessities, Tic Toc,
  Loyalty, Power of Love, Mischief, Bothered, Dark Pact, Nightmare, Everyone
  gets a wish, Rush Hour.
- **Dopo lo scontro** (2): Hunger Bites, Scaredy cat.
- **Reazione all'essere conquistati** (2): Hex (Pun Intended), Little Mermaid.
- **Tessere e posizioni** (3): Heigh-ho, Open Celery!, Braaaaaids.
- **Trasformazioni** (2): Kiss, Bell of the Ball.
- **Furti e regole** (4): New Tax, Give me that, Power Nap, True Story.

Una carta con un'abilita' dichiarata nel foglio ma non programmata non si
rompe: esce con `NO_SCRIPT` in rosso e in console si legge perche'.

**Deciso con Lorenzo (importante, non ricontrattare senza motivo):** le
abilita' si scrivono **una alla volta**, non con un motore generico. La
tentazione di una tabella dichiarativa per la famiglia "valori che cambiano"
c'e' ed e' forte, ma la si disegnerebbe leggendo undici descrizioni invece che
guardando undici implementazioni funzionanti. In questo progetto generalizzare
DOPO aver visto il caso vero e' andata bene (la rotazione condivisa fra Alice
e il Caterpillar, `modificaValori`); anticipare una struttura e' andata male
(la colonna `Ability key`, poi rimossa). Se dopo cinque o sei abilita' scritte
a mano emerge una forma ricorrente, la si estrae allora.

**Prima di scrivere un'abilita' servono quattro risposte**, e vanno chieste
invece che indovinate: **quando** scatta, **chi** colpisce (nemici compresi?
se stessa?), **cosa** fa e per quanto (finche' resta li' o per sempre), e
**cosa succede se non si puo'** (nessun bersaglio, tabellone pieno, effetto
gia' attivo).

---

## Il banco di prova (`test/`)

**v0.73.66 — non e' piu' il passaggio di default.** Scriverne una per ogni
abilita' e rilanciare l'intera suite a ogni modifica costava troppo tempo per
il ritmo con cui Lorenzo vuole lavorare: da qui in avanti si lavora
direttamente sull'HTML, senza scrivere ne' lanciare `test/*.js` a meno che
Lorenzo non lo chieda esplicitamente ("lancia le prove", "scrivi una prova per
questa"). Il banco resta com'e', intatto, per quando servira'.

Non e' zavorra, se lo si usa: i tre guasti piu' costosi di questo progetto —
il potere di Robin Hood che spariva nel nulla, i valori del Cheshire che
saltavano da una parte all'altra della carta, il turno che restava appeso —
erano tutti **invisibili guardando il gioco** e ovvi in una prova scritta.
Vale la pena riproporlo a Lorenzo quando un'abilita' e' particolarmente
intrecciata con l'animazione o il turno (proprio i casi sopra), anche se non
e' piu' un passaggio automatico.

**Nota d'ambiente:** in alcune sessioni la cartella montata ha reso `require
('jsdom')` lentissimo o bloccato senza motivo apparente (non e' successo
sempre, ma quando capita sembra un bug del codice e non lo e'). Se le prove
vanno lanciate, copiarle insieme all'HTML in una cartella locale (es. `/tmp`)
e lanciarle da li' aggira il problema.

```
cd test
npm install        # una volta sola, scarica jsdom
node tutti.js      # lancia tutto e riassume
node excalibur.js  # una prova sola
```

`harness.js` trova da solo il file `Hextale_*.html` col numero piu' alto: le
prove non contengono nessun percorso scritto a mano, quindi consegnare una
versione nuova non richiede di aggiornarle.

Le prove caricano il gioco vero in jsdom con dei sostituti per cio' che jsdom
non ha (`fetch`, `AudioContext`, `HTMLMediaElement`, `getContext` del canvas,
`Image`, `localStorage`), quindi eseguono le funzioni VERE. Cosa NON possono
vedere: l'impaginazione e il disegno. `getBBox` e' finto e le misure a schermo
non esistono — per quelle si controllano gli attributi e le regole CSS, mai le
posizioni calcolate.

| File | Cosa prova |
|---|---|
| `tutti.js` | lancia tutte le altre |
| `excalibur.js` | King Arthur, Immovable, carte solo evocabili |
| `dancing_around.js` | 12 Dancing Princesses: la scelta dopo lo scontro, dalla registrazione al turno che riparte |
| `collezione.js` | cosa compare nella griglia della Collezione |
| `gatto.js`, `turnogatto.js` | Different Reality: rotazione, salto, catena del turno |
| `rotazione.js` | la geometria della rotazione dei valori |
| `salto.js` | l'animazione del salto e dell'atterraggio |
| `nomi.js` | come il foglio aggancia le abilita' |
| `menu.js` | il menu principale, per intero |
| `volumi.js` | i volumi di partenza |
| `guscio.js`, `guscio2.js` | l'aggiornatore desktop e la sua configurazione |
| `vivo.js` | il gioco parte e la tabella interna e' coerente |
| `stato.js` | utilita': legge il foglio VERO e dice quali carte sono agganciate (serve rete, escluso da `tutti.js`) |

Alla consegna della v0.73.66 erano 332 asserzioni, tutte verdi. **Non
riverificato dalla v0.73.67**, per la nuova regola qui sopra — e
`dancing_around.js` in particolare e' oggi DESALLINEATO dal codice: testa
ancora "si sposta la carta conquistata", che non e' piu' vero (vedi il FIX
piu' sotto, sezione "Come si aggiunge un'abilita'"). Va riscritto o cancellato
prima di fidarsi di un suo verde.

---
## REGOLA FISSA — dove va il file di gioco quando si pubblica (dal 28/08/2026)

**A ogni push il file di gioco va in DUE posti, e nessuno dei due e' la radice:**

1. La versione **appena chiusa** si copia in `play/index.html`, con quel nome.
   E' l'indirizzo stabile: chi apre il gioco arriva sempre li', e non cambia
   mai da una versione all'altra.
2. La versione **precedente** resta in `versions/`, col suo nome per esteso
   (`Hextale_0.77.51.html`). E' l'archivio: serve per tornare indietro e per
   confrontare, non per essere giocata.

Quindi `play/index.html` e `versions/Hextale_<ultima>.html` hanno lo stesso
contenuto: uno e' l'indirizzo, l'altro e' la copia con la targhetta.
**Nella radice non ci va nessun `Hextale_*.html`.**

Perche' cosi': prima ogni versione era un file nuovo nella radice, e chi aveva
salvato il link si ritrovava a giocare una versione vecchia senza accorgersene.
Un indirizzo fisso toglie il problema alla radice.

**L'indirizzo del gioco e' `https://hextalegame.com/play/`** (dal 28/08/2026).
In radice non c'e' piu' niente: c'era un `index.html` che chiedeva alla API di
GitHub l'elenco dei file e rediregeva al `Hextale_*.html` col numero piu' alto,
ed e' stato tolto. Faceva due cose sbagliate — cercava in un posto dove i file
non stanno piu', e per farlo usava una chiamata NON autenticata, cioe' 60
richieste all'ora per indirizzo IP: bastava qualche ricarica di troppo, o un IP
condiviso, perche' il gioco non si aprisse. Un indirizzo fisso non ha niente da
cercare. **Non rimetterlo.**

Lorenzo ha fatto lo spostamento a mano per la v0.77.51. **Da lì in poi tocca a
chi pubblica**, e va fatto **prima** del push, non dopo.

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

**v0.73.66 — se invece la scelta arriva DOPO uno scontro** (la carta ha gia'
conquistato qualcosa, non sta venendo piazzata), il registro giusto e'
`SCELTE_DOPO_CONQUISTA`, non `SCELTE_PIAZZAMENTO`: quello apre la finestra
PRIMA che la conquista sia risolta, questo la apre DOPO, da dentro
`resolveConquestAndEndTurn` a scontro e animazione gia' finiti. E' il gemello
esatto — stessa `G.sceltaBersaglio`, stesso mirino, stessa X, stessa chiusura
per tempo scaduto — cambia solo il momento e cosa succede alla chiusura:
`chiudiSceltaBersaglio` riconosce le due dal flag `dopoConquista` e per queste
non richiama `resolveConquestAndEndTurn` (rifarebbe la conquista da capo), fa
solo proseguire il turno. Primo e finora unico caso: Dancing Around (12
Dancing Princesses), che dopo aver conquistato chiede su quale casella libera
adiacente spostare SE STESSA — non la carta appena presa, che resta dov'e'
finita (v0.73.67 FIX: la prima versione spostava la carta conquistata;
Lorenzo l'ha corretta).

**I bersagli di uno spostamento passano SEMPRE da `celleLibere()`, mai da un
controllo scritto a mano.** Lo stesso v0.73.67 FIX ha scoperto che la prima
versione di Dancing Around calcolava le caselle libere guardando solo se
erano occupate, non se erano BLOCCATE (un tassello sfondato) — un giocatore
avrebbe potuto, in teoria, farla atterrare su un buco. `celleLibere()` e' la
funzione che gia' filtra buchi e fuori-tabellone per ogni altro spostamento
del gioco (il salto del Cheshire compreso): usarla sempre, invece di
riscrivere il filtro ogni volta, e' l'unico modo per essere certi che non
capiti mai. Come ulteriore rete di sicurezza, anche `spostaCartaConSalto()` —
il punto UNICO da cui passa ogni spostamento di una carta gia' in campo —
adesso rifiuta da se' una destinazione bloccata, chiunque la chiami.

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

**I valori si disegnano per GRUPPO, non per lato.** Un gruppo che copre due
lati e' UN elemento solo, marcato con `data-value-side-*` per ciascuno dei suoi
lati. Chiedere "l'elemento del lato NE" e "l'elemento del lato E" puo' quindi
restituire lo stesso nodo: chi cicla sui sei lati per animare i valori scrive
due volte sullo stesso elemento e la seconda cancella la prima (era il guasto
v0.73.51, i cerchi che saltavano da una parte all'altra). Si cicla sui gruppi.
Per la stessa ragione, "far scorrere i gruppi di un lato" si anima come una
**rotazione di 60 gradi attorno al centro dell'esagono**, non come "vai dove sta
il prossimo": i gruppi dispari sono ancorati al punto di mezzo di un lato e i
pari a un vertice, quindi stanno su due raggi diversi.

**Le abilita' che agiscono da sole a ogni turno stanno in catena, non in fila.**
`startTurn` incatena rotazione in mano (Alice) → spostamento in campo (Cheshire)
→ pescata, e ognuna riceve un `poi` che chiama la successiva. Metterle una dopo
l'altra vorrebbe dire farle partire tutte insieme, e chi ridisegna per primo
porta via gli elementi che le altre stanno animando. Ogni abilita' di questo
tipo deve quindi accettare una richiamata e chiamarla SEMPRE, anche quando non
fa niente: se una tace, il turno resta appeso e la partita si ferma.

---

## Vincolo tecnico principale: `file://`

Lorenzo apre il gioco **facendo doppio clic sul file**, quindi l'origine e'
`file://` — e lo e' anche dentro al guscio desktop, che carica con `loadFile`.

**v0.77.24 — questa sezione diceva una cosa piu' forte del vero, e ha fatto
perdere tempo: non e' che `fetch()` non funzioni da `file://`.** Quello che
succede e' che una pagina `file://` si presenta con `Origin: null`, e un
server che non risponde con intestazioni CORS permissive vede quella origine e
rifiuta. Il divieto quindi non dipende da noi, dipende da CHI si interroga:

- **gviz di Google e `api.github.com` non le mandano** → per loro serve JSONP,
  cioe' un tag `<script>` iniettato, ed e' il motivo per cui esistono
  `_foglioViaScript()` (gviz con `responseHandler`) e `_githubJsonp(url,
  timeoutMs)` (parametro `callback=`). Qui non e' cambiato niente.
- **Nakama le manda** (`Access-Control-Allow-Origin: *`, con `Content-Type` e
  `Authorization` fra le intestazioni ammesse) → da `file://` `fetch()`, XHR e
  WebSocket funzionano tutti e tre. Verificato dentro a Electron, non dedotto.

La regola giusta, per chi aggiunge una lettura da rete: **guarda le
intestazioni CORS di quel server** (`curl -I` basta). Se sono permissive si usa
`fetch`; se non lo sono, e solo allora, si passa da JSONP.

Anche i download vanno costruiti a mano: l'attributo `download` viene
ignorato cross-origin, quindi si scarica il blob in base64 e si passa da
`URL.createObjectURL`.

---

## L'account (dalla v0.77.24)

Il server e' un **Nakama** (Heroic Labs) su una macchina nostra
(`45.59.124.211`), raggiungibile solo come **`https://api.hextalegame.com`**.
Gira in Docker insieme a un Postgres e a un Caddy; la configurazione sta sul
server in `/opt/nakama/`.

**Verso internet sono aperte solo la 22, la 80 e la 443.** Dalla v0.77.32 anche
la 7350 e' legata a `127.0.0.1`, come gia' erano la 7349 (gRPC), la 7351
(console) e la 5432 (Postgres): niente parla piu' in chiaro con l'esterno, e
l'unica strada per il gioco e' il TLS di Caddy. Nakama resta raggiungibile da
Caddy perche' i due si parlano sulla rete interna di Docker, che non passa
dalle porte pubblicate — e resta raggiungibile da dentro alla macchina per una
diagnosi (`curl http://127.0.0.1:7350/healthcheck`).
Per la console di amministrazione serve un tunnel:
`ssh -L 7351:127.0.0.1:7351 root@45.59.124.211`, poi `http://localhost:7351`.

Ogni modifica al `docker-compose.yml` lascia una copia accanto
(`.prima-di-caddy`, `.prima-di-chiudere-7350`): se qualcosa va storto si torna
indietro copiando il file e rifacendo `docker compose up -d`.

Nel gioco non c'e' nessuna libreria: `@heroiclabs/nakama-js` e' un pacchetto
npm e questo e' un file solo senza build. Le chiamate che servono sono quattro
POST di JSON, scritte a mano nella sezione **L'ACCOUNT: IL CLIENT NAKAMA**.
Tutte passano da `nakamaChiedi()`, che e' l'unico posto dove stanno il tempo
massimo, la lettura del corpo e la traduzione degli errori.

**`NAKAMA.chiaveServer` non e' un segreto.** Viaggia dentro a ogni copia del
gioco e chiunque apra l'HTML la legge: dice "sono un client di Hextale", non
"sono questo giocatore". Chi si autentica lo fa con email e password, e cio'
che torna e' un token personale. Se la si cambia qui va cambiata anche sul
server (`--socket.server_key`).

**Il codice degli errori conta, e `0` e' speciale.** `nakamaChiedi` mette 0
quando la richiesta non e' nemmeno partita — rete assente, server spento, tempo
scaduto — e solo in quel caso compare il pulsante **"Gioca in locale"**. Un 401
e' una risposta vera e vuole un'altra frase. La regola che valeva quando questi
campi erano una facciata **resta valida**: dalla partita contro l'IA non si
deve poter restare chiusi fuori, e infatti nessun percorso di errore lascia il
giocatore senza una strada per entrare.

**Il Login a password vuota si appoggia alla sessione salvata**
(`hextale.sessione` in `localStorage`), che al bisogno si rinnova col refresh
token. La decisione guarda solo la PASSWORD, mai l'email: il saluto
"Bentornato" riempie quel campo da solo, e la prima versione — che chiedeva
vuoti tutti e due — rendeva la strada irraggiungibile proprio a chi una
sessione ce l'aveva. Se pero' nel campo c'e' un'email DIVERSA da quella della
sessione, la password si chiede: una sessione vale per il suo proprietario.

**Tutto cio' che si vede e' in inglese (dalla v0.77.29).** Messaggi
dell'accesso, avviso di aggiornamento, `aria-label` e note di aggiornamento.
Resta in italiano il **menu debug**, che e' uno strumento di lavoro e non UI
del giocatore. I COMMENTI del codice restano in italiano: non sono a schermo.

**L'accesso con Google (dalla v0.77.30) vive solo sulla versione web.** Google
non permette `file://`: fra le "origini JavaScript autorizzate" si registra un
dominio, e una pagina aperta col doppio clic si presenta con origine `null`,
che non si puo' registrare. Vale anche per il guscio desktop, che carica con
`loadFile` ed e' percio' anche lui `file://`. Dove non puo' funzionare il
pulsante NON sparisce: resta e dice dov'e' che funziona, perche' un pulsante
che si volatilizza sembra un guasto. Il disegno del pulsante lo fa Google
(`renderButton`) e non si puo' rifare a mano: le sue linee guida vogliono il
suo pulsante, e la libreria consegna la credenziale solo da li' o dal One Tap.
Serve `GOOGLE_CLIENT_ID` nell'HTML e `--social.google.client_id` sul server:
**senza il secondo Nakama verifica la firma del token ma non per chi e' stato
emesso**, e accetterebbe un token valido di un'altra applicazione qualsiasi.

**TLS, e perche' non era una rifinitura (risolto nella v0.77.31).** Una pagina
servita in `https` non puo' chiamare un indirizzo `http`: il browser blocca la
richiesta come *mixed content* e non parte nemmeno. Finche' Nakama e' stato in
chiaro su `http://45.59.124.211:7350`, dalla versione web **nessun accesso
funzionava** — ne' Google ne' email — mentre da `file://` funzionava tutto,
perche' li' quella regola non si applica. Misurato da un'origine https vera:
il vecchio indirizzo `BLOCCATA: Failed to fetch`, il nuovo `RIUSCITA HTTP 200`.

Oggi Nakama sta dietro a **`https://api.hextalegame.com`**: un **Caddy** nello
stesso `docker-compose.yml` fa da muso, chiede il certificato a Let's Encrypt e
lo rinnova da se', e inoltra a `nakama:7350` dentro alla rete di Docker —
WebSocket compresi, senza configurazione aggiuntiva. Il gioco ci punta con
`ssl:true` e `porta:443`, **da ogni ambiente**: cosi' le password non viaggiano
in chiaro nemmeno aprendo il file col doppio clic.

**Due domini diversi, e vanno tenuti distinti.** `hextalegame.com` e' il
dominio del GIOCO (GitHub Pages, un `index.html` che rimanda all'ultima
versione). `api.hextalegame.com` e' il dominio del SERVER (la nostra macchina).
Configurare il primo non da' TLS al secondo: sono due cose separate.

**Il file `CNAME` vuole UN dominio solo.** Ne conteneva due (`hextalegame.com`
e `www.hextalegame.com`) e GitHub non emetteva il certificato: il sito serviva
un certificato `CN = *.github.io` e i browser lo rifiutavano. Per il `www` non
si usa quel file, si aggiunge un record DNS `CNAME www -> <utente>.github.io`.

**Il nome utente si chiede DOPO (dalla v0.77.33).** La creazione dell'account
chiede solo email e password: senza `username` Nakama ne assegna uno
provvisorio di dieci caratteri a caso, e il nome vero lo chiede una modale al
primo avvio, a giocatore gia' dentro. Il segno che la domanda e' stata fatta e'
un oggetto nello **storage di Nakama** (`profilo`/`stato`,
`{usernameScelto:true}`), non una riga in `localStorage`: deve seguire
l'ACCOUNT da una macchina all'altra, non restare sul computer dove ci si e'
registrati. Chi si e' registrato PRIMA della v0.77.33 quell'oggetto non ce l'ha
e la domanda gli arrivera' una volta: e' voluto, non un guasto.

**La scelta NON si puo' rimandare (dalla v0.77.35).** Il "Later" c'era, ed e'
stato tolto da Lorenzo: niente pulsante di rinvio, niente click sullo sfondo, e
una guardia in cima al gestore di Esc che, finche' quella finestra e' aperta,
non fa chiudere nulla — senza quella riga la catena di Esc avrebbe continuato a
lavorare sotto la finestra e la forzatura sarebbe stata solo apparente.

Va tenuta d'occhio, perche' una finestra senza uscita e' la cosa piu'
pericolosa che si possa mettere davanti a chi gioca. Quello che la rende
accettabile sono tre strade che restano aperte: **ricaricare** riporta
all'accesso; la **partita in locale** non la apre mai; e se il server non
risponde la finestra **non compare nemmeno**, perche' `chiediUsernameSeServe`
esce in silenzio quando non riesce a leggere lo stato. Se un giorno si
aggiungesse una quarta strada che porta dentro al menu senza passare da
`accessoEntra`, va ricontrollato che questa non diventi un vicolo cieco.

**Un nome gia' preso NON torna 409.** Su `PUT /v2/account` Nakama risponde
**400** con `Username is already in use.`; il 409 e' la risposta della
registrazione, un'altra strada. Guardare solo il codice fa finire questo caso
nel ramo generico "qualcosa e' andato storto": si guarda il messaggio.
Verificato sul server, non dedotto.

**Il pulsante di Google sta FUORI dai due moduli** (dalla v0.77.33), sopra al
tratto di "Exit game": cosi' compare sia sull'accesso sia sulla creazione senza
essere scritto due volte, e resta al suo posto mentre i due moduli si danno il
cambio in dissolvenza. La larghezza chiesta a `renderButton` e' **400**, il
massimo che Google accetta: chiedendo di piu' si torna alla larghezza di
default, molto piu' stretta.

**Lo standard di finestre e pulsanti e' cambiato nella v0.77.34.** Vedi la
sezione qui sotto: la modale del nome e' scritta con quello nuovo.

**Cosa non c'e' ancora.** "Forgot password?" non e' collegato. Non c'e' un "esci" nel menu:
`accessoEsci()` esiste ma non ha un pulsante. E nessun dato di gioco —
collezione, mazzi, valute — passa ancora dal server: restano tutti in
`localStorage`. `giocatoreOnline` dice se si e' entrati con un account, ed e'
l'aggancio da cui partira' quel lavoro.

**Il collaudo.** Non c'e' un file in `test/` per questa parte: il giro completo
(registrazione, accesso, sessione ritrovata, password sbagliata, nome utente
occupato, server irraggiungibile) e' stato provato lanciando il gioco vero
dentro Electron, che e' l'unico modo di vedere l'origine `file://` com'e'
davvero. Due trappole per chi lo rifara': le funzioni async del gioco si
**lanciano** e basta — passare la loro promise a `executeJavaScript` trasforma
un rigetto interno in un errore del collaudo invece che in un esito da leggere
— e **"e' entrato nel menu" non si misura su `#start-screen.style.display`**,
perche' quella schermata il gioco la RIMUOVE dal DOM.

---

## Le carte vengono dal database (dalla v0.77.36)

Il roster non si legge piu' dal foglio a ogni avvio. La verita' e' il server, e
il foglio e' diventato lo strumento con cui si SCRIVONO le carte.

**Il modulo.** Sul server, `/opt/nakama/data/modules/index.js`. Il runtime
JavaScript di Nakama carica **un solo file d'ingresso**, e di default si chiama
`index.js`: un modulo con un altro nome viene ignorato in silenzio — nessun
errore, semplicemente le RPC non esistono. E' costato mezz'ora.

**Tre RPC.**
- `hx_avvio` (serve un accesso) — torna il catalogo e il possesso in una
  chiamata sola. Se il client manda la `versioneNota` e coincide, il catalogo
  non viene rispedito: sono settanta chilobyte.
- `hx_importa` (solo con la chiave http del runtime, MAI da un client) — e' il
  modo in cui il foglio entra nel database.
- `hx_sistema_utenti` (idem) — ricalcola il possesso di utenti gia' esistenti.

**Catalogo e possesso sono DUE COSE, e confonderle e' l'errore.** Il catalogo
sono tutte le carte che esistono e serve INTERO per giocare: una carta non
posseduta puo' comparire lo stesso, evocata o per trasformazione (Excalibur,
The Green Prince). Il possesso e' `{ slug: livello }` e serve a MOSTRARE: e'
quello che guardano la Collezione e i mazzi. E' lo stesso paio di domande che
il gioco distingueva gia' fra `Visible` e `Drop rate`.

**Le due colonne nuove del foglio.**
- `Starter deck` — in quali mazzi iniziali entra la carta: vuoto = nessuno,
  `1` = il primo, `1-2` = il primo e il secondo. Oggi i tre mazzi hanno dieci
  carte ciascuno.
- `Admin = Yes` — carta riservata: non esce MAI verso un giocatore normale,
  nemmeno dentro al catalogo. Quando e' Yes, `Visible` non conta piu'.

**Chi e' amministratore** sta scritto in `metadata.admin` dell'account, e il
client NON puo' scriverlo: `PUT /v2/account` accetta username, display name,
avatar, lingua, luogo e fuso, non i metadati. I nomi in `NOMI_ADMIN` servono
solo a SEMINARE quel contrassegno la prima volta: dopo comanda il contrassegno,
ed e' per questo che quei nomi si possono cambiare senza perdere i privilegi.

**Quando si legge cosa, e perche'.** Il catalogo serve gia' durante il
caricamento, perche' gli indirizzi dell'arte si ricavano da li' — ma a quel
punto l'accesso non c'e' ancora. Quindi: allo splash si parte dalla COPIA IN
CACHE (`hextale.catalogo` in `localStorage`), e appena fatto l'accesso si chiede
al server; se il catalogo e' cambiato si rifa' la verifica dell'arte. Chi gioca
scollegato resta con la copia locale, e se il possesso non e' noto la Collezione
mostra tutto invece di mostrare il vuoto — una Collezione vuota sembra un gioco
rotto.

**Come si reimporta il foglio: doppio clic su
`server/importazione/reimporta.cmd`.** Scarica, converte col parser del gioco,
**confronta i valori col foglio riga per riga**, controlla che non manchi
niente, e solo allora importa. Alla prima cosa che non torna si ferma e non
tocca il database. Dettagli in `server/LEGGIMI.md`.

Quel confronto non e' prudenza esagerata: una normalizzazione sbagliata nel
convertitore ha fatto leggere alla colonna `SE` i valori di `E` e alla colonna
`W` quelli di `SW`, e **57 carte su 83** sono entrate nel database con numeri
plausibili ma falsi — senza un errore e senza un avviso. Il parser CSV del
controllo e' volutamente **indipendente** da quello del gioco: confrontare un
risultato con se stesso non prova niente.

**Il foglio si legge con `export?format=csv`, MAI con `gviz`.** `gviz` decide un
tipo per ogni colonna e scarta le celle che non ci rientrano: le colonne dei
lati sono numeriche, quindi una scaletta come `0-0-0-0` (Excalibur) da li' non
arriva, e la carta entra con sei valori inventati. E' la stessa trappola che il
gioco documenta gia' nell'avviso sui valori provvisori.

**Attenzione ai flag di Nakama.** Il parser dei flag di Go **smette di leggere
al primo argomento che non e' un flag**: un argomento spurio in mezzo fa
ignorare in silenzio tutto cio' che viene dopo. E' successo, e per un po' ne
sono stati ignorati due. Per questo l'entrypoint nel `docker-compose.yml` ha
tutti i flag **su una riga sola**: niente continuazioni da rompere.
E `social.google.client_id` **non esiste** in Nakama 3.40 (ci sono solo apple,
facebook e steam): la verifica di per chi e' emesso il token Google si fa nel
modulo, con un aggancio `registerBeforeAuthenticateGoogle`.

---

## Stagione, livello e rank (dalla v0.77.50)

Stanno sul SERVER, per la stessa ragione delle carte possedute: sono la misura
di quanto uno ha giocato, e una misura che il giocatore puo' riscrivere non
misura niente. Il client riferisce **com'e' finita** una partita (`hx_partita`);
cosa cambia lo decide il server.

**La stagione non e' un numero salvato:** e' una funzione della data, contata a
mesi da `STAGIONE_INIZIO` (27 agosto 2026). Cosi' non esiste il caso "il server
non era acceso il giorno dello scatto e la stagione non e' cambiata". Al primo
accesso di una stagione nuova, livello e rank si **azzerano** — lo fa
`leggiStagione`, alla prima occasione in cui il profilo serve.

**L'esperienza.** Vittoria +50, sconfitta +20, **anche contro l'IA**. Salire dal
livello L costa `50*(L+1)`: 50 il primo, 100 il secondo, e cosi' via fino al 30,
dove l'esperienza smette di accumularsi — una barra che si riempie senza far
salire niente racconterebbe una bugia.

**Il rank.** Dodici gradini (`RANGHI`), da Bronze I a Gold Top. Vittoria +3,
sconfitta −1. A 10 punti si sale **portandosi dietro l'eccesso** (da 9, una
vittoria fa 12: gradino nuovo con 2 punti gia' fatti). Si scende solo dopo
**tre sconfitte di fila**, e si riparte da **7/10**; da Bronze I non si
retrocede. **Contro l'IA il rank non si muove**: e' la misura del gioco contro
persone, ed e' quella su cui si basera' l'accoppiamento — lasciarla crescere da
soli la renderebbe una misura di quanto uno ha voglia di battere il computer.

**Perche' `hx_partita` torna il PRIMA e il DOPO.** Il menu deve poter far vedere
la barra che sale da dove era, invece di trovarla gia' piena. L'animazione non
parte quando il server risponde — a quel punto si sta guardando la schermata di
fine partita — ma **entrando nel menu**: `_daMostrareDopoPartita` tiene lo stato
in attesa, e `mm2MostraGuadagno` lo consuma.

**Un limite dichiarato:** se la rete manca quando la partita finisce, quel
risultato **non si recupera**. Una coda di partite da riferire piu' tardi
sarebbe anche una coda di partite da falsificare. Vale lo stesso per il fatto
che oggi e' il client a dire chi ha vinto: le partite sono locali, e il giorno
in cui saranno sincronizzate quel giudizio passera' al server.

---

## Le bustine e le valute (dalla v0.77.52)

**Fino alla v0.77.51 sbustare non lasciava niente.** Le due carte si vedevano,
si sceglieva, e poi sparivano: il possesso non le riceveva. La polvere, intanto,
era un numero in `localStorage`. Adesso tutte e due le cose stanno sul server.

**Due RPC, e la ragione per cui sono due.**

| RPC | Cosa fa |
|---|---|
| `hx_bustina_apri` | il server SORTEGGIA due carte, se le segna, e torna gli slug e il prezzo della seconda |
| `hx_bustina_raccogli` | il giocatore dice quali tiene; il server fa pagare e le scrive nel roster |

**Perche' sorteggia il server.** Prima pescava il client (`_pescaCartaBustina`) e
il server si sarebbe limitato a registrare cio' che gli veniva dichiarato:
chiunque avesse aperto la console avrebbe potuto raccogliere la carta che
voleva. Una valuta e un possesso che il client puo' scrivere non sono una
valuta e un possesso. `_pescaCartaBustina` c'e' ancora, ma **le sue carte non
entrano nel roster**: la raccolta le rifiuterebbe, perche' il server accetta
solo gli slug della bustina che ha sorteggiato lui. Serve al menu di debug e a
non lasciare una busta che non si apre se il server tace.

**Perche' la bustina aperta si scrive.** Fra il sorteggio e la scelta passano
dieci secondi di animazioni. Tenere le due carte in memoria non basterebbe — il
runtime e' un pool — e chiederle al client vorrebbe dire tornare a fidarsi di
lui. Sta in `profilo/bustina`, si riprende se si ricarica la pagina (altrimenti
ricaricare sarebbe un modo per ripescare finche' non esce quel che si vuole), e
si **cancella** appena raccolta.

**Il prezzo si fissa all'apertura** e si scrive insieme alla bustina. Alla
raccolta si riusa quello, non se ne calcola un altro: due conti che devono dare
lo stesso numero prima o poi non lo danno, e a divergere sarebbero la cifra sul
pulsante e quella addebitata. La scala resta per rarita' — 50 / 200 / 500 /
1000 — e **si paga sempre la meno cara delle due**, cosi' l'ordine dei clic non
cambia il conto. La tabella e' in due posti (client e server) ma **vale quella
del server**: il client la mostra soltanto.

**Pagamento e possesso in una scrittura sola.** Non "prima paga, poi aggiungi":
fra due scritture ci sta una connessione che cade, e allora la polvere sarebbe
andata e le carte no.

**Le valute.** `VALUTE_INIZIALI` nel modulo: **100 polvere e 100 inchiostro**.
Chi si era registrato prima se le vede assegnare al primo accesso — un saldo
mancante e' un vuoto della nostra storia, non una scelta sua. Nel client
`VALUTE_INIZIALI` esiste ancora ma e' solo il segnaposto mostrato finche' la
risposta non arriva; `applicaValuteDalServer` e' **l'unica porta** da cui il
saldo entra, e la cache in `localStorage` viene sovrascritta dal server. E'
voluto: chi giocava prima aveva 300 e 14000 scritti nel browser.

**`spendiFairyDust` non e' piu' una spesa.** Muove il numero a schermo, non il
saldo. Nessuna spesa vera deve cominciare da li'.

**Una trappola trovata mentre si collaudava.** `caricaCatalogoDaCache`
leggeva il possesso in un blocco che stava **dopo** il `return true` del ramo
"catalogo trovato": lo raggiungeva solo chi NON aveva il catalogo in cache,
cioe' quasi nessuno. Al riavvio `_possessoNoto` restava falso, e con quello
falso `carteDelGiocatore` mostra l'intero catalogo — la Collezione sembrava
piena di carte mai ottenute finche' non si premeva Login. Non se n'era accorto
nessuno perche' il ripiego "mostra tutto" e' silenzioso e sembra generosita'.
Adesso `caricaPossessoDaCache` si chiama per prima, e la scrittura in cache sta
in `salvaPossessoInCache`, una sola, invece delle due copie di prima.

**Il roster si chiede al server SOLO dopo il Login.** Con una sessione salvata
il gioco saluta con "Welcome back… Press Login to continue" e aspetta: prima di
quel gesto vale la cache. E' voluto, ma va saputo quando si collauda — una
sonda che ricarica e legge subito `CARTE_POSSEDUTE` non sta guardando il
server.

**Cosa NON e' ancora protetto.** Il livello di una carta sbustata e' fisso
(`LIVELLO_SBUSTATA`, oggi 2) e sbustare un doppione non fa niente: tiene il
livello piu' alto fra quello che c'era e quello nuovo. Quando i doppioni
serviranno a salire di livello, il posto e' `rpcBustinaRaccogli`.

---

## La partita in rete — TAPPA 1 (dalla v0.77.53, finita nella v0.77.54)

**STATO (v0.77.54): la tappa 1 e' FINITA e funziona.** Due giocatori si
accoppiano, entrano nella partita creata dal server e giocano davvero da due
computer diversi. Restano fuori le conquiste (tappa 2) e le abilita' (tappa 3),
che i client calcolano ancora ognuno per conto suo.

**Perche' a tappe.** Il motore di regole e' ~9.600 righe, 270 funzioni e 44
abilita', tutto nel client. Portarlo di la' in un colpo solo vuol dire settimane
senza PvP funzionante. Le tappe sono tre: **1)** partita di rete, turni, tempo,
legalita' del piazzamento; **2)** le conquiste; **3)** le abilita'.

**Cosa possiede il server, adesso** (`registerMatch('hextale', partita)`):

| | |
|---|---|
| le carte | mescola i due mazzi e distribuisce le mani |
| il tabellone | quali caselle sono bloccate, uguali per tutti e due |
| i turni | di chi e', e quante giocate si sono fatte |
| la legalita' | e' il tuo turno? la carta e' in mano tua? la casella esiste, non e' un muro, non e' occupata? |
| il tempo | i sessanta secondi, con un battito ogni cinque per correggere la deriva del client |

**Le carte dell'avversario sono coperte PER COSTRUZIONE.** Non e' un
accorgimento grafico: la mano dell'altro non attraversa mai la rete. Ogni
giocatore riceve la propria (`_aUno`, mai `_aTutti`) e dell'altra sa solo
QUANTE carte contiene. La carta pescata la sa solo chi ha pescato.

**Il mazzo si legge dallo storage, non dal client.** `_mazzoDi` prende il mazzo
scelto dal profilo: cosi' passa dalle regole gia' scritte (dodici carte,
ventiquattro punti, e soprattutto carte POSSEDUTE). Un mazzo che arriva dal
client e' una richiesta, non un fatto. Il codice mazzo nel biglietto del
matchmaking resta solo per mostrare l'avversario prima che la partita cominci.

**Le opcode** — 1 avvio (personale), 2 gioca, 3 giocata, 4 tempo, 5 rifiuto
(personale), 6 fine, 7 impronta, 8 disaccordo.

**L'impronta, finche' le regole stanno nel client.** Conquiste e abilita' le
calcolano ancora i due client. A ogni giocata mandano al server un'impronta del
proprio stato: se le due non coincidono la partita si ferma. Non impedisce di
barare — impedisce di barare **senza che si veda**, che e' la differenza fra un
problema e un problema silenzioso.

### Due trappole gia' pagate

**Le funzioni del match handler devono essere GLOBALI e con un nome.** Scritte
come funzioni anonime dentro all'oggetto, il runtime non parte:
`js match handler "matchInit" ... function literal found: javascript functions
cannot be inlined`. E non e' un errore mite — **Nakama entra in ciclo di
riavvio e il gioco resta giu'**. E' successo, ed e' durato un paio di minuti.
Da allora si schiera con `scratchpad/schiera.sh`, che rimette da solo il modulo
precedente se il nuovo non parte.

**Il salvataggio dei mazzi e' asincrono.** `creaMazzo` avvia un
`mandaMazziAlServer`, e una scrittura diretta fatta subito dopo puo' essere
sorpassata da quella gia' in volo. Chi collauda deve passare da `salvaMazzi` e
ASPETTARE che il server confermi, non dare per scontato di aver scritto.

### Come e' agganciato il client (dalla v0.77.54)

Tutto passa dal socket della ricerca, che dalla v0.77.54 **non si chiude piu'**
quando l'avversario e' trovato: `mmTrovato` manda un `match_join` col
`match_id` che arriva nell'accoppiamento, e la partita comincia solo quando
arriva l'avvio del server (`reteMessaggio`, op 1). Aspettare quel messaggio
invece di partire subito e' la differenza fra una partita e due partite diverse.

`PARTITA_RETE` e' l'interruttore: quando c'e', il gioco e' in rete.

| | |
|---|---|
| `makeBalancedDecks` | il mio mazzo e' quello mescolato dal server, nel suo ordine; il suo e' dodici `_cartaSconosciuta` |
| le caselle bloccate | `PARTITA_RETE.buchi`, non piu' sorteggiate |
| chi comincia | `PARTITA_RETE.turno` |
| `doPlace` | senza `daServer` MANDA e non tocca il tabellone; con `daServer` applica |
| `startTimer` | parte da quel che resta secondo il server |
| `autoPlay` | non fa niente: la giocata d'ufficio la fa il server |
| `renderHand` | la mano avversaria e' coperta SEMPRE, anche a partita finita |

**Il mio mazzo me lo manda il server, mescolato.** Non e' un segreto — e' roba
mia — e mandarlo all'avvio evita di sincronizzare ogni pescata: pesco da solo,
nello stesso ordine, e quel che pesco coincide sempre con quel che lui sa.

**`_cartaSconosciuta` ha `groupSides: []`, non sei null.** Con dei null dentro,
`gruppiDiCarta` chiama `.slice()` su di loro e la partita muore mentre disegna
la mano. Il fronte della carta viene costruito anche quando e' coperta.

### Tre trappole gia' pagate

**`G.currentPlayer=Math.random()<0.5?1:2`.** Ogni client tirava a sorte chi
comincia. In locale e' l'unico posto che decide, quindi andava bene; in rete i
due indovinavano lo stesso numero **una volta su due**, e nell'altra meta'
ognuno credeva che toccasse a se'. Adesso in rete quel numero viene dal server.

**Il turno puo' comunque divergere, e si riallinea.** Il motore fa passare il
turno per conto suo alla fine delle animazioni. Quasi sempre arriva allo stesso
numero del server; in un collaudo su quattro no. `reteAllineaTurno`, chiamata
sul battito del tempo, lo rimette a posto — ma **solo a tabellone fermo**:
forzarlo durante un'animazione strapperebbe il turno a meta' di una conquista.
Quando le regole saranno sul server (tappe 2 e 3) questa riconciliazione
sparira', perche' non ci sara' piu' un secondo posto che decide.

**Le funzioni del match handler devono essere GLOBALI e con un nome.** Scritte
come funzioni anonime dentro all'oggetto, il runtime non parte:
`function literal found: javascript functions cannot be inlined`. E non e' un
errore mite — **Nakama entra in ciclo di riavvio e il gioco resta giu'**. E'
successo, ed e' durato un paio di minuti. Da allora si schiera con
`server/nakama/schiera.sh`, che rimette da solo il modulo precedente se il
nuovo non parte (l'indirizzo si passa da fuori: `HEXTALE_SRV=root@… bash …`,
perche' questo repository e' pubblico).

## Le abilità vengono dal foglio (dalla v0.77.57)

**Cosa e' cambiato.** Un'abilita' non e' piu' un pezzo di JavaScript agganciato
a una chiave (`cardAbility === 'immovable'`): e' un **dato**, scritto in 37
colonne del foglio `Cards DB` e letto dal gioco. Il vocabolario sta in
`server/importazione/vocabolario-abilita.md`.

**La catena, in ordine.**

| pezzo | dove | cosa fa |
|---|---|---|
| il foglio | `Cards DB`, colonne AC..BM | dove si scrivono le abilita' |
| il parser | `server/importazione/abilita-parser.js` | legge quelle colonne e ne fa un oggetto. **Gira una volta sola, all'importazione** |
| il convertitore | `server/importazione/converti.js` | attacca l'abilita' strutturata a ogni carta del catalogo |
| il motore | `server/nakama/abilita-motore.js` | risponde alle domande del gioco leggendo quell'oggetto |
| l'iniettore | `server/nakama/inietta-motore.js` | mette il motore **dentro** al gioco e dentro al modulo |

**Perche' il parser gira una volta sola.** Client e server ricevono l'abilita'
gia' strutturata e gia' verificata: nessuno dei due deve interpretare del
testo. E' la ragione per cui il parser puo' permettersi di essere severo —
sbagliare all'importazione costa un errore, sbagliare piu' avanti costa una
partita. **Rifiuta rumorosamente**, dicendo carta e colonna, e non importa
niente se anche una sola riga non si capisce.

**Perche' il motore si INIETTA invece di essere copiato.** Le stesse regole
devono dare la stessa risposta di qua e di la'. Se divergessero, i due client
racconterebbero due tabelloni diversi e la partita si fermerebbe da sola —
esattamente cio' che l'impronta della v0.77.55 sorprende. Due copie scritte a
mano divergono sempre; questa si riscrive da sola con
`node server/nakama/inietta-motore.js`, che poi **verifica** che le due copie
siano identiche al sorgente. **Non si modifica il motore dentro all'HTML o
dentro a index.js**: si modifica `abilita-motore.js` e si rilancia l'iniettore.

**Il motore e' ES5.** Il runtime di Nakama e' goja: niente `let`, niente
funzioni a freccia. Il prezzo e' qualche `var`; il guadagno e' lo stesso file
in tutti e due i posti senza una compilazione in mezzo.

### Cosa legge gia' dal foglio

Le **regole** — quelle che non fanno niente ma cambiano cio' che gli altri
possono fare. Nel client cinque funzioni sono state riscritte per chiedere al
motore: `cartaIntoccabile`, `latoInconquistabile`, `puoConquistare`,
`getAttackValueForSide`, `vinceIlConfronto`. Coprono Excalibur, The Crystal
Princess, Sleeping Beauty, Thumbelina, Merlin, Shere Khan, Peter Pan, Bagheera
e Babes in the Wood.

**Il ripiego non e' pigrizia.** Finche' il catalogo sul server e' quello
vecchio, le carte non hanno il campo `abilita`: in quel caso vale la vecchia
chiave. Appena ce l'hanno, vale il foglio. Non esiste un momento in cui il
gioco non sa rispondere.

### Gli effetti continui (agganciati dalla v0.77.58)

Le sinergie — "+1 ALL per ogni Small in campo", "+2 ALL ai Wild adiacenti" —
si **ricalcolano** dallo stato del tabellone, non si sommano e sottraggono.

**Perche' ricalcolare.** Il sistema vecchio teneva un'istantanea dei valori per
ogni sinergia (`hoorayBaseValues`, `mischiefBaseValues`, `nightmareBaseValues`,
`balooBaseValues`) e **ogni** funzione che toccasse un valore doveva ricordarsi
di spostarle tutte, o quella sinergia avrebbe riportato la carta indietro al
ridisegno dopo. Bastava aggiungere una sinergia e dimenticare una riga.
`deltaContinuo` non ha niente da ricordare: parte dai valori stampati e
risomma tutto da capo.

**RAND e' ripetibile, non casuale.** Un lato "a caso" che cambia a ogni
ricalcolo sfarfallerebbe, e in rete i due giocatori vedrebbero lati diversi —
cioe' due tabelloni diversi, cioe' la partita fermata dall'impronta. Il lato si
sceglie da un'impronta del nome della carta piu' un seme che vale per tutta la
partita: casuale da fuori, **identico sui due schermi**.

### La trappola dei tratti, trovata collaudando

Nel foglio il tratto puo' voler dire due cose diverse, e le avevo confuse:

| `If subject` | significato |
|---|---|
| `adjacent` / `board` | **un cancello**: "se ESISTE un vicino / una carta in campo con quel tratto" |
| `target` | **un filtro**: "solo chi HA quel tratto riceve l'effetto" |

Avevo scritto `adjacent` dove serviva `target`, e il risultato era che **Baloo
buffava qualunque alleato adiacente**, non solo i Wild. Corrette nel foglio sei
carte: Baloo, Little John, Maid Marian, Dorothy Gale, Geppetto, Lancelot.
Restano giustamente col cancello Snow White e Pixies (dove il tratto e' cio' che
si CONTA, non chi riceve) e Cappuccetto Rosso (dove la condizione guarda il
nemico vicino e il bonus va a lei).

### Com'e' agganciato (v0.77.58)

`ricalcolaValoriVivi` era gia' il punto unico da cui passavano le quattro
sinergie: adesso, quando il catalogo porta le abilita' (`sinergieDalFoglio()`),
fa **un conto solo** col motore e i quattro `recalc*` non si chiamano piu'.

**Tre valori, e non sono la stessa cosa.**

| campo | cos'e' |
|---|---|
| `valoriNascita` | il METRO del disegno: dice se un numero e' verde o rosso. Non si tocca mai |
| `valoriBase` | quanto vale la carta al netto delle sinergie. Lo muovono gli effetti PERMANENTI (un furto, la vendetta di Baba Yaga) |
| `values` | quello vero: `valoriBase` piu' cio' che le carte vicine stanno regalando o togliendo adesso. Si rifa' da capo a ogni ricalcolo |

**La guardia sta dentro ai recalc, non nei chiamanti.** I chiamanti sono sette,
sparsi fra il piazzamento, il disegno della mano, la tavola delle abilita' e la
simulazione dell'IA: bastava dimenticarne uno per contare una sinergia due
volte, e **un numero che cresce a ogni ridisegno e' il guasto piu' difficile da
vedere**. Il collaudo lo verifica apposta: quattro ricalcoli di fila devono
dare lo stesso identico numero.

### La riga che mancava, ed era grossa

`_makeCardDbCardBase` non copiava `abilita` dalla voce di catalogo alla carta
giocata. L'abilita' restava sulla VOCE, il motore non la vedeva, e **ogni
regola ricadeva in silenzio sul vecchio sistema**. I collaudi non se ne erano
accorti perche' provavano le voci di catalogo, non le carte in campo — e una
carta in campo e' l'unica cosa con cui si gioca davvero. Da allora la carta
porta con se' `abilita`, `traitNames` e `idFoglio`.

**Se un domani un'abilita' non scatta**, la prima cosa da guardare e' se la
carta giocata ha il campo `abilita`, non se il foglio e' scritto bene.

### Un cambiamento di comportamento da sapere

Le sinergie `while_on_board` **non valgono piu' mentre la carta e' in mano**.
Il sistema vecchio le mostrava anche li' (i `recalc*` giravano pure sulla
mano); il foglio dice "while on board", e adesso si fa quello che dice il
foglio. Se non e' cio' che si vuole, si cambia il Trigger, non il codice.

### La finestra temporale (dalla v0.77.59)

`from_turn` e `until_turn` valgono: Strigoi prende il suo +2 dal quarto turno,
non prima.

**Se il turno non si sa, la finestra e' CHIUSA.** E' la scelta scomoda ed e'
voluta: chi dimentica di passare il turno nella scena vede l'abilita' non fare
niente — un guasto che si nota — invece di vedere una carta silenziosamente
piu' forte del dovuto. Questo gioco ha gia' pagato caro il guasto silenzioso
(le 57 carte con due lati sbagliati, le abilita' bloccate dal livello che non
dicevano niente). Il collaudo verifica anche questo caso.

`for_turns` e `next_only` non riguardano le sinergie continue: valgono per gli
effetti che scattano una volta, e quelli sono ancora da fare.

### Gli effetti a scatto: il motore DECIDE, non agisce (dalla v0.77.60)

Una sinergia si **ricalcola**; un effetto a scatto **succede**, una volta, e
lascia il segno. Sono due modelli diversi e vanno tenuti separati: chi li
confonde riapplica un furto a ogni ridisegno.

`cambiamentiAllEvento(fonte, evento, scena)` **non cambia niente**. Torna un
elenco di cambiamenti — `{ carta, lati, delta }` oppure `{ carta, lati, valore }`
per un "set" — e chi la chiama decide cosa farne:

- il **gioco** li applica passando da `modificaValori`, che si porta dietro il
  lampo verde o rosso e le animazioni;
- il **server** li applica al proprio stato senza mostrare niente.

La decisione e' **una sola** e vale per tutti e due. E' l'unico modo perche' i
due tabelloni restino d'accordo, ed e' il motivo per cui questa funzione non ha
il permesso di toccare una carta.

**Cosa sa gia' decidere**, provato sulle abilita' vere: Baba Yaga (colpisce chi
l'ha conquistata, per differenza di potere), Big Bad Wolf, Cowardly Lion, Mad
Hatter (un valore IMPOSTO fra 1 e 3, lo stesso su tutti i lati, non a
scacchiera), Carabosse (un nemico, mai un alleato), The Genie, Sinbad (solo sul
bordo), Aladdin (+3 **invece** di +1, non +4).

**Il caso non si tira dentro al motore.** Dove serve — un bersaglio a caso, un
valore fra 1 e 3, un "or" — il motore legge `scena.sorte`. Cosi' la stessa
decisione si puo' rifare identica: nel collaudo si passa un numero fisso, e in
rete lo passera' il server. Un `Math.random()` dentro al motore avrebbe reso i
due tabelloni impossibili da tenere d'accordo.

### L'aggancio al piazzamento (dalla v0.77.61)

`applicaAbilitaPiazzamento` era gia' il punto unico da cui passa un'abilita'
quando la carta viene calata — e da cui l'anteprima sotto il puntatore arriva
gratis. Adesso, prima di cercare la versione scritta a mano, chiede al motore
se sa fare da se'.

**"Sa fare da se'" e' una domanda precisa** (`motoreFaLEvento` +
`_effettoSemplice`): l'effetto cambia dei numeri, e li cambia a qualcuno che in
questo momento c'e'. Restano scritte a mano:

- quelle che toccano la **prossima** carta pescata o giocata — la Regina di
  Cuori, il Grillo Parlante;
- quelle che chiedono al giocatore di **scegliere col mirino**;
- tutte quelle che **non cambiano un numero**: trasformare, invocare,
  spostare, distruggere, rubare un'abilita' o un tratto.

**Perche' la domanda dev'essere precisa.** Spegnere a occhi chiusi la versione
scritta a mano di un'abilita' che il motore non sa fare vorrebbe dire toglierla
dal gioco **in silenzio** — peggio che lasciarla vecchia. Il collaudo verifica
tutt'e due i lati: chi e' passato al motore e chi e' rimasto, per nome.

**Passate al motore:** White Rabbit, Captain Hook, Aladdin, Guinevere, Sinbad.
**"Edgy" di Sinbad funziona per la prima volta**: era scritta sulla carta e non
era mai stata programmata.

**I cambiamenti si applicano passando da `modificaValori`** (vedi
`applicaCambiamenti`), non scrivendo dentro a `values`: e' li' che vivono il
lampo verde o rosso e le istantanee, e scavalcarlo vorrebbe dire un numero che
cambia senza che si veda perche'.

### L'aggancio alla conquista (dalla v0.77.62)

C'e' un punto unico anche qui: l'istante in cui la carta si e' appena girata.
E' li' che vivono sia "quando vengo conquistata" sia "quando conquisto" — le
due scene sono la stessa vista dalle due parti, e tenerle separate avrebbe
voluto dire due orologi da tenere d'accordo.

**Passate al motore:** Baba Yaga e Mad Hatter (`on_conquered`), Big Bad Wolf e
Cowardly Lion (`on_conquer`). **Restano scritte a mano:** 12 Dancing
Princesses (sposta), Morgana (annulla), The Caterpillar (mescola e nasconde),
Phoenix (cambia proprietario).

### Le due discordanze, chiuse da Lorenzo

Portare le abilita' sul foglio aveva fatto emergere due punti in cui il codice
faceva una cosa diversa da quella scritta sulla carta. **Le ha decise lui, e il
foglio adesso e' la risposta a tutte e due.**

**Cowardly Lion.** Avevo cambiato la carta per farla scattare alla conquista,
perche' cosi' diceva il foglio. Andava bene com'era: si infligge -1 RAND
**quando la cali**, una volta per partita. Il foglio ora dice `on_play` +
`once_per_game`, e il codice non ha avuto bisogno di una riga — e' il senso
di tenere le abilita' come dati. Da qui la lezione: il foglio va **chiesto**,
non dedotto. Il Genio gliel'avevo chiesto, il Leone no, e il Leone e' quello
che ho sbagliato.

**The Genie.** Adesso e' `end_of_turn` + `once_per_game`: il regalo alle
carte in mano arriva a fine turno, ma una volta sola nella partita, non a ogni
turno. Manca ancora **l'aggancio `end_of_turn`** perche' quel momento chiami
il motore.

### La colonna del riepilogo si rigenera (v0.77.63)

`Complete script` e' un SECONDO deposito della stessa verita': scritta a mano,
prima o poi dice una cosa mentre le colonne ne dicono un'altra — ed e' successo
appena Lorenzo ha corretto due carte. `server/importazione/rigenera-riepiloghi.js`
scarica il foglio, lo rilegge col parser vero e dice quali frasi non tornano.
Se una frase non torna, **e' la riga a essere sbagliata, non la frase**. Le
spiegazioni `UNIQUE — ...` scritte a mano non si toccano.

**Una trappola trovata sul foglio.** La convalida dati delle *durate* era stesa
una colonna di troppo (`BL2:BM1001` invece di `BL2:BL1001`), e cosi' la
colonna del riepilogo aveva ereditato una tendina che **rifiuta** qualunque
frase. L'effetto era peggiore di un errore: scrivendoci dentro, la cella si
svuotava invece di cambiare. Regola corretta; se un giorno una colonna di testo
libero rifiuta quel che ci scrivi, e' li' che si guarda.

### Quante volte scatta un'abilita' (v0.77.63)

`Frequency` era una promessa scritta e mai mantenuta: il motore faceva
scattare l'abilita' a ogni evento buono. Adesso la conta la tiene **il motore**,
non il chiamante — client e server sono due occasioni di dimenticare, e la
dimenticanza sarebbe silenziosa proprio dove costa di piu'.

- la memoria sta sulla **carta** (`_scatti`), non sull'abilita': due copie
  della stessa carta hanno ciascuna il suo colpo;
- si segna **solo se e' uscito qualcosa**: un colpo che non parte perche' la
  condizione era falsa non e' stato speso;
- `once_per_turn` con turno ignoto resta **chiusa**, come la finestra
  temporale: meglio un'abilita' che non parte, e si nota, di una che si ripete
  di nascosto.

### I due momenti del turno (v0.77.63)

Fino alla v0.77.62 il motore veniva chiamato solo da eventi provocati da una
giocata: calare una carta, conquistarne una. Ma il foglio ha anche abilita' che
non aspettano nessuno, e restavano **scritte e mute**. Adesso ci sono due
agganci: `end_of_turn` in `endTurn` (prima che il numero del turno salga, o
un `once_per_turn` si troverebbe gia' nel turno dopo) e `start_of_turn` in
`startTurn`.

Cercano sul **tabellone**, non in mano: una carta in mano non ha ancora un
posto in partita. Il Genio non fa eccezione — sta in campo e regala alle carte
in mano: e' il bersaglio a stare in mano, non la fonte.

| carta | momento | chi la fa |
|---|---|---|
| The Genie | `end_of_turn`, `once_per_game` | il motore |
| Carabosse | `end_of_turn`, `every_time` | il motore |
| Pinocchio | `end_of_turn` | scritta a mano (`protect side`, non e' un valore) |
| Cheshire Cat | `start_of_turn` | scritta a mano (`move tile`, non e' un valore) |

**Una scelta da confermare: di CHI e' il turno.** Il foglio dice
`end_of_turn` ma non dice di chi, e per Carabosse — che e' `every_time` — la
differenza e' il doppio: scattando a entrambi i fini turno colpirebbe due volte
per giro. Ho preso la lettura corrente nei giochi di carte, **"alla fine del
TUO turno"**, perche' e' quella che non raddoppia di nascosto. Se la si vuole a
ogni fine turno, e' una colonna in piu' sul foglio — non una riga di codice.

**La guardia al piazzamento adesso si chiede il momento invece di elencarlo.**
Prima diceva "se e' conquista, non fare niente qui"; Il Genio, passato a
`end_of_turn`, le sarebbe scivolato accanto e avrebbe colpito due volte. Ora
chiede alla carta qual e' il suo trigger.

**Il server non partecipa a questi due momenti**, ed e' voluto: e' ancora
arbitro e non calcolatore: non simula la partita, quindi non ha un fine turno
da agganciare. Il motore e' li' e aspetta la tappa in cui calcolera' le
conquiste.

### La Regina delle Nevi, e il gelo in mano (v0.77.64)

Facendo il giro delle carte rimaste e' venuta fuori una cosa che non sapevo:
delle 44 abilita' del registro **tre non venivano mai eseguite** (Shere Khan,
Unicorn, The Crystal Princess — e le prime due sono regole o UNIQUE, quindi
stanno bene dove sono), e **una carta non era nemmeno nel registro**: la
Regina delle Nevi. Il suo potere esisteva solo sulla figurina.

Adesso c'e'. `on_play`, `once_per_game`, `for_turns 2`: congela una carta a
caso nella mano avversaria, che per due turni non si puo' giocare.

- **"Congelata" e' un numero di turno, non una bandiera.** Chi scrive una
  bandiera deve poi ricordarsi di toglierla, e un contatore dimenticato
  lascerebbe una carta ghiacciata per tutta la partita. Un numero scade da solo.
- **Tre porte, non una**: `selectCard` (il tocco), `startDrag` (il
  trascinamento) e `aiChooseMove` (l'IA). Chiuderne due su tre voleva dire
  lasciare una strada aperta.
- **La scelta "a caso" adesso e' ripetibile.** `scelti` tirava con
  `Math.random`: in rete i due client avrebbero congelato due carte diverse.
  Ora il numero esce dal seme della partita, come il lato di `RAND`.

**Un difetto silenzioso trovato qui.** `candidati`, per `in_hand`, guardava
solo la mano di CHI AGISCE. Bastava per un dono ai propri (Il Genio), ma un
effetto rivolto all'avversario in mano non trovava mai nessuno e **non faceva
niente, senza dirlo**. Adesso guarda tutte e due le mani e lascia scegliere al
filtro `ally`/`opponent`, che e' li' apposta.

**Una scelta da confermare, come per Carabosse:** `for_turns 2` conta i turni
del CONTATORE (due giocate, una per parte), non due turni di chi subisce il
gelo. E' la lettura coerente con `from_turn` e `until_turn`, che usano lo
stesso contatore.

### Le altre venti carte: perche' non passano ancora dal motore

Il giro le ha divise in due gruppi netti, e nessuno dei due si sposta con un
lavoro meccanico.

**Otto chiedono al giocatore di scegliere** (`quale = selected`): Magic
Mirror, Mordred, Little Mermaid, The Walrus, 12 Dancing Princesses, Pied Piper,
March Hare, Nottingham Sheriff. Il motore e' senza stato e senza schermo: non
puo' fermarsi a fare una domanda. Servirebbe un terzo tipo di uscita — "questi
sono i candidati, chiedi e poi richiamami con la scelta" — piu' un valutatore
per l'IA, che oggi ha una funzione dedicata per ognuna (`VALUTAZIONI_IA`).

**Dodici toccano il TABELLONE**, non i valori: spostano una carta o un
tassello, ne distruggono uno, invocano Excalibur, cambiano proprietario,
trasformano, annullano una conquista. Il vocabolario dei cambiamenti che il
motore emette parla solo di lati e numeri; per queste servirebbe una seconda
lingua (celle, proprietari, mazzo) e chi la esegua da entrambe le parti.

**E soprattutto: funzionano gia'**, con animazioni, suoni, mirino di scelta e
valutazione per l'IA. Spostarle e' riscrivere codice che gira, e ogni riga
riscritta e' un'occasione per cambiare di nascosto cosa fa una carta — che e'
esattamente quel che era successo al Leone Codardo. Vanno spostate una per una,
confrontando foglio e codice, non in blocco.

### Due discordanze da decidere (non le tocco)

**Alice.** Il foglio le da' DUE effetti: ruotare i valori *e* spostarsi su una
casella libera a caso. Il codice fa solo la rotazione. La colonna
`Ability explained` dice "...and the card moves onto a random empty space on
the board" — che e' pari pari la descrizione del Gatto del Cheshire: sembra un
copia-incolla finito nella riga sbagliata, ma non e' una cosa che decido io.

**Alice, il momento.** Il foglio dice `while_in_hand`, che per il motore vuol
dire *continuo* (una sinergia sempre attiva). La rotazione pero' e' un evento:
il codice la fa **una volta all'inizio di ogni turno**. Cosi' com'e' scritta,
il motore non la farebbe mai partire.

### Cosa manca

Gli effetti che **cambiano i valori** li fa il motore: buff, debuff, set,
steal-di-potenza, con bersagli, ambito (ALL / RAND / HIGHEST), scala (`per`)
e durata. Restano scritte a mano una ventina di carte i cui effetti non sono
numeri: rubare o copiare un'abilita', trasformare, spostare, scambiare,
distruggere, proteggere un lato, cambiare proprietario.

E finche' quelle non passano dal motore, **il server non puo' calcolare le
conquiste**: un tabellone in cui una carta si e' spostata o ha cambiato
padrone, sul server non esisterebbe. E' la stessa ragione per cui la tappa 2 e'
diventata il server arbitro invece del server calcolatore.

**L'ultimo interruttore da girare:** il catalogo sul server e' ancora quello
senza abilita'. Finche' non si rifa' l'importazione
(`server/importazione/reimporta.cmd`), il gioco gira sul ripiego.

### Due correzioni alla reimportazione (v0.77.57)

**Cercava il gioco dove non sta piu'.** `trovaGioco` guardava un
`Hextale_*.html` nella radice, e dalla riorganizzazione del 28/08 li' non c'e'
piu' niente: la reimportazione moriva prima di cominciare. Adesso guarda in tre
posti, in ordine di verita': `play/index.html`, poi `versions/` col numero piu'
alto, poi la vecchia radice per i repository non ancora riorganizzati.

**L'avviso sulle abilita' mancanti diceva il falso.** Contava tutte le chiavi
col punto esclamativo, cioe' "dichiarata ma non scritta nel codice" — ma dalla
v0.77.57 un'abilita' puo' funzionare senza codice, se il foglio la descrive.
Elencava fra le mancanti Thumbelina, Peter Pan e Bagheera, che invece
funzionano. Adesso il passaggio 4 dice quante abilita' vengono dal foglio e
quante sono scritte a mano, e ne resta **una sola** davvero mancante — Tom
Thumb, quella dei segnalini sulle caselle.

---

## Il server arbitro — TAPPA 2 (dalla v0.77.55)

**La tappa 2 non e' andata come previsto, e la deviazione e' il punto.** Il
piano era portare le CONQUISTE sul server. Guardando il codice: la regola di
conquista e' minuscola — confronta il tuo lato col lato opposto del vicino — ma
i valori delle carte **cambiano in partita** per effetto delle abilita'
(`modificaValori`, i quattro `recalc*`, `trasformaCartaIn`, la follia del
Hatter, la taglia della Regina di Cuori). Un server che calcolasse le conquiste
senza conoscere le abilita' darebbe un risultato diverso dal client ogni volta
che una di quelle ha toccato una carta adiacente: le partite si fermerebbero di
continuo per divergenza. **Le conquiste SONO le abilita'**, e non si separano.

**Cosa si e' fatto invece: il server arbitro.** Le regole restano nel client,
ma ogni turno **tutti e due** i giocatori raccontano al server com'e' il
tabellone, e il server va avanti solo se i due racconti coincidono. Un fatto
raccontato uguale da due sconosciuti e' molto piu' di un fatto dichiarato da
uno solo: per falsificarlo non basta modificare il proprio client, servirebbe
che anche l'avversario mentisse nello stesso identico modo — cioe' un accordo,
non un attacco.

Da quei racconti concordi il server ricava il **risultato**: chi ha vinto,
l'esperienza e il rank, per tutti e due. Prima era il client a dichiarare "ho
vinto" con `hx_partita`, che era la cosa piu' facile da falsificare del gioco.
`applicaEsito` e' la funzione condivisa fra la RPC (partite contro l'IA) e la
partita in rete: una regola sola, in un posto solo.

### Tre trappole gia' pagate, tutte scoperte collaudando

**L'impronta NON deve contenere il punteggio.** I punti salgono con
un'animazione a scatti (la coda di `_hpQueueDamage`): due client li fotografano
in istanti diversi e i numeri non coincidono quasi mai, pur essendo la stessa
identica partita. Nei log si vedevano due tabelloni **cella per cella
identici** che finivano con `#103,68` contro `#95,57`, e la partita veniva
fermata per niente. Si confronta il tabellone, che e' il fatto; i punti sono una
conseguenza e viaggiano a parte solo alla fine.

**`hp` sono i PUNTI FATTI, e vince chi ne ha di piu'.** Il campo si chiama
`hp` per ragioni storiche — fino alla v0.75 erano danni subiti e vinceva chi ne
aveva meno — ma dalla v0.77.0 il verso e' rovesciato (vedi
`finishGameWithResult`). Scritto al contrario, il server premiava il perdente a
ogni partita. Era gia' scritto al contrario.

**Il WebSocket grezzo deve rispondere ai ping di Nakama.** Il server manda
`{"ping":{}}` e si aspetta `{"pong":{}}`; gli SDK ufficiali lo fanno da soli,
un `new WebSocket` no. Finche' su quel socket passava solo la RICERCA non si
notava — dura pochi secondi — ma da quando ci passa la PARTITA, dopo qualche
minuto il server considerava il giocatore sparito: nei log **"partita finita per
abbandono"** senza che nessuno avesse abbandonato niente.

### Quel che manca ancora

Le **44 abilita'** e con loro il calcolo delle conquiste. Finche' stanno nel
client, il server non sa COM'E' il tabellone: sa solo che i due giocatori
raccontano la stessa cosa. Due client modificati d'accordo fra loro
passerebbero — ma vanno messi d'accordo prima, e il matchmaking accoppia
sconosciuti.

Il turno, invece, e' gia' del server: lo impone `startTurn` a ogni giro (vedi
la sezione della tappa 1).

---

## La ricerca di un avversario (dalla v0.77.51)

Il pulsante **Find opponent** apre un WebSocket verso `wss://api.hextalegame.com/ws`
e consegna un biglietto al matchmaker di Nakama. Non c'e' un RPC nostro in mezzo:
il matchmaker e' un servizio del server, e ricostruirne uno sopra avrebbe voluto
dire riscrivere la parte difficile (chi aspetta da piu' tempo, chi si e'
scollegato mentre aspettava) con meno cura di chi l'ha gia' scritta.

**Come si accoppiano.** Il biglietto porta il rank, la forza del mazzo e il mazzo
stesso in forma di codice. La ricerca parte stretta — solo rank uguale — e si
allarga di **un rank ogni dieci secondi**, fino a un massimo di **sei**
(`MM_PASSO_MS`, `MM_FORBICE_MAX`). Ogni volta che si allarga il biglietto vecchio
viene **ritirato** prima di consegnare il nuovo: lasciarlo in giro vorrebbe dire
due biglietti nostri contemporaneamente, e due possibilita' di essere accoppiati
due volte. Arrivati al massimo si insiste ancora `MM_INSISTI_MS` (venti secondi),
poi si rinuncia e si apre la finestra *No player found. Try again later.*

**Fra i candidati raggiungibili si preferisce il piu' vicino** per capacita' del
mazzo (12–24) e livello medio delle carte: un rank simile dice quanto uno ha
vinto, non con che cosa gioca.

**Si gioca contro il mazzo VERO dell'avversario.** Trovato l'accoppiamento, il suo
mazzo arriva in `MAZZO_AVVERSARIO` e `makeBalancedDecks` lo **consuma** invece di
generarne uno. Consumarlo e' voluto: se restasse, la partita dopo — magari contro
l'IA — comincerebbe in silenzio con il mazzo di uno sconosciuto.

**Mentre cerca, il pulsante dice `Cancel`** e premerlo annulla: e' la stessa
azione al contrario, e due pulsanti per accendere e spegnere la stessa cosa sono
uno di troppo. Annullare ritira il biglietto e chiude il socket.

**Un mazzo non giocabile non si sceglie e non si gioca.** La regola sta in
`selezionaMazzo`, non nelle schermate: ci passano sia Library & decks sia il
selettore del matchmaking, e una terza schermata che arrivasse domani sarebbe
protetta senza doversene ricordare. `selezionaMazzo` **torna `true`/`false`**:
chi la chiama non deve dare per scontato che abbia funzionato. I mazzi non
giocabili restano in elenco, spenti (`.non-giocabile`) — nasconderli farebbe
sembrare **perso** un mazzo che e' solo **incompleto**.

**Trappola gia' pagata.** `mm2CercaAvversario` esce se `#mm2-find` non e' in
pagina. E' corretto — senza il pulsante non c'e' niente da accendere — ma in un
collaudo che aveva gia' aperto il tavolo quell'uscita sembrava un guasto della
ricerca: nessuna finestra si apriva e la ricerca non partiva. Adesso lo scrive in
console. Se una prova sul matchmaking fallisce senza aprire nessuna finestra,
**la prima cosa da guardare e' se il menu c'e' ancora**, non il matchmaker.

---

## I mazzi (dalla v0.77.37, solo dal database dalla v0.77.56)

### I mazzi vengono SOLO dal database (dalla v0.77.56)

**Non si scrivono e non si leggono piu' nella cache del browser.** Fino alla
v0.77.55 vivevano in due posti — `localStorage` sotto `hextale.mazzi`, e il
server — con una data (`modificatoIl`) a decidere quale copia vincesse. Due
depositi della stessa verita' prima o poi discordano, ed era gia' successo: una
copia locale piu' recente sovrascriveva quella buona del database, e un mazzo
composto su un altro computer spariva senza dire niente.

Adesso il deposito e' uno solo. `MAZZI` resta in memoria perche' serve a
disegnare, ma non finisce da nessuna parte che sopravviva alla pagina.

| funzione | cosa fa adesso |
|---|---|
| `salvaMazzi` | manda al server, e basta |
| `sincronizzaMazzi` | LEGGE dal server; non sincronizza piu' niente, copie da confrontare non ce ne sono |
| `caricaMazzi` | non legge piu': **cancella** la vecchia chiave `hextale.mazzi`, cosi' chi aveva mazzi nel browser non se li porta dietro come fantasmi. Resta perche' tre punti la chiamano ancora |

**La conseguenza va sapita: scollegati non si hanno mazzi.** La Libreria si apre
vuota e il matchmaking dice che il mazzo non e' pronto. Non e' un ripiego
mancante, e' la stessa regola detta al contrario — un mazzo che il giocatore
puo' riscrivere nella console del browser non e' un suo mazzo, e da quando le
partite sono in rete e' il server a doverli conoscere per giocarli
(`_mazzoDi` nel modulo li legge da li').

**Un salvataggio fallito e' una PERDITA, e si dice.** Prima la riga in console
finiva con "(restano in locale)" ed era vera; adesso in locale non resta niente.
Se la scrittura non riesce — o se non c'e' un accesso — si apre la finestra
"Deck not saved". Si dice **una volta sola** finche' non si torna a salvare
bene: comporre un mazzo fa scattare parecchi salvataggi di fila, e otto
finestre identiche non sarebbero un avviso ma un muro.

---

### Le dodici caselle (dalla v0.77.37)

**Dodici caselle, tutte del giocatore.** Fino alla v0.77.36 la quarta era del
Giocatore 2 e le altre undici del Giocatore 1. Quella funzione e' stata tolta,
e la **conseguenza va sapuita**: in PvP il secondo giocatore scende sempre in
campo con un mazzo GENERATO, scelto fra trecento tentativi come il piu' vicino
di forza al tuo. Era gia' cosi' per chi non si era composto un mazzo per il P2;
adesso e' l'unico caso.

**I mazzi stanno nel database**, non piu' solo nella cache del browser: si
perdevano svuotando i dati del sito e non seguivano il giocatore su un altro
computer. La copia locale pero' RESTA, e non e' una ridondanza — e' quello che
permette di comporre mazzi anche scollegati e di averli pronti allo splash,
prima che ci sia una sessione. Il server e' la verita', la copia locale e' la
memoria di lavoro.

**Chi vince quando le due copie non coincidono:** la piu' recente. Ognuna porta
il momento in cui e' stata toccata. Non e' una fusione — comporre mazzi su due
computer diversi senza collegarsi fa perdere uno dei due lavori — ma fondere
due liste senza sapere cosa il giocatore volesse tenere sarebbe peggio: si
inventerebbe una risposta invece di prenderne una.

**Si scrive passando da una RPC, non dallo storage.** Un mazzo si puo'
CONTROLLARE, e i controlli che stanno nel client non contano: chi apre gli
strumenti del browser scriverebbe dodici mazzi di carte che non possiede.
`hx_mazzi_scrivi` verifica che ogni carta sia davvero sua, che i mazzi non siano
piu' di dodici, che le carte non siano piu' di dodici e che il costo stia nel
tetto di ventiquattro punti. Le carte non possedute non fanno fallire la
scrittura: **si tolgono**, perche' possono capitare in buona fede (una carta
tolta dal foglio, un mazzo importato da un codice).

**Cosa NON si controlla, di proposito:** che un mazzo sia completo. Uno appena
creato e' vuoto e il gioco lo salva com'e'. "Dodici carte" e' la regola per
SCENDERE IN CAMPO, non per esistere.

**Ordine dei passaggi, e non e' scambiabile:** i mazzi si sincronizzano DOPO che
il roster e' arrivato. Potarli vuole le carte gia' lette, altrimenti butterebbe
ogni carta di ogni mazzo.

**Le regole del mazzo sono scritte in due posti** — `MAZZI_SLOT`, `MAZZO_CARTE`,
`MAZZO_PUNTI` e `COSTO_RARITA` nel gioco, e le stesse costanti nel modulo del
server. E' voluto: il server non puo' fidarsi di quelle del client. Se cambiano
di la', vanno cambiate anche qua.

---

## Finestre e pulsanti: lo standard (dalla v0.77.34)

**La regola precedente e' superata e va dimenticata.** Fino alla v0.77.33 il
codice diceva di scrivere ogni finestra nuova con `.hx-modal-box` /
`.hx-modal-overlay` e ogni pulsante con `.start-art-btn` + `.sab-primary` /
`.sab-secondary`. Quelle sono le finestre e i pulsanti VECCHI. Il loro CSS
resta in piedi — impostazioni, menu debug, note di aggiornamento e finestra
della carta ci stanno sopra — ma **niente di nuovo si scrive cosi'**.

**Lo standard e' quello della finestra dei filtri** (Library & decks). Dalla
v0.77.34 non e' piu' legato ai soli filtri: e' nelle classi condivise
`.hx-overlay` e `.hx-box`, aggiunte agli stessi selettori di `#filters-overlay`
e `#filters-box` invece che duplicate, cosi' un ritocco all'aspetto si propaga
a tutte le finestre insieme.

```html
<div class="hx-overlay" onclick="if(event.target===this) chiudi()">
  <div class="hx-box" style="width:...">        <!-- la larghezza e' sua -->
    <div class="hx-titlebar" id="qualcosa-titlebar">
      <span class="hx-titlebar-cap hx-titlebar-left"></span>
      <div class="hx-titlebar-center"><h2>Titolo</h2></div>
      <span class="hx-titlebar-cap hx-titlebar-right"></span>
    </div>
    <div class="hx-pannello"> ...contenuto... </div>
  </div>
</div>
```

I tre pezzi della barra del titolo e la trama del pannello **non si vestono da
soli**: vanno impostati una volta sola all'apertura, come fa
`montaColonnaAccesso` (che dalla v0.77.34 veste anche la modale del nome).

**I pulsanti sono la famiglia `.hx-btn`, e le varianti sono QUATTRO:**

| Classi | Aspetto |
|---|---|
| `.hx-btn` | trasparente — il caso normale |
| `.hx-btn.hx-btn-warning` | trasparente rosso — azioni che tolgono qualcosa |
| `.hx-btn.hx-btn-opaco` | opaco |
| `.hx-btn.hx-btn-opaco.hx-btn-warning` | opaco rosso |

Il **rosso** e' cio' che distingue i due warning. Dentro ci va sempre la
striscia `.hxb-strip` a cinque pezzi (`hxb-left`, `hxb-fill`, `hxb-center`,
`hxb-fill`, `hxb-right`) piu' `.hxb-label`, e il pulsante va passato a
`vestiPulsante()`, che sceglie da solo i file `-warning`. `.hx-azione` lo rende
largo quanto il contenitore.

**Cosa NON e' stato convertito.** Le finestre e gli 83 pulsanti vecchi che
esistevano prima sono rimasti dov'erano: cambiarli tutti in un colpo e' un
lavoro grosso e visibile su mezzo gioco, e non e' stato chiesto. Quando si
tocca una di quelle schermate per altri motivi, conviene convertirla allora.

---

## Verifica prima di consegnare

**v0.73.66 — non e' piu' obbligatorio passare da `test/`** (vedi sopra): si
lavora sull'HTML e si consegna, senza scrivere ne' lanciare prove di default.

Resta vero pero' che `node --check` non basta: controlla la sintassi, non
l'esecuzione. Un `const` usato prima della sua riga di dichiarazione (temporal
dead zone) passa il check ma manda in errore l'intero script al caricamento, e
in quel caso **nessun pulsante del gioco funziona piu'** — e' gia' successo
con `CARD_DB_GEMMA_RARITA` in v0.72.81. Vale quindi la pena, prima di
consegnare una modifica che tocca dichiarazioni in cima al file o l'ordine
delle `const` di alto livello, controllare a occhio quella riga — e' li' che
questo genere di guasto nasce, non nella logica dell'abilita' in se'.

Se Lorenzo chiede di lanciare le prove, si usa `node tutti.js` dentro `test/`
(vedi sopra): la prova `vivo.js` copre proprio il caso della temporal dead
zone, caricando il gioco e verificando che le funzioni chiave esistano ancora.

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


---

## L'applicazione desktop (`desktop/`)

Electron, Windows per ora, Mac quando servira'. Vedi `desktop/LEGGIMI.md` per
i comandi.

**L'idea:** il guscio non contiene il gioco, lo APRE. Il gioco e' il documento,
il guscio e' il lettore. Il lettore cambia quasi mai; il documento cambia dieci
volte al giorno ed e' un file solo.

Da qui i due livelli di aggiornamento:

- **il contenuto** si aggiorna a ogni avvio, scaricando da GitHub l'HTML col
  numero piu' alto. Pubblicare una versione nuova resta quello che e' sempre
  stato: caricare il file. Nessuna reinstallazione, nessuna firma.
- **il guscio** si aggiorna solo con un pacchetto nuovo, cioe' quasi mai.

Il gioco riconosce di girare dentro l'applicazione da `window.hextaleDesktop`
(esposto da `preload.js`) e li' spegne il proprio avviso "e' disponibile una
versione piu' recente", che manderebbe a scaricare un HTML in una cartella
qualunque.

**Cosa cambierebbe se un giorno il gioco girasse SOLO dentro Electron:** cade
il vincolo `file://`, quindi `fetch()` torna a funzionare e tutta la macchina
JSONP (`_foglioViaScript`, `_githubJsonp`) diventa superflua, insieme alla
ripresa dell'audio al primo gesto. Finche' Lorenzo apre anche l'HTML col
doppio clic, tutto questo resta necessario.

---

## Il menu principale

E' una pagina del gestore (`PAGE_ELEMENT_IDS.mainmenu`), si raggiunge dal
"Login" della schermata iniziale.

**Tutte le misure stanno in un blocco solo**, in cima alle regole di
`#main-menu`, come variabili CSS con nomi in italiano (`--libro-larghezza`,
`--banner-x`, `--griglia-y`, `--segna-store-x`...). Sono percentuali **del
libro**, non dello schermo, cosi' cambiare la misura del libro non scompagina
niente. **Quando Lorenzo chiede di spostare qualcosa, si cambia una variabile
li' dentro** — non si aggiungono regole nuove sparse.

Due cose da sapere:

- Il gruppo `#mm-book-rot` e' ruotato di 3 gradi e ha i click SPENTI; chi sta
  dentro se li riprende con `.mm-clic`. Quella classe fa SOLO questo: quando
  azzerava anche `font` e `background` cancellava la grafica dei pulsanti veri
  (v0.73.55). Chi ha bisogno di un `<button>` spogliato usa `.mm-nudo`.
- I segnalibri sono una finestrella ferma con `overflow:hidden` dentro cui
  scorre il disegno: e' il taglio a farli leggere come "si sfilano dalle
  pagine" invece che "si staccano dal libro". `--sotto` (quanto disegno resta
  nascosto) deve restare maggiore di `--sfilo` (quanto esce), o all'uscita
  ricompare il bordo destro. La larghezza della finestrella la detta
  l'immagine stessa (`adattaSegnalibroAlDisegno`), non un numero copiato.

**La musica dei menu e' una sola e non ricomincia mai.** Schermata iniziale,
menu, Collezione e Book Packs condividono lo stesso brano: `musicaMenuAvvia()`
non fa niente se sta gia' suonando, e a spegnerlo e' solo chi sa dove si sta
andando (`tornaAllaPaginaChiamante`, `startGame`). Aggiungendo una pagina di
menu nuova basta chiamare `musicaMenuAvvia()` entrandoci.

**Le finestre si chiudono tutte** con la X in alto a destra e con un click
fuori. C'e' una prova che le verifica tutte insieme (`menu.js`), cosi' una
finestra nuova senza via d'uscita non passa inosservata.

---

## Un dato non appartiene a una schermata

Regola generale, imparata due volte in un giorno.

I tre volumi nascevano dentro `startGame`. Finche' le impostazioni si aprivano
solo durante una partita tornava; dal menu principale no, e i cursori
restavano a zero senza rispondere. Il rimedio non e' stata la chiamata in piu':
e' che il volume e' del GIOCO, non della partita.

Stessa forma: `_daFileLocale`, la risoluzione locale-prima-di-remoto degli
asset, la definizione di "carta che si ottiene" (`carteGiocabili`, usata da
mazzi, bustine e Collezione). Quando un dato serve a due schermate, non deve
vivere in nessuna delle due.
