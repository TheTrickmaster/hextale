# Hextale — l'applicazione desktop

Da qui in avanti Hextale si gioca **solo dall'app per Windows**. Il gioco resta
quello di sempre (`play/index.html` e gli asset): questa cartella contiene il
guscio che lo installa sul disco, lo apre a schermo pieno e lo tiene aggiornato
— lui e se stesso.

Il perche': dal browser ogni avvio chiedeva a GitHub Pages centinaia di file, e
GitHub Pages limita le richieste per indirizzo. Nell'app **nessuna richiesta va
al sito**: tutto cio' che il gioco carica arriva dal disco.

## Cosa c'e' qui

| File | Cosa fa |
|---|---|
| `main.js` | il guscio: finestra, menu, aggiornamenti del gioco e dell'app |
| `servitore.js` | il servitore locale che risponde al posto di hextalegame.com |
| `crea-certificato.js` | crea il certificato di quel servitore (al build, fuori da git) |
| `aggiornatore.js` | legge il deposito su R2, scarica, verifica, posa |
| `preload.js` | dice al gioco che gira nell'app (`window.hextaleDesktop`) |
| `installatore.nsh` | la domanda "avviare il gioco adesso?" a fine installazione |
| `prepara-gioco.js` | copia il gioco in `gioco-pronto/` e scrive il manifesto |
| `pubblica-r2.js` | carica gioco e installatore su Cloudflare R2 |
| `r2.esempio.json` | com'e' fatto il file delle chiavi di R2 |
| `prova-aggiornatore.js`, `prova-guscio.js`, `prova-pubblica-r2.js`, `prova-pacchetto.js` | i banchi |

## Come gira il gioco dentro all'app

La finestra apre `https://hextalegame.com/play/index.html`, ma il nome
`hextalegame.com` l'app lo manda a `127.0.0.1`, dove risponde `servitore.js`
coi file sul disco. L'origine resta `hextalegame.com`: server di gioco,
"Remember me" e accesso con Google la riconoscono come quella del sito.

**Tutto il resto va in rete com'e'**: `api.hextalegame.com`, Google, PayPal. Il
guscio non lo tocca. (Fino alla 1.0.0 lo rifaceva lui, e le richieste partivano
senza `Origin` e `Referer`: Google rispondeva **errore 400** all'accesso.)

Il certificato del servitore locale lo crea `crea-certificato.js` al build; lo
accetta solo l'app, solo per `hextalegame.com`, e solo se e' proprio lui. Non
sta nel repository (c'e' dentro una chiave privata). La porta si sceglie a caso
a ogni avvio; se e' occupata, l'app riparte con un'altra.

Il servitore risponde 404 per cio' che il gioco non ha, serve audio e video a
pezzi (Range), e con l'ETag un file aggiornato non si rilegge mai dalla copia vecchia.

## L'accesso con Google

Dalla **1.0.2** si fa nel browser vero del giocatore. Dentro all'app Google lo
rifiuta ("Questo browser o questa app potrebbero non essere sicuri"): e' una sua
regola per le app desktop, e aggirarla travestendo la finestra sarebbe fragile.

1. Nel gioco, "Login with Google" chiede al guscio `accediConGoogle` (preload.js).
2. Il guscio apre un indirizzo locale (`http://127.0.0.1:<porta>`, porta del
   sistema) e apre nel browser `https://hextalegame.com/app-login/?porta=…&stato=…`
   (la pagina e' in `app-login/index.html`, nel sito).
3. La pagina chiede il codice a Google col solito flusso del gioco (stesso
   client, stessa origine) e lo riporta all'indirizzo locale.
4. L'indirizzo locale accetta **una sola** richiesta, con lo stato giusto, entro
   cinque minuti; il codice torna al gioco, che fa lo scambio col server come prima.

Niente da configurare su Google Cloud ne' sul server.

## Niente da browser

- Il menu (tasto Alt) ha solo **File** (Exit) e **Window** (Minimize, Close):
  niente Edit, niente View — quindi niente ricarica, zoom, schermo intero da
  tastiera.
- Gli strumenti da sviluppatore sono spenti in ogni finestra.
- La finestra del gioco non va altrove: un link trascinato dentro non la porta via.
- Nessuna finestra si apre dentro all'app: ogni link va al browser vero. Un
  modulo che si apre fuori (il Donate di PayPal) ci arriva coi suoi campi
  nell'indirizzo.
- Il nome del browser non contiene "Electron": Google rifiuta l'accesso dai
  browser incorporati.
- Si apre un'app sola alla volta.

Non e' una barriera contro chi vuole guardare dentro al gioco (il codice e'
pubblico e le regole le fa rispettare il server): e' che un gioco non deve
comportarsi da browser.

## Dove finiscono i file

- **Inclusa** — `resources\gioco` nella cartella d'installazione
  (`%LOCALAPPDATA%\Programs\Hextale`): il gioco del giorno del build.
- **Viva** — `%APPDATA%\Hextale\gioco`: **solo** i file cambiati dopo, e il
  manifesto che vale adesso. Se si installa un'app piu' nuova della viva, la viva si butta.
- **Installatori** — `%APPDATA%\Hextale\installatore`: l'app nuova scaricata,
  in attesa della chiusura del gioco.

## Gli aggiornamenti del gioco

Il deposito su R2 (`https://download.hextalegame.com/`):

```
gioco/manifesto.json      { versione, generato, origine, file: { "ui/x.png": { sha256, dimensione } } }
gioco/file/<sha256>       il contenuto di ogni file, col nome uguale all'impronta
```

- **All'avvio** si chiede il manifesto (6 secondi al massimo). Se qualcosa e'
  cambiato si scaricano solo quei file, con una finestrella d'avanzamento.
  Senza rete si gioca con quello che c'e'.
- **A gioco aperto** si guarda di nuovo ogni due minuti. Una versione nuova si
  scarica in silenzio, e da quel momento il guscio serve le note di rilascio
  nuove: il gioco se ne accorge col suo solito controllo, avvisa, aspetta la
  fine della partita e ricarica. Ricaricando, il guscio posa i file nuovi.
- **Mai a meta'**: tutto si scarica in un cantiere e si verifica l'impronta; i
  file vanno al loro posto solo quando c'e' tutto, e il manifesto per ultimo.

## Gli aggiornamenti dell'app

Dalla **1.0.1**. Un minuto dopo l'avvio, e poi ogni sei ore, l'app legge
`installatore/ultimo.json`. Se c'e' una versione piu' nuova, il suo installatore
si scarica in silenzio (mai durante una partita: si riprova al menu), si
verifica l'impronta, e **parte muto quando si chiude il gioco**. All'avvio dopo
si apre l'app nuova. La 1.0.0 non sa farlo: chi ce l'ha la reinstalla a mano.

## Pubblicare una versione del gioco

Una volta sola: il file delle chiavi `%USERPROFILE%\.hextale\r2.json`, fatto
come `r2.esempio.json`. **Non va nel repository e non va incollato in chat.**

Poi, a ogni versione (dopo il commit di `play/index.html`):

```
node desktop/prepara-gioco.js
node desktop/pubblica-r2.js --senza-caricare
node desktop/pubblica-r2.js
```

Il primo copia in `desktop/gioco-pronto` i file **dell'ultimo commit** (non le
modifiche in corso sul disco). Il secondo dice cosa caricherebbe. Il terzo
carica solo le impronte che su R2 mancano e il manifesto per ultimo; rifiuta una
versione piu' vecchia di quella su R2 (`--forza` per farlo lo stesso) e una copia
fatta con `--copia-di-lavoro`. Le chiavi non vengono mai scritte a schermo.

## Pubblicare una versione dell'app

Si alza `version` in `package.json` (la versione dell'app e' **sua**, non
quella del gioco), poi:

```
cd desktop
npm install          (una volta)
npm run build
node pubblica-r2.js --installatore
```

`npm run build` crea il certificato se manca, prepara il gioco dall'ultimo
commit e costruisce `desktop/dist/Hextale-Setup-<versione>.exe`. L'installatore
installa per l'utente, senza chiedere dove e senza permessi da amministratore,
con icona sul desktop e nel menu Start; a fine installazione chiede se avviare
il gioco. Disinstallando, i dati in `%APPDATA%\Hextale` restano.

Su R2 va come `installatore/Hextale-Setup-<v>.exe`, `installatore/Hextale-Setup.exe`
(il nome fisso per la pagina di download) e `installatore/ultimo.json`: da quel
momento le app installate si aggiornano da sole alla chiusura.

L'installatore non e' firmato: al primo avvio Windows mostra l'avviso
"Windows ha protetto il PC" (Ulteriori informazioni → Esegui comunque).

## I banchi

```
node desktop/prova-aggiornatore.js
node desktop/prova-pubblica-r2.js
node desktop/prepara-gioco.js --copia-di-lavoro
desktop/node_modules/electron/dist/electron.exe desktop/prova-guscio.js
```

`prova-guscio.js` fa partire il guscio vero con un R2 finto e un sito esterno
finto (serve `openssl`, che c'e' con Git per Windows): aggiornamenti del gioco
all'avvio e a gioco aperto, richieste esterne con le loro intestazioni, menu,
strumenti da sviluppatore, PayPal, aggiornamento dell'app ed Exit game.

Dopo `npm run build`, `node desktop/prova-pacchetto.js` apre il programma
costruito (`dist/win-unpacked/Hextale.exe`) senza installarlo, e controlla
dalla porta di debug che il gioco incluso si apra dal disco.

## Se qualcosa va storto

Cancellare `%APPDATA%\Hextale\gioco`: al riavvio vale la copia inclusa, e
l'aggiornamento riscarica quello che manca.
