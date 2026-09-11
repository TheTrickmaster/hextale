// IL CASO NON SI MOSTRA IN ANTEPRIMA — A SCHERMO.
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-anteprima-caso.js
//
// Regola di Lorenzo (v0.79.99): "ogni volta che una carta dovrebbe dare dei
// valori random, questi valori non vanno mostrati in anteprima, ma solo dopo
// che si e' giocata la carta, come funziona gia' per il Cowardly Lion", coi
// punti interrogativi sui valori che potrebbero cambiare. E il bordo del punto
// interrogativo sulla carta chiara e' bianco (#fff).
//
// Tre carte finte, scritte con le righe del foglio:
//   - un Genio (buff ally in_hand power all RAND 3): le carte in MANO devono
//     mostrare il punto interrogativo, e i numeri restare quelli di adesso;
//   - una Ginevra (buff ally in_hand random ALL 2): il punto interrogativo va
//     su TUTTE le candidate, non solo sull'estratta;
//   - un Leone (debuff self power RAND 1): la carta trascinata e' incerta;
//   - e un +2 ALL fermo, che invece si mostra come sempre.
// Poi il disegno: il "?" ha il bordo scuro sulla carta scura e bianco sulla chiara.
const { app, BrowserWindow } = require('electron');
const path = require('path');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  try {
    var sp = document.getElementById('splash'); if(sp) sp.remove();
    showPage('game');
    initGame(true);
    await respira(300);
    try{ fermaIlConto(); }catch(_){}
    G.gameOver = false; G.turnPlayLocked = false; G.sceltaBersaglio = null;

    var modello = FINAL_CARDS.find(function(e){ return e && e.values && !Array.isArray(e.values) && e.groupSides && e.groupSides.length > 1; }) || FINAL_CARDS.find(function(e){ return e && e.values && !Array.isArray(e.values); });
    var riga = function(effetto){ return { unica:false, trigger:'on_play', frequenza:'every_time', finestra:{ tipo:'always' },
      se:null, regola:null, legame:null, se2:null, regola2:null, effetto2:null, effetto:effetto }; };
    var voce = function(id, abilita){ return Object.assign(JSON.parse(JSON.stringify(modello)), { id:id, slug:id, name:id,
      cardAbility: abilita ? 'prova_' + id : '', abilityUnlockLevel:1, abilityLocked:false, abilita:abilita || null }); };
    var GENIO = voce('prova-genio', riga({ azione:'buff', chi:'ally', dove:'in_hand', cosa:'power', quale:'all', ambito:'RAND', quanto:{ numero:3 } }));
    var GINEVRA = voce('prova-ginevra', riga({ azione:'buff', chi:'ally', dove:'in_hand', cosa:'power', quale:'random', ambito:'ALL', quanto:{ numero:2 } }));
    var LEONE = voce('prova-leone', riga({ azione:'debuff', chi:'self', cosa:'power', ambito:'RAND', quanto:{ numero:1 } }));
    var FERMO = voce('prova-fermo', riga({ azione:'buff', chi:'self', cosa:'power', ambito:'ALL', quanto:{ numero:2 } }));
    var SEMPLICE = voce('prova-semplice', null);
    FINAL_CARDS.push(GENIO, GINEVRA, LEONE, FERMO, SEMPLICE);
    _sinergieDaFoglioNoto = null;
    dice(sinergieDalFoglio(), 'le sinergie vengono dal foglio');

    var fai = function(v, owner, n){ var c = _makeCardDbCard(v, owner); c.id = v.id + '-' + owner + '-p' + n; c.baseId = v.id; return c; };
    var prepara = function(chi){
      G.board = {}; G.holes = new Set(); G.destroyedHoles = new Set();
      G.currentPlayer = 1;
      var trascinata = fai(chi, 1, 0);
      var altre = [fai(SEMPLICE, 1, 1), fai(SEMPLICE, 1, 2), fai(SEMPLICE, 1, 3)];
      G.p1Hand = [trascinata].concat(altre); G.p2Hand = [];
      _anteprimaTavolo = null;
      dragState = { card: trascinata, hoverCellKey: key(0,0) };
      return { trascinata: trascinata, altre: altre };
    };
    var somma = function(v){ return SIDES.reduce(function(s,k){ return s + (v[k]||0); }, 0); };

    // ── il Genio ───────────────────────────────────────────────────────
    var p = prepara(GENIO);
    var es = anteprimaTavolo();
    dice(!!es && !!es.aSorte, 'la simulazione dice chi e- a sorte');
    var tutteASorte = p.altre.every(function(c){ return es.aSorte.mani[1][c.id]; });
    dice(tutteASorte, 'Genio: tutte le carte in mano sono segnate a sorte');
    var numeriFermi = p.altre.every(function(c){ return somma(es.mani[1][c.id]) === somma(c.values); });
    dice(numeriFermi, 'e i loro numeri in anteprima restano quelli di adesso (nessun +3 disegnato)');
    dice(p.altre.every(function(c){ return !c.__aSorte; }), 'il segno sta sulle copie della simulazione, non sulle carte vere');
    dice(firmaAnteprimaMani().indexOf('?') >= 0, 'e la firma dei ventagli se ne accorge (si ridisegnano)');

    // ── Ginevra ────────────────────────────────────────────────────────
    p = prepara(GINEVRA);
    es = anteprimaTavolo();
    var quante = p.altre.filter(function(c){ return es.aSorte.mani[1][c.id]; }).length;
    dice(quante === 3, 'Ginevra: il punto interrogativo va su tutte e tre le candidate', quante);

    // ── il Leone, trascinato ───────────────────────────────────────────
    p = prepara(LEONE);
    var ant = computeDragPreview(p.trascinata, 0, 0);
    dice(!!ant && ant.uncertain === true, 'Leone: la carta trascinata e- incerta');
    dice(!!ant && somma(ant.values) === somma(p.trascinata.values), 'e mostra i suoi numeri senza il -1', ant && somma(ant.values));

    // ── un +2 ALL fermo si vede come sempre ────────────────────────────
    p = prepara(FERMO);
    ant = computeDragPreview(p.trascinata, 0, 0);
    dice(!!ant && !ant.uncertain && somma(ant.values) === somma(p.trascinata.values) + 12,
      '+2 ALL: nessun punto interrogativo, e il +12 si vede', ant && (ant.uncertain + ' ' + somma(ant.values)));
    dragState = null; _anteprimaTavolo = null;

    // ── il disegno del punto interrogativo ─────────────────────────────
    var bordo = function(owner){
      var svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      document.body.appendChild(svg);
      var c = fai(SEMPLICE, owner, 9);
      drawHexCard(svg, 100, 100, 80, c, '#000', '#000', '#fff', c.name, false, null, null, true, c.values, null, true);
      var q = Array.prototype.find.call(svg.querySelectorAll('text'), function(t){ return t.textContent === '?'; });
      var s = q ? q.getAttribute('stroke') : null;
      svg.remove();
      return s;
    };
    var scura = playerFactionIsDark(1) ? 1 : 2, chiara = 3 - scura;
    dice(bordo(scura) === '#1D2D2F', 'sulla carta scura il "?" ha il bordo scuro', bordo(scura));
    dice(bordo(chiara) === '#fff', 'sulla carta chiara il "?" ha il bordo bianco', bordo(chiara));

    // La carta intera in mano deve passare l-incertezza al disegno.
    var mano = fai(SEMPLICE, chiara, 7);
    var intera = buildFullHandCardSVG(mano, 210, 360, { values: mano.values, deltas: null, uncertain: true });
    var qm = Array.prototype.filter.call(intera.querySelectorAll('text'), function(t){ return t.textContent === '?'; }).length;
    dice(qm > 0, 'la carta intera in mano disegna i punti interrogativi', qm);
    return d.join(String.fromCharCode(10));
  } catch(e) {
    return 'PIANTATA: ' + (e && e.message) + ' @ ' + ((e && e.stack) || '').split(String.fromCharCode(10))[1]
      + String.fromCharCode(10) + d.join(String.fromCharCode(10));
  }
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 800,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await win.loadURL('file:///' + path.resolve(__dirname, '..').split(path.sep).join('/') + '/play/index.html');
  await new Promise(r => setTimeout(r, 4000));
  let out;
  try { out = await win.webContents.executeJavaScript(CORPO); }
  catch(e){ out = 'ERRORE NELL\'INIEZIONE: ' + (e && e.message); }
  console.log('\n' + out + '\n');
  app.exit(String(out).indexOf('  NO  ') !== -1 || String(out).indexOf('PIANTATA') === 0 ? 1 : 0);
});
