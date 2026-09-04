// SE UN NUMERO CAMBIA, IL RIQUADRO DEVE DIRE DA CHI.
//
// Il riquadro "Buffs/debuffs" del tooltip e della scheda ingrandita costruisce
// le sue righe da tre posti:
//   1. lo scarto dai valori stampati — il FATTO: quanto e' cambiato. C'e'
//      sempre, ma non ha un nome sopra.
//   2. le sinergie continue, chieste al motore fonte per fonte: hanno il nome.
//   3. il registro `card.modificatori`, che lo scrive chi chiama modificaValori
//      passando {chiave, da}: ha il nome.
// Quando 2 e 3 sono vuoti resta solo 1, e la carta mostra "+2 ALL" senza dire
// da chi. E' quello che si vede in partita.
//
// Questo banco fa scattare, una per una, ogni abilita' del foglio che cambia un
// valore, e guarda il riquadro che ne esce.
//
//   $ELECTRON strumenti/prova-attribuzione.js
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
    FINAL_CARDS.length = 0; FINAL_CARDS.push.apply(FINAL_CARDS, CARTE);

    // Chi cambia dei numeri, secondo il foglio.
    const cambiano = [];
    for(const x of CARTE){
      const a = x.abilita; if(!a) continue;
      const suoi = [a.effetto, a.effetto2].filter(e => e
        && ['buff','debuff','set'].indexOf(e.azione) >= 0
        && (!e.cosa || e.cosa === 'power'));
      if(suoi.length) cambiano.push({ x:x, a:a, eff:suoi[0] });
    }

    const celle = [];
    for(let q=-2;q<=2;q++) for(let r=-2;r<=2;r++){ if(Math.abs(q+r)>2) continue; celle.push({q:q,r:r}); }
    const CAMPI = ['cells','board','holes','destroyedHoles','currentPlayer','numeroTurno',
                   'p1Hand','p2Hand','p1Deck','p2Deck','sceltaBersaglio','gameOver'];
    const salva = {}; for(const k of CAMPI) salva[k] = G[k];

    const V = ()=>({NW:5,NE:5,E:5,SE:5,SW:5,W:5});
    const finta = (nome, tratti, owner) => {
      const v = V();
      return { id:'p'+nome, name:nome, owner:owner, rarity:'common', level:9,
        values:v, valoriBase:{...v}, valoriNascita:{...v},
        traits:tratti.slice(), traitNames:tratti.map(s=>s.charAt(0).toUpperCase()+s.slice(1)),
        cardAbility:null, abilityLocked:false, abilityUnlockLevel:1, modificatori:null };
    };

    function apparecchia(){
      G.cells = celle; G.board = {}; G.holes = new Set(); G.destroyedHoles = new Set();
      G.currentPlayer = 1; G.numeroTurno = 5; G.gameOver = false; G.sceltaBersaglio = null;
      const metti = (q,r,c)=>{ G.board[key(q,r)] = { card:c, owner:c.owner }; };
      metti(1,0,  finta('Vicina',   ['wild','small'],       2));
      metti(1,-1, finta('Compagna', ['wild','explorer'],    1));
      metti(0,1,  finta('Amica',    ['trickster','small'],  1));
      metti(-1,1, finta('Nemica',   ['sovereign','cruel'],  2));
      metti(2,-1, finta('Lontana',  ['noble','small'],      1));
      G.p1Hand = [finta('Mano1',['small'],1), finta('Mano2',['wild'],1)];
      G.p2Hand = [finta('Mano3',[],2)];
      G.p1Deck = [finta('Mazzo1',[],1)]; G.p2Deck = [finta('Mazzo2',[],2)];
    }

    // Una riga del riquadro che non dice da chi: nessun "from", nessun "Self".
    const anonima = (testo) => testo.indexOf(' from ') < 0 && testo.indexOf(' Self') < 0;
    // Le righe come le costruisce il gioco, senza passare per l'HTML.
    function righeDi(card){
      const html = bloccoModificatoriHTML(card);
      if(!html) return [];
      const d = document.createElement('div'); d.innerHTML = html;
      return [...d.querySelectorAll('.ct-mod')].map(e => e.textContent);
    }

    const dette = [];
    for(const v of cambiano){
      apparecchia();
      const x = v.x, trig = v.a.trigger;
      const card = finta(x.name, x.traits||[], 1);
      card.id = x.id; card.cardAbility = x.cardAbility;
      card.abilita = JSON.parse(JSON.stringify(x.abilita));
      G.board[key(0,0)] = { card:card, owner:1 };

      const riga = { nome:x.name, trigger:trig, riepilogo:(v.a.riepilogo||'').slice(0,58),
                     motore:false, cambia:0, anonime:[], righe:[] };
      // Il motore lo fa? Se no, e' scritta a mano e questo banco non la
      // riguarda: chi la scrive passa gia' il suo {chiave, da}.
      const momento = (trig === 'while_on_board') ? 'while_on_board' : trig;
      if(!motoreFaLEvento(card, momento)){ riga.motore = false; dette.push(riga); continue; }
      riga.motore = true;

      const extra = (trig === 'on_conquer' || trig === 'on_conquered')
        ? { attaccante: (trig === 'on_conquer') ? card : G.board[key(1,0)].card,
            attaccato:  (trig === 'on_conquer') ? G.board[key(1,0)].card : card,
            differenza: 3 }
        : {};
      let cambi = [];
      try{ cambi = _motore().cambiamentiAllEvento(card, momento, _scenaEvento(card, key(0,0), extra)) || []; }
      catch(e){ riga.guasto = (e&&e.message)||'errore'; dette.push(riga); continue; }
      if(!cambi.length){ dette.push(riga); continue; }

      const prima = new Map();
      for(const c of cambi) if(c.carta && !prima.has(c.carta)) prima.set(c.carta, {...c.carta.values});
      try{ applicaCambiamenti(cambi); }catch(e){ riga.guasto = (e&&e.message)||'errore'; }

      prima.forEach((valori, colpita)=>{
        const mosso = SIDES.some(s => (colpita.values[s]||0) !== (valori[s]||0));
        if(!mosso) return;
        riga.cambia++;
        const rr = righeDi(colpita);
        riga.righe = riga.righe.concat(rr);
        for(const t of rr) if(anonima(t)) riga.anonime.push(t);
      });
      dette.push(riga);
    }

    // ── LE SINERGIE CONTINUE ────────────────────────────────────────────────
    // Queste non passano da applicaCambiamenti: si ricalcolano a ogni disegno,
    // e il riquadro le chiede al motore fonte per fonte (_modificatoriDalMotore).
    // Il nome ce l'hanno per costruzione; quello che si controlla qui e' che la
    // domanda arrivi a destinazione — una sinergia che non produce nessuna riga
    // e' una sinergia che chi gioca non vedra' mai spiegata.
    const continue_ = [];
    for(const x of CARTE){
      const a = x.abilita; if(!a) continue;
      const e = [a.effetto, a.effetto2].find(y => y && y.durata === 'while_true'
        && ['buff','debuff','set'].indexOf(y.azione) >= 0);
      if(!e) continue;
      apparecchia();
      const card = finta(x.name, x.traits||[], 1);
      card.id = x.id; card.cardAbility = x.cardAbility;
      card.abilita = JSON.parse(JSON.stringify(x.abilita));
      G.board[key(0,0)] = { card:card, owner:1 };
      // Si guarda chi c'e' in campo, se stessa compresa: la riga puo' parlare
      // di lei (buff self) o dei vicini.
      let righe = 0, chi = [];
      for(const k in G.board){
        const p = G.board[k]; if(!p || !p.card) continue;
        let rr = [];
        try{ rr = _modificatoriDalMotore(p.card) || []; }catch(_){ rr = []; }
        if(rr.length){ righe += rr.length; chi.push(p.card.name + ' ' + rr.map(z=>'"'+z.testo+'"').join(' ')); }
      }
      // Nessuna riga non vuol dire per forza "muta": il riquadro ha un'ultima
      // rete, e cioe' il totale che si scrive "Self" quando la riga del foglio
      // dice che quella carta agisce su di se'. Succede alle sinergie la cui
      // CONDIZIONE guarda tutto il tabellone ("if board has_trait Small"): qui
      // le fonti si interrogano una per volta, e con una sola carta in campo
      // quella condizione non e' piu' vera. Va saputo, ma non e' un buco:
      // Biancaneve si legge "+2 ALL Self", che e' la risposta giusta.
      continue_.push({ nome:x.name, righe:righe, chi:chi.join('  '),
                       rete: !righe && _abilitaSuDiSe(card) });
    }

    for(const k of CAMPI) G[k] = salva[k];
    return { dette:dette, continue_:continue_ };
  }catch(e){ return { guasto:(e&&e.message)+' | '+String((e&&e.stack)||'').slice(0,300) }; } })()`);

  if (esito.guasto) { console.error('GUASTO: ' + esito.guasto); app.exit(1); return; }

  const mute = [], viste = [], inerti = [], fuori = [];
  for (const d of esito.dette) {
    if (!d.motore) { fuori.push(d); continue; }
    if (!d.cambia) { inerti.push(d); continue; }
    if (d.anonime.length) mute.push(d); else viste.push(d);
  }
  console.log('  ' + 'CARTA'.padEnd(24) + 'MOMENTO'.padEnd(15) + 'RIGHE DEL RIQUADRO');
  console.log('  ' + '-'.repeat(94));
  for (const d of mute.concat(viste)) {
    console.log('  ' + (d.anonime.length ? '! ' : '') + d.nome.padEnd(d.anonime.length ? 22 : 24)
      + d.trigger.padEnd(15) + d.righe.map(t => '"' + t + '"').join('  '));
  }
  console.log('\n  ' + (mute.length + viste.length) + ' abilita\' hanno davvero mosso dei numeri:  '
    + viste.length + ' dicono da chi,  ' + mute.length + ' NO');
  if (inerti.length) console.log('  ' + inerti.length + ' non hanno mosso niente su questo tabellone: '
    + inerti.map(d => d.nome).join(', '));
  if (fuori.length) console.log('  ' + fuori.length + ' non passano dal motore (scritte a mano): '
    + fuori.map(d => d.nome).join(', '));
  const guasti = esito.dette.filter(d => d.guasto);
  if (guasti.length) console.log('  GUASTI: ' + guasti.map(d => d.nome + ' (' + d.guasto + ')').join(', '));

  const cont = esito.continue_ || [];
  const parlano = cont.filter(c => c.righe > 0);
  console.log('\n  LE SINERGIE CONTINUE (righe chieste al motore, non al registro)');
  console.log('  ' + '-'.repeat(94));
  for (const c of cont) console.log('  ' + (c.righe || c.rete ? '' : '! ') + c.nome.padEnd(c.righe || c.rete ? 24 : 22)
    + (c.chi || (c.rete ? '(nessuna riga: la condizione guarda tutto il tabellone. Il totale la firma "Self")'
                        : '(NESSUNO la spiega)')));
  console.log('\n  ' + parlano.length + ' su ' + cont.length + ' hanno prodotto una riga col nome.');
  app.exit((mute.length || (esito.continue_||[]).some(c=>!c.righe && !c.rete)) ? 1 : 0);
}).catch(e => { console.error(e); app.exit(1); });
