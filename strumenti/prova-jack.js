// JACK AND THE BEANSTALK, "Up You Go!": due domande in fila.
//
// "Puo' spostare un alleato ovunque sul tabellone" sono DUE scelte — chi, e
// dove — e due finestre in fila sono il punto in cui e' piu' facile lasciare il
// turno fermo per sempre: basta che la seconda non si apra, o che la
// continuazione della prima non arrivi mai in fondo.
//
//   $ELECTRON strumenti/prova-jack.js
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
  const jack = carte.find(c => c && c.name === 'Jack and the Beanstalk');
  if (!jack) { console.error('nel catalogo non c-e- Jack and the Beanstalk'); app.exit(1); return; }

  const win = new BrowserWindow({ show: false, width: 1280, height: 800,
    webPreferences: { contextIsolation: false, webSecurity: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 2000));

  const esito = await win.webContents.executeJavaScript(`(async function(){ try{
    const RIGA = ${JSON.stringify(jack)};
    const dette = [];
    const dice = (ok, che, perche) => dette.push({ ok:!!ok, che:che, perche:perche||'' });
    const attendi = (ms)=>new Promise(r=>setTimeout(r,ms));

    const celle = [];
    for(let q=-2;q<=2;q++) for(let r=-2;r<=2;r++){ if(Math.abs(q+r)>2) continue; celle.push({q:q,r:r}); }
    const CAMPI = ['cells','board','holes','destroyedHoles','currentPlayer','numeroTurno',
                   'p1Hand','p2Hand','p1Deck','p2Deck','sceltaBersaglio','gameOver'];
    const salva = {}; for(const k of CAMPI) salva[k] = G[k];

    const finta = (nome, owner) => ({
      id:'p'+nome, name:nome, owner:owner, rarity:'common', level:9,
      values:{NW:3,NE:3,E:3,SE:3,SW:3,W:3}, valoriBase:{NW:3,NE:3,E:3,SE:3,SW:3,W:3},
      traits:[], traitNames:[], cardAbility:null, abilityLocked:false, abilityUnlockLevel:1
    });
    const jackFinto = () => {
      const c = finta('Jack and the Beanstalk', 1);
      c.id = RIGA.id; c.cardAbility = RIGA.cardAbility;
      c.abilita = JSON.parse(JSON.stringify(RIGA.abilita));
      return c;
    };
    function apparecchia(pieno){
      G.cells = celle; G.board = {}; G.holes = new Set(); G.destroyedHoles = new Set();
      G.currentPlayer = 1; G.numeroTurno = 3; G.gameOver = false; G.sceltaBersaglio = null;
      G.p1Hand = []; G.p2Hand = []; G.p1Deck = []; G.p2Deck = [];
      const metti = (q,r,c)=>{ G.board[key(q,r)] = { card:c, owner:c.owner }; };
      metti(0,0, jackFinto());
      metti(1,-1, finta('Compagna', 1));
      metti(0,1,  finta('Amica', 1));
      metti(1,0,  finta('Nemica', 2));
      if(pieno){
        // tabellone senza nemmeno una casella libera
        for(const c of celle){ const k = key(c.q,c.r); if(!G.board[k]) metti(c.q,c.r, finta('Tappo'+k, 2)); }
      }
      return G.board[key(0,0)].card;
    }

    // ── 1. la prima finestra: CHI si sposta ─────────────────────────────────
    let card = apparecchia(false);
    const uno = sceltaDalFoglio(card, 0, 0, 1);
    dice(!!uno, 'la prima finestra si apre',
      'Senza, la carta scende e non chiede niente — e- il guasto segnalato.');
    if(!uno){ for(const k of CAMPI) G[k] = salva[k]; return dette; }

    const b1 = uno.bersagli || [];
    dice(b1.indexOf(key(1,-1)) >= 0 && b1.indexOf(key(0,1)) >= 0, 'si possono indicare gli ALLEATI');
    dice(b1.indexOf(key(1,0)) < 0, 'non l-avversaria', 'Il foglio dice "Who = ally".');
    dice(b1.indexOf(key(0,0)) < 0, 'ne- se stessa');

    // ── 2. la seconda: DOVE va ──────────────────────────────────────────────
    let proseguito = 0;
    uno.applicaEAspetta(key(1,-1), ()=>{ proseguito++; });
    const due = G.sceltaBersaglio;
    dice(!!due, 'scelto chi, si apre la SECONDA finestra',
      'E- la meta- che il foglio chiama "ovunque": sceglierla al posto suo\\n' +
      '        vorrebbe dire togliergli proprio cio- che la carta promette.');
    if(!due){ for(const k of CAMPI) G[k] = salva[k]; return dette; }

    const b2 = due.bersagli || [];
    const libere = celleLibere();
    dice(b2.length === libere.filter(k=>k!==key(1,-1)).length && b2.every(k=>libere.indexOf(k)>=0),
      'e i bersagli sono le caselle LIBERE (' + b2.length + ')');
    dice(b2.indexOf(key(0,0)) < 0 && b2.indexOf(key(1,0)) < 0, 'mai una casella occupata');
    dice(proseguito === 0, 'il turno NON e- ancora ripreso',
      'La continuazione della prima finestra deve arrivare in fondo alla\\n' +
      '        seconda, o lo scontro guarderebbe un tabellone che sta per cambiare.');

    // ── 3. e la carta si sposta davvero ─────────────────────────────────────
    const meta = key(-2,2);
    dice(b2.indexOf(meta) >= 0, 'la casella lontana e- fra le mete: "ovunque" e- ovunque');
    let finita = 0;
    due.applicaEAspetta(meta, ()=>{ finita++; });
    await attendi(1200);
    dice(!G.board[key(1,-1)], 'la carta ha lasciato la casella di partenza');
    dice(!!(G.board[meta] && G.board[meta].card && G.board[meta].card.name === 'Compagna'),
      'ed e- arrivata dall-altra parte del tabellone');
    dice(finita === 1, 'e il turno riprende, una volta sola',
      'Zero vuol dire partita ferma per sempre; due vuol dire lo scontro\\n' +
      '        risolto due volte sulla stessa carta.');

    // ── 4. tabellone pieno: nessuna finestra e nessuna pausa ────────────────
    card = apparecchia(true);
    dice(sceltaDalFoglio(card, 0, 0, 1) === null,
      'con il tabellone pieno non si apre niente',
      'Far scegliere una carta per poi non poterla mettere da nessuna parte\\n' +
      '        e- una pausa senza uscita.');

    for(const k of CAMPI) G[k] = salva[k];
    return dette;
  }catch(e){ return [{ok:false, che:'GUASTO: '+(e&&e.message), perche:String((e&&e.stack)||'').slice(0,300)}]; } })()`);

  let male = 0;
  for (const d of esito) {
    if (!d.ok) male++;
    console.log((d.ok ? '  ok   ' : '  NO   ') + d.che);
    if (!d.ok && d.perche) console.log('        ' + d.perche);
  }
  console.log(male ? '\n' + male + ' cose non tornano' : '\ntutto a posto (' + esito.length + ' controlli)');
  app.exit(male ? 1 : 0);
}).catch(e => { console.error(e); app.exit(1); });
