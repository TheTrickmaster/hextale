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

Dalla v0.79.60 la scena dopo la scelta e' un'altra: il riquadro e il titolo
RESTANO (il titolo dice "New deck!"), la colonna della lettera scivola a
sinistra e a destra si apre la galleria delle carte del mazzo — tre per riga,
larghe 300, a trenta pixel l'una dall'altra, alta fin sul bordo del riquadro e
da scorrere con la rotella senza barra. Il banco misura tutto questo in pixel,
e controlla che a "Collect" a salire sia il riquadro intero, non la colonna
sola. Le carte sono quelle di `carteDelMazzo`, disegnate intere con
`buildFullHandCardSVG`: la casella che le contiene DEVE essere posizionata,
perche' quell'SVG arriva con la classe della mano, che e' assoluta e riempie il
primo antenato posizionato — senza, delle dodici se ne vedeva una sola, larga
quanto tutto il riquadro.

## prova-disclaimer.js — il disclaimer del prototipo

    $ELECTRON strumenti/prova-disclaimer.js [scatto.png]

Si vede UNA volta sola per account, appena firmato l'accordo, e questo lo rende
difficile da riprovare a mano quanto "Pick a letter": per rivederlo servirebbe
un account nuovo ogni volta.

Il controllo che conta piu' di tutti non e' come sta in piedi, e' la **catena**.
Questa finestra non ha una memoria sua — sta attaccata all'accettazione
dell'accordo, che avviene una volta per account — e chi la chiude deve far
proseguire chi stava andando al menu. Se quel filo si spezza, chi firma resta
davanti a un velo scuro e non entra piu': un guasto che colpisce **solo chi si
registra**, cioe' nessuno di quelli che provano il gioco tutti i giorni. Il
banco firma con un server finto, controlla che al menu non ci si vada ancora, e
che ci si vada premendo "Got it!" — una volta sola, anche premendolo due volte.

Poi la forma: le due colonne devono avere il fondo, il bordo, gli angoli e la
trama di quelle della lettera, ma **non** la tinta colorata (li' i tre colori
distinguevano tre lettere fra cui scegliere, qui non c'e' niente da scegliere);
le icone larghe cento e centrate; il pulsante FUORI dal riquadro e in mezzo.

**Due trappole imparate scrivendolo.** La finestra va mostrata — anche fuori
dallo schermo — e con `backgroundThrottling` spento: una finestra considerata
coperta non fa avanzare le TRANSIZIONI CSS, e le finestre del gioco compaiono in
dissolvenza (`--hx-dissolvenza`), quindi restano a opacita' zero. Sono
misurabili in ogni loro parte e **nere in fotografia**, che e' il modo piu'
rapido per credere di aver sbagliato il markup. E il velo di apertura si toglie
con una REGOLA (`insertCSS`), non con uno stile in linea: la sequenza di
caricamento se lo rimette addosso da sola.

## prova-esc.js — Esc chiude la finestra piu' in alto

    $ELECTRON strumenti/prova-esc.js

Dalla v0.79.72 Esc non chiude: fa quello che farebbe un clic sul **velo** della
finestra piu' in alto. Prima era una CATENA di cinque casi scritti a mano, e
ogni finestra nuova nasceva fuori dall'elenco — cioe' senza Esc — finche'
qualcuno non se ne accorgeva.

Il bello e' cio' che non serve dire: una finestra che si puo' gia' lasciare
cliccando fuori si lascia anche con Esc, da subito e senza aggiungersi a nessuna
lista. E una che NON si puo' lasciare — l'accordo, la scelta della lettera, il
blocco del client vecchio — non ha quel gestore, quindi Esc non fa niente: la
regola "di qui si passa decidendo" resta scritta in un posto solo.

Proprio per questo il difetto e' silenzioso **in tutte e due le direzioni**, ed
e' quello che il banco guarda: una finestra che dovrebbe chiudersi e non si
chiude (chi ci prova pensa di aver sbagliato tasto), e una che non deve chiudersi
e si chiude (tre porte che diventano tre porte che si tolgono di mezzo).
Undici finestre da una parte, cinque dall'altra, aperte per davvero e con Esc
premuto per davvero. Piu' due regole di convivenza: se ne chiude **una** per
volta, la piu' in alto (un mazzo aperto sotto l'ingrandimento di una carta non
deve chiudersi anche lui), e finche' si sceglie il nome Esc non tocca nemmeno
cio' che sta sotto.

Due delle undici vivono dentro alla Collezione, e le pagine sono ermetiche: il
banco monta quella pagina, o direbbero "non si chiude" per il motivo sbagliato.

## prova-report.js — segnalare un giocatore

    $ELECTRON strumenti/prova-report.js [scatto.png]

Un pulsante speculare a quello delle impostazioni, e una finestra che manda
un'email a una casella che qualcuno legge davvero. Il banco tiene ferme due
cose di natura diversa.

**La forma.** "Speculare" e' una parola, e qui diventa una misura: stessa
grandezza, stessa altezza dal bordo, e la distanza da destra uguale a quella da
sinistra dell'altro. Due pulsanti quasi speculari non sembrano un errore,
sembrano una svista di chi guarda.

**La sostanza, e conta di piu'.** Il client NON manda il nome dell'accusato:
manda l'identificativo del TAVOLO, e chi ci fosse seduto lo dice il server dal
registro scritto a inizio partita (`COLL_PARTITE`). Se il nome lo dicesse il
client, chiunque potrebbe accusare chiunque senza averlo mai incontrato — e
sarebbe una segnalazione che arriva a una persona vera, con dentro un nome
vero. Il banco guarda **cosa parte**, non cosa la finestra mostra: il nome
dell'avversario compare nel testo della finestra e non deve comparire nel
messaggio.

Poi le due cose che si rompono in silenzio: il pulsante si accende **solo in
rete** (contro la macchina non c'e' nessuno da segnalare, e una finestra per
accusare un avversario che non esiste manda posta a vuoto), e il modulo vuoto
non parte, dicendo cosa manca.

Una trappola imparata scrivendolo: il disegno del pulsante lo mette
`montaGraficaPartita`, che gira dentro a `initGame`. Chiederglielo prima di
una partita dice che manca il file quando manca solo il momento.

## prova-spazi.js — il testo delle abilita', parola per parola

    $ELECTRON strumenti/prova-spazi.js

Il Cowardly Lion recitava **"When Played , Inflicts -1 RAND to itself"** — uno
spazio fra "Played" e la virgola. Nel foglio la virgola e' attaccata: a metterlo
era il gioco.

**Perche' succedeva**, ed e' il genere di cosa che nessuno riprova a mano su
centoundici carte. Per andare a capo il testo va spezzato in parole, e lo si
faceva con `split(/\s+/)`, che gli spazi li **butta**. Da li' in poi nessuno
sapeva piu' dove fossero, e chi disegna ne rimetteva uno fra ogni parola e la
successiva. Con un grassetto seguito da punteggiatura, la punteggiatura diventa
una parola per conto suo e si prende il suo spazio davanti. Adesso ogni parola
porta con se' `spazioPrima`, che e' l'unica cosa che serve per rimetterla dov'era.

**L'invariante che il banco chiede** e' secco: il testo DISEGNATO, rimesso
insieme, dev'essere esattamente il testo del FOGLIO senza i marcatori. Non
"simile": uguale. E lo chiede per ogni abilita' del catalogo, a due larghezze —
una che sta su una riga sola e una che manda a capo spesso, perche' l'andata a
capo e' proprio il posto in cui uno spazio si puo' perdere o guadagnare. E' cosi'
che si sa che non c'era una seconda carta con lo stesso difetto.

Prende anche il difetto opposto, che nessuno avrebbe cercato: due parole di
stile diverso rimaste **attaccate** perche' lo spazio non e' stato messo.

## prova-targhetta.js — cosa succede premendo il numero di versione

    $ELECTRON strumenti/prova-targhetta.js

Dalla v0.79.68 la targhetta fa una cosa per uno: agli admin il menu di debug, a
tutti gli altri le note di rilascio. E' un bivio che si puo' sbagliare in due
modi opposti, e **nessuno dei due si vede provando il gioco da admin**:

- un giocatore preme e non succede niente (com'era prima: la targhetta era
  spenta per chi non e' admin, cioe' per tutti);
- un giocatore preme e si ritrova il **menu di debug**, che e' la porta che non
  deve nemmeno vedere.

Chi sviluppa e' admin, quindi la strada che prova ogni giorno e' l'unica delle
due che non si rompe in silenzio. Il banco le percorre tutte e due spostando
`GIOCATORE_ADMIN`, e controlla anche il caso in cui il permesso cambia mentre si
e' dentro: arriva dal server col profilo, e chi lo perde non deve restare col
menu aperto davanti.

## prova-quest-server.js — le regole delle quest, senza Nakama

    node strumenti/prova-quest-server.js

Il server delle quest non ha niente da guardare: e' tutta aritmetica e
calendario, e le due cose che puo' sbagliare non danno nessun errore.

**Il giorno** cambia a mezzanotte GMT. Chi lo sbaglia se ne accorge una volta
sola, di notte, e non capisce cosa sia successo.

**Il passaggio di giorno** paga da solo quel che era finito e non riscosso
(decisione di Lorenzo del 10/09/2026). Se quella riga non gira, il premio
sparisce e nessuno lo sa: chi lo aspettava pensa di essersi sbagliato.

Si carica `index.js` dentro a un contesto finto — niente Nakama, niente rete —
e si chiamano le sue funzioni con oggetti scritti a mano. E' l'unico modo di
provare un capodanno senza aspettare mezzanotte.

Un controllo vale piu' degli altri: **il testo e il campo `dove` devono dire la
stessa cosa**. La regola e' che "PvP" nel nome significa solo online e "PvIA"
solo contro la macchina, ma a leggere il nome e' il giocatore e a leggere il
campo e' il codice. Se i due discordano, il giocatore legge una promessa e il
gioco ne mantiene un'altra.

## prova-quest.js — le schede delle daily quests

**v0.79.79 — le icone non sporgono piu', ma non si sono mosse.** Sono due
cose distinte e il banco le guarda tutte e due. Le icone stanno dove Lorenzo
le aveva messe — vanno ancora oltre il bordo destro della scheda — e a
fermarle e' il ritaglio della scheda, non una posizione diversa. Chiedere
"l'icona sta dentro?" darebbe di no e avrebbe torto: la domanda giusta e'
"la scheda ritaglia?" *e* "l'icona e' ancora al suo posto?". Se un domani
sparisse l'overflow, le posizioni da sole rimetterebbero le icone fuori dal
bordo senza dire niente.

Il terzo controllo misura **quanto** si perde di ciascuna. Tagliare un'icona
e' voluto; tagliarne via meta' no, perche' a quel punto smette di leggersi
per quel che e'. La spunta e' quella che ci va piu' vicino (39%): era la piu'
sporgente delle tre, e se un domani qualcuno la spostasse ancora a destra e'
la prima che diventerebbe irriconoscibile.

    $ELECTRON strumenti/prova-quest.js [scatto.png]

Il disegno mostra **cinque** schede, ma gli stati sono **tre**: in corso,
completata, riscattata. Le cinque sono tre stati per due premi (busta e
inchiostro), e il premio non e' uno stato, e' un'icona. Il banco tenta i sei
incroci e chiede che le classi siano tre: e' la differenza fra un pannello che
regge un premio nuovo domani e uno in cui ogni premio raddoppia i casi.

Poi il vincolo che non si vede finche' non si rompe: **cinque schede devono
starci**. Il riquadro e' alto quanto la colonna di sinistra (regola della
v0.79.69) e non puo' crescere; cinque schede da 55 con quattro di stacco sono
315 pixel esatti. Bastano tre pixel di bordo contati male perche' la quinta
finisca sotto il bordo, e nessuno se ne accorge: una lista che scorre di poco
sembra una lista che sta dentro. E' successo davvero — il primo giro aveva le
schede a 63 invece che a 55, perche' il gap fra titolo e barra e' 4 e non 8
(l'8 e' il gap fra la colonna del testo e l'icona).

Gli altri: la barra dice la frazione giusta, chi ha fatto piu' del dovuto legge
il traguardo e non un numero storto ("4/3"), il contatore in cima conta le
**riscosse** e non le completate (una completata che aspetta e' ancora una cosa
da fare), e il pulsante si accende solo quando c'e' qualcosa da riscuotere.

Una trappola: l'indirizzo dell'icona si legge **dopo un respiro**.
`impostaImgDaCandidati` prova gli indirizzi uno per uno e scrive il `src` quando
trova quello buono; letto nello stesso istante e' vuoto, e il banco direbbe che
manca l'immagine quando manca solo il tempo.

## prova-menu-sx.js — le due colonne del menu, e la fine partita

    $ELECTRON strumenti/prova-menu-sx.js [scatto.png]

Dalla v0.79.67 il riquadro dello Shop non ha piu' un'illustrazione sua e
dev'essere **identico** a quello del Donate. "Identico" e' la parola che questo
banco traduce in numeri: stessa altezza, stessa larghezza, stesso fondo, stesso
bordo, stessi angoli, stesso padding, stessa trama, stesso modo di tenere dentro
il pulsante.

Serve un banco per una cosa che si vede a occhio perche' **due riquadri quasi
uguali sono peggio di due riquadri diversi**: nessuno sa dire cos'e' che non va,
e il difetto sopravvive a tutti quelli che ci passano davanti. Il fondo poi e'
un gradiente, e due gradienti diversi di un soffio si vedono solo mettendoli uno
accanto all'altro — cosa che a schermo non succede mai, perche' i due riquadri
sono separati da venti pixel di menu.

L'altra meta' del banco e' che il PULSANTE non sia cambiato: resta la sua veste
(`hx-btn-shop`, i suoi cinque pezzi e non quelli di un altro) e resta spento al
30%, perche' quel che non si puo' ancora fare e' comprare, non guardare il
riquadro.

## prova-muri.js — cinque muri, e mai due uguali

    $ELECTRON strumenti/prova-muri.js

Le caselle bloccate di una partita sono da due a cinque e le varianti sono
cinque: dentro a una partita due muri uguali non si devono vedere **mai**. Non
e' un caso fortunato — `assegnaMuriDellaPartita` pesca da un mazzo mescolato e
non rimette in gioco niente finche' il mazzo non e' finito — ma e' esattamente
il genere di regola che si rompe in silenzio: due muri uguali su un tabellone
non sembrano un guasto, sembrano una coincidenza. Il banco tira milleduecento
partite finte e conta i doppioni.

Poi che i cinque file **esistano**. Dalla v0.79.65 si chiamano `tile-blocked-N`
(erano `tile-broken-N`), e un indirizzo sbagliato non da' nessun errore che si
veda giocando: la casella resta vuota e il tabellone sembra disegnato male
invece che rotto. Il banco li chiede al sito, uno per uno.

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

## prova-note-apertura.js — quando le note si aprono da sole

    $ELECTRON strumenti/prova-note-apertura.js

Regola di Lorenzo (10/09/2026): da sole si aprono solo a chi TORNA, e solo se
c'e' qualcosa di nuovo. Chi entra per la prima volta non se le trova davanti —
non ha nessun "da quando manchi" da farsi raccontare.

Sono quattro casi, e uno non si vede mai giocando: le preferenze (dove sta
scritto cosa si e' gia' letto) arrivano col profilo, e possono arrivare **dopo**
che il menu si e' aperto. In quell'istante "non ho mai letto niente" e "non lo
so ancora" si somigliano, e portano a due gesti opposti: il primo dice "segna e
taci", il secondo "taci e non segnare". Confonderli vuol dire segnare come letto
un aggiornamento che nessuno ha visto — e quello e' perso **per sempre**, perche'
il segno resta sul server.

Il banco non guarda la finestra: guarda la DECISIONE, caso per caso, e annota
anche cosa viene SEGNATO come letto, che e' meta' della decisione e a schermo
non si vede. Poi le due cose che restano vere: chieste col pulsante si aprono
comunque (e' l'unico modo di rileggerle) e non cambiano cosa risulta letto; e il
riquadro si riempie anche quando l'apertura automatica tace, o il pulsante del
menu troverebbe le note di ieri.

## prova-note.js — le note di rilascio, e nessuna richiesta a GitHub

    $ELECTRON strumenti/prova-note.js

Prende il posto di `prova-aggiornamento.js`, che provava l'avviso "c'e' una
versione nuova": quell'avviso non c'e' piu' dalla v0.79.62, e con lui la
ricerca nel repository che lo alimentava.

**Perche' e' sparito.** Cercava in radice del repository un `.html` col numero
di versione nel nome. Dalla regola del 28/08/2026 in radice un
`Hextale_*.html` non ci va piu' — stanno in `versions/`, che e' un'altra
cartella e non veniva nemmeno guardata — quindi l'elenco tornava sempre senza
candidati e la ricerca falliva **sempre**. Il pulsante "Download" del riquadro,
poi, chiamava `scaricaVersione`, che nel file non esisteva piu' da tempo.
Erano due richieste per avvio spese su una domanda che non poteva avere
risposta.

**Cosa costava.** L'API di GitHub, a chi non si autentica, concede **sessanta
richieste all'ora per indirizzo IP**. Il gioco ne spendeva cinque appena
aperto e trenta all'ora per sempre (la sorveglianza della versione, ogni due
minuti): una scheda sola arrivava a trentacinque nella prima ora. Due schede,
o un paio di ricaricamenti mentre si lavora, e il tetto era superato — e
superato il tetto GitHub risponde 403, quindi da fuori sembra semplicemente
che le note e il controllo di versione abbiano smesso di funzionare. Chi sta
dietro a un IP condiviso quelle sessanta le divide con tutti gli altri.

**Cosa prova questo banco.** Il file `patch-notes.txt` sta nella radice del
sito, quindi da `/play/` e' a un passo. Qui non si apre il file col doppio
clic: si tira su un server sulla radice del sito, perche' e' l'unico modo di
vedere che le note vengono chieste **a chi ha servito la pagina** e non a
hextalegame.com. Ogni richiesta verso GitHub viene annotata e **bloccata**: un
banco non deve spendere la quota vera di chi lo esegue, e quello che si misura
e' che di richieste non ne parta nessuna.

Il controllo che conta piu' di tutti e' proprio quello: **zero richieste a
GitHub**, all'apertura e stando aperti. Un giro da GitHub rimesso dentro per
sbaglio continuerebbe a funzionare finche' la quota regge, quindi non si
noterebbe fino al giorno in cui si rompe di nuovo.

Gli altri: che il testo arrivi leggibile (prima era base64 dentro alla
risposta dell'API e andava ricomposto a mano come UTF-8), che il riquadro si
riempia con tutte le versioni lette, che la prima voce del file sia la versione
di **questo** client — cioe' la regola per cui le note si aggiornano a ogni
versione — e che il blocco di un client rimasto indietro regga ancora, perche'
era l'unica cosa che il giro da GitHub facesse davvero.

Infine che ogni sguardo della sorveglianza sia una lettura **vera**: il sito
serve questo file con dieci minuti di cache, e senza il `?t=` la sorveglianza
— che guarda ogni due minuti — rileggerebbe cinque volte di fila la stessa
copia vecchia.

## prova-gelo.js — le due lastre di ghiaccio

    $ELECTRON strumenti/prova-gelo.js [scatto.png]

In partita si congelano due cose, e sono due mestieri diversi: una **carta in
mano** (Snow Queen, "Yo. Chill"), che vive in HTML dentro al ventaglio ed e'
inclinata, si solleva al passaggio del mouse e si rimette in fila nella mano
espansa; e un **tassello** in campo (Sherazade, "Cliffhanger"), che vive in SVG
dentro al gruppo della sua cella, cade dall'alto a inizio partita, trema quando
viene colpito e si solleva se Ali Baba lo prende.

Le due lastre rispondono percio' alle stesse tre domande, e il banco le fa a
tutte e due: **sono grandi quanto cio' che coprono** (non "circa": in pixel),
**si fondono in `hard-light`**, e **seguono** cio' che coprono quando si sposta.

La terza e' quella che nessuno controlla a mano, perche' a carta ferma non si
vede: un overlay tenuto in pari a mano sembra perfetto finche' la cosa sotto
non si muove, e si scolla al primo caso che nessuno aveva previsto. Qui il
gruppo della cella viene spostato per davvero e la carta inclinata per davvero,
e si guarda dove finisce il ghiaccio. Due trappole imparate scrivendola:
la transizione della carta va **spenta** prima di misurare (`getBoundingClientRect`
legge il fotogramma di adesso, cioe' ancora quello di partenza), e la seconda
scrittura su `transform` va messa `important`, o sostituisce l'inclinazione del
ventaglio invece di aggiungersi.

Il banco allestisce la scena con `startGame`, non montandola a pezzi: `showPage`
piu' `initGame` lascia `#app` spento — lo accende `startGame` — e il fondo del
tavolo mai posato. La mano si vede lo stesso, perche' vive fuori da `#app`, e il
tabellone resta nero: e' il modo piu' rapido per credere che sia il ghiaccio a
non funzionare mentre meta' della scena non c'e'.

Con un nome di file come argomento fa tre fotografie: la scena intera, la carta
da vicino e il tassello da vicino. Per il ritratto la carta si solleva, perche'
nel ventaglio sporge sotto al bordo dei 1080 e un ritaglio che esce dalla
finestra torna **nero** senza dire perche'.

## prova-punti.js — i punti si contano come devono

    $ELECTRON strumenti/prova-punti.js

Quaranta controlli sulle due regole del punteggio, che e' cio' che decide chi
vince. Sono quelle dette da Lorenzo: i punti per la **differenza** fra
attaccante e difensore, e le **carte proprie in campo** a ogni fine turno.

Nato nella v0.79.28, togliendo le bolle di danno: 541 righe da rimuovere in un
file da 44.000, tutte intrecciate col punteggio, e il punteggio era la sola
cosa che non doveva cambiare.

**v0.79.56 — la seconda regola e' cambiata.** Una carta in campo non vale piu'
un punto: vale AL CONTRARIO della propria rarita' — common 3, rare 2, mythic 1,
timeless 0. C'e' l'esempio di Lorenzo alla lettera: due common, una mitica e una
timeless fanno **sette**. Ed e' il genere di regola che, se sbaglia, non se ne
accorge nessuno: **un punteggio storto e' un numero plausibile**.

Si guarda il **calcolo**, non il punteggio a schermo. `G.hp` lo scrive la bolla
in fondo alla sua animazione, e in una finestra nascosta le animazioni non
arrivano mai in fondo: aspettare quel numero misurerebbe se l'animazione gira,
non se il conto e' giusto. Il banco intercetta invece le due porte da cui i
punti passano — `assegnaPunti` e `incrementaBollaPunti` — e guarda con che
numeri vengono chiamate.

**Non basta provare `puntiDiCarta`.** Quella direbbe che i numeri sono giusti
anche il giorno in cui l'onda smettesse di consegnarli, ed e' proprio il genere
di scollamento che in questo file e' gia' costato caro. Si contano gli
incrementi davvero chiesti e il totale con cui la bolla si chiude: sono le due
cose che il giocatore vede.

**Il tabellone di sole timeless e' il caso che si dimentica.** Vale zero
esattamente come uno vuoto, e come quello deve far proseguire il turno — senza
quel controllo una partita fra due mazzi di leggendarie si fermerebbe al primo
cambio di turno.

Una meta' del banco e' un elenco di funzioni che **non devono esistere**
(`createDamageBubbleVisual`, `spawnDamageProjectile`, e le altre otto). Se una
torna a esistere, e' tornato anche il disegno che chiedeva, e quei file Lorenzo
li ha cancellati.

`G` si puo' scrivere da fuori: e' un `let` di livello superiore, e quelli vivono
nell'ambiente lessicale globale, che uno script iniettato dopo vede. Si
costruisce quindi un `G.board` finto invece di giocare una partita vera.

Il server non ricalcola niente — prende il punteggio dai due racconti concordi
dei client (vedi `OP_IMPRONTA` in `server/nakama/index.js`) — quindi la regola
vive tutta nel client.

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

## prova-codice.js — il codice a sei cifre

    $ELECTRON strumenti/prova-codice.js [scatto.png]

Come "Pick a letter", si vede **una volta sola per account**, ed e' per questo
la piu' difficile da riprovare a mano: sbagliarla vuol dire sbagliarla per
tutti quelli che si registreranno, e accorgersene mesi dopo. Qui il server si
finge e si guarda cosa fa la schermata.

Il pezzo piu' facile da rompere senza accorgersene sono le **sei caselle**. Non
sono sei campi: sono **un campo diviso in sei**, e la differenza si vede solo
usandolo — si scrive e si va avanti, si cancella e si torna indietro, si
incolla il codice preso dall'email e si riempiono tutte, alla sesta cifra si
prova da solo. Ognuna di queste e' una riga che si puo' perdere in un
rimaneggiamento, e nessuna fa rumore quando sparisce.

Le misure delle caselle sono controllate contro il disegno (49x66, raggio 16,
Rosarivo 40, dieci di distanza, ombra **interna**) perche' sono le stesse
dell'email: chi arriva a questa schermata ha appena guardato quelle nella
posta, e riconoscerle e' il modo piu' corto di capire cosa gli si sta
chiedendo. Se le due divergono, il collegamento si rompe in silenzio.

Due trappole trovate scrivendolo:

- **Leggere le caselle dopo il successo le trova vuote.** Alla sesta cifra la
  schermata prova il codice da sola, e un codice giusto le svuota: aspettando
  prima di misurare, il banco leggeva sei caselle vuote e diceva "non ha
  incollato" proprio nel caso in cui aveva incollato e aveva anche funzionato.
- **La colonna dell'accesso nasce a opacita' zero** e si accende quando il
  caricamento finisce. In una finestra nascosta quel momento non arriva mai:
  senza accenderla a mano, la fotografia e' la schermata di caricamento.

## prova-dissolvenze.js — ogni finestra compare e sparisce in dissolvenza

    $ELECTRON strumenti/prova-dissolvenze.js [scatto.png]

Fino alla v0.79.33 ogni finestra appariva di colpo: `display:none` che diventa
`display:flex`, e in mezzo niente. **Non si rimediava con una transizione**:
`display` non e' un numero, e fra "non c'e'" e "c'e'" non esistono valori in
mezzo. In chiusura era anche peggio — `display:none` fa sparire l'elemento
nell'istante stesso, e non resta niente da dissolvere.

Il banco **non prova le finestre che conosce: le cerca** (`[id$="-overlay"]`
piu' le due classi condivise). E' la differenza fra un controllo che vale oggi
e uno che vale anche per la finestra aggiunta il mese prossimo — la quale, se
nascesse col vecchio `display:none`, apparirebbe di colpo e nessuno se ne
accorgerebbe finche' non la guarda aprire. Le tre escluse sono escluse **per
nome e con la ragione scritta accanto**.

Tre trappole, tutte pagate scrivendolo:

- **L'opacita' letta subito dopo il cambio di classe e' quella di PARTENZA.**
  La transizione e' appena cominciata, quindi una finestra che si sta aprendo
  risponde "opacita' zero" — ed e' giusto, ed e' anche il motivo per cui la
  dissolvenza si vede. Gli stati fermi si misurano a **transizioni spente**
  (`el.style.transition='none'`), la transizione dichiarata a transizioni
  accese: sono due domande che vogliono due condizioni opposte.
- **In una colonna flex, `flex-basis` e' l'ALTEZZA.** Scritto `flex:0 0 600px`
  sulla barra di "Pick a letter" per farla larga 600, e' venuta larga giusta e
  **alta seicento**, spingendo le tre lettere fuori dallo schermo. Il controllo
  guardava solo la larghezza e diceva di si'. Adesso guarda anche l'altezza.
- **Un `animation` con `both` tiene il suo valore finale anche da ferma**, e
  resterebbe a battersi con la transizione che deve venire dopo. Per questo la
  classe che porta l'entrata delle tre colonne viene tolta a corsa finita, e il
  banco verifica proprio che se ne vada.

## Il recupero della password sta in prova-codice.js

Non ha un banco suo: sta in coda a `prova-codice.js`, ed e' voluto. Le sei
caselle sono **le stesse** — stesso codice, stesse misure, stesso
comportamento — e provarle in due file vorrebbe dire poterne aggiustare uno e
rompere l'altro senza accorgersene. L'unica differenza e' cosa succede alla
sesta cifra: nella verifica si prova il codice da soli (non manca altro), nel
recupero il fuoco passa alla password, e il banco controlla proprio quella
differenza.

Le due chiamate del recupero **non passano da `nakamaRpc`**: chi ha perso la
password non ha una sessione, e Nakama senza sessione risponde 401 anche con
la chiave pubblica del client. Vanno a due indirizzi pubblici che Caddy
riscrive nelle due RPC aggiungendo lui la chiave del runtime. Il banco finge
`fetch` e verifica **a quale porta si bussa**, perche' quella e' l'unica cosa
che il gioco decide da solo.

Una trappola che merita di essere raccontata: la riga che controllava
l'indirizzo era scritta con un'espressione regolare, e fra il programma che
scrive il banco e il banco che inietta il proprio codice ci sono **due livelli
di virgolette**. La barra rovesciata e' stata mangiata due volte,
`/\/recupero\/chiedi$/` e' diventato `//recupero/chiedi$/` — cioe' un
**commento** — e la riga si e' saldata con quella dopo. Il controllo non
girava, e passava lo stesso, perche' quel che restava era `chieste.length === 1
&& 'del testo'`. Adesso c'e' `endsWith`, che non ha niente da sfuggire.

---

## prova-sito.js — la pagina d'ingresso

    $ELECTRON strumenti/prova-sito.js [scatto.png]
    HX_SCHERMO=390x844 $ELECTRON strumenti/prova-sito.js [scatto.png]

Come la 404, **non apre il file: tira su un server sulla radice del sito**.
Tutti gli indirizzi di `index.html` partono da `/` — devono, perche'
hextalegame.com/ *e'* la radice — e aprendola come file quelli punterebbero al
disco. Servendola si vede anche l'altra meta' della cosa: quali file la pagina
chiede davvero, e se qualcuno non c'e'.

Le tre cose che il banco guarda e che a occhio si sbagliano:

**Le targhe dei titoli non si stirano.** Il difetto era che erano immagini
allungate. Adesso sono una sola immagine tagliata in tre — `border-image` — e a
stirarsi e' solo la fascia di mezzo. Il segno che sia davvero cosi' non e' che
il titolo *sembri* giusto: e' che i bordi laterali abbiano una larghezza loro
invece di zero, ed e' quello che il banco misura.

**Il palco occupa esattamente il posto che gli serve.** Due sezioni impaginano
in coordinate assolute; il palco tiene le misure del disegno e si rimpicciolisce
tutto insieme, e il guscio deve essere alto quanto il palco *rimpicciolito*.
Se resta alto quanto quello intero si apre un buco, se resta a zero le cose
sopra e sotto si accavallano. Il banco ricava il fattore dalla matrice della
trasformazione e lo moltiplica: e' l'unico modo di controllarlo che non sia
riscrivere il conto che si sta controllando.

**Niente scorre di lato.** E' la firma di un palco che non si e' rimpicciolito,
e su un telefono e' il difetto piu' facile da lasciarsi dietro.

Tre trappole che questo banco ha gia' pagato:

- **In una finestra che non e' a schermo le transizioni CSS non avanzano.**
  Misurando l'altezza di una risposta a meta' di una transizione ferma si legge
  sempre il valore di *partenza*, cioe' zero: il banco diceva che l'accordion
  era rotto quando era rotto lui. Adesso le spegne prima di misurare.
- **`capturePage` restituisce il fotogramma precedente.** Il primo scatto dopo
  ogni scorrimento si butta, altrimenti ogni immagine esce con la posizione di
  quella prima — e ci si mette mezz'ora a capire perche' la sezione fotografata
  non e' quella chiesta.
- **Le immagini sotto alla prima schermata si caricano quando ci si arriva.**
  Il banco fa un giro di tutta la pagina prima di misurare e **resta in fondo**:
  risalendo subito, l'ultima immagine — Geppetto, dietro alle domande — comincia
  a caricarsi e il browser lascia perdere, e il banco la trova vuota.

Su `HX_SCHERMO=390x844` cambiano tre cose e le controlla tutte: la carta torna
nel flusso, i cinque cartellini spariscono, e al loro posto c'e' il riquadro che
si riempie toccando un pezzo della carta — con **lo stesso testo dei
cartellini**, preso da li'. Il banco tocca davvero, e guarda che compaia quello
giusto.

---

## estrai-carta.js — la carta del gioco, presa dal gioco

    $ELECTRON strumenti/estrai-carta.js [nome] [livello]

Scrive tre file in `web-assets/sito/` che la pagina d'ingresso si mette dentro:
`carta-alice.html` (il markup), `carta-alice.css` (le regole) e `carta-alice.js`
(le funzioni che la muovono).

**Perche' tre file e non una fotografia.** La carta del sito deve essere quella
del gioco *in tutto e per tutto*: il riflesso che segue il puntatore, la
lucentezza per materiale, la lamina vera con le sue due trame che scorrono in
verso opposto, e il parallax dei livelli d'arte. Nessuna di queste cose e'
un'immagine — sono un SVG con dentro maschere e trame, un foglio di stile, e una
funzione che a ogni movimento riscrive una dozzina di numeri. Riscriverle a mano
vorrebbe dire avere **due lamine diverse**, quella del gioco e una che le
somiglia, e vederle divergere alla prima modifica.

Il banco **non copia a mano niente**. Apre il gioco, costruisce la carta con lo
stesso percorso della finestra dell'ingrandimento — `cartaAlLivello`,
`_makeCardDbCard`, `cardFoilVisualCard`, `buildFullHandCardSVG`, `cardFoilWrap`,
poi `cardDbBuildGlossLayer`, in quest'ordine, perche' l'ordine conta — e porta
via tre cose:

- **il DOM che ne esce**, con la lucentezza gia' costruita;
- **le regole di stile che lo riguardano**, raccolte guardando quali classi
  compaiono davvero nel sottoalbero invece che da una lista scritta a mano. Piu'
  le proprieta' `--foil*` che il gioco scrive su `:root` all'avvio: senza quelle
  i livelli restano spenti e non lo dice nessuno;
- **il codice sorgente delle funzioni**, chiesto alle funzioni stesse con
  `toString()`. E' l'unico modo di essere sicuri che sia quello che gira davvero.

Alla fine dichiara cosa ha trovato — lamina, bande, parallax, lucentezza — e
**esce con errore se manca qualcosa**: un'estrazione riuscita a meta' darebbe una
carta che sembra giusta e che non luccica, ed e' il difetto piu' facile da non
vedere.

Gli indirizzi assoluti (`hextalegame.com/...`) diventano relativi alla radice,
cosi' la stessa carta funziona sul sito vero e su un server di prova.

---

## prova-arte.js — l'illustrazione di una carta si aggancia

    $ELECTRON strumenti/prova-arte.js

Il gioco cercava l'illustrazione di una carta **solo in `.jpg`**. Chi ne
caricava una in `.png` o in `.jpeg` non lo scopriva: nessun errore, nessun
avviso. Il gioco chiedeva un indirizzo che non esiste, non trovava niente, e la
carta restava col segnaposto — e cinque personaggi sono rimasti invisibili cosi'
per settimane.

**Perche' non basta guardare la costante.** Che `EST_ART` sia diventata una
lista di tre lo si vede leggendo il file; che il gioco le USI tutte e tre no.
Fra la costante e la richiesta ci sono `_candidatiArt`, `artUrlVariante`,
`_livelliDiVariante` e `_primoCheEsiste`, e basta che uno dei quattro sia
rimasto indietro perche' non cambi niente. Il banco chiama percio'
`artUrlVariante` e guarda **quali indirizzi ne escono**: e' il punto a valle di
tutti e quattro.

**Non si scarica niente, e non e' una scelta.** Il primo tentativo tirava su un
server finto e gli puntava `ART_BASE` addosso. Non funziona: `ART_BASE` e' un
`const` di primo livello, e **un `const` non finisce su `window`** —
`window.ART_BASE = ...` crea una seconda proprieta' che il gioco non legge, e le
richieste continuano ad andare al sito vero. Il banco diceva zero richieste su
tre estensioni e sembrava che la correzione non funzionasse.

Il banco guarda anche **la cartella**, che e' l'altra meta' del problema:

- se c'e' un'illustrazione in un formato non ammesso, lo dice e fallisce;
- se un file non si chiama come la sua cartella lo **riferisce senza bocciare**.
  Il gioco cerca `cards/art/<slug>/<slug>-<fazione>.<est>`: un file chiamato
  diversamente non lo trova nessuno, con qualunque estensione. Non e' pero' un
  errore del codice, e non e' sempre uno sbaglio — l'arte di una carta in cui
  un'altra si trasforma sta di casa nella cartella della prima.

### Il difetto che prova-sito.js si e' lasciato scappare

Le tre regole che aprono il ventaglio c'erano tutte e tre, e nessuna andava
verso sinistra — che e' esattamente quello che il banco controllava, leggendo il
testo del foglio di stile. Solo che cadevano sulle **carte sbagliate**:
`nth-of-type` conta i tag, e il primo `<img>` del palco e' l'alone, non una
carta. La "seconda" era la prima, la "quarta" la terza, e la quarta — che di
regola non ne aveva nessuna — restava ferma mentre quella prima di lei le
scivolava sotto e spariva del tutto.

**Un controllo che legge quello che il codice dice di fare non e' un
controllo.** Adesso il banco apre il ventaglio davvero (con la classe `aperto`,
che fa quel che fa `:hover` e serve anche a chi tocca lo schermo invece di
passarci sopra col mouse) e misura **quanto si vede di ogni carta**, prima e
dopo. Se una sparisce sotto la vicina, lo dice.

E si ricorda di spegnere le transizioni prima di misurare: in una finestra che
non e' a schermo non avanzano, e leggendo subito dopo si ottiene due volte il
valore di partenza — cioe' il ventaglio chiuso, due volte, e un controllo che
non fallisce mai.

### Due trappole che prova-sito.js ha pagato in un pomeriggio

**Un `const` dichiarato dentro al `try` non si vede nel `catch`.** Il corpo del
banco era avvolto in un try, e il catch provava a scrivere il guasto dentro a
`dette` — dichiarata dentro al try. Il messaggio d'errore alzava una seconda
eccezione prima di uscire, la promessa restava rifiutata, e il banco tornava a
morire con un `PIANTATA` che non dice niente. Il `try` si apre adesso **dopo**
le scorciatoie, che sono le uniche cose che servono anche a chi raccoglie il
guasto.

**In una finestra che non e' a schermo `requestAnimationFrame` arriva due volte
in mezzo secondo**, non trenta. Il gestore dello scorrimento della pagina e'
regolato sul fotogramma: aspettando un TEMPO si misurava prima che avesse
girato, e il banco diceva che la barra non compariva mentre la pagina era
giusta. Si aspetta il fotogramma, non il cronometro.

E la lezione che le tiene insieme, gia' pagata col ventaglio: **un banco che
legge quel che il codice dice di fare non e' un banco.** Le cinque zone da
toccare sulla carta non si controllano guardando le percentuali scritte nel
foglio di stile — si accendono e si guarda se cadono sopra al pezzo giusto,
chiedendo all'SVG dove sta ogni pezzo.

### Il controllo che mancava, e quello che continuava a sbagliare domanda

**Una riga ha spento ogni dissolvenza della pagina, e i 127 controlli non se ne
sono accorti.** Il blocco `prefers-reduced-motion` azzera ogni animazione e ogni
transizione con `!important`; la condizione era passata da `reduce` a
`no-preference`, che e' vera per quasi tutti. I ritardi restavano — quindi le
cose continuavano ad arrivare **nell'ordine giusto** — e comparivano solo di
scatto. Nessun controllo lo vedeva perche' guardavano tutti che le cose ci
FOSSERO e DOVE: mai **per quanto tempo**. Adesso c'e' un controllo che pretende
che le dissolvenze durino almeno un decimo di secondo.

**E la barra sul telefono ha richiesto tre tentativi, tutti sbagliati allo stesso
modo.** Aspettare un tempo, poi due fotogrammi, poi due fotogrammi e un tempo:
il difetto non era nell'attesa, era nella **domanda**. Misuravo l'EFFETTO —
l'opacita', che arriva in fondo a una catena di eventi, giri di
`requestAnimationFrame` (che in una finestra non a schermo arrivano quattro
volte al secondo, non sessanta) e transizioni, e che in mezzo alla catena **sta
ferma**, quindi anche la stabilita' inganna. Si guarda invece la **decisione**:
la classe, che il gestore mette nello stesso istante in cui gira. Che poi la
classe spenga la barra e' un fatto del foglio di stile, e si controlla a parte, a
pagina ferma.

### Due cose che Safari su iOS non fa, e non lo dice

**`mix-blend-mode` non si applica dentro a un contesto con trasformazione 3D e
`will-change`.** La carta vive dentro a `.card-db-foil-tilt`, che la inclina con
`rotateX`/`rotateY` e dichiara `will-change: transform` (viene dal gioco). Le
sagome accese sopra i pezzi della carta erano disegnate in `screen` — una forma
chiara che SCHIARISCE quel che sta sotto invece di coprirlo. Su iOS Safari
ripiega su `normal` in silenzio: la sagoma diventa una tinta piena e copre
esattamente quello che doveva indicare, il numero o il nome o la riga
dell'abilita'.
Non c'e' modo di accorgersene da un `@supports`: iOS *supporta* la proprieta',
semplicemente non la applica li'. Si e' rinunciato alla fusione — una
semitrasparenza si vede attraverso perche' la si vede attraverso, non perche' un
motore di composizione ha voglia di fonderla.

**Safari su iOS ingrandisce da solo il testo che giudica troppo piccolo** dentro
a un blocco largo. E' una comodita' per i siti non pensati per il telefono. Le
righe dell'abilita' vivono dentro all'SVG della carta a coordinate FISSE,
calcolate quando la carta e' stata costruita: ingrandite dopo occupano piu'
spazio di quello che gli era stato dato, salgono, e finiscono sopra al titolo
dell'abilita'. Si spegne con `-webkit-text-size-adjust:100%` sull'`html`, e vale
per tutto il documento perche' il difetto non e' della carta — e' di ogni testo
a misura decisa.

---

## prova-cancello.js — il sito dietro alla parola d'ordine

    $ELECTRON strumenti/prova-cancello.js <la parola d'ordine>

**La parola si passa, non si scrive.** Il deposito e' pubblico: una parola
d'ordine scritta in un file di questo deposito e' una parola d'ordine
pubblicata. Nella pagina c'e' la sua **impronta** — SHA-256 di un sale piu' la
parola — e mai la parola, e questo banco controlla anche quello: che nel
sorgente servito la parola non compaia da nessuna parte.

Si serve la pagina da `127.0.0.1` e non dal file, perche' `crypto.subtle` esiste
solo in un **contesto sicuro** (https, o localhost). Aprendo il file a mano il
cancello resta chiuso comunque — che e' il verso giusto in cui sbagliare, ma non
permette di provare l'apertura.

**Cosa il cancello e', e cosa non e'.** Questo e' un sito statico su GitHub
Pages: non c'e' nessun server che possa rifiutare una richiesta, quindi la
pagina arriva sempre intera al browser e la parola la controlla la pagina
stessa. Chi apre gli strumenti da sviluppatore e cancella il riquadro vede il
sito. **Non e' una serratura: e' un cartello "non ancora"**, che tiene fuori chi
passava di li'. Una serratura vera la puo' fare solo un server — il sito dietro
al Caddy che gia' sta davanti a `api.hextalegame.com`, e li' rifiutare la
richiesta prima di mandare una sola riga di pagina.

Il cancello nasce **coperente** nel markup e lo toglie lo script: se lo script
non parte — JavaScript spento, un errore, una rete a meta' — il sito resta
coperto invece di scoprirsi. Un cancello che in caso di guasto si apre non e' un
cancello.

E `prova-sito.js` lo **toglie e basta** prima di misurare: quel banco guarda la
pagina, e la parola non sta in questo deposito.

## prova-pacchetti.js — la pagina "Card packs" e' quella del disegno?

    $ELECTRON strumenti/prova-pacchetti.js [scatto.png]

Apre il gioco, porta la pagina dei pacchetti sotto gli occhi con un inventario
finto (un daily maturo, un reward, un treasure) e misura tutto quello che il
Figma dichiara: riquadro a tempo largo 360, caselle da 300x70 con angoli a 16 e
stacchi da 16, titoli a 22px in E6D8B9, separatore di un pixel bianco al 10%,
saldo e pulsante appesi ai due bordi al 47% dell'altezza. Poi prova la regola
dello scorrimento — la fila si muove solo oltre i quattro pacchetti — e
l'apertura: che scali il contatore giusto e nessun altro.

Dandogli un nome di file salva anche uno scatto. **Con `disable-gpu` lo scatto
viene nero**: `capturePage` restituisce una tela vuota. Per guardare la pagina
si apre una finestra vera, senza spegnere la GPU e con `show:true`.

Due cose che il banco ha corretto su se stesso, e valgono per il prossimo:

- **`offsetTop` non conosce la `transform`.** Il riquadro del saldo e' ancorato
  a `top:47%` e poi sale di meta' se stesso con `translateY(-50%)`: `offsetTop`
  risponde 508, cioe' il PRIMA. Chi vuole il centro vero deve misurare i
  rettangoli, non gli offset.
- **Chromium arrotonda i bordi.** `border:1.5px` risulta `1px` in
  `getComputedStyle` a densita' 1. Il valore dichiarato si legge dalla regola
  (`cssRules`), non dall'elemento — ed e' la regola che il disegno prescrive.

### E adesso prova anche la busta

Lo stesso banco (`prova-pacchetti.js`) copre la sequenza intera dello sbusto:
misura la busta (640 di larghezza, ogni pezzo con la sua proporzione, la
ceralacca al centro, i tre frammenti dove stavano nel sigillo intero), poi fa
il gesto vero — un `pointerdown` su una casella, un movimento in su, un
rilascio — e verifica che lasciandola in basso torni indietro senza consumare
niente e lasciandola al centro si apra. Poi cinque colpi sulla ceralacca, la
rottura, l'apertura, le tre carte, e il prezzo della seconda.

Due cose imparate scrivendolo:

- **I frammenti della ceralacca si allineano MISURANDOLI, non a occhio.** I tre
  PNG sono ritagliati sul proprio contenuto, quindi non portano con se' la
  posizione che avevano nel sigillo. La si ricava confrontando le SAGOME (il
  canale alfa) e cercando, per ogni pezzo, l'offset che copre piu' ceralacca
  possibile senza uscirne — un pezzo per volta, sottraendo mano a mano quello
  gia' coperto. Il risultato (5,0 / 109,20 / 45,1) ricompone il sigillo con le
  crepe al posto giusto, ed e' scritto nel CSS invece di essere ricalcolato a
  ogni apertura.
- **`elementFromPoint` e' l'unico modo di provare che un click arriva.** Un div
  trasparente e' invisibile e riceve i click lo stesso: leggere il CSS non lo
  dice, chiedere al browser chi c'e' in quel punto si'.

## senza-battlecry.js — chi non ha ancora un grido di battaglia

    node strumenti/senza-battlecry.js [rare mythic timeless]

Non serve Electron: legge il FOGLIO (esportazione CSV, nessuna chiave) e la
cartella `audio/voices/`, e incrocia. Senza argomenti guarda tutte le carte.

Due cose imparate scrivendolo:

- **Al gioco non si puo' chiedere l'elenco delle carte.** Aperto da `file://` e
  senza accesso, `FINAL_CARDS` contiene tre carte di ripiego: il catalogo vero
  arriva dal server, e il server lo prende dal foglio. La fonte e' il foglio.
- **Lo slug si RICALCOLA con la stessa regola del gioco** (`slugPersonaggio`),
  perche' i file si chiamano `<slug>-battlecry.mp3`. Basta una regola diversa
  per dichiarare mancante della roba che c'e'.

Lo strumento elenca anche il contrario — i file che non corrispondono a nessun
nome del foglio. Sono gridi che nessuno urlera' mai: di norma vuol dire che la
carta e' stata rinominata e il file e' rimasto col nome vecchio.

**Lo stdout di node viene troncato** se il processo esce mentre lo sta ancora
svuotando: la prima versione stampava 37 righe su 49 e usciva con codice 0. Il
risultato si scrive quindi anche su `strumenti/senza-battlecry.txt`, e l'uscita
aspetta che stdout abbia finito.

## prova-novita.js — il pallino delle novita' si spegne?

    $ELECTRON strumenti/prova-novita.js

Il pallino accanto a "Library & decks" c'e' finche' resta una carta da guardare.
Il difetto che questo banco esiste per non far tornare: la carta si accendeva,
guardarla non la spegneva, e il pallino restava per sempre.

**La causa era che due funzioni non cercavano la stessa chiave.** Nel gioco
convivono due forme per nominare una carta — lo slug (`robin-hood`) e l'id
(`final-robin-hood`). `_eCartaNuova` le accetta entrambe, giustamente: chi legge
non deve sapere quale gli e' arrivata. `_chiaveCartaNuova` invece ne
restituiva UNA sola, sempre lo slug. Basta che l'elenco conosca la carta per ID
e le due si separano: una la trova e accende il nastro, l'altra risponde con una
chiave che nell'elenco non c'e', e chi doveva toglierla esce senza fare niente.

Non e' un difetto che si vede leggendo una funzione: si vede solo mettendo le
due una accanto all'altra, ed e' esattamente cio' che fa il banco — costruisce
il caso "l'elenco la conosce per id, la carta ha anche uno slug".

**Il pallino vive nel MENU**, e le pagine sono ermetiche: cercarlo mentre si e'
in Collezione risponde sempre "non c'e'", e un controllo scritto cosi' passa
per la ragione sbagliata. Si torna al menu e si guarda li'.

## prova-nomi.js — il filtro sui nomi respinge il giusto?

    node strumenti/prova-nomi.js

Niente Electron e niente server: il modulo del runtime e' uno script, e uno
script si puo' far girare in una scatola (`vm`) e poi INTERROGARE. Si finge il
catalogo — bastano quattro carte, purche' una si chiami "Puss in Boots" — e si
chiede a `nomeSporco` cosa pensa di una trentina di nomi.

**Meta' delle prove sono nomi che devono PASSARE**, ed e' la meta' che conta.
Un filtro che respinge troppo si nota subito e fa male a chi non ha fatto
niente: Assatanato, Cassandra, Banal, peacock, Grapes, Puss in Boots. Quei casi
non capitano mentre lo si prova a mano — capitano al giocatore che si chiama
Cassandra. Qui stanno in fila, e il giorno in cui qualcuno tocca la regola si
vede subito chi cade.

Il filtro sta sul server perche' il nome si cambia con una PUT a `/v2/account`
che fa il client: un controllo scritto di la' lo salterebbe chiunque aprisse
gli strumenti del browser.

## prova-ricordami.js — la spunta "Remember me" scrive il giusto?

    npx electron strumenti/prova-ricordami.js

E' l'unico punto del gioco che ha il permesso di scrivere nel browser, e il
permesso e' stretto: SOLO se la spunta e' accesa, SOLO il token di rinnovo con
l'email a cui appartiene, e la casella si RILEGGE una volta sola. Nessuna delle
tre cose, se salta, si vede giocando: si vede fra sei mesi, quando due account
si mescolano di nuovo. Il banco guarda tutte e tre.

Trentuno prove in due giri. Il primo controlla la riga nel modulo, che a spunta
spenta non venga scritto niente, che a spunta accesa venga scritto QUELLO e
nient'altro (`Object.keys` vale quanto il resto: e' il controllo che si accorge
del giorno in cui qualcuno aggiungera' un campo di comodo), e che al rinnovo si
riscriva il token NUOVO. Il secondo semina la casella, ricarica la finestra e
verifica che si rientri da soli.

**La trappola: la pagina prova gia' da sola il rientro all'avvio**, quando la
colonna d'accesso compare, e quel tentativo CONSUMA la lettura unica. Il banco
ci si appoggia — dopo, `ricordoLeggiUnaVolta()` deve tornare nulla anche se
nella casella c'e' qualcosa di fresco — ma va saputo, o si scambia per un
difetto.

**Il secondo giro non usa stub: usa un PRELOAD** (`prova-ricordami-preload.js`)
che sostituisce `fetch`. Dalla v0.79.49 il rientro parte dentro `runPreload()`,
cioe- al DOMContentLoaded: non esiste un momento, dopo il caricamento, in cui
si faccia in tempo a mettere uno stub. Sostituendo la rete si prova la strada
VERA — rinnovo, sessione, sedia, accordo, menu — invece di una catena di finte
che potrebbero andare bene mentre quella vera e- rotta.

**Il logo e la colonna si guardano con un MutationObserver**, non chiedendo
all-elemento se ha la classe: entrando nel menu la schermata iniziale viene
SMONTATA, e dopo il logo risponde "non ci sono" — la risposta giusta per la
ragione sbagliata. L-osservatore segna se quelle classi sono mai comparse, e
c-e- un controllo apposta sullo sfondo (che invece deve accendersi) per
accorgersi del giorno in cui l-osservatore smettesse di guardare.

`_ricordoAttivo` e `CHIAVE_RICORDO` NON stanno su `window` (`let` e `const` in
cima a uno script non ci finiscono): da fuori si arriva solo alle funzioni
dichiarate, ed e' il motivo per cui il banco accende l'interruttore passando
dalla porta vera — `accediConPassword` con la casella spuntata — invece che a
mano.

Il lato server e' una riga in `/opt/nakama/docker-compose.yml`, che NON sta in
questo repository: `--session.refresh_token_expiry_sec 2592000`. Senza, il
token di rinnovo dura un'ora (e' il valore di partenza di Nakama) e la spunta
mantiene l'accesso per un'ora invece che per un mese.

## prova-voci.js — le carte parlano ancora?

    npx electron strumenti/prova-voci.js

Il 9 settembre 2026 nessuna carta gridava piu', e nessuna parlava. Non per un
difetto nel suono: per una SCORCIATOIA. `verificaArtCarte` scopre due cose
insieme — le illustrazioni e l'audio — e da v0.77.99 salta il giro quando il
catalogo importato le sa gia'. La domanda che decideva se fidarsi era "il
catalogo porta il campo `voci`?", e il catalogo in linea lo portava per tutte e
111 le carte: **vuoto** per tutte e 111. Campo si', contenuto no, risposta si'.

Il banco costruisce esattamente quel catalogo — `voci: []` per tutte, nessun
`battlecry`, l'arte nota per una sola carta — e pretende che il gioco si accorga
di non poterselo bere.

**E prova anche il caso opposto**, che e' la meta' che si dimentica: con un
catalogo che l'audio lo sa DAVVERO la scorciatoia e' giusta e non si deve
bussare, ma gli indirizzi vanno comunque passati a `registraVociSfx` — sapere
dove sta un file non basta a poterlo suonare, `playSfxFile` pesca da
`AUDIO_DATA_URLS`. Quel secondo difetto non si era ancora visto solo perche' il
primo arrivava prima.

**Si aspettano venti secondi prima di cominciare.** Il caricamento della pagina
fa girare `verificaArtCarte` per conto suo: partire mentre e' in corso vuol dire
due verifiche sovrapposte sulla stessa `FINAL_CARDS`, e nessuna delle due
risposte e' attendibile.

**Il banco gira sul roster di ripiego (4 carte).** Da `file://` il foglio non si
legge, quindi ci sono solo Robin Hood, Snow White, Merlin e Alice — che pero'
un `-battlecry.mp3` ce l'hanno davvero in `audio/voices/`, ed e' tutto cio' che
serve: la domanda e' se la catena scopre-registra-suona regge, non quante carte
la percorrono.

### La sentinella della cartella locale (dentro a prova-voci.js)

I primi cinque controlli di `prova-voci.js` non parlano di voci: guardano che
la META' LOCALE della ricerca degli asset punti davvero al disco.

Il gioco cerca prima accanto al file e poi sul sito (`_candidati`). La pagina
vive in `play/`, e dentro `play/` c'e' solo `index.html`: la radice del sito e'
un piano SOPRA. Gli indirizzi relativi erano rimasti scritti per la radice —
`cards/art/...` invece di `../cards/art/...` — quindi puntavano a
`play/cards/art/`, che non esiste, e la meta' locale non ha mai trovato niente
da quando la pagina si e' spostata.

**Il conto l'ha pagato l'importazione.** `converti.js` gira da `file://` e
chiama `verificaArtCarte`: scoprire l'arte sono sei richieste per carta per
fazione, cioe' ~1300 in raffica verso GitHub Pages, che risponde **429 Too Many
Requests**. `new Image().onerror` non sa distinguere un 429 da un 404, quindi
ogni richiesta strozzata e' finita nel catalogo come "questa carta non ha
illustrazione": 4 carte su 111 con arte, zero gridi di battaglia. E il gioco,
per le altre 107, tornava a bussare a ogni avvio — altre 1300 richieste, altri
429, e le illustrazioni che comparivano una alla volta dopo svariati secondi.

Con il `../` la stessa passata trova 109 illustrazioni su 111 in quattro
secondi, dal disco, senza toccare la rete.

Il banco lo verifica in tre modi: che il primo candidato cominci per `../`, che
quella cartella RISPONDA davvero (non basta che l'indirizzo sia scritto bene), e
lo stesso per le voci. C'e' anche una spia in `verificaArtCarte` che avvisa in
console se, da `file://`, nessuna illustrazione arriva dal disco.

## prova-cascata.js — le carte entrano una dopo l'altra?

    npx electron strumenti/prova-cascata.js

Dodici controlli sull'ingresso della Libreria. Tre cose non si vedono a occhio
senza fermare il tempo, ed e' per quelle che il banco esiste:

1. **che il ritardo cresca davvero di 50ms per carta.** Un errore di indice qui
   si vede solo come "entrano tutte insieme", che e' anche l'aspetto di una
   macchina lenta: guardando non si distingue il difetto dal computer.
2. **`fill: 'backwards'`.** Senza, la carta e' visibile durante l'attesa e poi
   rifa' la dissolvenza: compaiono tutte subito e poi sfarfallano, che e' peggio
   di non avere niente. Si controlla sia il timing dichiarato sia l'opacita'
   VERA dell'ultima casella, che in quell'istante deve essere zero.
3. **che una casella nascosta da un filtro non prenda il proprio turno**, o la
   fila avrebbe buchi di cinquanta millisecondi in cui non entra niente.

E due sul contorno: che un ridisegno qualunque NON la rigiochi (ordinare e
filtrare sono gesti in cui si confronta qualcosa, e cinque secondi e mezzo di
cascata li' dentro sarebbero un'attesa), e che chi la interrompe la lasci
VISIBILE — una cascata cancellata a meta' che lasciasse una carta trasparente
sarebbe un difetto permanente e silenzioso.

## prova-orologio.js — il turno dura lo stesso di qua e di la'?

    node strumenti/prova-orologio.js

Tre controlli, niente Electron e niente server: e' un accordo fra due numeri, e
un accordo fra due numeri si verifica leggendoli.

Il conto alla rovescia lo mostra il client (`TURN_SECS` in `play/index.html`),
ma la scadenza la tiene il **server** (`TURNO_MS` in `server/nakama/index.js`):
e' lui a decidere quando un turno e' finito, e il client si riallinea alla sua
scadenza a ogni battito. Se i due non combaciano non succede niente di
rumoroso — succede la cosa peggiore, cioe' una partita che si comporta in modo
diverso da come si vede:

- client piu' lungo del server: il turno si tronca con la barra ancora a meta',
  e chi stava pensando non capisce cos'e' successo;
- client piu' corto: la barra arriva a zero e il turno continua.

Nessuno dei due da' un errore da nessuna parte.

Si cerca la **dichiarazione** e non il numero: `45000` cercato da solo lo si
trova in venti punti che non c'entrano niente. Ed e' l'unico banco che guarda
due file INSIEME — vale la pena saperlo, perche' e' il modello per il prossimo
numero che dovesse vivere di qua e di la'.

## prova-turno.js — chi sono io, quanto manca, e cosa succede a zero

    npx electron strumenti/prova-turno.js

Quattordici controlli su tre cose che il turno deve sapere di se'.

**Chi sono io.** In rete il server dice quale dei due numeri siamo, e quella
riga girava un istante PRIMA che `initGame` rifacesse `G` da zero: il numero
si perdeva ogni volta e `_goIoSono` rispondeva 1 a tutti e due. Chi era il 2
sentiva la fanfara al contrario e vedeva i punteggi scambiati. Il banco fa
quello che fa il gioco — `initGame` che rifa' `G` — invece di leggere la
funzione, che sarebbe passata anche prima.

**Il conto non si ferma mai** (regola di Lorenzo, v0.79.59). A zero ci sono
tre casi e vanno tenuti distinti: nessuna carta giocata (giocata d'ufficio),
una scelta aperta (si chiude come rinuncia), la carta GIA' giocata che sta
risolvendo (non si fa niente: e' un turno che finisce da solo, e "tempo
scaduto" su una mossa gia' fatta sarebbe una bugia). Prima il terzo caso non
esisteva perche' `doPlace` fermava il conto; adesso e' il prezzo del conto che
corre sempre.

**In rete la scelta scade davvero.** Il ritorno anticipato per la rete stava
SOPRA al ramo che chiude una scelta scaduta — che aveva la sua guardia per la
rete, scritta bene e mai eseguita. Una finestra di bersaglio online non
scadeva mai: restava aperta sui due schermi, il server passava il turno, e la
mossa dell'avversario arrivava sopra a una scelta ancora aperta. Era la strada
da cui le partite online si fermavano.

**I valori viaggiano con la giocata.** Sull'altro schermo la carta e'
ricostruita dal catalogo (`_cartaDaIdRete`): cio' che le era successo in mano
si perdeva. Si manda la BASE (`valoriBase`), non i valori vivi, o le sinergie
continue verrebbero contate due volte di la'.

`G.gameOver = true` prima di far scattare il tic serve a non fargli giocare
una carta da solo; per il caso "carta gia' giocata" invece `G.gameOver`
dev'essere falso e `G.turnPlayLocked` vero, e si sostituiscono `autoPlay` e
`mostraTempoScaduto` per contare se vengono chiamate.

**Il banco puo' puntare la copia SCHIERATA.** Passandogli un percorso —
`node strumenti/prova-quest-server.js /percorso/index.js` — prova quel file
invece di quello di casa. Serve a rispondere a una domanda diversa da "il
codice e' giusto?": *quello che sta girando adesso, oggi, si comporta bene?*.

Le due cose non coincidono per definizione. Il file di casa puo' essere avanti
di un commit, o indietro di uno schieramento andato storto. Si tira giu' il
modulo dal server (`/opt/nakama/data/modules/index.js`) e gli si fanno le
stesse domande. Il calendario e' l'unica cosa che un banco non puo' fingere del
tutto: la giornata vera e' quella in cui gira.

## prova-trovato.js — "Match found!", dieci secondi per dire di si'

    $ELECTRON strumenti/prova-trovato.js [foto.png]

Prima, trovato l'avversario, si entrava in partita da soli. Adesso i due si
devono dire di si' tutti e due, e questo splash e' l'unico posto in cui una
partita puo' non cominciare senza che sia successo niente di male.

**Accettare vuol dire entrare.** Non c'e' un messaggio di "accetto" da
inventare: chi preme Accept fa `match_join`, chi rifiuta semplicemente non
entra, e la partita comincia quando il server vede dentro tutti e due — cosa
che gia' faceva. Il banco controlla che aprendo lo splash NON si entri, e che
premendo Accept si entri una volta sola.

**Il riquadro non ritaglia, ed e' voluto.** I due personaggi devono uscire dai
lati e da sopra (nel disegno il cappello del pirata sta fuori dal bordo alto)
e mai da sotto. La proprieta' overflow non sa fare "tagliato da una parte
sola": il fondo si evita ancorandoli al bordo basso, non tagliandoli. Se un
domani qualcuno mette `overflow:hidden` per pulizia, il disegno si perde e
nessun errore lo dice — per questo il banco guarda anche quello.

**I dieci secondi li arbitra il server.** La barra e' il loro disegno, non la
loro misura: se li contasse ogni client per se', la latenza li farebbe scadere
a uno prima che all'altro, e il caso in cui accettano tutti e due sul filo
diventerebbe una lotteria.

**Chi rifiuta non e' dentro al match e deve poter parlare lo stesso.** Non ha
una presenza, quindi non puo' mandargli un messaggio: bussa per RPC, e l'RPC
usa `matchSignal`, che e' la porta di servizio verso chi non ci sta dentro.
Senza quella strada l'altro imparerebbe la notizia solo alla scadenza.

### Due trappole che in un giorno mi hanno fermato tre volte

**Gli apici inclinati dentro al corpo del banco.** Il corpo vive in un
template literal: un apice inclinato in un commento — attorno al nome di una
regola CSS, per dire — chiude il template a meta'. Il file smette di partire,
e l'errore che si legge indica la riga della chiamata, non quella del
commento. Nel corpo del banco: nessun apice inclinato, mai.

**Gli a-capo dentro alle spiegazioni.** Per andare a capo in un messaggio
servono DUE caratteri (```` seguito da n), non uno: scritto con uno solo, il
template esterno lo trasforma subito in un a-capo vero e spezza la stringa
interna. Stesso sintomo, stessa caccia.

### v0.79.85 — il rifiuto che non arrivava

Il caso piu' comune era quello rotto: A dice di no e B non ha ancora premuto
niente. B non e' dentro alla partita, quindi OP_NON_ACCETTATO — che passa
dalla partita — non lo raggiunge. Restava davanti allo splash, e se premeva
Accept entrava in un tavolo gia' chiuso: il server rispondeva con un errore,
e il socket trasformava OGNI errore in "Cannot search".

Adesso chi rifiuta manda anche una **notifica** di Nakama, che arriva al
socket del giocatore e non alla partita. Chi era gia' entrato la riceve due
volte (dalla partita e come notifica) e il client la conta una volta sola:
il banco lo prova mandandola due volte piu' un OP_NON_ACCETTATO, e contando
le ricerche ripartite. Prova anche il caso sul filo (Accept premuto su un
tavolo appena chiuso: niente errore, di nuovo in cerca) e il caso opposto —
un errore vero, fuori dallo splash, deve vedersi ancora. Zittirli tutti
sarebbe il difetto rovesciato.

**Il lampo d'arrivo si aspetta, non si cronometra.** Nella finestra fuori
schermo il primo fotogramma arriva dopo un secondo e mezzo e le transizioni
non finiscono mai: il lampo parte dalla rete di sicurezza, verso i due
secondi e mezzo. Un'attesa fissa diceva "non arriva" per il motivo
sbagliato; adesso il banco aspetta la classe con un limite.

**I tappi del timer si misurano come proporzione.** Il fondo e'
slider-bar-bg tagliato in tre: nell'immagine il tappo e' 8 su 16 di
altezza, sulla barra deve essere 6 su 12. Il banco confronta i due rapporti
invece di un numero, cosi' resta vero se un domani la barra cambia altezza.

### v0.79.86 — lati e fondo mascherati, l'alto no

I personaggi possono uscire solo dal bordo alto. Il taglio non sta sul
riquadro ma su #trovato-palco, un livello con i lati e il fondo del riquadro
che sale di quattrocento pixel: overflow taglia quattro lati o nessuno, e un
clip-path sul riquadro intero isolerebbe anche la trama del pannello.

Il banco ha un controllo che sembra al contrario: che l'uncino SIA piu' largo
del riquadro. Serve a non farsi ingannare: se le figure stessero dentro da
sole, un palco senza taglio passerebbe tutti gli altri controlli, e il
giorno in cui qualcuno allarga l'uncino nessuno se ne accorgerebbe.

### v0.79.87 — cinque correzioni, e un difetto che staccava dalla partita

**Lo splash non si chiudeva quando accettavano tutti e due**, e il suo
orologio continuava a girare: a dieci secondi faceva scattare il rifiuto per
tempo scaduto, che chiude il socket. Il banco controlla che l'avvio della
partita chiuda lo splash e che, fatto questo, nessun rifiuto parta piu'.
Controlla anche che le figure restino ferme durante la dissolvenza: tolte
subito, tornerebbero indietro mentre la finestra svanisce.

**Il rosso a strisce** aveva due cause, e la seconda non era nel codice. Lo
zoom rimpiccioliva anche il riempitivo, una fetta larga 2 pixel ripetuta, e
sotto al pixel il browser ne mescola i toni: adesso il pulsante e'
rimpicciolito con le sue misure e il riempitivo prende tessere da un pixel
intero. Il pulsante inoltre veniva vestito prima del cambio fra opaco e
trasparente e restava con i pezzi dell'altra famiglia: adesso si riveste a
ogni cambio, e il banco guarda che i cinque pezzi siano della stessa famiglia.

Ma su Decline le bande restavano, e il motivo e' l'immagine:
`button-opaque-filler-warning.png` e' semitrasparente (alfa 165) e piu' chiaro
dei tappi e del centro della sua famiglia (alfa 255) — di fatto e' il
riempitivo della famiglia trasparente. Nessun altro pulsante usava il rosso
opaco, e un controllo sulla famiglia lo lascia passare: e' un pezzo della
famiglia giusta, solo disegnato sbagliato. L'ha trovato una sonda che legge il
colore ai bordi di ogni pezzo. L'immagine e' di Lorenzo e non si tocca da qui.

**Il pallino della Libreria** contava le carte nuove che il server manda, e
il server manda anche quelle a drop rate zero, che la Libreria non mostra mai.
Adesso conta sull'elenco che la Libreria disegna, con la domanda che accende
il nastro "New". Il banco lo prova con una carta inesistente, con una a drop
rate zero e con una vera.

**Le schede VS** si misurano con la matrice di trasformazione in tre momenti
(partenza, in scena, uscita), con le transizioni spente: il banco guarda il
SEGNO dei due spostamenti, cosi' resta vero anche se un domani cambiano i
trenta e i quaranta pixel.

## prova-rifiuto-server.js — chi torna in cerca dopo un Match found a vuoto

    node strumenti/prova-rifiuto-server.js [percorso/index.js]

La regola di Lorenzo: chi non preme Accept in tempo non rientra in coda,
mai; chi aveva accettato rientra; chi viene interrotto da un Decline mentre
ha ancora tempo rientra. A decidere e' il server, dentro alla notifica che
manda quando qualcuno rifiuta, perche' e' l'unico che conosce la scadenza
vera. Il caso rotto era il piu' banale: nessuno accetta, il primo a scadere
avvisa l'altro, e l'altro veniva rimesso in coda.

Come prova-quest-server: index.js in un contesto finto, e partitaSignal
chiamato con un tavolo e un dispatcher scritti a mano che annotano cosa viene
mandato a chi. Accetta un percorso, per provare la copia scaricata dal server.

## prova-muto.js — muto vuol dire muto

    $ELECTRON strumenti/prova-muto.js

Col cursore **General volume** a zero non si deve sentire niente. Sembra
ovvio e non lo e': il volume generale non e' un interruttore, e' un numero che
ogni strada dell'audio deve ricordarsi di moltiplicare. Una strada che se ne
dimentica non da' nessun errore — da' un suono, e chi lo sente pensa che il
muto sia rotto.

Le strade sono cinque e non si somigliano: `playSfxFile` su Web Audio, il suo
ripiego a `<audio>`, il **volume fisso** dentro `playSfxFile`, `playSfx` per i
tre `<audio>` del tavolo, la musica su `#bgm` e `#bgm-loop`, piu' i video del
tutorial, che sono muti per attributo e devono restarlo.

**Il banco non ricalcola le formule.** Ricalcolarle proverebbe solo che so
copiare una moltiplicazione: se la formula nel gioco fosse sbagliata e il
banco la ricopiasse, passerebbe. Invece **intercetta** — una mano su
`createGain` e una su `HTMLMediaElement.play` — fa suonare tutto per davvero
col generale a zero, e guarda che ogni volume passato sia zero.

Tre accorgimenti che valgono quanto il controllo:

**Gli altri due cursori restano al massimo.** Spegnendo tutti e tre, il banco
passerebbe anche se il generale non contasse niente. Il punto e' che il
generale **da solo** basti.

**Si controlla che qualcosa abbia davvero provato a suonare.** Un banco che
non sente niente direbbe "tutto a posto" anche con l'audio rotto e nessuna
riproduzione partita. E la prova specchiata in fondo — rialzare il generale e
risentire — chiude lo stesso buco dall'altra parte.

**Il percorso Web Audio va forzato.** Senza un buffer decodificato
`playSfxFile` non passa mai dal `GainNode` e risponde solo il ripiego a
`<audio>`. In partita e' il contrario — i buffer ci sono e il ripiego quasi
non si vede — quindi il ramo che conta di piu' resterebbe fuori dalla prova.
Gli si mette in mano un buffer di silenzio da un decimo di secondo: serve la
strada, non il suono.

## prova-tutorial.js — le sei schede del tutorial

    $ELECTRON strumenti/prova-tutorial.js [foto.png]

Il tutorial e' la prima cosa che un giocatore nuovo vede dopo aver scelto il
nome, e questo lo rende diverso da ogni altra finestra: **chi lo prova non e'
mai chi lo ha scritto**. Un difetto qui non lo segnala nessuno — chi arriva
pensa che il gioco sia fatto cosi'.

**Il riquadro e' 1200x700 sempre.** Non e' una conseguenza del contenuto, e'
un vincolo: dentro c'e' un video, e un riquadro che seguisse il testo lo
farebbe allargare a ogni passo. Il banco misura tutte e quattro le schede.

**Il video sbagliato** e' il difetto che nessun controllo generico prende: sei
schede, sei clip, e uno scambio si vede solo guardando. Ogni scheda deve
puntare al suo file.

**La freccia che sparisce invece di spegnersi.** Sulla prima scheda l'indietro
non ha dove andare. Se se ne andasse, l'avanti scivolerebbe al suo posto e il
pollice tornerebbe su un pulsante diverso: il banco controlla che sia spenta
**e** che occupi ancora il suo spazio.

**Il "Got it!" sulla scheda sbagliata.** Prima dell'ultima chiuderebbe un
discorso a meta'; assente sull'ultima non lascerebbe modo di uscire, perche'
questa finestra non si chiude col velo ne' con Esc — ed e' voluto: le prime
quattro schede stanno fra la scelta del nome e quella del mazzo, dentro a una
fila di cose che si fanno decidendo.

Due note su come misura. Le gemme delle rarita' si leggono **dopo un'attesa**:
`impostaImgDaCandidati` scrive il `src` quando ha finito di provare gli
indirizzi, e leggerlo subito direbbe "gemma mancante" per il motivo sbagliato.
E i colori delle rarita' si confrontano con `COLORI_RARITA` invece che con
quattro costanti scritte nel banco: una rarita' ha un colore solo in tutto il
gioco, e un banco che ne tenesse una copia sarebbe il secondo posto da
aggiornare.

**`hidden` non nasconde niente, se qualcuno dopo dice `display`.**
`[hidden]{display:none}` sta nel foglio del browser e vale quanto una classe.
Nel tutorial e' stato scavalcato due volte nello stesso giorno: da
`#tutorial-fondo{display:flex}` (un id, che vince) e da `.hx-btn` sul pulsante
"Skip tutorial" (stessa forza, ma scritto dopo). In tutti e due i casi il
codice era convinto di aver nascosto, la proprieta' `hidden` era giusta, e la
cosa restava in scena. Serve una regola esplicita `#tizio[hidden]{display:none}`.

**Il banco deve guardare `display`, non `.hidden`.** Chiedere la proprieta'
e' chiedere all'imputato: risponde di si' e ha ragione, ma non e' la domanda.

**Il filo di progresso.** Il banco stampa ogni controllo mentre passa
(`console-message` nel processo principale, `[passo] ...` dalla pagina). Un
banco lungo che tace non si distingue da un banco appeso, e la differenza
cambia cosa si fa dopo: aspettare, o andare a cercare. Per vederlo scorrere
serve `grep --line-buffered`, o il filtro tiene tutto in pancia fino alla fine
e il filo non serve a niente.

## prova-customize.js — le due voci che hanno traslocato

    $ELECTRON strumenti/prova-customize.js

Dalla v0.79.76 "Play as" e "Show hexagon helper" non stanno piu' in mezzo ai
cursori del volume: stanno dentro a Customize, sotto al nome del giocatore.

Un trasloco di markup e' il genere di modifica che sembra riuscita perche' le
due voci **si vedono** nel posto nuovo. Quel che si rompe in silenzio e' tutto
il resto, e sono quattro cose diverse:

**Il vestito.** La casella di spunta non ha un'immagine sua: la prende da due
variabili (`--hx-casella-off/on`) scritte sul pannello che la contiene, e quel
pannello adesso e' un altro. Una casella senza immagine e' un quadrato vuoto
che sembra spento anche quando e' acceso.

**Le regole di stile intestate al vecchio indirizzo.** Erano scritte
`#settings-pannello .settings-opzione`: nel pannello nuovo non valgono, e la
riga perde la forma senza che nessuno lo dica. Adesso comanda la classe, che
viaggia con chi la porta.

**Chi le prepara.** La tendina la costruiva `openSettingsModal`. Se nessuno la
costruisce piu' si apre vuota, e una tendina vuota si scopre solo cliccandoci.
Adesso e' `aggiornaCustomize` a farlo, cioe' chi apre la finestra in cui vive.

**La tendina aperta che finisce dietro.** Il banco non guarda lo z-index: apre
la tendina e chiede a `elementFromPoint` chi risponde in quel punto. Se
risponde la casella dell'esagono, l'elenco e' dietro.

E infine la cosa chiesta per nome: l'avatar sta due dita sopra alla tendina,
quindi scegliendo un colore lo si sta guardando. Il banco mette `MIO_AVATAR` a
`fox` — senza account e' vuoto, e due immagini vuote sarebbero "uguali" per il
motivo sbagliato — poi controlla che da `fox-dark.jpg` si passi a
`fox-light.jpg` mentre la finestra e' aperta. Con `Random` la faccia deve
restare l'ultima uscita: random non e' un colore, e' il modo in cui si decide
quale sara'.

**v0.79.77 — e l'esagono torna in partita.** Alla v0.79.76 era traslocato
dentro Customize, e a Customize dal tavolo non si arriva: chi voleva spegnerlo
mentre giocava non poteva piu'. Adesso le caselle sono **due** — quella di
Customize e quella delle impostazioni, che compare solo mentre si gioca — e la
preferenza resta **una**.

Due caselle per una preferenza sola aprono due strade sbagliate, e il banco
guarda tutte e due. La prima: si scrive solo quella aperta, e l'altra racconta
lo stato di prima — a scoprirlo sarebbe chi apre la seconda e la trova al
contrario. La seconda, piu' cattiva: il toggle cerca la casella per nome e
trova sempre la prima del documento, cosi' premendo l'altra il gioco fa il
contrario di quel che si e' appena fatto. Per questo la casella premuta arriva
come argomento (`toggleAiutoEsagono(this)`) e il banco preme da tutte e due le
parti: premendone una sola, meta' della prova passerebbe comunque.

Il banco non da' per scontato l'ordine delle due nel documento — le
impostazioni vengono prima di Customize — e non conta la riga di separazione
guardando il vicino di "Close": in mezzo c'e' il gruppo dell'esagono, che dal
menu e' fuori scena e la propria riga se la porta dentro.

## prova-livelli-server.js — le regole dei livelli, senza Nakama

    node strumenti/prova-livelli-server.js
    node strumenti/prova-livelli-server.js /percorso/index.js   (la copia schierata)

Le regole dei livelli (Lorenzo, 11/09/2026) sono tutte numeri, e un numero
sbagliato non da' nessun errore: si prende un livello in piu' o in meno, o si
paga il prezzo di un'altra rarita'. Il banco carica `index.js` in un contesto
finto, sostituisce le letture e le scritture con un magazzino in memoria e
prova:

- **le tabelle**: 2, 5 e 9 copie in tutto per i livelli 2, 3 e 4; l'inchiostro
  per rarita' (600, 1200, 1800 e 2400 in tutto); e che il profilo le mandi;
- **lo sbusto**: una carta del mazzo starter pescata vale la SECONDA copia (fino
  alla v0.79.89 valeva la prima); una copia oltre le nove torna in inchiostro,
  quanto costa tenere la seconda carta di quella rarita', e il conto resta a
  nove; e il livello non sale mai da solo;
- **hx_carta_livella**: niente senza copie o senza inchiostro (e senza pagare
  niente), un livello per volta, mai oltre il 4, mai una carta che non si ha;
- **la migrazione**: le carte starter sbustate ricevono la copia che mancava,
  ognuna sale al livello che le copie le danno, gratis, una volta sola; un
  livello gia' piu' alto non scende; senza catalogo non si segna come fatta;
- **la partita**: ogni giocatore porta il livello di ogni carta del SUO mazzo,
  calcolato quando la partita nasce (col mazzo casuale `_mazzoDi` ne compone uno
  nuovo a ogni chiamata, quindi non si puo' calcolare prima).

## prova-livelli.js — i livelli delle carte, a schermo

    $ELECTRON strumenti/prova-livelli.js [foto.png]

Senza server il catalogo ha quattro carte e il possesso non e' mai "noto" (la
Libreria resta vuota finche' `_possessoNoto` non e' vero): il banco lo accende e
si costruisce un possesso con una carta per ogni stato — una tacca su due,
pronta, due tacche su tre, al massimo.

**La barra a tacche** conta il tratto verso il prossimo livello, non le copie
totali: al 2 con quattro copie sono due tacche su tre. **Il nastro Lv up** c'e'
solo sulla carta pronta, a destra, sporgente di due pixel, alla stessa altezza
del nastro New. **Il riquadro sotto alla carta aperta** si vede solo in
Libreria, e' largo quanto la finestra, a sedici pixel da lei e da Close; il
pulsante e' spento finche' le copie non bastano e sparisce al massimo, dove la
barra e' una sola e grigia e il testo e' MAX. Senza inchiostro lo dice e non
chiama il server.

**La salita** si fa partire dal pulsante vero, con la risposta del server
finta, e il banco ne registra le fasi: arrivo, giri, cambi, finestra, fine,
nell'ordine. Il lampo non si controlla per fase ma per ANGOLO (fra 540 e 720,
cioe' nel secondo giro, dopo il dorso): in una finestra nascosta i fotogrammi
arrivano radi e il lampo puo' scattare sull'ultimo fotogramma del giro, quando
la fase letta dal banco e' gia' quella dopo. Poi: il saldo della risposta, il
titolo, il bonus, la barra del livello NUOVO, la carta che va al suo posto nella
finestra, e il nastro Lv up gia' andato via dalla Libreria.

**Il cartellino dello sbusto**: la nuova ha `new-card-banner-wide` 109x41 che
sporge di due pixel, la posseduta dice Owned, al massimo la barra e' grigia;
tenendole ognuna riempie una tacca, e una copia rimborsata no. **In rete** le
carte dell'avversario vanno al livello che il server dice per ognuna.

Con un nome di file scrive cinque foto: la scheda col riquadro, il nastro in
Libreria, la finestra finale, il lampo coi fuochi, e i cartellini dello sbusto.
Per quest'ultima le carte si mettono a mano nello stato in cui galleggiano (senza
la classe `emerging` resterebbero sopra al bordo dello schermo, dove le lascia
l'animazione d'ingresso che il banco non fa partire).

**v0.79.91 — vendere.** Allo sbusto una carta che ha gia' nove copie non si
tiene: si vende, e il pulsante dice "Sell for N". `prova-livelli-server.js`
controlla che vendendone una e tenendone un'altra non si paghi niente (la
venduta non entra nella coppia che si paga), che l'altra prenda la sua copia e
che la venduta resti comunque una delle due scelte. `prova-livelli.js` legge le
etichette (Sell for, Keep (Free) accanto a una venduta, Discarded, un Collect
senza prezzo) e poi raccoglie con una risposta finta che paga 50 e ne rende 200:
il saldo deve rientrare dal bordo, partire da 300, scendere a 250, salire a 450,
col suono dei soldi due volte. Nell'etichetta l'icona dell'inchiostro sta fra la
parola e il numero, quindi il testo ha due spazi: il banco li compatta — e dentro
al corpo del banco la barra si scrive `\s`, perche' il corpo e' un template
literal e `\s` perderebbe la barra.
