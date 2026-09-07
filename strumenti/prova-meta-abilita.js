// QUANDO UN'ABILITA' E' FATTA DI DUE META', E UNA SOLA E' ROBA DA MOTORE.
//
//     $ELECTRON strumenti/prova-meta-abilita.js
//
// Il foglio puo' scrivere due effetti su una riga sola, legati da "and". Certe
// coppie sono miste: una meta' il motore la calcola (un numero), l'altra no —
// perche' la sceglie il giocatore, o perche' non e' un numero affatto.
//
// motoreFaLEvento risponde con una E — "sai fare TUTTA la riga?" — ed e' la
// domanda giusta. Ma la risposta veniva usata come un interruttore: no, e
// allora il motore non faceva NIENTE, nemmeno la meta' che sapeva fare.
//
// Nel catalogo le carte cosi' sono due, e vanno nei due versi opposti:
//   Little Mermaid   on_play   scarto SCELTO  +  buff +2 ALL
//   The Walrus       on_moved  buff +2 ALL    +  spostamento SCELTO
// Il Tricheco aveva gia' la cura, scritta dentro ad avvisaCartaSpostata; la
// Sirenetta no, e infatti scendeva in campo senza il suo +2 — segnalato da
// Lorenzo il 07/09/2026, giocato dall'IA. Dalla v0.79.30 la cura e' una
// funzione sola e la usano tutte e due, quindi questo banco le guarda insieme:
// separarle vorrebbe dire poter aggiustare una e rompere l'altra.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';
const CATALOGO = path.join(RADICE, 'server', 'importazione', '.lavoro', 'catalogo.json');

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
setTimeout(() => { console.error('PIANTATA: nessuna risposta in 120s'); app.exit(2); }, 120000);

app.whenReady().then(async () => {
  const cat = JSON.parse(fs.readFileSync(CATALOGO, 'utf8'));
  const carte = Array.isArray(cat) ? cat : (cat.carte || cat.cards || Object.values(cat));
  const suGiocata = carte.filter(c => c && c.abilita && c.abilita.trigger === 'on_play');
  const sirena = carte.find(c => c && c.name === 'Little Mermaid');
  const tricheco = carte.find(c => c && c.name === 'The Walrus');
  if (!sirena || !tricheco) { console.error('nel catalogo mancano le due carte'); app.exit(1); return; }

  const win = new BrowserWindow({ show: false, width: 1280, height: 800, frame: false,
    webPreferences: { contextIsolation: false, webSecurity: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 2500));

  const dette = await win.webContents.executeJavaScript(`(async function(){ try{
    const SIRENA = ${JSON.stringify(sirena)};
    const TRICHECO = ${JSON.stringify(tricheco)};
    const dette = [];
    const dice = (ok, che, perche) => dette.push({ ok:!!ok, che:che, perche:perche||'' });
    const attendi = (ms)=>new Promise(r=>setTimeout(r,ms));

    const celle = [];
    for(let q=-2;q<=2;q++) for(let r=-2;r<=2;r++){ if(Math.abs(q+r)>2) continue; celle.push({q:q,r:r}); }
    const CAMPI = ['cells','board','holes','destroyedHoles','currentPlayer','numeroTurno',
                   'p1Hand','p2Hand','p1Deck','p2Deck','sceltaBersaglio','gameOver'];
    const salva = {}; for(const k of CAMPI) salva[k] = G[k];
    function apparecchia(){
      G.cells = celle; G.board = {}; G.holes = new Set(); G.destroyedHoles = new Set();
      G.numeroTurno = 3; G.gameOver = false; G.sceltaBersaglio = null;
      G.p1Hand = []; G.p2Hand = []; G.p1Deck = []; G.p2Deck = [];
    }
    // Una carta NUOVA ogni volta. cambiamentiAllEvento segna lo scatto
    // "once_per_game" sulla carta: riusare la stessa vorrebbe dire chiederle
    // due volte una cosa che sa fare una volta sola, e leggere "non fa niente"
    // credendo di aver trovato un guasto.
    const nuova = (RIGA, chi) => {
      const c = _makeCardDbCard(RIGA, chi);
      c.id = RIGA.id + '-' + chi + '-' + Math.random().toString(36).slice(2,7);
      c.baseId = RIGA.id;
      return c;
    };
    const somma = v => ['NW','NE','E','SE','SW','W'].reduce((s,l)=>s+(v[l]||0),0);

    // ── LA SIRENETTA: +2 SU OGNI LATO, GIOCANDOLA ──────────────────────────
    // "Gains +2 ALL when played, but discards a card from your hand": il +2
    // e' meta' del testo che il giocatore legge sulla carta.
    [1, 2].forEach(chi=>{
      apparecchia();
      G.currentPlayer = chi;
      const c = nuova(SIRENA, chi);
      const prima = {...c.values};
      G.board[key(0,0)] = { card:c, owner:chi };
      applicaAbilitaPiazzamento(c, 0, 0, abilitaAttivaDi(c));
      const lati = ['NW','NE','E','SE','SW','W'];
      const cresciuti = lati.filter(l => (c.values[l]||0) === (prima[l]||0) + 2);
      dice(cresciuti.length === 6,
        'la Sirenetta giocata dal giocatore ' + chi + ' prende +2 su tutti e sei i lati',
        'prima ' + JSON.stringify(prima) + '\\n        dopo  ' + JSON.stringify(c.values) +
        (chi === 2 ? '\\n        E- il caso segnalato: la giocava l-IA e non prendeva niente.' : ''));
    });

    // E una volta sola: "once per game" sta sulla riga, e chiamarla due volte
    // non deve regalarne quattro.
    apparecchia(); G.currentPlayer = 1;
    const bis = nuova(SIRENA, 1);
    const primaBis = somma(bis.values);
    G.board[key(0,0)] = { card:bis, owner:1 };
    applicaAbilitaPiazzamento(bis, 0, 0, abilitaAttivaDi(bis));
    const dopoUno = somma(bis.values);
    applicaAbilitaPiazzamento(bis, 0, 0, abilitaAttivaDi(bis));
    dice(somma(bis.values) === dopoUno && dopoUno === primaBis + 12,
      'e lo prende UNA volta sola, non a ogni passaggio',
      'partenza ' + primaBis + ', dopo la prima ' + dopoUno + ', dopo la seconda ' + somma(bis.values));

    // ── E LA FINESTRA DELLO SCARTO SI APRE ANCORA ──────────────────────────
    // La meta' che il motore NON sa fare non deve essersi persa per strada:
    // aggiustare il buff spegnendo lo scarto sarebbe un pareggio, non una cura.
    apparecchia(); G.currentPlayer = 1;
    const conMano = nuova(SIRENA, 1);
    G.p1Hand = [nuova(TRICHECO, 1), nuova(TRICHECO, 1)];
    G.board[key(0,0)] = { card:conMano, owner:1 };
    const s = SCELTE_PIAZZAMENTO['mermaid_discard'](conMano, 0, 0, 1);
    dice(!!s, 'la finestra dello scarto si apre ancora');
    dice(s && s.modo === 'mano', 'e si sceglie nella MANO, non sul tabellone', s && s.modo);
    dice(s && s.bersagli && s.bersagli.length === 2, 'con le due carte in mano come bersagli',
      s && s.bersagli ? s.bersagli.length + ' bersagli' : 'nessuno');
    // Mano vuota: nessuna finestra. Chiedere di scegliere fra niente e' un
    // vicolo cieco, e il registro esiste per evitarlo.
    G.p1Hand = [];
    dice(SCELTE_PIAZZAMENTO['mermaid_discard'](nuova(SIRENA,1), 0, 0, 1) === null,
      'e con la mano vuota non si apre niente');

    // ── IL TRICHECO: LA STESSA CURA, NELL'ALTRO VERSO ──────────────────────
    // Il suo giro e' stato riscritto per usare la funzione condivisa: se si
    // fosse rotto qui, si sarebbe rotto in silenzio.
    apparecchia(); G.currentPlayer = 1;
    const t = nuova(TRICHECO, 1);
    const primaT = {...t.values};
    G.board[key(0,0)] = { card:t, owner:1 };
    avvisaCartaSpostata(t, key(1,-1), key(0,0), ()=>{});
    await attendi(300);
    const latiT = ['NW','NE','E','SE','SW','W'];
    dice(latiT.every(l => (t.values[l]||0) === (primaT[l]||0) + 2),
      'e il Tricheco prende ancora il suo +2 quando si sposta',
      'prima ' + JSON.stringify(primaT) + '\\n        dopo  ' + JSON.stringify(t.values));

    // ── E NESSUN'ALTRA CARTA HA PERSO O GUADAGNATO QUALCOSA ────────────────
    // La funzione nuova gira per OGNI carta giocata: quelle che il motore fa
    // per intero devono passarci accanto senza che succeda niente, o
    // prenderebbero il buff due volte.
    let doppie = 0, guardate = 0;
    // Le righe arrivano dal CATALOGO e non da FINAL_CARDS: il file aperto da
    // solo ne ha quattro, e cercarle li' vorrebbe dire non guardarne nessuna —
    // il controllo direbbe di si' senza aver provato niente. E' successo
    // scrivendolo, ed e' il motivo per cui il conto di quante ne ha guardate
    // e' un controllo suo.
    ${JSON.stringify(suGiocata)}
      .forEach(riga=>{
        if(!riga || !riga.abilita) return;
        if(!motoreFaLEvento(_makeCardDbCard(riga,1), 'on_play')) return;
        guardate++;
        const c2 = nuova(riga, 1);
        apparecchia(); G.currentPlayer = 1;
        G.board[key(0,0)] = { card:c2, owner:1 };
        const p = somma(c2.values);
        applicaAbilitaPiazzamento(c2, 0, 0, abilitaAttivaDi(c2));
        const d1 = somma(c2.values) - p;
        // La stessa carta, di nuovo da zero, ma passando SOLO dalla funzione
        // nuova: se anche lei facesse qualcosa, il totale sarebbe doppio.
        const c3 = nuova(riga, 1);
        apparecchia(); G.currentPlayer = 1;
        G.board[key(0,0)] = { card:c3, owner:1 };
        if(applicaLeMetaSemplici(c3, 'on_play', key(0,0))) doppie++;
      });
    // Prima di credere allo zero: quante carte ha davvero guardato? Un
    // controllo che non esercita niente dice sempre di si', ed e' peggio di un
    // controllo che manca — perche' sembra esserci.
    dice(guardate >= 5, 'ci sono carte che il motore fa per intero da guardare',
      'ne ho guardate ' + guardate);
    dice(doppie === 0, 'e nessuna di quelle ' + guardate + ' passa dalla strada nuova',
      doppie + ' ci sono passate: quelle prenderebbero il loro buff due volte');

    for(const k of CAMPI) G[k] = salva[k];
    return dette;
  }catch(e){ return [{ok:false, che:'la prova si e- rotta', perche:String((e && e.stack) || e)}]; } })()`);

  let male = 0;
  for (const d of dette) {
    console.log((d.ok ? '  ok  ' : '  NO  ') + d.che + (d.ok || !d.perche ? '' : '\n        ' + d.perche));
    if (!d.ok) male++;
  }
  console.log('\n' + dette.length + ' controlli, ' + male + ' storti');
  app.exit(male ? 1 : 0);
});
