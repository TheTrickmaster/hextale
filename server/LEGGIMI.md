# Il lato server di Hextale

## Reimportare le carte dal foglio — `importazione/reimporta.cmd`

**Doppio clic.** Fa cinque cose e si ferma alla prima che non torna, senza
toccare il database:

1. scarica il foglio `Cards DB`;
2. lo converte col parser del gioco vero;
3. **confronta i valori col foglio, riga per riga**;
4. controlla che non manchi niente (ID, slug doppi, starter deck fuori posto);
5. importa.

La prima volta si ferma subito e crea `configurazione.json`: dentro va
incollata la chiave del server, che si legge con

```
ssh root@45.59.124.211 "grep NAKAMA_HTTP_KEY /opt/nakama/.env"
```

Quel file **non va su GitHub** ed e' gia' escluso dal `.gitignore` di questa
cartella.

Finito, i giocatori prendono le carte nuove al prossimo accesso: il gioco
confronta la versione con quella che ha in cache e si aggiorna da solo.

### Perche' il passaggio 3 esiste

Perche' e' successo. Una normalizzazione sbagliata nel convertitore faceva
leggere alla colonna `SE` i valori di `E` e alla colonna `W` quelli di `SW`:
**57 carte su 83** sono finite nel database con numeri plausibili ma falsi,
senza un errore e senza un avviso. Il confronto col foglio l'avrebbe preso al
primo colpo, e per questo adesso c'e' — con un parser CSV **indipendente** da
quello del gioco, perche' confrontare un risultato con se stesso non prova
niente.

### Due trappole che il codice evita, e che vanno lasciate in pace

**Non si usa `gviz`.** Google offre due modi di leggere un foglio come CSV.
`gviz/tq?tqx=out:csv` decide un TIPO per ogni colonna e **scarta le celle che
non ci rientrano**: le colonne dei lati sono numeriche, quindi una scaletta di
livelli come `0-0-0-0` (Excalibur) da li' non arriva affatto, e la carta entra
con sei valori inventati. `export?format=csv` consegna le celle come sono
scritte. Verificato su Excalibur: da `gviz` i sei lati tornano vuoti, da
`export` tornano `0-0-0-0`.

**Dentro `converti.js` non si usano espressioni regolari.** Il codice che
finisce nella pagina viaggia dentro a un *template literal*, dove la sequenza
barra-rovesciata-`s` non e' un escape valido e collassa nella sola lettera `s`.
E' cosi' che "sostituisci gli spazi" e' diventato "sostituisci le esse", ed e'
la causa esatta del guasto delle 57 carte.

## `nakama/index.js`

Il modulo di runtime di Nakama. Sul server vive in
`/opt/nakama/data/modules/index.js`. **Il nome conta**: il runtime JavaScript
carica un solo file d'ingresso, `index.js`; un modulo chiamato diversamente
viene ignorato senza un errore.

Tre RPC (`hx_avvio`, `hx_importa`, `hx_sistema_utenti`), gli agganci che
assegnano il mazzo iniziale a chi si registra, e il controllo di **per chi e'
stato emesso** il token di Google — che Nakama 3.40 non sa fare da se', perche'
non ha nessuna impostazione `social.google`.

Per aggiornarlo: si copia il file sul server e si riavvia il container.

## `carte-nel-database.csv`

L'elenco leggibile di cosa c'e' **nel database adesso**, rigenerato dopo ogni
importazione. Si apre in Sheets o Excel. Non e' una sorgente: e' una fotografia
per controllare che il database dica quello che ci si aspetta.
