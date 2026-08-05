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
