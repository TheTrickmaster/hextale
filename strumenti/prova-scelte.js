// TUTTE LE ABILITA' CHE CHIEDONO QUALCOSA AL GIOCATORE, una per una.
//
// Il foglio ha una colonna che si chiama "Player selection". Quando dice yes,
// calare quella carta deve FERMARE il turno e aprire una finestra con dei
// bersagli da indicare. Quando non succede, da fuori e' identico a un'abilita'
// che non esiste: la carta scende, non succede niente, e nessuno dice se il
// gioco ha deciso o si e' dimenticato. E' il guasto silenzioso che questo
// gioco ha gia' pagato caro piu' volte — King Louie e Jack and the Beanstalk
// erano tutti e due cosi'.
//
// Questo banco le prova tutte. Per ognuna costruisce un tabellone che le
// darebbe di che scegliere e chiama LA STESSA porta che chiama il gioco
// (apriSceltaBersaglio: prima la tabella scritta a mano, poi il foglio).
//
//   $ELECTRON strumenti/prova-scelte.js
//
// Non prova COSA succede scegliendo — quello lo fanno i banchi delle singole
// carte. Prova che la domanda venga fatta.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';
const CATALOGO = path.join(RADICE, 'server', 'importazione', '.lavoro', 'catalogo.json');

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const cat = JSON.parse(fs.readFileSync(CATALOGO, 'utf8'));
  const carte = Array.isArray(cat) ? cat : (cat.carte || cat.cards || Object.values(cat));

  const win = new BrowserWindow({ show: false, width: 1280, height: 800,
    webPreferences: { contextIsolation: false, webSecurity: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 2000));

  const esito = await win.webContents.executeJavaScript(`(function(){ try{
    const CARTE = ${JSON.stringify(carte)};
    // Il catalogo vero al posto della tabella di ripiego: senza, le abilita'
    // che vanno a cercare una carta per nome (Excalibur) non troverebbero
    // niente e sembrerebbero rotte per il motivo sbagliato.
    FINAL_CARDS.length = 0; FINAL_CARDS.push.apply(FINAL_CARDS, CARTE);

    // Chi chiede qualcosa al giocatore, secondo il foglio.
    const chiedono = [];
    for(const x of CARTE){
      const a = x.abilita; if(!a) continue;
      for(const e of [a.effetto, a.effetto2]){
        if(!e || !e.scelta) continue;
        chiedono.push({ carta:x, a:a, eff:e });
        break;
      }
    }

    const celle = [];
    for(let q=-2;q<=2;q++) for(let r=-2;r<=2;r++){ if(Math.abs(q+r)>2) continue; celle.push({q:q,r:r}); }
    const salva = {};
    const CAMPI = ['cells','board','holes','destroyedHoles','currentPlayer','numeroTurno',
                   'p1Hand','p2Hand','p1Deck','p2Deck','sceltaBersaglio','gameOver'];
    for(const k of CAMPI) salva[k] = G[k];

    const finta = (nome, tratti, owner, abilita, valori) => ({
      id:'p'+nome, name:nome, owner:owner, rarity:'common', level:9,
      values: valori || {NW:3,NE:3,E:3,SE:3,SW:3,W:3},
      valoriBase: valori || {NW:3,NE:3,E:3,SE:3,SW:3,W:3},
      traits: tratti.slice(), traitNames: tratti.map(s=>s.charAt(0).toUpperCase()+s.slice(1)),
      cardAbility: abilita || null, abilityLocked:false, abilityUnlockLevel:1
    });

    // ── IL TABELLONE DI PROVA ────────────────────────────────────────────────
    // Attorno alla carta sotto esame c'e' di tutto: un'alleata e un'avversaria
    // con tratti e abilita', un'avversaria "reale" (per chi uccide i re), un
    // muro adiacente, una casella libera adiacente. Piu' lontano: altre carte,
    // altre caselle libere, un altro muro. Se una finestra non si apre QUI, non
    // e' perche' mancava di che scegliere.
    function apparecchia(){
      G.cells = celle;
      G.board = {};
      G.holes = new Set([key(0,-1), key(-2,2)]);
      G.destroyedHoles = new Set();
      G.currentPlayer = 1; G.numeroTurno = 3; G.gameOver = false;
      G.sceltaBersaglio = null;
      const metti = (q,r,c)=>{ G.board[key(q,r)] = { card:c, owner:c.owner }; };
      // adiacenti
      metti(1,0,  finta('Regina',  ['sovereign','wild'], 2, 'eat_the_rich', {NW:9,NE:9,E:1,SE:1,SW:5,W:5}));
      metti(1,-1, finta('Compagna',['wild'],             1, 'eat_the_rich'));
      metti(-1,1, finta('Nemica2', ['noble'],            2, null));
      metti(0,1,  finta('Amica2',  ['wild'],             1, null));
      // (-1,0) resta libera, (0,-1) e' un muro
      // lontane
      metti(2,0,  finta('Lontana', ['wild'],             1, null));
      metti(-2,1, finta('Lontana2',['beast'],            2, 'eat_the_rich'));
      G.p1Hand = [finta('Mano1',[],1), finta('Mano2',[],1)];
      G.p2Hand = [finta('Mano3',[],2)];
      G.p1Deck = []; G.p2Deck = [];
    }

    const dette = [];
    for(const v of chiedono){
      apparecchia();
      const x = v.carta;
      const card = finta(x.name, x.traits||[], 1, x.cardAbility);
      card.id = x.id; card.abilita = JSON.parse(JSON.stringify(x.abilita));
      card.abilityUnlockLevel = x.abilityUnlockLevel || 1;
      card.abilityLocked = false;   // il livello e' un'altra faccenda, vedi sotto
      card.rarity = x.rarity || 'common';
      G.board[key(0,0)] = { card:card, owner:1 };

      // ── LA PORTA GIUSTA DIPENDE DAL MOMENTO ──────────────────────────────
      // Non c'e' un solo registro di finestre, ce ne sono tre, e sbagliare
      // porta fa sembrare muta una carta che parla benissimo. Quale sia lo
      // dice la colonna Trigger:
      //   on_play    -> SCELTE_PIAZZAMENTO, e in mancanza sceltaDalFoglio
      //   on_conquer -> SCELTE_DOPO_CONQUISTA (la finestra si apre a scontro
      //                 finito, quindi vuole sapere cosa e' stato conquistato)
      //   on_moved   -> avvisaCartaSpostata, che apre da se' la sua finestra
      const chiave = abilitaAttivaDi(card);
      let scelta = null, guasto = '', strada = '';
      try{
        if(v.a.trigger === 'on_conquer'){
          strada = 'conquista';
          const f = SCELTE_DOPO_CONQUISTA[chiave];
          // conquestInfo: a queste finestre serve solo sapere che qualcosa e'
          // stato conquistato davvero.
          scelta = (typeof f === 'function') ? f(card, 0, 0, 1, [{ cella: key(1,0) }]) : null;
        } else if(v.a.trigger === 'on_moved'){
          strada = 'spostamento';
          G.sceltaBersaglio = null;
          const preso = avvisaCartaSpostata(card, key(2,-2), key(0,0), ()=>{});
          scelta = (preso && G.sceltaBersaglio) ? G.sceltaBersaglio : null;
          G.sceltaBersaglio = null;
        } else {
          const aMano = (typeof SCELTE_PIAZZAMENTO[chiave] === 'function');
          strada = aMano ? 'a mano' : 'dal foglio';
          scelta = aMano ? SCELTE_PIAZZAMENTO[chiave](card, 0, 0, 1)
                         : sceltaDalFoglio(card, 0, 0, 1);
        }
      }catch(e){ guasto = (e && e.message) || 'errore'; }

      dette.push({
        nome: x.name,
        sigla: String(x.cardAbility||''),
        riepilogo: (x.abilita && x.abilita.riepilogo) || '',
        trigger: v.a.trigger,
        strada: strada,
        apre: !!scelta,
        quanti: scelta ? ((scelta.bersagli||[]).length) : 0,
        modo: scelta ? (scelta.modo || 'mirino') : '',
        bloccataDalLivello: !!x.abilityLocked,
        guasto: guasto
      });
    }

    for(const k of CAMPI) G[k] = salva[k];
    return { dette:dette };
  }catch(e){ return { guasto: (e&&e.message)+' | '+String((e&&e.stack)||'').slice(0,240) }; } })()`);

  if (esito.guasto) { console.error('GUASTO: ' + esito.guasto); app.exit(1); return; }

  const mute = [];
  console.log('  ' + 'CARTA'.padEnd(24) + 'STRADA'.padEnd(11) + 'BERSAGLI  RIGA DEL FOGLIO');
  console.log('  ' + '-'.repeat(96));
  for (const d of esito.dette) {
    const ok = d.apre && d.quanti > 0;
    if (!ok) mute.push(d);
    console.log('  ' + (ok ? '' : '! ') + d.nome.padEnd(ok ? 24 : 22) + d.strada.padEnd(11)
      + String(d.quanti).padStart(5) + '     ' + d.riepilogo.slice(0, 52)
      + (d.guasto ? '   GUASTO: ' + d.guasto : ''));
  }
  console.log('\n  ' + esito.dette.length + ' carte con "Player selection = yes"');
  if (mute.length) {
    console.log('\n  NON APRONO NIENTE: ' + mute.map(m => m.nome).join(', '));
    app.exit(1);
  } else {
    console.log('\n  tutte chiedono il loro bersaglio.');
    app.exit(0);
  }
}).catch(e => { console.error(e); app.exit(1); });
