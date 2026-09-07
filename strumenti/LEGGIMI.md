# Guardare un difetto che si vede solo in movimento

Un'animazione che "sembra sbagliata" non si diagnostica a parole: si guarda
fotogramma per fotogramma. Questi due strumenti lo fanno partendo da una
registrazione dello schermo, e non serve installare niente — usano Electron,
che c'e' gia' per l'importazione delle carte.

    ELECTRON=desktop/node_modules/electron/dist/electron.exe

## provino.js — tanti fotogrammi in un'immagine sola

    $ELECTRON strumenti/provino.js <video> <uscita.png> <da> <a> <passo> [x y larg alt]

I tempi sono in secondi. Gli ultimi quattro ritagliano una finestra: un colpo
occupa una parte piccola dello schermo, e guardarlo a tutta pagina vuol dire
sprecare pixel su cose ferme.

    # dove succede qualcosa, a passi di un decimo
    $ELECTRON strumenti/provino.js reg.mp4 largo.png 3 5 0.1 600 150 900 750

    # e poi il dettaglio, un fotogramma ogni 20 millisecondi
    $ELECTRON strumenti/provino.js reg.mp4 colpo.png 5.2 5.8 0.02 690 150 400 300

## fotogrammi.js — i singoli fotogrammi, uno per file

    $ELECTRON strumenti/fotogrammi.js <video> <cartella> [da] [a] [passo]

Senza tempi stampa solo durata e dimensioni, per capire dove guardare.

## Cosa ha trovato, la prima volta

Il "doppio colpo" dell'attacco (v0.77.97). A parole sembrava un rimbalzo
ripetuto; a 20ms per fotogramma si e' visto che erano due LAMPI BIANCHI sulla
stessa carta a 110 millisecondi di distanza — la scia del colpo che arrivava
sul bersaglio prima del colpo. Nessuna quantita' di lettura del codice ci era
arrivata: il difetto stava nei numeri di tre animazioni messe insieme, e quei
tre numeri sono giusti ciascuno per conto suo.

# Quelli che non guardano un video: aprono il gioco e lo misurano

I tre qui sotto caricano `play/index.html` in Electron a finestra nascosta e
interrogano la pagina vera — foglio di stile vero, funzioni vere. Servono
quando la domanda e' "quanto e' largo davvero" o "questa funzione, chiamata
cosi', cosa risponde": leggere il codice non basta, perche' la risposta la da'
il browser.

Due cose da sapere, imparate a caro prezzo su questi stessi banchi:

- **`getBoundingClientRect` non misura il foglio.** Il gioco vive dentro a un
  riquadro 1920x1080 che viene scalato per stare nella finestra, e quel
  rettangolo e' gia' moltiplicato per la scala. Per i numeri del foglio si usa
  `offsetWidth` / `offsetLeft`.
- **A finestra nascosta le transizioni non avanzano.** Un valore che ci arriva
  con una transizione resta al primo fotogramma per sempre, per quanto si
  aspetti. Si spegne la transizione a mano (`style.transition='none'`, oppure
  l'interruttore che il gioco ha gia' — `data-tilt="1"`) e si misura.
- **`G` e' una costante del documento**: `window.G = ...` non la sostituisce.
  Per dare un tabellone finto a una funzione si scrive DENTRO a `G` e si
  rimettono a posto i campi alla fine.

## misura-pulsanti.js — la larghezza di ogni pulsante del gioco

    $ELECTRON strumenti/misura-pulsanti.js <nome-dello-scatto>

Apre ogni finestra una per volta, accende cio' che e' nascosto, e misura tutti
i `.hx-btn`: larghezza e posizione, salvate in `misura-<nome>.json`. Elenca
quelli sopra i 400px, che dalla v0.79.16 devono essere zero. Due scatti si
confrontano fra loro — e' cosi' che si e' visto che il tetto dei 400 non
spostava in verticale nessuno dei 41.

## prova-nastro-sbusto.js — il nastro "New" segue la carta?

Costruisce la stessa impalcatura della pagina dello sbusto in due copie, con la
sistemazione vecchia e quella nuova fianco a fianco, inclina e ingrandisce, e
confronta. Il confronto E' la prova: senza la copia vecchia, "il nastro si e'
mosso di 1.4px" non vorrebbe dire niente.

## prova-king-louie.js — l'abilita' chiede il bersaglio, e copia?

Tabellone costruito a mano attorno a King Louie (un'alleata, un'avversaria, una
senza tratti, una lontana) e poi si chiamano `sceltaDalFoglio` e la sua
`applica`. Controlla anche il furto di Rumpelstiltskin, che e' l'altra meta'
della stessa faccenda: i tratti stanno in due elenchi paralleli e chi ne cambia
uno solo fa una carta che mostra quel che non ha, o ha quel che non mostra.

## prova-scelte.js — chi deve chiedere un bersaglio, lo chiede?

Il foglio ha una colonna "Player selection". Quando dice yes, calare quella
carta deve fermare il turno e aprire una finestra. Quando non succede, da fuori
e' identico a un'abilita' che non esiste. Il banco le prova tutte su un
tabellone apparecchiato apposta.

**Le porte sono tre, non una**, e sbagliarla fa sembrare muta una carta che
parla benissimo — ci sono cascato scrivendo questo banco:

    on_play     SCELTE_PIAZZAMENTO, e in mancanza sceltaDalFoglio
    on_conquer  SCELTE_DOPO_CONQUISTA (vuole sapere cosa e' stato conquistato)
    on_moved    avvisaCartaSpostata, che apre da se' la sua finestra

## prova-jack.js — due finestre in fila

"Sposta un alleato ovunque" sono due domande, e due finestre in fila sono il
punto in cui e' piu' facile lasciare il turno fermo per sempre: basta che la
seconda non si apra, o che la continuazione della prima non arrivi in fondo.
Il banco controlla anche che il turno riprenda UNA volta sola.

## prova-attribuzione.js — se un numero cambia, chi e' stato?

Fa scattare una per una tutte le abilita' del foglio che cambiano un valore e
legge il riquadro "Buffs/debuffs" che ne esce, cercando righe senza un nome.
Le righe vengono da tre posti (lo scarto dai valori stampati, le sinergie
chieste al motore, il registro `card.modificatori`) e solo gli ultimi due hanno
un nome sopra: quando tacciono resta il totale muto.

## controlla-asset.js — quali file non li usa piu' nessuno

    node strumenti/controlla-asset.js            l'elenco
    node strumenti/controlla-asset.js --tutti    anche chi e' usato, e come

Sembra un lavoro da `grep` e non lo e', per due ragioni che si scoprono
sbagliando: meta' degli asset non compare MAI per intero (il nome viene
composto — `'archetype-icon-' + tratto + '-' + variante + '.png'`), e due file
diversi hanno spesso lo STESSO nome in due cartelle diverse (`right-button.png`
stava in `ui/` e in `player-ui/`, `glow.png` in `main-menu/` e in
`loading-screen/`). Cercare il nome e basta salva dei morti e condanna dei vivi.
E' proprio guardando questi doppioni che si e' visto che tre cartelle
d'interfaccia erano due di troppo: dalla v0.79.20 ce n'e' una sola, `ui/`.

Quindi la domanda che fa e' un'altra: **questo nome compare insieme alla sua
cartella?** Ogni cartella ha il suo modo di essere nominata — una costante
(`MENU_BASE`), una funzione (`uiFileCandidati`), o il percorso per esteso — e
l'elenco sta in cima al programma. Il giorno in cui nasce una cartella nuova,
va aggiunta li' o i suoi file risulteranno tutti orfani.

**Il programma segnala e non cancella**, e con questi file e' la differenza fra
un ripostiglio e un disastro: la cartella del gioco E' il sito, quindi spostare
un asset ancora in uso lo rompe per tutti, subito. L'elenco che esce e' un punto
di partenza da verificare a mano, cartella per cartella — vedi `_old/LEGGIMI.md`
per come e' andata la prima volta.

## prova-lettera.js — la scelta del mazzo iniziale

    $ELECTRON strumenti/prova-lettera.js [scatto.png]

"Pick a letter" si vede UNA volta sola per account, e questo la rende la
schermata piu' difficile da riprovare a mano: sbagliarla vuol dire sbagliarla
per tutti quelli che si registreranno, e accorgersene per caso mesi dopo
guardando un account nuovo. Qui si apre a comando — con un server finto che
risponde come quello vero — si sceglie, e si guarda cosa succede.

Il controllo che conta piu' di tutti e' **quale lettera da' quale mazzo**
(sinistra 1, centro 3, destra 2): e' una corrispondenza decisa da Lorenzo e
senza una regola dietro, quindi non c'e' niente nel codice che possa
smentirla se un giorno si scambia.

Con un nome di file come argomento fa anche due fotografie: la schermata come
si apre e come resta dopo la scelta. Per fotografarla va tolto il velo di
apertura (`#splash`), che sta sopra a tutto finche' il gioco non ha finito di
caricare.

## prova-404.js — la pagina che non c'e'

    $ELECTRON strumenti/prova-404.js [scatto.png]
    HX_SCHERMO=390x844 $ELECTRON strumenti/prova-404.js [scatto.png]

Il rischio vero di una 404 non e' come sta in piedi: e' che venga servita
**sotto l'indirizzo sbagliato che l'ha chiamata**. Chi finisce su
`/play/roba/che/non/esiste` vede quella pagina, ma la barra dice ancora quello,
e un percorso relativo andrebbe a cercare i font dentro a una cartella
immaginaria. La pagina arriverebbe nuda proprio nel momento in cui il
visitatore si e' gia' perso una volta — ed e' un guasto che aprendo il file a
mano non si vede MAI, perche' aprendolo a mano l'indirizzo e' giusto.

Per questo il banco non apre il file: tira su un server sulla radice del sito,
serve `404.html` con lo stato 404 come fa GitHub Pages, e chiede la pagina da
un indirizzo che non esiste. Poi conta le richieste che il server ha visto
arrivare: se una risorsa fosse cercata nel posto sbagliato, il server la
vedrebbe passare sotto `/play/roba/che/...` e la segnalerebbe.

Il resto sono le misure che Lorenzo ha dettato — tre stacchi da cento, uno da
sedici, i corpi e i colori — lette **sullo schermo** e non nel CSS: un margine
dichiarato puo' essere schiacciato da un altro margine, e nessuno se ne
accorge. `HX_SCHERMO` la guarda su un telefono, dove gli stessi controlli
valgono con le cinque misure che il `@media` cala apposta.

## prova-aggiornamento.js — l'avviso "c'e' una versione nuova"

    $ELECTRON strumenti/prova-aggiornamento.js

Il 07/09/2026 il gioco ha annunciato **"A newer version is available:
404.html"**. Non era colpa di quel file: era che per il controllo bastava
essere un `.html` in radice per essere una versione, e in radice di `.html`
non ce n'era nessuno. **Taceva perche' guardava uno scaffale vuoto**, non
perche' fosse d'accordo — e il primo oggetto appoggiato li' e' diventato
"l'ultima versione". Un filtro che non ha mai niente da filtrare non e'
provato: e' solo inattivo.

Un guasto cosi' non si riprova a mano, perche' dipende da cosa c'e' nel
repository: per rivederlo bisognerebbe metterci davvero un file sbagliato e
aspettare. Qui la risposta di GitHub si finge — un elenco di file inventato —
e si guarda cosa il gioco decide di dire.

I due controlli che contano tirano in versi opposti, ed e' voluto: **la 404 non
dev'essere scambiata per una versione**, ma **una versione vera e piu' nuova
dev'essere ancora annunciata**. Senza il secondo, il modo piu' facile di far
passare il primo sarebbe spegnere l'avviso — e un controllo che tace sempre
sembra un controllo che funziona.

## prova-punti.js — i punti si contano ancora come prima

    $ELECTRON strumenti/prova-punti.js

Nato nella v0.79.28, togliendo le bolle di danno: 541 righe da rimuovere in un
file da 44.000, tutte intrecciate col punteggio, e il punteggio era la sola
cosa che non doveva cambiare. Le due regole sono quelle dette da Lorenzo — i
punti per la **differenza** fra attaccante e difensore, e **un punto per ogni
carta propria in campo** a ogni fine turno.

Si guarda il **calcolo**, non il punteggio a schermo. `G.hp` lo scrive la bolla
in fondo alla sua animazione, e in una finestra nascosta le animazioni non
arrivano mai in fondo: aspettare quel numero misurerebbe se l'animazione gira,
non se il conto e' giusto. Il banco intercetta invece le due porte da cui i
punti passano — `assegnaPunti` e `incrementaBollaPunti` — e guarda con che
numeri vengono chiamate.

La seconda meta' del banco e' un elenco di funzioni che **non devono esistere**
(`createDamageBubbleVisual`, `spawnDamageProjectile`, e le altre otto). Se una
torna a esistere, e' tornato anche il disegno che chiedeva, e quei file Lorenzo
li ha cancellati.

## prova-menu-carte.js — il pallino, il gap, la specular

    $ELECTRON strumenti/prova-menu-carte.js [scatto.png]

Tre guasti della v0.79.28 che hanno in comune il modo di rompersi: **una regola
CSS che ne cancella un'altra senza che si veda**, o **un dato preso al livello
sbagliato**. Nessuno dei tre da' errore — si vedono soltanto, e solo se si sta
guardando quel pezzo di schermo.

- Le due righe di "Card packs" erano scritte a `gap:0` e disegnate a 10: piu'
  avanti nel foglio `.hx-btn .hxb-label{ gap:10px }` vale piu' di una classe
  sola. Il banco legge il valore **calcolato**, che e' l'unico che si vede.
- Il pallino delle novita' stava dentro all'etichetta e la allargava, spingendo
  la scritta a sinistra. Il controllo misura il **nodo di testo** con un Range,
  non il riquadro dell'etichetta: con il pallino dentro, l'etichetta restava
  centrata lo stesso — era larga testo piu' pallino — e misurarla avrebbe detto
  "centrato" proprio nel caso rotto.
- La specular map non compariva mai nella carta a tutto schermo: il disegno
  seguiva il selettore dei livelli, la lucentezza chiedeva il livello **vero**
  della carta. Il banco costruisce una carta di livello 1 e la guarda ai quattro
  livelli del selettore, che e' esattamente il gesto che la rompeva.

## prova-capacita.js — l'IA gioca con un mazzo che costa quanto il tuo

    $ELECTRON strumenti/prova-capacita.js

La **capacita'** di un mazzo e' la somma dei costi di rarita' — timeless 4,
mythic 3, rare 2, common 1 — e il gioco te ne concede ventiquattro. Fino alla
v0.79.29 l'IA li spendeva **tutti a ogni partita**: `composizioniMazzo()`
conosceva un solo numero, `MAZZO_PUNTI`, quindi tutte e diciannove le
composizioni ammesse costavano ventiquattro. Contro un mazzo iniziale da dodici
punti l'IA scendeva in campo con dodici rare.

Il pareggio che gia' c'era guardava la **potenza**, cioe' i valori sui lati — e
la potenza **non vede le abilita'**, che sono quasi tutta la differenza fra una
common e una rare. Due mazzi possono avere la stessa somma di numeri e non
essere per niente la stessa partita: e' per questo che la capacita' va
pareggiata per conto suo, e prima delle altre due, perche' e' un vincolo e non
una preferenza — decide di quali carte l'IA puo' disporre.

Il roster del file aperto da solo ha **quattro carte**: non basta per generare
niente, e un banco che generasse mazzi da quattro carte direbbe sempre di si'.
Qui si carica il catalogo vero (107 carte, tutte e quattro le rarita'), lo
stesso da cui il server importa.

Il banco gira anche sul codice **di prima** — la costante nuova ha un ripiego
apposta — e li' fallisce undici controlli su diciotto. E' quella la prova: un
banco che non sa fallire non sta misurando niente.

## prova-meta-abilita.js — quando un'abilita' e' fatta di due meta'

    $ELECTRON strumenti/prova-meta-abilita.js

Il foglio puo' scrivere due effetti su una riga sola, legati da "and". Certe
coppie sono **miste**: una meta' il motore la calcola (e' un numero), l'altra
no — perche' la sceglie il giocatore, o perche' non e' un numero affatto.

`motoreFaLEvento` risponde con una **E**: "sai fare TUTTA la riga?". E' la
domanda giusta, ma la risposta veniva usata come un interruttore — no, e allora
il motore non faceva **niente**, nemmeno la meta' che sapeva fare.

Nel catalogo le carte cosi' sono due, e vanno nei versi opposti:

| carta | momento | prima meta' | seconda meta' |
|---|---|---|---|
| Little Mermaid | `on_play` | scarto **scelto** | buff +2 ALL |
| The Walrus | `on_moved` | buff +2 ALL | spostamento **scelto** |

Il Tricheco aveva gia' la cura, scritta dentro ad `avvisaCartaSpostata`; la
Sirenetta no, e scendeva in campo senza il suo +2 mentre il testo che il
giocatore legge sulla carta glielo prometteva. Dalla v0.79.30 la cura e' una
funzione sola (`applicaLeMetaSemplici`) e la usano tutte e due — per questo il
banco le guarda **insieme**: separarle vorrebbe dire poter aggiustare una e
rompere l'altra senza accorgersene.

Due cose imparate scrivendolo, che valgono per i prossimi banchi:

- **Una carta nuova a ogni prova.** `cambiamentiAllEvento` segna lo scatto
  `once_per_game` sulla carta: riusare la stessa vuol dire chiederle due volte
  una cosa che sa fare una volta sola, leggere "non fa niente" e credere di
  aver trovato un guasto. Ci sono cascato mentre lo scrivevo.
- **Un controllo che non esercita niente dice sempre di si'.** L'ultimo
  controllo — "nessuna carta prende il buff due volte" — cercava le righe in
  `FINAL_CARDS`, che nel file aperto da solo ne ha quattro: guardava zero carte
  e passava. Adesso conta quante ne ha guardate, e quel conto e' un controllo
  suo.
