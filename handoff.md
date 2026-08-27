# Hextale — handoff di sessione

Nota per chi riprende il lavoro (umano o assistente). Il file HTML resta
la fonte di verita' piu' aggiornata: i suoi commenti interni descrivono il
perche' di ogni scelta. Questo documento raccoglie le regole di processo e le
informazioni che non stanno dentro al codice.

---

## Dove si trova cosa

Tutto vive in `game-assets/`, che e' anche il repository GitHub
(`TheTrickmaster/hextale`, pubblicato su `thetrickmaster.github.io/hextale/`).

| Cosa | Dove |
|---|---|
| Il gioco | `Hextale_<versione>.html` — un unico file, ~26.000 righe |
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

Il database delle carte NON e' nel repository: sta su un Google Sheet
(foglio `Cards DB`), letto a ogni avvio. La copia interna nell'HTML e' solo un
ripiego per quando il foglio non risponde, ed e' vecchia.

**Come si consegna una versione.** Si rinomina il file col numero nuovo, si
aggiorna il badge `#build-version-badge`, si scrive il blocco in
`patch-notes.txt`, e Lorenzo carica entrambi su GitHub. Il numero di versione
sta in DUE posti che devono combaciare: il nome del file e il badge. Se
esiste anche `desktop/package.json`, il suo `version` va allineato.

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

Il server e' un **Nakama** (Heroic Labs) su una macchina nostra:
`45.59.124.211`, porta **7350** per il gioco. Gira in Docker insieme a un
Postgres; la configurazione sta sul server in `/opt/nakama/`. La console di
amministrazione (porta 7351) e Postgres (5432) **non sono esposti a internet**:
ci si arriva con un tunnel SSH, `ssh -L 7351:127.0.0.1:7351 root@45.59.124.211`.

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

**TRAPPOLA GROSSA — https non puo' chiamare http.** La versione su GitHub
Pages e' servita in `https`, il server Nakama risponde in `http` sulla 7350: il
browser blocca la chiamata come *mixed content* e non parte nemmeno. Verificato
sul sito pubblicato, non dedotto: `Mixed Content: ... has been blocked`.
Conseguenza pratica: **dalla versione web nessun accesso funziona** — ne'
Google ne' email — finche' Nakama non sta dietro a un dominio con TLS. Da
`file://` invece funziona tutto, perche' li' la regola del mixed content non si
applica. E' il motivo per cui il TLS non e' piu' una rifinitura: e' il
prerequisito della versione web.

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
