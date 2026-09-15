# Hextale — l'applicazione desktop

Da qui in avanti Hextale si gioca **solo dall'app per Windows**. Il gioco resta
quello di sempre (`play/index.html` e gli asset): questa cartella contiene il
guscio che lo installa sul disco, lo apre a schermo pieno e lo tiene aggiornato.

Il perche': dal browser ogni avvio chiedeva a GitHub Pages centinaia di file, e
GitHub Pages limita le richieste per indirizzo. Nell'app **nessuna richiesta va
al sito**: tutto cio' che il gioco carica arriva dal disco.

## Cosa c'e' qui

| File | Cosa fa |
|---|---|
| `main.js` | il guscio: la finestra, i file dal disco, gli aggiornamenti |
| `aggiornatore.js` | legge il deposito su R2, scarica, verifica, posa |
| `preload.js` | dice al gioco che gira nell'app (`window.hextaleDesktop`) |
| `prepara-gioco.js` | copia il gioco in `gioco-pronto/` e scrive il manifesto |
| `pubblica-r2.js` | carica gioco (e installatore) su Cloudflare R2 |
| `r2.esempio.json` | com'e' fatto il file delle chiavi di R2 |
| `prova-aggiornatore.js`, `prova-guscio.js`, `prova-pubblica-r2.js`, `prova-pacchetto.js` | i banchi |

## Come gira il gioco dentro all'app

La finestra apre `https://hextalegame.com/play/index.html`, ma ogni richiesta a
`hextalegame.com` la risponde il guscio coi file sul disco (l'HTML, immagini,
audio, video, note di rilascio; con l'indirizzo relativo o scritto per intero).
Il gioco non se ne accorge e non va toccato, e l'origine resta `hextalegame.com`:
server di gioco, "Remember me" e accesso con Google la riconoscono come quella
del sito. Tutto il resto (`api.hextalegame.com`, Google) passa in rete com'e'.

Un file che il gioco non ha risponde 404. Un link verso fuori (per esempio il
modulo di feedback) si apre nel browser vero; dentro all'app si aprono solo le
finestre di `accounts.google.com`. Il nome del browser non contiene "Electron",
perche' Google rifiuta l'accesso dai browser incorporati.

Si apre un'app sola alla volta: la seconda apertura porta in primo piano la prima.

## Dove finiscono i file

- **Inclusa** — `resources\gioco` nella cartella d'installazione
  (`%LOCALAPPDATA%\Programs\Hextale`): il gioco completo del giorno in cui e'
  stato costruito l'installatore. Funziona anche senza rete.
- **Viva** — `%APPDATA%\Hextale\gioco`: **solo** i file cambiati dopo, e il
  manifesto che vale adesso.

Un file si serve dalla viva se c'e', altrimenti dall'inclusa, ma solo se il
manifesto che vale lo nomina. Se si installa un installatore piu' nuovo della
viva, la viva si butta.

## Gli aggiornamenti del gioco

Il deposito su R2 (`https://download.hextalegame.com/`):

```
gioco/manifesto.json      { versione, generato, file: { "ui/x.png": { sha256, dimensione } } }
gioco/file/<sha256>       il contenuto di ogni file, col nome uguale all'impronta
```

- **All'avvio** si chiede il manifesto (6 secondi al massimo). Se qualcosa e'
  cambiato si scaricano solo quei file, con una finestrella d'avanzamento.
  Senza rete si gioca con quello che c'e'.
- **A gioco aperto** si guarda di nuovo ogni due minuti. Una versione nuova si
  scarica in silenzio, e da quel momento il guscio serve le note di rilascio
  nuove: il gioco se ne accorge col suo solito controllo, avvisa, aspetta la
  fine della partita e ricarica. Ricaricando, il guscio posa i file nuovi prima
  di servire il gioco.
- **Mai a meta'**: tutto si scarica in un cantiere e si verifica l'impronta; i
  file vanno al loro posto solo quando c'e' tutto, e il manifesto si scrive per
  ultimo. Se l'app si chiude a meta', al prossimo avvio si riparte da uno stato
  coerente.

Senza aggiornamento del gioco non serve un installatore nuovo: **pubblicare una
versione significa caricarla su R2**.

## Pubblicare una versione del gioco

Una volta sola: copiare `r2.esempio.json` in `%USERPROFILE%\.hextale\r2.json` e
riempirlo con Account ID, Access Key ID e Secret Access Key del token R2.
**Quel file non va nel repository e non va incollato in chat.**

Poi, a ogni versione (dopo il commit di `play/index.html`):

```
node desktop/prepara-gioco.js
node desktop/pubblica-r2.js --senza-caricare
node desktop/pubblica-r2.js
```

Il primo copia in `desktop/gioco-pronto` i file **dell'ultimo commit** (non le
modifiche in corso sul disco) e legge la versione dalla targhetta del gioco. Il secondo dice cosa caricherebbe. Il terzo
carica solo le impronte che su R2 mancano e il manifesto per ultimo; rifiuta una
versione piu' vecchia di quella su R2 (`--forza` per farlo lo stesso) e una copia
fatta con `--copia-di-lavoro`. Le chiavi non vengono mai scritte a schermo.

## L'installatore

```
cd desktop
npm install          (una volta)
npm run build
node pubblica-r2.js --installatore
```

Esce `desktop/dist/Hextale-Setup-<versione del guscio>.exe`: si installa per
l'utente, senza chiedere dove e senza permessi da amministratore, con icona sul
desktop e nel menu Start, e al termine apre il gioco. Disinstallando, i dati in
`%APPDATA%\Hextale` restano.

Su R2 va come `installatore/Hextale-Setup-<v>.exe`, `installatore/Hextale-Setup.exe`
(il nome fisso per la pagina di download) e `installatore/ultimo.json`.

La versione del guscio (`package.json`, oggi 1.0.0) e' **sua**, non quella del
gioco: cambia solo quando cambia il guscio.

L'installatore non e' firmato: al primo avvio Windows mostra l'avviso
"Windows ha protetto il PC" (Ulteriori informazioni → Esegui comunque).

## I banchi

```
node desktop/prova-aggiornatore.js
node desktop/prova-pubblica-r2.js
node desktop/prepara-gioco.js --copia-di-lavoro
desktop/node_modules/electron/dist/electron.exe desktop/prova-guscio.js
```

Dopo `npm run build`, `node desktop/prova-pacchetto.js` apre il programma
costruito (`dist/win-unpacked/Hextale.exe`, lo stesso che installa l'installatore)
senza installarlo, e controlla dalla porta di debug che il gioco incluso si apra
dal disco.

`prova-guscio.js` fa partire il guscio vero con un R2 finto, e con
`hextalegame.com` che non si risolve: se una sola richiesta al sito uscisse in
rete, fallirebbe. Controlla anche che le richieste al server passino col loro
corpo (serve `openssl`, che c'e' con Git per Windows).

## Se qualcosa va storto

Cancellare `%APPDATA%\Hextale\gioco`: al riavvio vale la copia inclusa, e
l'aggiornamento riscarica quello che manca.
