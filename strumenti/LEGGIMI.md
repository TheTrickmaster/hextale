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
