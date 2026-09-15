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

**v0.79.92 — "New" solo alla prima copia.** Una carta e' nuova se e' fra le
sbustate e non fra le viste; ma le carte del mazzo starter (e tutte, per un
admin) non erano mai state sbustate e quindi nemmeno viste, e la prima volta che
uscivano da un pacchetto si accendevano come nuove pur essendo in Libreria da
sempre. `prova-livelli-server.js` controlla che una carta starter uscita da un
pacchetto non sia nuova e una mai avuta si'; che una sbustata e non ancora
guardata resti nuova con la seconda copia, e una guardata no; che la migrazione
(`novitaVersione`) spenga le starter accese a torto lasciando accese quelle
davvero nuove, una volta sola; e che per un admin si spengano tutte.

**v0.79.93 — la salita rifatta.** Un giro solo: a meta' (col dorso) il lampo, i
fuochi e `fireworks.mp3`. I fuochi sono grandi una volta e mezza
(`LV_FUOCHI_SCALA`) e spinti verso i lati nel primo mezzo secondo
(`LV_FUOCHI_SPINTA`). Ogni pezzo cambia NEL lampo: nei keyframes `lvcCambio` il
pezzo nuovo e' assente fino all'11,9% e compare di colpo al 12%, che e' anche il
massimo di `lvcBagliore` e l'istante in cui suona `score.mp3`
(`LV_CAMBIO_PICCO_MS`). `prova-livelli.js` controlla le fasi (arrivo, giro,
cambi, finestra, fine), l'angolo del lampo fra 180 e 360, un `card-flip`, un
`fireworks` e nessun `card-ding`, uno `score` per pezzo, che i due fotogrammi a
opacita' piena siano lo stesso (12%) e che le due animazioni durino quanto il
codice aspetta. E sullo sbusto, che New! voglia dire solo "non ancora in
Libreria": una carta ancora da guardare in Libreria e una avuta solo dal mazzo
starter dicono Owned.

Il conto del saldo che scende e sale non si legge piu' campionando il numero a
video: il banco registra le chiamate a `contaValutaAllIndietro` (300>250, poi
250>450) e guarda solo il primo e l'ultimo numero. In una finestra nascosta i
fotogrammi arrivano radi, e il 250 di mezzo veniva sovrascritto dal secondo
conto prima che il banco lo leggesse: il controllo passava o no a caso.

**v0.79.93 — prova-tutorial.js.** La barra del titolo sopra al riquadro non c'e'
piu' (tolta su richiesta di Lorenzo): il banco controlla che non ci sia, al
posto dei tre controlli su testo, larghezza e altezza.

**v0.79.94 — i pezzi cambiano davvero nel lampo.** Alla v0.79.93 i numeri nuovi
comparivano solo quando tutti i lampi erano finiti, e nessun controllo se n'era
accorto: i banchi contavano suoni e fasi, non guardavano il disegno. Ogni pezzo
era un CLONE della carta nuova, e i suoi `url(#id)` (il clipPath degli angoli)
si risolvevano nella carta di riferimento, che portava gli stessi id ed era
nascosta con `visibility:hidden` — una forma invisibile dentro a un clipPath
ritaglia via tutto. Adesso ogni pezzo e' una carta disegnata da capo, preparata
prima dei lampi (`_lvPreparaCambio`), e la carta di riferimento e' trasparente
invece che nascosta. `prova-livelli.js` percorre ogni riferimento per id dentro
ai pezzi: deve esistere una volta sola nel documento, e dentro allo stesso
pezzo. Controlla anche che fra un lampo e l'altro passino 100ms
(`LV_CAMBIO_PASSO_MS`, dai tempi di `score.mp3`), e con un nome di file scrive
la foto `cambio`: la salita fermata 160ms dopo l'inizio del primo cambio, col
primo cerchio gia' al valore nuovo e gli altri ancora ai vecchi. (La carta in
quella foto sembra sbiadita perche' fermando TUTTE le animazioni si ferma anche
il lampo grande del giro; nel gioco a quel punto e' gia' spento.)

**v0.79.94 — prova-pacchetti.js.** Le scartate svaniscono in 230ms invece che in
460 (`USCITA_SVANIRE_MS` e `.pack-card.svanisce`, che devono combaciare), e
premuto Collect cominciano subito: la pausa per la tacca delle copie la fanno
solo le tenute. Il banco veste le carte del pagamento col loro cartellino — senza,
non c'e' nessuna tacca da riempire e il ramo della pausa non si prova — prende la
scartata PRIMA di raccogliere e controlla che dopo 300ms stia svanendo mentre le
tenute sono ancora tenute.

**v0.79.95 — i suoni muti.** `playSfxFile` suona solo cio' che e' stato
registrato: in `SUONI_SFX_EXTRA` (precaricato, cercato prima accanto al gioco e
poi sul repository), in `AUDIO_DATA_URLS`, o fra i `SUONI_EXTRA` delle voci. Un
nome che non sta in nessuno dei tre cade sul ripiego `assets/audio/sfx/`, che
accanto al gioco non esiste, e resta muto con un avviso in console — e leggendo
il codice la chiamata c'e' e sembra tutto a posto. Cosi' non si sentivano i
fuochi della salita di livello (se n'e' accorto Lorenzo), `quest-collected`,
`card-draw` e `card-drop`. `prova-livelli.js` legge adesso il copione della
pagina, raccoglie ogni `playSfxFile('...')` scritto per nome e controlla che sia
registrato. Non vede i nomi costruiti a runtime (i whoosh per rarita' passano da
una tabella): per quelli vale il loro elenco.

**v0.79.95 — prova-pacchetti.js.** Comprato un pacchetto, la sua casella (l'ultimo
tesoro della fila) lampeggia e pulsa una volta (`pkComprato`: brightness 1,9 e
scale 1,06 al 22%, bordo d'oro, .55s). Il banco compra con una risposta finta del
server e controlla che si accenda il tesoro nuovo e non l'altro, e legge i
fotogrammi-chiave.

## foto-titoli.js — la barra del titolo di ogni finestra, fotografata e misurata

    $ELECTRON strumenti/foto-titoli.js <cartella>

v0.79.96 — le finestre hanno lo stendardo nuovo (`.hx-titolo`: title-bar.png, o
title-bar-warning.png, alto 90 e largo 297, appeso al bordo superiore del
riquadro e centrato). Lo strumento apre ognuna delle 24 finestre con la sua
funzione vera, la fotografa ritagliata sul riquadro e scrive per ognuna la
distanza dello stendardo dal bordo interno (0,3 e' l'arrotondamento del bordo da
1,5), lo scarto dal centro, e se il titolo ci sta (testo piu' largo di 277px:
"NON CI STA"). In fondo misura anche i titoli che il codice scrive da se' — gli
avvisi, "Change player name", "New deck!" — dentro alla barra dell'avviso.

Due trappole pagate scrivendolo: i moduli d'accesso stanno in `#start-accesso`,
che e' `.start-fade` e si vede solo con `.show`; e "Update available" non va
aperta con la sua funzione, che fa partire un conto alla rovescia che ricarica la
pagina.

**v0.79.96 — i banchi sulla barra nuova.** prova-customize (lo stendardo alto 90),
prova-disclaimer ("Disclaimer", 36px), prova-dissolvenze (lo stendardo di Pick a
letter dentro al riquadro, 297x90, centrato e appeso), prova-report e
prova-ricordami (la fila del pannello di login comincia col titolo).

**prova-lettera.js non arrivava piu' alla fine dalla v0.79.82**, e non per la
lettera. Tre cose: chiediStarterSeServe aspetta che si chiuda il tutorial
d'apertura, e il banco non diceva che era gia' visto (restava fermo per sempre);
le misure della galleria erano a schermo, e la finestra del banco non e' sempre
larga 1920 (fuori dallo schermo viene 1280, e una colonna da 330 misurava 220);
e Chromium ricorda lo zoom di ogni pagina nel profilo di Electron, e su questo
computer play/index.html se n'era tenuto uno a 1,5 — il puntatore finto dell'hover
cadeva una volta e mezza piu' in la'. Adesso il banco segna il tutorial visto,
riporta le misure al disegno 1920x1080 e mette lo zoom a 1.

NOTA: in prova-ricordami resta un controllo storto da prima di oggi ("la stessa
regola vale per le altre caselle"): cerca una casella nelle impostazioni, e dalla
v0.79.76 quella casella sta in un gruppo che si vede solo in partita, quindi
misura zero.

**v0.79.97 — i titoli scritti dal codice, accorciati.** Change name, Activate, No
connection, Match error, No decks, Error, Not enough ink, Can't level up (scelti
da Lorenzo): adesso foto-titoli.js li trova tutti dentro allo stendardo. Nota:
lo strumento raccoglie gli avvisi scritti fra apici singoli; "Can't level up" e'
fra virgolette doppie per via dell'apostrofo, e per questo sta nell'elenco dei
titoli che misura sempre.

**v0.79.98 — White Rabbit in mano.** L'abilita' del Coniglio ("Starts the game in
hand") si apre al livello 2. Due difetti, uno per parte:
- contro l'IA la cima del mazzo si decideva in makeDeck coi livelli del catalogo
  (Coniglio al 1, abilita' chiusa), e pareggiaILivelli portava DOPO le carte
  dell'IA al livello del giocatore: il Coniglio poteva finire al 2, con
  l'abilita' aperta, in mezzo al mazzo. Adesso la cima si rifa' dopo i livelli.
  prova-livelli.js controlla l'ordine delle due chiamate in makeBalancedDecks e
  la regola su una carta finta che si apre;
- in rete il server lo metteva in cima sempre, anche chiuso. Adesso
  _inCimaChiHaFretta riceve i livelli carta per carta della partita e guarda
  abilityUnlockLevel. prova-livelli-server.js ha un Coniglio nel catalogo finto
  e lo prova al livello 1, al 2 e senza livelli.

## prova-trasformate-rete.js e prova-trasformate-server.js — una carta trasformata in mano si gioca anche online

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-trasformate-rete.js
    node strumenti/prova-trasformate-server.js [percorso/index.js]

Segnalazione di Lorenzo (v0.79.99): online, uno Strigoi diventato Dark Strigoi
IN MANO non si poteva giocare. Il server conosce la mano per id di catalogo,
come l'ha distribuita, e rispondeva "quella carta non e' nella tua mano"; allo
scadere del tempo la giocava d'ufficio col nome vecchio, il client non la
ritrovava e calava mano[0], e la partita si fermava ("racconti diversi ...
final-strigoi contro final-dark-strigoi" nel registro).

Adesso la carta si chiede col nome del MAZZO (`idDelMazzo`, annotato da
trasformaCartaIn) e porta la FORMA in cui scende. Il server controlla sul
catalogo che la forma sia una trasformazione di quella carta e la rimbalza;
chi guarda rifa' la trasformazione prima di mettere i valori. Senza forma (la
giocata d'ufficio) chi guarda la ricava dalla regola "always" e dal turno.

Il banco del client usa due carte finte con la riga dello Strigoi (il catalogo
dentro la pagina non ha le righe del foglio) e prova i due schermi: la
trasformazione in mano, i due nomi della giocata, il ritorno che trova la carta
giusta anche d'ufficio, e la carta ricostruita di la' identica a quella di qua.
Quello del server legge il foglio (bersaglio per numero e per nome), accetta la
giocata col nome del mazzo, rifiuta una forma inventata e lascia com'era un
client che la forma non la manda.

## prova-barra-tempo.js — la barra del tempo ha tre stati

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-barra-tempo.js

Regola di Lorenzo (v0.80.0): durante il turno la barra si svuota piano; nel
cambio turno sta ferma; al cambio turno torna piena di colpo, senza
transizione. E "a volte rimbalza avanti e indietro senza motivo".

La larghezza non si ricava piu' dai secondi interi con un secondo di
transizione CSS: la tiene BARRA_TEMPO (corre / ferma / piena), disegnata a ogni
fotogramma. Una scadenza corretta a turno in corso non la fa saltare: riparte
da dove si trova verso la scadenza nuova. endTurn la ferma per prima cosa
(fermaIlConto), startTurn la riempie, startTimer la fa correre. Il battito del
server (reteAllineaTimer) corregge solo il turno che sta davvero correndo: a
carta giocata portava gia' la scadenza del turno dopo, e la barra risaliva.

Il banco campiona la larghezza vera: niente transizioni su maschera e pallino,
discesa a piccoli passi e mai in salita, ferma quando e' ferma, piena nello
stesso istante, in rete piena anche se il server ha cominciato prima, e il
battito che non la sposta a carta giocata o sotto al banner.

## prova-anteprima-caso.js e server/nakama/prova-caso.js — il caso e' caso, e non si mostra prima

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-anteprima-caso.js
    node server/nakama/prova-caso.js

Segnalazione di Lorenzo (v0.80.0): copiando o rubando il Genio, la carta che
copiava buffava gli stessi gruppi. L'hash del motore (_semeDi) moltiplicava in
virgola mobile e perdeva i bit bassi: su due gruppi il primo usciva 171 volte su
200. Adesso la moltiplicazione e' a 32 bit vera e i bit si rimescolano alla fine;
l'occasione (_occasione) contiene anche il turno e la carta che agisce, e "set
1-3" e "or" tirano col seme invece che con Math.random (in rete i due client
tiravano numeri diversi). Il banco del motore controlla la distribuzione,
l'hash contro Math.imul, il Genio contro chi lo copia, la stessa carta turno
dopo turno, la ripetibilita' fra due client e i segni `aCaso` / `fraChi`.

E la regola dell'anteprima: un valore a caso si vede solo dopo aver giocato. I
cambiamenti marcati `aCaso` nella simulazione non si applicano; le carte che
potrebbero toccare (tutte le candidate, se il bersaglio e' pescato a caso)
mostrano il punto interrogativo — la carta trascinata, quelle in campo e
quelle in mano. Il "?" ha il bordo bianco sulla carta chiara. Il banco del
client usa un Genio, una Ginevra, un Leone e un +2 ALL finti.

## prova-accoppiamento-server.js e prova-rete-e-quest.js — online, hint, quest e scudi

    node strumenti/prova-accoppiamento-server.js [percorso/index.js]
    desktop/node_modules/electron/dist/electron.exe strumenti/prova-rete-e-quest.js

Quattro segnalazioni di Lorenzo (v0.80.1).
- ENTRARE IN PARTITA CON SE STESSI. Due sessioni dello stesso account in cerca
  (due finestre, due dispositivi) venivano accoppiate: "partita cominciata:
  f59b... contro f59b..." nel registro. accoppiati rifiuta l'accoppiamento; il
  biglietto porta `utente` (l'id senza trattini) e la domanda lo esclude; se un
  accoppiamento con se stessi arriva lo stesso, il client rimette in coda un
  biglietto invece di mostrare "Match error".
- L'HINT DELLA MANO. In rete si passava dal ramo del gioco a turni sullo stesso
  schermo, e a turno dell'avversario si accendeva il suo hint (a destra). Adesso
  in rete la mano apribile e l'hint sono solo i miei, a qualunque turno.
- LE QUEST. Il pannello sta nel menu, staccato dalla pagina durante la partita:
  mm2DisegnaQuest usciva prima di tenere l'elenco nuovo, e il pannello restava
  quello dell'accesso (i popup, fuori da ogni pagina, salivano giusti). L'elenco
  si tiene sempre; all'ingresso nel menu si ridisegna e si chiede a hx_quest.
- CARABOSSE E GLI SCUDI. La scena del gioco passa `latoProtetto` al motore; un
  debuff a caso sorteggia fra i gruppi scoperti e fra le carte che ne hanno
  (il motore lo prova in server/nakama/prova-caso.js, sezione 7).

## prova-punti-veri.js — i punti si incassano tutti, e la musica di fine partita e' giusta

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-punti-veri.js

Segnalazione di Lorenzo (v0.80.1): "a volte suona la musica di vittoria se si
perde". Due colpi ravvicinati aprivano una bolla sola e la chiudevano due
volte: la seconda chiusura non trovava la bolla e non incassava. 3 + 4 a 300ms
davano 3. E G.hp decideva vincitore, titolo, musica e racconto al server.
Adesso G.puntiFatti si scrive nell'istante dell'assegnazione (assegnaPunti,
ondataDanno), chiudiBollaPunti incassa anche senza bolla, i contatori del
ritratto girano in fila (_codaPunteggio) e la bolla conta dal suo valore invece
che da zero. finishGameWithResult e reteMandaImpronta leggono i punti veri.
(Da non confondere con prova-punti.js, che prova come si CONTANO i punti.)

## prova-buff-con-nome.js — nel riquadro "Buffs/debuffs" ogni riga dice da chi

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-buff-con-nome.js

Segnalazione di Lorenzo (v0.80.2), col Bianconiglio: "+1", "+2", "+2 ALL Self",
"-1 from Robin Hood". I numeri nudi erano i totali per gruppo, scritti per non
tacere mai e tolti solo se una riga col nome diceva alla lettera la stessa cosa:
con due fonti sulla stessa carta non succedeva mai. Regola nuova: "se un buff o
debuff non ha un nome non e' valido e non va mostrato". Il totale si scrive solo
quando ha un nome ("Self"); una voce del registro senza nome non si scrive.

Nella stessa versione:
- prova-gelo.js segue la lastra di ghiaccio della carta, che adesso e' un
  elemento .ghiaccio-carta dentro al piano che si inclina (e non piu' un
  ::after del supporto), e controlla che il gelo si formi (animazione
  geloArriva, ripresa al punto giusto se si ridisegna, vedi _geloDa); la lastra
  del tassello ha fusione e ritaglio sul gruppo che la contiene.
- prova-livelli.js controlla che il nastro "Lv up" stia dentro al piano che si
  inclina, cosi' segue il tilt della carta.

## prova-specchio-e-treccia.js — lo Specchio non eredita una trasformazione, la treccia tira dal punto giusto

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-specchio-e-treccia.js

Due segnalazioni di Lorenzo (v0.80.3).
- MAGIC MIRROR E GREEN PRINCE. trasformaCartaIn cambiava chiave, nomi e testi
  dell'abilita' ma non `abilita`: il Green Prince restava con la riga del
  Ranocchio ("se accanto a una Principessa, trasformati"), e chi copiava quella
  riga poteva trasformarsi a sua volta. Adesso la carta trasformata prende la
  riga della carta nuova (nessuna per il Green Prince e la Dark Strigoi), e
  _prendiAbilita scarta una trasformazione verso la forma che il donatore ha
  gia' (rete per le carte trasformate prima). Il banco prova la trasformazione
  in una carta senza riga e in una con una riga, la copia dal principe con la
  riga vecchia, la copia da una rana vera, e la rana calata in partita.
- RAPUNZEL. Lo strascico partiva da "centro della carta" meno "centro del
  tassello d'arrivo": riquadri diversi, quattro-cinque pixel che diventavano un
  primo passo all'indietro. cardSlideApplyTo misura adesso la carta d'arrivo
  prima di animarla (carta contro carta). Il banco guarda che il primo
  fotogramma sia dove la carta era e che da li' vada solo verso Rapunzel.

Carabosse che colpiva sempre lo stesso avversario: con due nemici l'hash della
v0.79.x estraeva sempre il primo (30 su 30); era gia' corretto dalla v0.80.0.
server/nakama/prova-caso.js lo prova adesso con due nemici.

## prova-badr-scambio.js — Badr al-Budur scambia con un nemico accanto, poi attacca

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-badr-scambio.js

Segnalazione di Lorenzo (v0.80.4): l'abilita' non funzionava. La riga del foglio
("on play, once per game, swap chosen opponent adjacent card single") non aveva
nessuno che la costruisse: sceltaDalFoglio conosceva lo scambio di posizione fra
due carte (il Pifferaio) e quello dei valori, non lo scambio della carta giocata.
La finestra non si apriva, la console diceva "[scelta non aperta]" e la carta
attaccava da dove era caduta; nessun NO_SCRIPT, perche' la riga c'era.

Adesso _sceltaScambiaCarta apre la finestra sui nemici accanto (candidatiDalFoglio:
mai un intoccabile), scambiaCarteConScivolata scambia le due carte facendole
scivolare con lo strascico di Rapunzel (diventato un elenco, _scivolate, perche'
le carte in movimento sono due) e ferma la caduta di chi era appena stato giocato,
e resolveConquestAndEndTurn fa partire lo scontro dalla casella in cui la carta
sta davvero. L'IA prova lo scambio sul tabellone e lo fa solo se rende di piu'.
Il banco prova finestra, scambio, scontro dalla casella nuova, rinuncia e IA.

## prova-briciole.js — le briciole di Tom Thumb

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-briciole.js

Regola di Lorenzo (v0.80.5): giocato, Tom Thumb lascia 3 briciole al centro di 3
caselle libere a caso (crumb-1/2/3.png, o crumb-dark-1/2/3.png se e' dark, larghe
80px al tabellone in HD). Una carta ALLEATA giocata sopra a una di quelle caselle
la mangia: munch.mp3, la carta brilla e pulsa, e prende +2 sul gruppo piu' alto.

- lasciaBriciole (in EFFETTI_PIAZZAMENTO_REALI['!tomthumb']): le caselle si
  sorteggiano col seme della partita, la casella di Tom e il turno — non l'id
  della carta, che in rete e' diverso sui due client — cosi' sono le stesse di
  qua e di la'. G.briciole: cella -> {owner, da, nome, variante, scura, ordine}.
- mangiaBriciola (in doPlace, appena la carta lascia la mano): +2 subito, prima
  dello scontro; munch e bagliore (.briciola-mangiata sul wobble-host) all'impatto.
  Una carta nemica copre la briciola e basta.
- bonusBricioleSimulato (in simulaPiazzamento): il +2 si vede in anteprima e l'IA
  lo conta, senza consumare la briciola.
- disegnaBriciola nel ramo delle caselle vuote di renderBoard; arrivo in fila
  (.briciola-arriva col ritardo); le briciole stanno nella firma della plancia.
- TILE_ABILITIES_DEF['!tomthumb'] la rende "programmata" (niente NO_SCRIPT).

Il banco prova numero, caselle, fazione, misura e centro, stesso caso con un
altro id, anteprima, alleato che mangia (+2, munch, bagliore, riga "from") e
nemico che copre.

## prova-codice.js — il codice parte da solo, e dopo il codice si entra (v0.80.6)

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-codice.js

Segnalazione di Lorenzo (v0.80.6): registrandosi con Google il codice a 6 cifre
non arrivava (arrivava solo con "Send a new code"), e dopo averlo inserito si
tornava al login e bisognava ripremere "Login with Google".

- accessoEntra: se l'account e' da verificare e non e' mai partito un codice (o
  quello partito e' scaduto) lo spedisce da solo prima di aprire le caselle. Il
  server lo dice con `inviato` in hx_verifica_stato (nuovo campo, schierato).
  Un codice ancora buono non si rimanda: lo annullerebbe.
- completaRegistrazione: codice giusto -> accessoEntra con la stessa sessione
  (sedia, accordo, menu). Vale anche per la registrazione con email.

Il banco, sezioni 4 e 4b: si entra da soli; account Google nuovo -> codice
spedito; codice buono gia' partito -> niente; scaduto -> nuovo.

## prova-uscita-senza-splash.js — Disconnect torna subito al login (v0.80.6)

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-uscita-senza-splash.js

Richiesta di Lorenzo (v0.80.6): Disconnect salta lo splash di Big Fennel.

- _fuoriDalGioco({senzaSplash}) scrive #uscito nell'indirizzo prima di
  ricaricare (niente nel browser). Uno script subito sotto a #splash lo legge,
  toglie il velo e ripulisce l'indirizzo: RIENTRO_DA_USCITA.
- runPreload: niente dissolvenza di 3s dello sfondo; revealLogoAndButtons: il
  modulo entra col logo. Il segno vale una volta sola.
- decode() dopo una ricarica puo' non rispondere mai (misurato in Electron):
  sfondo, immagini nascoste, precaricamento e arte hanno un tetto di 800ms
  (DECODE_ATTESA_MAX_MS). Prima lo copriva lo splash; senza, la barra restava
  ferma.

Il banco: splash all'avvio, niente splash e indirizzo pulito dopo Disconnect,
modulo in ~2.5s invece di ~8, splash di nuovo a un aggiornamento a mano.

## prova-icone-scelta.js — icone di scelta a meta' (v0.80.6)

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-icone-scelta.js

Richiesta di Lorenzo (v0.80.6): tutte le icone che compaiono quando un'abilita'
chiede un'azione, piu' piccole del 50%.

- SCALA_ICONE_SCELTA = 0.5 dentro buildSvgIconBtn: mirino/icona della scelta,
  mano da trascinare e X per rinunciare. Anello e contatore delle scelte
  multiple seguono. .scarta-croce (mano) da 74 a 37px.

Il banco misura mirino (R*0.31) e X (R*0.21) contro il tabellone, il clic sul
mirino, e la croce dello scarto.

## prova-board-score.js — il punteggio delle carte in tavola (v0.80.7)

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-board-score.js

Richiesta di Lorenzo (v0.80.7): il componente "!board-score" del Figma (Battle
Screen, 975:28506) in partita, appeso al bordo superiore (-2px). Dice quanti
punti valgono adesso le carte di ognuno, cioe' quanti ne arriveranno a fine
turno. dark-card-icon al giocatore dark, light-card-icon al light.

- #board-score (markup accanto a #p2-info, in PAGE_ELEMENT_IDS.game): 68 di
  altezza, padding 12, gap 16, angoli bassi a 12; bordo 1.5px bianco 22% come
  strato (::after) perche' in Figma il tratto non occupa spazio; fondo a
  gradiente + brushed-texture in overlay al 40% (--hx-trama da
  montaGraficaPartita) + backdrop blur 20. Numeri Marcellus SC 50 in oro
  (text-box trim cap), scritta 22 DDCAA1. A 0 e 0 e' largo 329 come nel disegno.
- carteCheFruttano(): il primo pezzo di dannoDiFineTurno, estratto: lo leggono
  sia l'onda sia aggiornaBoardScore, quindi il pannello promette esattamente
  quello che l'onda consegna (common 3, rare 2, mythic 1, timeless 0).
- aggiornaBoardScore() gira in cima a renderBoard, prima della firma.
- io-sono-2: il pannello e i due lati si rovesciano, icone sempre fuori.
- #board-wrap scende di 25px (translateY da -15.4 a 9.6, anche in
  BASE_TRANSFORM del pizzico): la punta del tassello in cima finiva sotto al
  pannello. E' la posizione del Battle Screen.

Il banco prova misure, conto (anche dopo una conquista), icone per fazione,
scambio dei lati, tabellone sotto al pannello e assenza nel menu.

v0.80.8 — i numeri erano tagliati in basso (segnalato da Lorenzo). text-box
chiude il box sulla linea di base e background-clip:text dipinge l'oro solo
dentro al box: le cifre che scendono (3, 5, 7, 9) restavano mozzate. .bs-num ha
ora padding 10/6/20 con margini negativi uguali: si dipinge piu' in largo, ma
l'ingombro resta 35 e la cifra non si sposta. Il banco misura con un canvas
quanto le cifre di Marcellus SC escono da base e maiuscola e controlla che il
padding le contenga, e che l'ingombro sia ancora 35.

## prova-pacchetti.js — la top-bar nuova di Unpack (v0.80.10)

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-pacchetti.js

Richiesta di Lorenzo (v0.80.10): la barra del titolo di Unpack diventa la
"top-bar" del Figma (987:31546). A sinistra Back in un contenitore, al centro lo
stendardo del titolo, a destra il colore delle carte in un contenitore; l'icona
del colore e' stata ingrandita.

- .hx-topbar (classi generiche: Main menu e Library & Decks la prenderanno):
  fascia 90 in cima, 12 ai lati. .hx-topbar-contenitore 150x66, raggio 20, lo
  stesso vetro di #board-score (gradiente -32.1deg, --hx-trama in overlay 40%,
  blur 20, bordo 1.5 bianco 22% come ::after). .hx-topbar-titolo 297x90 con
  title-bar.png (--hx-titolo-sfondo, vestiTitoli), h1 Marcellus SC 36 EDE0C6,
  ombra 8, box tagliato alla maiuscola a 20 dal bordo.
- Freccia: back-button.png a 40.34x42.71. Colore: color-dark/light.png a 40.5
  con margini -2.25 (nodo 36, anello che sborda), scritta larga 53.
- Via le regole per id di #pack-header / #pack-main h1 / #pack-toggle-variant:
  un id batte una classe e avrebbero ricoperto la barra nuova. Gli id restano
  (packs-back, pack-toggle-variant, -label, -icon): li cercano la sequenza di
  apertura, packUpdateToggleLabel e i banchi.

## prova-menu-sx.js — il Main menu nuovo (v0.80.11)

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-menu-sx.js

Richiesta di Lorenzo (v0.80.11): stessi elementi, disposizione nuova (Figma:
Main menu, 985:29258). Decisioni sue: via il logo e lo Shop; "+" solo sulla
fairy dust; la riga e l'alone delle bustine restano; via "Season N rank"; il
mazzo resta la casella di sempre (prima carta del mazzo); modalita' non scelta
= niente bagliore, bordo bianco 20% in overlay; Play vs Bot mostra lo stesso
centro e il pulsante non cambia funzione; le schede delle quest cambiano solo
misure e stacchi; il numero di versione resta quello del gioco. Gli asset sono
quelli di ui/ (avatar-frame.png, matchmaking-container.png con cornice gia'
dentro, le icone delle valute cosi' come sono): da Figma solo misure e colori.

- .mm2-vetro: il materiale di tutti i riquadri (gradiente per riquadro,
  --hx-trama in overlay 40%, bordo ::after che non occupa spazio, sotto ai
  figli posizionati).
- #mm2-topbar 102: #mm2-giocatore (avatar 80x87.37 con la cornice spostata
  perche' la foto sia 69.28x80, orb 46 a 17/60.69, nome e XP 134), #mm2-nav a
  7 di gap con i non scelti al 60%, #mm2-valute (id #mm-ink/#mm-dust: adesso il
  lampo del pagamento si vede anche nel menu).
- #mm2-sx: .mm2-scheda 370x200 a 19, icone inclinate come nel disegno.
- #mm2-centro 890 a 515.5/236: #mm2-testata (rank 260x59, separatore, "Select
  deck:", #mm2-gioca-deck 381x70), #mm2-modi (.mm2-modo scelto/spento,
  mm2ScegliModo), #mm2-gioca 313x82 con #mm2-find-raggi.
- #mm2-dx a 1551/237: #mm2-quest-pannello 370x638, schede 61 a 12 (solo nel
  menu; l'avviso in basso resta a 55).
- #mm2-basso: settings, bug, news 48x51 a 20 dai bordi.
- Tolte le regole CSS del menu vecchio; quelle di #pack-ink-fisso (Unpack)
  riscritte a parte con gli stessi numeri.

Il banco prova i tre riquadri (misure, posti, vetro uguale, pulsanti, riga
delle bustine, PayPal), che lo Shop e le valute non stiano piu' a sinistra, e
che le quest siano alte 638 come la colonna e finiscano con le modalita'.

v0.80.12 — LA v0.80.11 AVEVA CANCELLATO 351 RIGHE DI CSS CHE NON C'ENTRAVANO.
Segnalato da Lorenzo con due schermate: moduli d'accesso tutti aperti insieme,
frecce indietro enormi, finestre senza pannello. Lo script del menu toglieva la
vecchia fascia in basso "fino a #mm2-xp-mask": avevo letto due tratti del file
incollati (sed '1301,1336p;1687,1704p') credendoli uno, e quel #mm2-xp-mask stava
390 righe piu' in la'. In mezzo c'erano la colonna d'accesso (.hx-modulo,
#start-accesso, .hx-indietro), le finestre, le caselle dei mazzi, gli avvisi.
I banchi del menu passavano tutti: guardavano il menu, non le finestre.

Rimesso il tratto esatto dalla v0.80.10 (versions/Hextale_0.80.10.html, dalla
riga 1337), nello stesso punto. Poi confronto dei selettori di primo livello
fra v0.80.10 e adesso: mancano 25 selettori, tutti del menu vecchio, nessun
altro. Per le prossime sostituzioni a tratti: dopo, fare SEMPRE quel
confronto — dice in un colpo cosa e' sparito, anche da parti che nessun banco
guarda.

v0.80.13 — PLAY VS BOT (segnalato da Lorenzo: "non posso piu' cliccare").
#mm2-giocatore e #mm2-valute sono larghi meta' barra ciascuno (flex:1) e
stavano sopra a #mm2-nav, che e' assoluto al centro: il gruppo delle valute
copriva Play vs Bot e si prendeva il clic. #mm2-nav ha adesso z-index 2.
E la vista contro il bot (mm2Vista('ai')): stesso centro, titoli "PvB Draft" e
"PvB Normal", #mm2-online nascosto (#mm2-centro.vista-bot); l'etichetta "Start
match vs Bot" e quel che fa il pulsante non cambiano. Il banco (sezione 3b)
clicca dove clicca il mouse — elementFromPoint al centro del pulsante — perche'
chiamare mm2Vista a mano sarebbe passato anche col pulsante coperto.

v0.80.14 — i titoli contro il bot diventano "Draft vs Bot" e "Normal vs Bot"
(Lorenzo), e il riquadro Normal ha un'immagine sua: matchmaking-container-bot.png.
Le due immagini stanno tutte e due nel riquadro (.mm2-modo-fondo e
.mm2-modo-fondo-bot) e #mm2-centro.vista-bot sceglie quale si vede: cambiare
l'indirizzo di un'immagine sola e' asincrono, e passando in fretta da una vista
all'altra resterebbe quella arrivata per ultima. Il banco controlla quale
immagine si vede nelle due viste.
Nella stessa versione, sempre da Lorenzo: #mm2-find (e #mm2-gioca, che lo
centra) largo 400 invece dei 313 del Figma; le due illustrazioni della colonna
di sinistra non piu' in object-fit:cover sul riquadro del Figma, che le
tagliava (la busta perdeva la cima) — un lato scritto, l'altro dal file; la
scatola dei mazzi il 15% piu' grande (188.09 di altezza).
E ancora:
- titoli delle modalita': 16 di margine ai lati invece dei 46 del Figma, o
  "Draft vs Bot" (208) e "Normal vs Bot" (244) venivano tagliati nei 205.
- la trama (--hx-trama, 847x809.5) si RIPETE: in no-repeat copriva meno di
  meta' della barra in alto. Vale per .mm2-vetro, #mm2-rank, i contenitori
  della top-bar di Unpack e #board-score.
- quest: i popup vanno in basso a destra (#quest-avvisi right:24px);
  quest-advance.mp3 e quest-complete.mp3 non erano fra i suoni precaricati
  (SUONI_SFX_EXTRA) e restavano muti; questMostraMosse, se una mossa non trova
  la sua quest in QUEST_OGGI, chiede prima l'elenco al server e scrive in
  console quelle che restano senza.

v0.80.15 — ritocchi di Lorenzo: nel pannello delle quest nome e conto delle
schede a 16 invece di 14 (#mm2-quest-corpo .quest-nome/.quest-conta; l'avviso
in basso resta a 14); la scatola di Library & decks un altro 20% piu' grande
(225.71 di altezza) e 15 piu' in basso (translate da -24.85 a -9.85, e lo
stesso nell'hover). prova-menu-sx controlla le tre misure.

## Anteprima e rilascio (v0.80.15) — prova-anteprima-rilascio.js

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-anteprima-rilascio.js

Lorenzo (13 set 2026): "ci sono dei giocatori online e non voglio che vengano
disconnessi al push di una nuova versione". Due cose buttavano fuori chi gioca:
- ogni client guarda patch-notes.txt ogni 2 minuti (sorvegliaLaVersione) e, se
  la prima voce e' piu' nuova della targhetta, blocca e ricarica in 10 secondi,
  anche a partita in corso;
- server/nakama/schiera.sh riavvia Nakama: cadono collegamenti e partite.

COME SI LAVORA ADESSO
- Si sviluppa su play/index.html sul computer. Per farla vedere a Lorenzo:
      bash strumenti/pubblica-anteprima.sh "cosa c'e' di nuovo"
  copia play/index.html in anteprima/index.html e committa/pusha SOLO quella:
  https://hextalegame.com/anteprima/ . patch-notes.txt non si tocca, quindi per
  chi e' su /play/ non esce niente di nuovo e nessuno viene ricaricato.
- L'anteprima e' la stessa pagina con ANTEPRIMA vera (percorso /anteprima/):
  la targhetta dice "preview" e Find opponent non cerca in rete (si
  incontrerebbero giocatori con un'altra versione); Play vs Bot funziona. Parla
  col server vero e con l'account vero.
- Il rilascio lo decide Lorenzo: allora si committano insieme play/index.html,
  patch-notes.txt, l'archivio in versions/, LEGGIMI e i banchi, e se c'e' un
  cambio al server si schiera nello stesso momento.

E PERCHE' IL RILASCIO FACCIA MENO MALE
- controllaVersioneDaNote non blocca piu' a partita in corso (_activePage ===
  'game', schermata di fine compresa): segna _aggiornamentoInAttesa, e
  PAGE_ENTER_HOOKS.mainmenu riguarda subito le note al ritorno nel menu.
  (I client gia' in giro prima di questa versione si comportano ancora alla
  vecchia maniera: vale dal rilascio successivo.)
- schiera.sh chiede prima a hx_giocatori quanti sono online (da dentro al
  contenitore di Caddy, con la chiave del suo ambiente: qui non passa). Se c'e'
  qualcuno si ferma; HEXTALE_FORZA=1 per riavviare lo stesso.

E NELLA STESSA VERSIONE: "Give us feedback" (Lorenzo) apre
https://forms.gle/54LgVmaoXKpnVpwh9 con window.open (nell'app desktop il browser
di sistema, via setWindowOpenHandler). Nel menu sta nel riquadro della
donazione sotto al Donate, al posto della scritta "Support the development";
nelle impostazioni sotto al Donate.

Il banco apre la pagina da /play/ (niente preview, modulo dal menu e dalle
impostazioni, aggiornamento che aspetta la partita) e una copia in una cartella
/anteprima/ temporanea (targhetta preview, niente rete, bot si').

v0.80.15 (anteprima) — #board-score largo 500 (Lorenzo): justify-content
space-between porta i due gruppi punteggio+icona contro i bordi, e .bs-etichetta
e' assoluta al centro del pannello, cosi' non scivola quando i punteggi cambiano
numero di cifre. prova-board-score: larghezza, gruppi ai bordi, scritta al centro.

## prova-libreria.js — Library & Decks col Figma nuovo (v0.80.15, anteprima)

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-libreria.js

Lorenzo (13 set 2026): la barra sopra e' la top-bar di Card packs con il numero
di carte sbloccate e totali sotto al titolo; la barra laterale e' piu' bassa e
le caselle dei mazzi sono 10 (prima 12); la barra in basso filtra le carte per
nome e il tasto a destra apre la finestra dei filtri. "Il resto e' pressoche'
tutto uguale" — la finestra dei filtri non cambia (nel Figma manca Reset
filters, ma resta).
- #card-db-header e' una .hx-topbar (stessi pezzi di #pack-header: Back, lo
  stendardo, il colore; id di prima). #card-db-count sta dentro allo stendardo:
  assoluto, cima a 59, Marcellus SC 16 in C6CFD0, testo unico "possedute/totali".
  montaGraficaLibreria chiama vestiTitoli e mette la trama ai contenitori.
- la lista: #card-db-grid-viewport 1424 a partire da (32,81) fino in fondo;
  cardDbLayoutGrid usa CARD_DB_CARD_W 252.34 e CARD_DB_PAD_SX 18.67 del Figma
  invece di dividere lo spazio. L'altezza resta quella della carta (210x360:
  432.58, il Figma dice 430.33). 81 + PAD_TOP 25 = il 106 del disegno.
  CARD_DB_SPAZIO_BARRA (110) allunga lo scorrimento perche' l'ultima fila salga
  sopra alla barra.
- #card-db-barra-cerca 771x80 a (358,970), centrata sulla lista. #card-db-cerca
  chiama cardDbApplyFilters a ogni tasto; ogni casella porta dataset.nome gia'
  passato per normalizzaRicerca (minuscole, senza accenti, spazi singoli). La
  ricerca si SOMMA a rarita' e tratti; Reset filters non la tocca.
  #library-filters e' sceso qui (niente piu' .hx-btn).
- #card-db-right 423x962 a (1485,106), angoli 28, padding 20, appoggiata in
  fondo. MAZZI_SLOT = 10; il server (MAZZI_MAX) accetta ancora 12, quindi non
  c'e' niente da schierare: chi ne ha gia' 11 o 12 li vede tutti (non si taglia
  piu' la lista) e #deck-list scorre. La separazione prende lo spazio che avanza
  (.deck-lista-riga flex 1; .deck-slot-svanita gli azzera flex-grow in
  modifica); .deck-importa del Figma, 48 con angoli 16.
- in modifica il pannello di prima non ci stava (911 in 876: Save usciva e la
  barra della capacita' si schiacciava a 0). Stretto come nel Figma "Edit deck":
  padding 24/24/16 e gap 0 sulla riga, gap 16 nel pannello, nome 38, niente
  .filters-riga, contatore-barra-capacita' a 4px, .deck-distrib 54 con
  l'esagono a 72. .deck-edit > * non si restringe: se un giorno non ci sta,
  deve vedersi.
Il banco clona le quattro carte offline fino a quaranta (meta' "Fox") e guarda
misure, ricerca (anche sommata alla rarita'), fondo della griglia, caselle con
4, 10 e 12 mazzi, e il pannello di modifica.

## prova-mazzi-server.js e prova-mazzi-client.js — il sorteggio non torna (v0.80.16)

    node strumenti/prova-mazzi-server.js
    desktop/node_modules/electron/dist/electron.exe strumenti/prova-mazzi-client.js

Il "Match error" del 13 set 2026 (registro di Nakama, 13:02:51 UTC):
"mazzo di e18cf1a1... con 3 carte invece di 12". Account nato alle 12:09 col
sorteggio (Starter Princess), alle 12:11 ha scelto dalla lettera lo Starter
Trickster. Sul server pero' il mazzo scelto era di nuovo "starter-3": una copia
dei mazzi letta PRIMA della scelta e' stata salvata sopra a quella nuova, e
_mazziPuliti ha tolto le carte non piu' sue. Restavano fox e kitsune (in comune
fra i due starter) e hare (da un pacchetto alle 12:57). Il suo client diceva
12/12 perche' mazzoValido non guardava il possesso, quindi lo ha lasciato
cercare; il server ha rifiutato l'accoppiamento e il messaggio a entrambi
diceva "Check that your selected deck is valid". Lorenzo: "fai in modo che
non succeda piu' che il server sbagli tra mazzo temporaneo e quello definitivo".
SERVER (va schierato)
- i mazzi hanno una `versione`: la alzano creaMazzoStarter, rpcMazziScrivi e
  _riparaMazzi. rpcMazziScrivi riceve `base` (la versione su cui il client ha
  lavorato) e, se sul server ce n'e' una piu' nuova, NON scrive e risponde
  { conflitto:true, mazzi, scelto, versione }.
- una lista con "starter-N" di uno starter che il giocatore non ha
  (_eStarterNonSuo: N non in possesso.mazzi) e' una copia di prima della scelta:
  stesso rifiuto, anche dai client vecchi che `base` non la mandano.
- _riparaMazzi toglie il mazzo del sorteggio e rimette al suo posto quello
  dello starter del giocatore (e la scelta, se puntava al sorteggio). Gira in
  rpcMazziLeggi, rpcMazziScrivi, dopo la scelta in rpcStarter (anche quando il
  giocatore ha altri mazzi e creaMazzoStarter non riscrive) e in _mazzoDi,
  cioe' anche in matchmaking: chi e' gia' rotto si ripara da solo.
  Nel registro: "mazzi riparati per ..." e "mazzi di ... NON scritti: ...".
- _carteDelloStarter: le carte di uno starter, tolte da creaMazzoStarter.
CLIENT
- sincronizzaMazzi: conta solo l'ultima lettura partita (_mazziLetture); la
  lettura all'accesso non e' aspettata e poteva arrivare dopo quella della
  scelta. _adottaMazziDalServer e' l'unico punto che mette in memoria mazzi,
  scelta e _mazziVersione.
- mandaMazziAlServer manda `base`; col conflitto adotta la copia del server e
  avvisa ("Decks updated"); a salvataggio riuscito adotta cio' che il server ha
  scritto (solo se diverso, e solo se non c'e' un altro salvataggio in coda).
- cartaTua(entry): posseduta secondo il server (sempre vero senza possesso noto
  o per un admin). mazzoGiocabile = mazzoValido + carte tutte tue, e lo usano
  la ricerca (mm2CercaAvversario), la scelta e Save Deck. mazzoValido NON
  cambia: giudica anche il mazzo dell'avversario e quelli generati.
- importaMazzoDalCampo tiene solo le carte tue e dice quante ha lasciato fuori.
- Match error: "one of the two decks could not be used" (poteva essere il mazzo
  dell'altro) e i mazzi si rileggono dal server.

## prova-sessione-account.js e prova-nomi-admin.js — le carte di un altro (v0.80.17)

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-sessione-account.js
    node strumenti/prova-nomi-admin.js

Lorenzo (13 set 2026): "dopo aver comprato una busta, un utente aveva
sbloccato tutte e 107 le carte. al login sono sparite quelle extra". Registro di
Nakama: il server non ha mai dato carte a nessuno (solo acquisti e aperture
normali, e "admin=false" ovunque); fra le 12:37 e le 12:40 pero' un client ha
premuto i pulsanti del menu di debug (hx_debug_regala, hx_bustina_azzera) e il
server li ha rifiutati ("serve un account admin"), e alle 12:48 ha provato ad
aprire pacchetti reward che per il server non aveva.
Tutte le carte (carteDelGiocatore) e il menu di debug (debugPermesso) si
accendono per una cosa sola, GIOCATORE_ADMIN, che arriva con hx_avvio. Quindi in
quella pagina e' arrivata la risposta di un account admin mentre la sessione era
di un altro account. Porte che lo lasciavano passare, chiuse:
- nakamaRpc consegnava qualunque risposta arrivasse. Adesso confronta l'uid del
  token (nakamaUtenteDaToken) di chi l'ha chiesta con quello della sessione
  attiva quando arriva: se l'account e' cambiato, o si e' usciti, la scarta con
  codice 409. Un rinnovo del token dello stesso account non scarta niente.
- cambiando account (_passaAllaSessione, usata da nakamaSalvaSessione e dalla
  verifica del codice) o dimenticando la sessione, azzeraStatoAccount butta
  admin, carte possedute, copie, mazzi, versione dei mazzi, pacchetti, e chiude
  il menu di debug. _utenteDelloStato dice di chi sono i dati in memoria.
- completaRegistrazione e rimandaIlCodice usavano la sessione che c'era gia'
  al posto di quella appena nata (`if(!sessioneAccount && _verificaSessione)`):
  il codice si provava sull'account sbagliato e si entrava con quello.
- mandaMazziAlServer: un 409 (account cambiato) non avvisa nessuno.
Il percorso preciso che ha portato quel giocatore ad avere due account nella
stessa pagina non si legge dal registro: le RPC rifiutate non portano l'uid.
SERVER (va schierato) — trovato cercando, non la causa di quel giorno:
eAdmin dava l'admin (per sempre, nei metadati) a chi aveva un nome uguale a
NOMI_ADMIN in minuscolo. Per il database "loreadmin" e "LoreAdmin" sono nomi
diversi, quindi il primo si poteva prendere. Adesso: admin per nome solo col
nome esatto; _nomeDaAdmin ferma registrazioni (email, dispositivo, custom:
primaDiEntrareConNome; Google: dentro primaDiGoogle) e cambi di nome
(primaDiCambiareProfilo) con un nome da admin, salvo per chi e' gia' admin per
contrassegno (_adminDaContrassegno).

## prova-bustina-rifiutata.js — il pacchetto che il server non apre (v0.80.18)

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-bustina-rifiutata.js

Registro di Nakama, 13 set 2026 12:48-12:49 UTC: tre volte "hx_bustina_apri ...
non hai un pacchetto di tipo reward". _bustinaChiediAlServer tornava null per
QUALSIASI errore e bustaPosa, che aveva gia' scalato il contatore, pescava tre
carte in locale (_pescaCartaBustina): il giocatore le vedeva uscire, sceglieva,
le vedeva volare nella collezione, e la raccolta scriveva solo "bustina locale:
niente possesso". Il commento diceva "rete muta", ma il ramo prendeva anche i
rifiuti veri.
COSA FA ADESSO (solo client, il server non cambia)
- _bustinaChiediAlServer lancia, col `codice` di nakamaChiedi: 0 se la
  richiesta non e' arrivata, altrimenti la risposta del server; 200 per una
  risposta senza le tre carte o con slug che il catalogo del client non conosce.
- bustaPosa annota cosa scala (_bustaSpesa) e il numero della busta
  (_bustaGiro): la risposta di una busta che non e' piu' quella in corso non
  tocca niente, e nemmeno una che arriva a pagina gia' tornata indietro.
- bustaNonSiApre: la busta svanisce (busta-via, come in bustaRimetti), i colpi
  smettono di contare, dopo 400 ms tornaAllaBustina libera la pagina. Avviso
  rosso "Can't open pack": "Check your connection and try again" col codice 0,
  "it is not available right now" negli altri casi.
- _bustinaRidaiPacchetto rilegge da hx_avvio SOLO bustineExtra, bustineTesoro e
  bustinaProssima: se il server ha detto di no il numero del client era
  sbagliato, e rimetterlo e basta farebbe ripetere lo stesso rifiuto (quel
  giocatore ci ha provato tre volte). Se nemmeno hx_avvio risponde si rimette a
  mano quello scalato; con un 409 (account cambiato) no.
- bustaApri, se stava aspettando la risposta, si ferma; senza carte chiama
  bustaNonSiApre prima del lampo (c'era un toast in italiano).
- La pescata locale non c'e' piu', nemmeno a rete muta: il server tiene da parte
  il pacchetto gia' sorteggiato (`ripresa` in rpcBustinaApri), quindi riprovare
  non perde niente, mentre tre carte mostrate e mai date sono una bugia.
Il banco finge fetch solo per le RPC (il resto va alla fetch vera), cosi' gli
errori passano da nakamaRpc e nakamaChiedi veri. Sei casi: rifiuto mentre si
martella la ceralacca, rifiuto con il pacchetto ancora sul server, rifiuto a
sigillo gia' rotto, rete muta sul pacchetto a tempo, apertura buona, risposta
per una busta lasciata. Sulla v0.80.17 fallisce 19 controlli su 35.
Trappola: showPage('packs') va chiamata PRIMA di cercare #pack-overlay. Le
pagine che non si vedono non sono nel documento, e cercato prima risponde null.

## prova-segnalazioni-v08018.js — filtri, gelo simulato, Pixies, quest in partita (v0.80.18, anteprima)

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-segnalazioni-v08018.js

Segnalazioni di Lorenzo, 13 set 2026 pomeriggio. Il banco carica il catalogo da
server/importazione/.lavoro/catalogo.json (servono Sherazade, le Pixies, Robin Hood).
- FILTRI (Figma "Library & Decks - Filters modal"): _filtroOpzione mette la
  casella PRIMA di icona e nome (sempre dopo la <input>, per `:checked ~`);
  12 fra casella e icona (#filters-pannello .filters-casella), 8 fra gemma e
  nome, 4 fra icona del tratto e nome; tratti in colonne 162/163/162 con 52 e
  26; "Rarity" e "Trait" tagliati alla maiuscola. Nient'altro cambiato.
- CASELLE QUADRATE: checkbox-square-checked/unchecked sono 64x64 tutte e due;
  la spuntata non cresce piu' di 10px (tolte anche le eccezioni per
  .settings-opzione e #nca-spunta-riga, che toglievano quel margine).
- FILTERS nella barra in basso: alto 26 in una barra da 80. Adesso padding
  16/20/16/8 e margini negativi uguali: prende tutta l'altezza e fino al bordo
  destro, e quello che si vede non si sposta.
- IL BOT CHE NON GIOCA E LA BOARD GHIACCIATA: simulaPiazzamento sostituiva
  tabellone e mani ma non G.gelo. Il gelo di Sherazade ("freeze any board tile
  free 1"), simulato per l'anteprima della mano o per l'IA (aiEvaluateConquests
  simula ogni carta su ogni casella), gelava un tassello VERO a ogni prova, il
  primo libero non ancora gelato: in un turno dell'IA si gelava tutto, e l'IA
  non trovava piu' caselle. Adesso la simulazione gela una copia e rimette G.gelo.
- PIXIES: le sinergie dal foglio passano da ricalcolaValoriVivi, che non segnava
  il caso. In simulazione, se una sinergia continua a lati RAND/ONE/random
  cambia i numeri di una carta (_toccataDaContinuoACaso), la carta e'
  __aSorte e l'anteprima mostra "?".
- QUEST IN PARTITA: questSegnaConquiste chiama questAvanzaInPartita, che fa
  salire il popup nell'istante in cui si girano carte (QUEST_OGGI + QUEST_CONTO;
  quali quest si muovono girando carte sta in QUEST_CONTA_IN_PARTITA, perche'
  l'elenco del server non lo dice). _questMostrateInPartita evita che a fine
  partita questMostraMosse ripeta lo stesso avanzamento; si azzera in initGame.
  riferisciPartita prende il conto PRIMA di aspettare hx_partita e lo passa a
  questRaccontaFinePartita(pvp, conto), che allora non azzera quello di adesso.
- BRUCALIFFO DEL BOT: non e' un difetto. Il bot gioca le carte a un livello
  pareggiato sul mazzo del giocatore (pareggiaILivelli); l'abilita' del
  Caterpillar si sblocca al livello 2, e a livello 1 non fa niente (niente fumo).
NOTA: due sessioni di Claude hanno lavorato nella stessa cartella. Il commit
fcc6f95 (pacchetti rifiutati) ha preso dentro meta' di queste modifiche mentre
erano in corso; il commit che segue le completa.

### prova-caso-tutte-le-carte.js — il caso non si vede in anteprima, carta per carta

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-caso-tutte-le-carte.js

Lorenzo (Pixies, dopo la prima correzione): "appare il punto interrogativo ma
appare ancora la preview. così non è più random" e poi "quando c'è incertezza,
mostra sempre i '?' e mai i valori in anteprima. Fai un check di tutte le carte".
Il "?" c'era, ma accanto ai numeri SIMULATI (col tiro dentro). Adesso, col caso
di mezzo, i numeri simulati non si usano da nessuna parte: restano quelli di
adesso, senza verde e rosso, col "?":
- computeDragPreview: se l'esito e' a sorte, dopoAbilita non si applica;
- renderBoard (carte in campo): con aSorteInCampo i valori simulati non si applicano;
- renderHand (carte in mano): con aSorteInMano `arrivo` resta card.values;
- riscuotiPremioProssimaGiocata in anteprima, premio a lato RAND/ONE (Tin
  Woodman): la carta che lo riscuote e' __aSorte;
- _toccataDaContinuoACaso capisce il caso delle sinergie continue rifacendo il
  conto con semi diversi (le Pixies contano gli ALTRI Trickster: isolarle le
  azzerava).
Il banco non ha un elenco di carte: per ognuna del catalogo (livello 4) simula
il piazzamento con sei semi diversi (G._semeSinergie) su una scena con vicini
alleati e nemici di tratti diversi, e dove i numeri cambiano pretende il "?"
senza numeri simulati (trascinata, in campo, in mano). Controlla anche che la
simulazione non lasci niente sulla partita vera (gelo, premio, briciole, muri,
pescata). Nota: gli effetti a sorte "una tantum" del motore (Genie, Guinevere,
Cowardly Lion...) in simulazione non si applicano affatto (applicaCambiamenti
salta gli aCaso e segna __aSorte), quindi i loro numeri non cambiano: il banco
li prova a parte, chiedendo che l'incertezza sia dichiarata.

## prova-sticker-server.js e prova-sticker.js — gli sticker (v0.80.19, anteprima)

    node strumenti/prova-sticker-server.js
    desktop/node_modules/electron/dist/electron.exe strumenti/prova-sticker.js

Figma "Battle Screen - Stickers". Chi gioca ha l'icona sotto alle impostazioni;
cliccandola si apre "Send a sticker" con cinque sticker (uguali per tutti), che
si illuminano al passaggio. Cliccandone uno il menu si chiude e compare
sticker-bubble con lo sticker in mezzo, per 3 secondi, dal lato di chi l'ha
mandato: la punta della coda (359,36 in sticker-bubble.png) sul centro del suo
avatar, specchiata a sinistra. Entrata elastica (aiSpeechPop), senza suono ("troppo spammy").
Piu' di 5 in 10 secondi: bloccati 2 minuti, "Send a sticker (1:59)" / "(7s)",
sticker al 30%. Il blocco vale solo dentro la partita.

In rete: il client manda op 14 {sticker}; il server (_sticker) controlla nome,
partita cominciata e non finita, conta per giocatore dentro state.sticker e
rimanda a tutti op 15 {di, sticker}, oppure al solo mittente op 16 {resta}. Il
mio lo mostro subito al clic, quindi l'op 15 col mio numero si ignora. Contro il
bot e' tutto locale (il bot non risponde). Il menu si chiude anche con Esc e
con un clic fuori; a fine partita l'icona sparisce, initGame azzera il blocco.

Il banco del server fa girare partitaLoop con un orologio finto (5 passano, il
sesto blocca 120000 detti solo a lui, a meta' blocco resta 60000, l'avversario
non e' toccato, dopo due minuti si rimanda, sparsi non bloccano mai). Quello del
client misura impostazioni (369,30), icona (371,119.74 63x63) e menu (351,99.74 largo 776), clicca,
controlla bolla, specchio, punta sull'avatar (anche da giocatore 2), suono,
uscita, blocco, Esc, clic fuori, op 14/15/16 con mmManda finto e fine partita.
Nota: lo sticker dentro la bolla si misura a molla ferma (dopo l'entrata).
Poi (Lorenzo): impostazioni e icona sticker 55px piu' a sinistra (369 e 371, il
menu a 351; #report-btn resta speculare a right:369, lo pretende prova-report);
il menu si apre e si chiude in dissolvenza di 200ms (opacity + visibility, il
banco guarda getAnimations perche' fuori schermo i fotogrammi non corrono);
"Send a sticker" e il timer a sinistra, 16 dopo l'icona.

## prova-quest-volo.js — il premio di una quest vola dove va (v0.80.19)

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-quest-volo.js

Lorenzo: riscosso un premio, la sua icona vola sopra all'elemento a cui
appartiene, con una traiettoria curva che accelera e una scia. Il magic ink va
all'icona del contatore in cima: arrivato sparisce, l'icona lampeggia e pulsa
una volta, il saldo si aggiorna, kaching.mp3. La busta va al pulsante "Card
packs", che lampeggia, pulsa e suona card-draw.mp3. quest-collected.mp3 al clic
resta.

Come (questVolaPremi, dopo mm2RiscuotiQuest): le partenze si misurano sulle
icone delle schede PRIMA che si ridisegnino con la spunta; ogni icona vola in
#quest-volo (dentro #game-root, coordinate del disegno) su una curva di Bezier
quadratica con progresso u^2.4, dopo uno stacco di 160ms; la scia e' una tela
(nastro degli ultimi 200ms + granelli). I saldi veri arrivano subito dal
server: _questInkFermo tiene il numero a video (aggiornaValuteAVideo) e
_questBusteFerme la riga del pulsante (mm2AggiornaBustine) finche' l'icona non
arriva; con piu' inchiostri il numero sale a ogni arrivo e all'ultimo e' quello
del server. "Collect all" li lancia a 140ms l'uno dall'altro. Senza scheda o
senza bersaglio (menu staccato) il premio arriva subito; un tempo di riserva
chiude il volo anche se i fotogrammi non corrono.

Il banco finge il server (nakamaRpc) e campiona: partenza dalla scheda, curva
(scarto dalla retta), accelerazione (strada nella seconda meta' del tempo contro
la prima), saldo fermo in volo e aggiornato all'arrivo, arrivo sul bersaglio
letto all'ultimo fotogramma (agganciando questVoloArriva: i campioni a
setTimeout perdono il tratto finale), suoni, lampo e pulsazione (le animazioni
premioArrivato / premioArrivatoPulsante), scia sulla tela, tre premi con saldo
100 > 150 > 180, riga del pulsante ferma e poi aggiornata, arrivo immediato
senza scheda.

## prova-segnalazioni-v08020.js — Scarecrow, la resa e i banner, buff e debuff (v0.80.20, anteprima)

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-segnalazioni-v08020.js

Carte vere dal catalogo (server/importazione/.lavoro/catalogo.json, passato a
_applicaCatalogo come fa prova-caso-tutte-le-carte).
1. Scarecrow ("next card you play gains +2 on its highest"): il premio della
   prossima giocata si riscuoteva in resolveConquestAndEndTurn DOPO lo scontro,
   quindi la carta combatteva col 7 e mostrava il 9. Adesso i premi che non
   dipendono dall'esito si riscuotono prima di ricalcolaTabellone; quelli
   "solo se non conquista" (il Grillo) restano dopo. Il banco gioca Scarecrow,
   poi un 7 contro un 7 nemico: deve conquistare; e prova il Grillo nei due versi.
2. La resa: spegniBannerPartita toglie turn-banner, timesup e il velo, sblocca
   il tavolo e alza G.bannerSpenti (showTurnBanner e mostraTempoScaduto non
   mostrano e non suonano piu'); G si rifa' con la partita nuova. La chiama
   surrenderGame (anche in rete, prima della risposta del server) e l'op 6 con
   motivo resa/abbandono per chi la riceve.
3. Buff e debuff: sommaModificatore tiene buff e debuff della stessa fonte in due
   voci (chiave#buff / chiave#debuff), cosi' un +1 dopo un -1 non li azzera e non
   cancella la riga; stesso segno si somma (due furti = -2). E il totale "Self"
   di bloccoModificatoriHTML si guarda su valoriBase contro i valori stampati
   (solo i colpi una tantum) e contro il solo registro: la riga "+1 ALL from
   Little John" non zittisce piu' il "-1 Self" del Cowardly Lion.
Nella stessa versione: reimporta.js non segnala piu' come "non programmate" le
abilita' scritte a mano nel gioco (chiavi di TILE_ABILITIES_DEF lette da
play/index.html): Tom Thumb sparisce dalla NOTA, resta Yeti.

## prova-transizioni.js — le pagine entrano ed escono, la stanza resta (v0.80.20, anteprima)

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-transizioni.js

showPage monta subito la pagina nuova (i chiamanti la trovano) ma la tiene
invisibile e senza clic (.pagina-attende) mentre la vecchia (.pagina-esce)
porta via i suoi pezzi con el.animate su `translate`/`opacity` (PAGINE_PEZZI:
lato e ritardi per pezzo, 200ms); finita l'uscita la vecchia si smonta e nello
stesso istante partono le entrate (riempimento all'indietro). Da/verso partita e
accesso niente uscita; dalla partita solo l'entrata. Cambi a raffica: la
transizione a meta' si chiude subito (_chiudiTransizione). .show di Library e
Card packs lo toglie unmountPage, non piu' close*Overlay.
La stanza (#stanza: main-menu-bg, lanterna, polvere del menu su tele proprie) e'
fuori dalle pagine: accesa per menu, library e packs, spenta per partita e
accesso (stanzaAccendi). I fondali di pagina (#mm2-bg, #pack-bg, #card-db-bg)
sono spenti e #main-menu e' trasparente. prova-pacchetti guarda la stanza.
Il banco controlla lati e ritardi delle animazioni (getAnimations), clic
bloccati durante l'uscita, stanza e lanterna mai rifatte, cambi a raffica e la
partita. Fuori schermo i fotogrammi non corrono: si guardano le animazioni, non
le posizioni a meta'.
Nota (v0.80.20): dal reimport del 14/09 Sherazade nel foglio e' "freeze CHOSEN
tile" (scelta: true). prova-segnalazioni-v08018 prova la fuga del gelo dalla
simulazione su una copia con scelta false, perche' con la scelta la simulazione
apre la finestra e non congela; prova-pacchetti legge la fiamma dalla regola di
#stanza-lit (il banco spegne le animation su *).

## prova-sherazade.js — Sherazade congela il tassello che scegli (v0.80.20)

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-sherazade.js

Lorenzo: "sherazade non funziona. insegna ad interpretare la stringa al gioco".
La riga (reimport del 14/09): "on play, once per game, freeze chosen any board
tile free 1 n_turns". sceltaDalFoglio non sapeva costruire "freeze tile" con la
scelta: la finestra non si apriva e non succedeva niente. Adesso
_sceltaCongelaTassello apre la finestra sui tasselli liberi (candidatiDalFoglio,
senza muri, senza quelli gia' gelati), congelaTassello gela quello scelto;
applicaCambiamenti non gela piu' da solo un tassello che il foglio vuole scelto.
L'IA sceglie con `valuta` (la casella con aiVicinatoUtile piu' alto); in rete la
cella passa da op 10/11 come ogni scelta.
Quanto dura: G.numeroTurno sale a ogni cambio di giocatore, e "fino al turno +
1" (il conto di congelaTasselli) scioglieva il ghiaccio all'inizio del turno
dell'avversario. congelaTassello gela per i `turni` turni DOPO questo (turno +
1 + turni): con "1" e' gelato nel turno dell'avversario e si scioglie quando
tocca di nuovo a chi l'ha gelato. Snow Queen (for_turns 4 = due turni
dell'avversario) segue gia' lo stesso metro e non e' stata toccata.
Il banco: finestra e bersagli, niente gelo automatico, scelta, durata, rinuncia,
IA, rete (op 10 poi op 11), anteprima senza gelo, niente NO_SCRIPT.

## prova-yeti.js e prova-yeti-server.js — lo Yeti si nasconde (v0.80.21, anteprima)

    desktop/node_modules/electron/dist/electron.exe strumenti/prova-yeti.js
    node strumenti/prova-yeti-server.js

Le regole di Lorenzo e le sue risposte alle domande stanno in testa al blocco
YETI di play/index.html. In breve: giocato non attacca e sparisce per
l'avversario (a meta' per chi l'ha giocato); si trascina dove si vuole (il gesto
di Ali Baba, la X nell'angolo); con la X resta e si sceglie l'impronta finta
(foot-yeti-icon, niente X). Poi due impronte (foot-yeti, alte 110 in HD, ruotate
a caso, una normale e una specchiata, 300ms l'una dall'altra, 50ms di
dissolvenza, snow-footstep-* a caso). L'avversario non gioca sulle impronte, il
padrone su quella vuota. Nascosto non sta in G.board (niente abilita', anteprime,
sinergie, impronta di rete); una carta avversaria posata accanto lo scopre
(yeti-rivela) prima delle abilita', e dopo le conquiste della carta
yetiContrattacco lo fa attaccare se il suo lato e' piu' alto (conquestInfo con
`da`/`vincitore`: affondo e girata partono dallo Yeti). Briciole: dove sta la
mangia senza suono, sulla finta sparisce. Tempo scaduto: casella a caso. Bot:
_yetiScegliIA. Fine partita: si mostra.
In rete e' segreto davvero: la decisione va al server (op 17, reteYeti), il
server tiene { di, da, vera, impronte } e rimanda op 18 a tutti con le impronte e
la casella vera solo a chi l'ha giocato. Una giocata avversaria accanto (anche
d'ufficio) porta `yeti` dentro op 3; la fine porta `yeti` dentro op 6. Il server
vieta le impronte all'avversario con la stessa risposta di una casella occupata,
tiene la casella dello Yeti anche quando rifa' le occupate dall'impronta
concordata (_yetiOccupa), e la giocata d'ufficio salta le impronte.
Le scelte dello Yeti sono `privata` (chiudiSceltaBersaglio non le manda con op
10) e l'attesa della risposta e' `attesa` (autoPlay non la chiude).
Il banco del client prova tutto questo con la carta vera (catalogo) e due carte
finte, compresi i tre esiti dello scontro, la X, le briciole, il bot e i due
lati della rete (op 17/18/3 finti). Quello del server fa girare partitaLoop con
un catalogo finto.

Nella stessa versione: freeze.mp3 quando si gela una carta o un tassello (mai
nell'anteprima), e il ghiaccio del tassello che si scioglie con un lampo leggero
e una dissolvenza (_geloDaSciogliere, .gelo-scioglie; vedi prova-sherazade, parte
7: renderBoard non ridisegna a firma invariata, il banco forza il ridisegno); via
.mm2-modo-cornice dal riquadro Draft pick.
Poi (Lorenzo, sull'anteprima): la X del trascinamento sta SOTTO alla mano, sulla
stessa verticale (rinunciaSottoLaMano). Uno Yeti giocato ACCANTO a una carta
avversaria non si nasconde: si rivela e attacca subito (yetiAccantoANemici, sul
tabellone dopo le rivelazioni della stessa giocata: anche lo Yeti nemico appena
scoperto conta, cosi' non si scopre il suo restando nascosti). E lo Yeti nascosto
da' i suoi punti sul tabellone: calcScores e carteCheFruttano lo contano; per
l'avversario la voce dell'onda non ha casella (k null), cosi' non lampeggia dove
sta. aiEvaluateConquests non esclude piu' lo Yeti: senza nemici accanto non ha
comunque niente da conquistare.

## dal-disco.js — i banchi non toccano il sito; gli asset prima di entrare (v0.80.22, anteprima)

    HEXTALE_CONTA_SITO=1 desktop/node_modules/electron/dist/electron.exe strumenti/prova-transizioni.js

GitHub Pages ha rallentato hextalegame.com per l'IP di Lorenzo ("Rate limit
exceeded"). Le chiamate all'API di GitHub non c'entrano (tolte in v0.79.62): era
il sito. Misurato con una sonda che blocca o serve dal disco ogni richiesta:
- un'apertura del gioco fa ~200-450 richieste al sito (card-parts, tile-parts,
  suoni, ui...), anche aperto dal disco, perche' molti indirizzi sono assoluti;
  una giornata di banchi dallo stesso IP ne fa decine di migliaia;
- quando una richiesta fallisce (429), il cursore CSS (ui/cursor.png) viene
  richiesto a ogni ridisegno: 1303 volte in 15 secondi di partita. Una scheda
  aperta teneva vivo il blocco;
- un suono non ancora nel buffer rifaceva la richiesta a ogni colpo (bump.mp3
  19 volte in 15 secondi).
Quindi: i tre cursori (--cursore, --cursore-premuto, --cursore-trascina) sono
dentro al file come data URI; il ripiego dei suoni riusa un <audio> per indirizzo
(_audioDiRipiego); e ogni banco Electron fa `require('./dal-disco')` subito dopo
electron: le richieste a hextalegame.com si servono dalla copia di lavoro
(protocol.handle su https), stessi file e zero richieste. Con HEXTALE_CONTA_SITO=1
stampa quante ne ha servite. Per sapere se una pubblicazione e' online si guarda
patch-notes.txt (piccolo) e di rado, non la pagina intera a raffica.

Gli asset prima di entrare (Lorenzo: "finche' tutti gli asset che compongono un
determinato pezzo delle schermate di gioco non sono caricati, non farlo apparire
in fadein"): impostaImgDaCandidati e impostaSfondoDaCandidati lasciano
sull'elemento la promessa __assetPronto; assetProntiDi(el) aspetta quelle, le
<img>, le <image> SVG e gli sfondi CSS del pezzo (scaricati e decodificati), con
un tetto di ASSET_ATTESA_MAX_MS (4s). Le pagine con transizioni entrano pezzo per
pezzo quando ciascuno e' pronto (_entraQuandoPronti, .pezzo-attende), e la caduta
dei tasselli d'inizio partita aspetta i tasselli e la plancia (_assetDellaCaduta
in renderBoard). prova-transizioni prova un pezzo con un asset lento (entra
quando arriva) e uno con un asset che non arriva mai (entra al tetto).
Nella stessa versione: l'ombra dell'icona della Library anche sulla busta di Card
packs (su .mm2-scorciatoia-ombra, perche' la busta ha una maschera) e l'icona
della Library il 10% piu' piccola (203.14).
Tick rate del server (Lorenzo): partitaLoop gira 20 volte al secondo (TICK_RATE,
era 1). I messaggi si smistano al giro dopo, quindi una giocata torna ai due
client in al massimo ~50ms invece di ~1s. I tempi della partita si contano con
Date.now e non cambiano; l'unico conto a giri, il battito OP_TEMPO, e' diventato
`tick % (5 * TICK_RATE)`: resta ogni cinque secondi.

## prova-v08023.js, prova-buchi-server.js e prova-quest-in-partita.js — sei segnalazioni (v0.80.23, anteprima)

    $ELECTRON strumenti/prova-v08023.js
    node strumenti/prova-buchi-server.js
    $ELECTRON strumenti/prova-quest-in-partita.js

Lorenzo, sei punti:
1. "Tutti i testi che appaiono agli occhi dei giocatori devono essere in
   inglese". Tradotti i toast (turno, carta congelata, carte avversarie,
   pacchetti), gli errori dei codici mazzo, i titoli rimasti ("Opponent's deck",
   "Card ability", la frase di ripiego delle carte) e TUTTI i messaggi del server
   che arrivano a un client: i rifiuti delle giocate (OP_RIFIUTO), gli errori
   delle RPC, i rifiuti d'ingresso in partita. Le funzioni che traducevano
   l'italiano del server (_spiegaVerifica, _spiegaRecupero, il livello senza
   inchiostro) riconoscono tutte e due le lingue, e "Move refused" passa da
   rifiutoInInglese, che traduce anche il server di prima finche' non e'
   schierato quello nuovo. prova-v08023 controlla che i vecchi testi non ci siano
   piu'; prova-buchi-server che nessun `perche:`/`throw Error`/`rejectMessage`
   del server sia rimasto in italiano. Restano in italiano solo gli strumenti da
   sviluppatore (tuner del foil, dei brani) e la console.
2. "Se sposto un tile bloccato e poi provo a mettere una carta dove prima c'era,
   mi dice move refused, quella casella e' bloccata". Il server teneva
   state.buchi fermo a quello d'inizio partita. Adesso il racconto del tabellone
   (op 7) porta anche `buchi` (G.holes, in ordine), e quando i due racconti sono
   d'accordo il server li adotta (_buchiDaRacconto: solo caselle che esistono,
   una volta). Diversi fra loro, o mandati da un client di prima: restano quelli
   che c'erano, e il registro lo dice. Il racconto parte 1.8s dopo ogni giocata.
3. Gli avvisi delle daily in partita: prova-quest-in-partita gioca una partita
   vera contro il bot con "Flip 20 cards" a 3/20, gira una carta e guarda che
   salga la scheda 4/20, dentro allo schermo, senza niente sopra, col suono. Il
   meccanismo funziona; il popup sale solo se una quest delle carte girate puo'
   ancora salire, e le cinque del giorno sono sempre le stesse fino a mezzanotte
   GMT (contro il bot se ne muovono tre). Finite o riscattate quelle, in partita
   non c'e' niente da mostrare: la prima volta in partita la console lo dice
   (questSpiegaSilenzio).
4. Il pulsante della ricerca dice "Searching...(12s)" (e "Cancel" sotto al dito).
5. Da Matchmaking a Play vs Bot (e ritorno) il blocco centrale sfuma dentro
   (mm2VistaSfuma): i pezzi `sfuma` di PAGINE_PEZZI.mainmenu, con i loro ritardi
   e l'attesa degli asset; non sulla stessa vista, non durante un cambio pagina.
6. Sotto ai giocatori online, #mm2-cercano con lo stesso CSS: "N players
   searching for a match". Il battito hx_giocatori porta `cerca`; mentre si cerca
   batte ogni 10s (ONLINE_CERCANDO_OGNI_MS) e cominciando/smettendo batte subito.
   Il server segna `c` sulla presenza e conta chi cerca solo se il battito e'
   piu' giovane di RICERCA_VIVA_MS (25s): chi chiude la pagina mentre cerca esce
   dal conto in fretta, anche se come presenza resta viva 90s. Contro il bot le
   due righe non si vedono.
Nota: server/nakama/prova-account.js ha un controllo rotto ("il conto sale nella
STESSA scrittura che consegna le carte") gia' prima di questa versione.

## prova-v08024.js e prova-v08024-server.js — hover dell'avversario, Mythic, quest PvP (v0.80.24)

    $ELECTRON strumenti/prova-v08024.js
    node strumenti/prova-v08024-server.js

1. Segnalazione di Vladimiro: "non progredisce il contatore delle partite
   giocate in PvP nelle Daily". applicaEsito usava `logger` senza riceverlo, e su
   Nakama un logger globale non c'e': il blocco delle quest lanciava un
   ReferenceError, il suo `catch` lo rileggeva e rilanciava, e il `catch`
   esterno inghiottiva tutto. A ogni partita fra persone (dalla v0.79.75) non si
   scrivevano ne' le quest ne' l'inchiostro. Adesso `logger` e' l'ultimo
   parametro (le quattro chiamate lo passano) e un premio non scritto finisce nel
   registro. Il banco gira senza logger globale, come il server vero: prima di
   questa versione la prova dava "possesso scritto: false".
2. "Flip a Timeless card" diventa "Flip a Mythic card" (id flipmythic, verbo
   flip_mythic, il client conta le carte `rarity === 'mythic'`). La quest di oggi
   di chi l'aveva gia' si rinomina al volo con quel che aveva fatto e riscosso
   (QUEST_RINOMINATE in assicuraQuestDelGiorno), anche quella di ieri da pagare.
   flip_timeless dal client non conta piu'.
3. La carta sotto al puntatore dell'avversario. Passando sopra a una carta della
   propria mano (mouseenter) il client manda op 19 con l'id della carta; uscendo
   o premendola, null; al massimo uno ogni MANO_SOPRA_OGNI_MS (80ms), l'ultimo
   vince. Il server (_manoSopra) lo gira solo all'altro con op 20, se la carta e'
   davvero nella mano di chi la manda, con un tetto di MANO_SOPRA_MAX al secondo
   (il null passa sempre). Dall'altra parte manoSopraAvversario alza il dorso di
   quella carta come il bot quando pensa (liftHandCardIntoView con keepZIndex),
   la rimette giu' alla carta dopo o al null, e renderHand la rialza se rifa' il
   ventaglio. In anteprima le partite in rete sono spente: si prova col banco.
4. #mm2-online a top 400px e #mm2-cercano a 430px (Lorenzo).
5. Il riavvio si annuncia (Lorenzo: "invece di aspettare che non ci sia piu'
   nessuno online, manda un messaggio con una modale 'Servers will restart in 5
   minutes' ... a zero il server restarta a prescindere"). schiera.sh, se c'e'
   qualcuno online, chiama hx_riavvio_annuncia (dal contenitore di Caddy con la
   chiave del runtime, come hx_giocatori: un client non puo'), aspetta cinque
   minuti e riavvia comunque. Il server scrive QUANDO (KEY_RIAVVIO); il battito
   hx_giocatori, che ogni client collegato fa ogni 20s anche in partita, porta
   `riavvio: { alle, ora }`, e il client conta da solo togliendo lo scarto fra i
   due orologi. #riavvio-overlay: "Servers will restart in 5 minutes" con
   "Understood"; a un minuto si riapre (anche se chiusa) col conto in secondi; a
   zero "Servers are restarting now" e resta aperta finche' il primo battito del
   server ripartito (InitModule cancella l'annuncio) non la chiude. Se l'annuncio
   non parte — il modulo in esecuzione e' di prima della v0.80.24 — schiera.sh si
   ferma come prima: riavviare vorrebbe dire buttare fuori senza avviso.
   HEXTALE_FORZA=1 riavvia subito, senza annuncio.
   (v0.80.25: il punto 3 e' cambiato. L'op 19 portava l'id della carta, e sul
   client dell'avversario le carte della mia mano sono finte: non si alzava
   niente, e in piu' l'id viaggiava fino all'altro. Adesso viaggia il POSTO:
   vedi la sezione v0.80.25.)

## prova-v08025.js, prova-v08025-server.js e prova-stats.js — statistiche, menu, OminoBianco (v0.80.25)

    $ELECTRON strumenti/prova-v08025.js
    node strumenti/prova-v08025-server.js
    $ELECTRON strumenti/prova-stats.js

1. Da Matchmaking a Play vs Bot (Lorenzo): il riquadro del rank e del mazzo
   sfuma; il riquadro Draft esce verso sinistra sfumando e rientra verso destra,
   quello Normal al contrario (MM2_VISTA_SPOSTA_PX = 40); il pulsante sfuma.
   mm2VistaCambia: uscita (TRANSIZIONE_MS), poi a pezzi invisibili
   mm2VistaApplica (titoli, immagine, pulsante), poi entrata quando gli asset
   sono pronti. Un cambio a meta' annulla quello di prima.
2. Tre righe nel riquadro Normal: "N players online" (top 370), "N players in
   matchmaking" (400), "N players in a match" (430, #mm2-in-partita). Il battito
   porta `gioca` (_giocoInCorso: pagina game e partita non finita, anche contro
   il bot); onlineSeCambiato batte subito entrando in una pagina, a inizio e a fine
   partita. Il server conta `g` sulle presenze vive (inPartita).
3. La partita di OminoBianco del 14/09 ("server problem", tornati al menu): dal
   turno 9 i due client avevano le caselle bloccate in posti diversi (il registro:
   "caselle bloccate diverse ... 1,1|2,-2 contro -1,1|2,-2"), e al turno 15 una
   carta giocata su una casella bloccata solo da una parte ha diviso i tabelloni.
   La causa: le scelte a trascinamento (Open Celery che sposta un tassello
   bloccato, e le altre con modo 'trascina') mandavano solo cosa si prendeva, e
   dall'altra parte la meta la indovinava miglioreCasellaPerTassello. Adesso
   reteScegli manda anche `dest` (destinazioneScelta), il server la gira in op 11
   e l'altro client la usa. Il messaggio non dice piu' "server problem": "The two
   boards went out of sync, so the match was stopped."
4. matchSignal (il rifiuto di una partita trovata) tornava null, e Nakama lo
   registrava come errore: adesso segna state.finita e torna { state, data }; il
   loop chiude al giro dopo.
5. La carta sotto al puntatore dell'avversario (Lorenzo: le carte avversarie sono
   finte e devono restarlo). Op 19 porta `indice`, il posto della carta nella mano
   di chi passa sopra; il server controlla che stia dentro la mano e gira
   all'altro solo { di, indice, quante }. Dall'altra parte si alza la carta finta
   a quel posto.
6. Bug report di OminoBianco "gli inchiostri non mi vanno oltre i 100": nessun
   tetto nel codice. Era il bug della v0.80.24 (applicaEsito senza logger: le
   partite PvP non scrivevano ne' quest ne' inchiostro), gia' corretto.
7. LA TELEMETRIA E /stats/ (Lorenzo, "Telemetria Hextale.txt"):
   - client (TELEMETRIA_STATO): tempo per pagina (teleCambioPagina in showPage),
     caricamento (primo modulo d'accesso o menu), errori JS (window error e
     unhandledrejection), errori di rete (erroreNakama con codice 0), e il
     registro di ogni partita: mazzi (teleInizioPartita), pescate
     (drawAndAnimate), giocate col tempo del turno (doPlace, startTurn), conquiste
     (accanto a questSegnaConquiste), punti a fine turno (endTurn), vincitore
     (finishGameWithResult). Parte con hx_telemetria ogni minuto, a fine partita e
     a pagina nascosta; un registro rifiutato tre volte si lascia andare.
   - server: hx_telemetria scrive nella collezione `telemetria` (utente di
     sistema) s:<utente>:<sessione>, p:<partita>:<utente>, b:<utente>:<ms>,
     ripuliti (_telePartitaPulita); la partita in rete scrive da se' m:<partita>
     alla fine (_teleFinePartita: finita, resa, abbandono, fermata) con ranghi,
     mazzi e giocate (_teleMossa); i contatori di progressione stanno in
     possesso.stat (_statConta: bustine ottenute e aperte, carte, livelli, quest).
   - hx_stats: controlla la password col SHA-256 del cancello del sito
     (STATS_SALE/STATS_IMPRONTA = CANCELLO_SALE/CANCELLO_IMPRONTA, _sha256Hex in
     ES5), massimo 10 sbagliate ogni 10 minuti, legge tutto e calcola al momento
     (calcolaStatistiche, pura). L'account di chi chiede non entra nei numeri.
   - /stats/index.html: il cancello (stessa password), la sessione con
     l'autenticazione custom "hextale-stats-page" (nome hxstats) e la chiave del
     server, poi hx_stats. Sei sezioni come nel file, la tendina delle carte,
     Refresh. Niente nel browser.
   I numeri partono dalla v0.80.25: prima non si raccoglieva niente. "Prima
   sessione" e "login dopo N giorni" contano solo i giocatori nati dopo.

## prova-v08026.js e prova-v08026-server.js — punti di fine partita, quest, menu (v0.80.26)

    $ELECTRON strumenti/prova-v08026.js
    node strumenti/prova-v08026-server.js

1. Da Matchmaking a Play vs Bot #mm2-testata (rank e mazzo) resta fermo: tolto da
   MM2_VISTA_PEZZI. I riquadri delle modalita' e il pulsante si animano come prima.
2. Il pannello delle daily non dice piu' "prese/5" ma quanto manca al cambio delle
   quest, a mezzanotte GMT come _giornoGmt sul server (questTempoAlCambio: "7h 32m left",
   sotto l'ora "32m 05s left"; "left" l'ha chiesto Lorenzo). Un orologio da un secondo lo riscrive finche' il pannello
   c'e', e passata la mezzanotte chiede le quest nuove (questChiediAlServer).
3. Gli avvisi dell'avanzamento delle quest in #quest-avvisi sono il 30% piu' grandi:
   `zoom:1.3` sulla scheda (scala misure, testo, barra e icona, e non tocca il
   transform delle animazioni), il contenitore largo 355.
4. I punti di fine partita (Lorenzo: 199 da una parte, 203 dall'altra, stesso
   tabellone; il server aveva deciso 118-203, cioe' col racconto del giocatore 1).
   L'impronta confronta chi possiede ogni casella, non i numeri: una carta con un
   lato diverso da una parte non ferma la partita, ma cambia i margini delle
   conquiste e quindi i punti. La causa di quella partita non si ricostruisce senza
   i dati; da adesso:
   - il racconto (op 7) porta anche `valori` (reteImprontaValori: casella e sei
     lati), e il server, quando i due tabelloni coincidono, confronta punti e valori
     e scrive nel registro la PRIMA volta che non tornano ("punti diversi al turno
     N", "valori diversi al turno N: casella (carta) lati / lati");
   - op 6 "finita" e l'esito portano i punti con cui il server ha deciso, e
     fineAllineaAlServer li mette nella schermata di fine partita (numeri e
     vincitore) su tutti e due gli schermi.
5. Il caso uguale sui due schermi (Lorenzo: "la board e' andata fuori sync per
   colpa della randomness del brucaliffo"). Il Brucaliffo ruotava i gruppi di un
   numero di passi tirato con Math.random su ciascun client; lo stesso facevano
   Smoke and Mirrors (il 50%), Scaredy Cat, Hunger Bites, il Cappellaio, Cheshire
   e True Story. casoCondiviso(etichetta): in rete il numero esce da
   _semeDaNome(id del match | turno | etichetta), con un'etichetta che dice
   abilita', casella, carta e indice del tiro; fuori rete Math.random. prova-v08026
   controlla che le sette non chiamino piu' Math.random e che il Brucaliffo, sulla
   stessa carta nello stesso turno, ruoti degli stessi passi su due "schermi".
6. Premuto Collect nella pagina dello spacchettamento, il cartellino sopra alle
   carte (.pack-etichetta: Owned/New, livello, copie) sparisce prima che la carta
   voli via. La classe .senza-etichetta c'era gia' (v0.79.40, la mette
   _preparaUscita), ma la sua regola stava PRIMA di .mostra-etichetta e pesava
   uguale: vinceva quella che la accende. Adesso sta dopo, con !important, sfuma
   in .25s e poi `visibility:hidden`. prova-pacchetti accende i cartellini prima
   dell'uscita (a banco il doppio requestAnimationFrame non arriva, ed e' per
   questo che il difetto non si vedeva).
7. Il saldo di un premio delle quest: prova-v08026 riscuote un premio d'inchiostro
   e campiona il numero a video ogni 20ms: resta quello di prima finche' l'icona
   non arriva (questVoloArriva) e cambia solo dopo. Il difetto segnalato non si
   riproduce con l'inchiostro dal menu.
8. Chi resta senza carte perde (Lorenzo: "anche se ha il punteggio piu' alto").
   La partita finiva gia' quando uno dei due restava a mani vuote; adesso:
   - client: endTurn chiama segnaSenzaCarte, che con chiRestaSenzaCarte dichiara
     vincitore l'altro (G.vincitoreDichiarato) e scrive il motivo "<nome> ran out of
     cards."; finishGameWithResult riferisce al server l'esito del vincitore, non
     dei punti (contro il bot);
   - server: _chiudiPartita chiede _chiSenzaCarte (mano E mazzo vuoti, veri, del
     server) e rovescia il vincitore; op 6 e l'esito portano `senzaCarte`, e
     fineAllineaAlServer lo mette nella schermata (o lo lascia a finishGameWithResult
     se la schermata non c'e' ancora).
   Scelte mie, da confermare con Lorenzo: vale solo se il tabellone aveva ancora
   posto (pieno, o chiuso dalle impronte dello Yeti, decidono i punti) e solo se ne
   e' rimasto senza uno solo (tutti e due senza carte: decidono i punti).
9. La X delle carte da scartare (.scarta-croce, abilita' che scartano una carta in
   mano): in alto a sinistra (left/top 14px) invece che al centro, e DENTRO
   .hand-card-hitzone invece che accanto. L'hover durante lo scarto era spento dalla
   v0.75.38 per un rimbalzo: la croce stava fuori dalla zona sensibile, passarci sopra
   faceva uscire dalla carta, la carta scendeva e la croce con lei. Dentro la zona
   mouseleave non scatta, quindi la guardia `!sceltaScarto` sull'hover e' tolta: le
   carte si alzano e vengono davanti anche con la X. Il trascinamento resta chiuso
   durante lo scarto, e il pointerdown della croce non risale alla zona.

## prova-per-value.js — la colonna "Per value" (v0.80.27)

    node strumenti/prova-per-value.js
    node server/importazione/reimporta.js --senza-importare

Lorenzo ha aggiunto nel foglio la colonna "Per value" (dopo "Per"), per Mowgli:
"Gives +1 RAND to Small characters for each Explorer on the board". If value e'
gia' il filtro sui bersagli (Small), e il tratto da contare (Explorer) non aveva un
posto. Adesso:
- abilita-parser.js (quello che usano converti.js e rigenera-riepiloghi.js, cioe'
  la reimportazione): "Per value" fra le COLONNE obbligatorie, "Per value 2" fra le
  COLONNE_FACOLTATIVE (nel foglio non c'e'); _perValore la legge come { tratti } e
  si ferma se e' scritta senza Per o con un Per che non conta tratti
  (adjacent_trait, board_trait, hand_trait);
- abilita-motore.js: quantita conta eff.perValore.tratti se ci sono, altrimenti il
  tratto della condizione come prima; iniettato nel gioco e nel server con
  inietta-motore.js;
- rigenera-riepiloghi.js: "per board_trait Explorer";
- reimporta.js: --senza-importare fa i primi quattro passi e si ferma prima del
  database. Tolto anche l'indirizzo del server dai messaggi (ssh $HEXTALE_SRV):
  questo file e' pubblico. (Resta nella storia di git.)

Poi Tin Woodman: "sul valore zero prende +2 per ogni carta adiacente alleata o
nemica", scritto con `Per = adjacent_card` e `Scope = SE-SW`. Due termini nuovi:
- `adjacent_card` (VOCE Per): quantita conta scena.vicini(fonte), tutte, di
  chiunque siano — i vicini del gioco (scena in index.html) e del server
  (ombraVicini) non guardano il padrone;
- Scope per lati: _ambito nel parser accetta le parole di prima oppure lati per
  nome col trattino, e si ferma su un lato inesistente, in minuscolo o ripetuto;
  nel motore latiNominati("SE-SW") da' ['SE','SW'] e latiColpiti li restituisce
  cosi' come sono, prima dei gruppi. I lati sono fissi: si tocca cio' che in
  quel momento sta in SE e SW, qualunque numero porti.
Il banco (sezione 4b) prova parser, errori, quantita e lo scatto on_play vero
(cambiamentiAllEvento: +4 su SE e SW con due vicini).
