// BADR AL-BUDUR SCAMBIA CON UN NEMICO ACCANTO, POI ATTACCA.
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-badr-scambio.js
//
// Segnalazione di Lorenzo (v0.80.4): "controlla se l'abilita' di Badr al-Budur
// funziona. Dovrebbe fare swap con un avversario prima di attaccare."
// Non funzionava. Il foglio dice "on play, once per game, swap chosen opponent
// adjacent card single", ma sceltaDalFoglio sapeva costruire solo lo scambio di
// POSIZIONE fra due carte (il Pifferaio) e quello dei VALORI: la finestra non si
// apriva, la console diceva "[scelta non aperta]", e la carta attaccava da dove
// era caduta. Nessun NO_SCRIPT, perche' la riga c'era.
//
// Qui, con due carte finte scritte con la stessa riga:
//   1. la finestra si apre sui nemici accanto (non sugli alleati, non su una
//      carta intoccabile);
//   2. scelto il nemico, le due carte si scambiano di posto scivolando, e il
//      nemico arrivato nella casella di Badr non si porta dietro la sua caduta;
//   3. lo scontro parte dalla casella NUOVA;
//   4. rinunciando si attacca da dove si e';
//   5. l'IA scambia solo se dalla casella nuova rende di piu'.
const { app, BrowserWindow } = require('electron');
const path = require('path');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  try {
    var modello = FINAL_CARDS.find(function(e){ return e && e.values && !Array.isArray(e.values); });
    var copia = function(extra){ return Object.assign(JSON.parse(JSON.stringify(modello)), extra); };
    var tutti = function(v){ return {NE:v,E:v,SE:v,SW:v,W:v,NW:v}; };
    var BADR = copia({ id:'final-prova-badr', slug:'prova-badr', numero:9172, name:'Prova Badr', cardAbility:'!prova_badr', abilityLocked:false, abilityUnlockLevel:1,
      traits:[], traitNames:[], values:tutti(9), valuesBase:tutti(9),
      abilita:{ unica:false, trigger:'on_play', frequenza:'once_per_game', finestra:{ tipo:'always' }, se:null, regola:null,
        legame:null, se2:null, regola2:null, effetto2:null,
        effetto:{ azione:'swap', scelta:true, chi:'opponent', dove:'adjacent', cosa:'card', quale:'single' } } });
    var DEBOLE = copia({ id:'final-prova-debole-b', slug:'prova-debole-b', numero:9173, name:'Prova Debole', cardAbility:'', abilita:null,
      traits:[], traitNames:[], values:tutti(1), valuesBase:tutti(1) });
    var FORTE = copia({ id:'final-prova-forte-b', slug:'prova-forte-b', numero:9174, name:'Prova Forte', cardAbility:'', abilita:null,
      traits:[], traitNames:[], values:tutti(9), valuesBase:tutti(9) });
    FINAL_CARDS.push(BADR, DEBOLE, FORTE);
    _sinergieDaFoglioNoto = null;
    var n = 0;
    var fai = function(v, o, vals){ var c = _makeCardDbCard(v, o); c.id = v.id + '-' + o + '-z' + (n++); c.baseId = v.id;
      if(vals){ c.values = Object.assign({}, vals); c.valoriBase = Object.assign({}, vals); c.valoriNascita = Object.assign({}, vals); } return c; };
    var chi = function(k){ var p = G.board[k]; return p ? (p.card.name + '/' + p.owner) : '-'; };

    showPage('game');
    startGame(true);
    await respira(16000);
    var prepara = function(giocatore){
      try{ fermaIlConto(); }catch(_){}
      G.board = {}; G.holes = new Set(); G.destroyedHoles = new Set(); G.gelo = {};
      G.gameOver = false; G.currentPlayer = giocatore; G.turnPlayLocked = false; G.sceltaBersaglio = null; G.vsAI = true;
    };

    // ── 1. la finestra ────────────────────────────────────────────────────
    prepara(1);
    G.board[key(1,0)] = { card: fai(DEBOLE, 2), owner: 2 };     // nemico accanto
    G.board[key(-1,0)] = { card: fai(DEBOLE, 1), owner: 1 };    // alleato accanto
    G.board[key(2,0)] = { card: fai(DEBOLE, 2), owner: 2 };     // nemico oltre il primo
    var badr = fai(BADR, 1);
    G.p1Hand = [badr, fai(DEBOLE, 1)];
    _firmaTabellonePrecedente = null; renderBoard(); render();
    await respira(400);
    doPlace(badr, 0, 0, 0);
    await respira(250);
    var s = G.sceltaBersaglio;
    dice(!!s && s.chiave === 'scambio_carta', 'giocata accanto a un nemico, la finestra dello scambio si apre', s ? s.chiave : 'nessuna');
    dice(!!s && s.bersagli.length === 1 && s.bersagli[0] === key(1,0), 'e propone solo il nemico accanto (non l-alleato, non quello oltre)', s && JSON.stringify(s.bersagli));

    // ── 2. lo scambio ─────────────────────────────────────────────────────
    chiudiSceltaBersaglio(key(1,0));
    await respira(60);
    dice(G.board[key(1,0)] && G.board[key(1,0)].card === badr && G.board[key(0,0)] && G.board[key(0,0)].owner === 2,
      'le due carte si scambiano di posto', chi('0,0') + ' <-> ' + chi('1,0'));
    var bs = document.getElementById('board-svg');
    var elBadr = bs.querySelector('[data-conquered="1,0"]'), elNemico = bs.querySelector('[data-conquered="0,0"]');
    dice(!!elBadr && !!elNemico && elBadr.classList.contains('card-slide') && elNemico.classList.contains('card-slide'),
      'e scivolano tutte e due', (elBadr ? elBadr.getAttribute('class') : '-') + ' / ' + (elNemico ? elNemico.getAttribute('class') : '-'));
    dice(!!elNemico && !elNemico.classList.contains('card-land'), 'il nemico arrivato nella casella di Badr non fa la sua caduta', elNemico && elNemico.getAttribute('class'));

    // ── 3. lo scontro dalla casella nuova ─────────────────────────────────
    await respira(4000);
    dice(G.board[key(2,0)] && G.board[key(2,0)].owner === 1, 'dalla casella nuova Badr conquista la carta che prima non toccava', chi('2,0'));
    dice(G.board[key(0,0)] && G.board[key(0,0)].owner === 1, 'e anche il nemico scambiato, che le resta accanto', chi('0,0'));

    // ── 4. rinuncia ───────────────────────────────────────────────────────
    prepara(1);
    G.board[key(1,0)] = { card: fai(DEBOLE, 2), owner: 2 };
    var badr2 = fai(BADR, 1);
    G.p1Hand = [badr2, fai(DEBOLE, 1)];
    _firmaTabellonePrecedente = null; renderBoard(); render();
    await respira(400);
    doPlace(badr2, 0, 0, 0);
    await respira(250);
    if(G.sceltaBersaglio) chiudiSceltaBersaglio(null);
    await respira(3500);
    dice(G.board[key(0,0)] && G.board[key(0,0)].card === badr2 && G.board[key(1,0)].owner === 1,
      'rinunciando resta dov-e- e attacca da li-', chi('0,0') + ', ' + chi('1,0'));

    // ── 5. l-IA ───────────────────────────────────────────────────────────
    // Badr dell-IA in (0,0). Accanto un umano forte in (1,0), che da li- non batte;
    // oltre, in (2,0) e (2,-1), due umani deboli raggiungibili solo dalla casella (1,0).
    prepara(2);
    G.board[key(1,0)] = { card: fai(FORTE, 1), owner: 1 };
    G.board[key(2,0)] = { card: fai(DEBOLE, 1), owner: 1 };
    G.board[key(2,-1)] = { card: fai(DEBOLE, 1), owner: 1 };
    var badrIA = fai(BADR, 2, tutti(5));
    G.p2Hand = [badrIA, fai(DEBOLE, 2)];
    _firmaTabellonePrecedente = null; renderBoard(); render();
    await respira(400);
    doPlace(badrIA, 1, 0, 0);
    await respira(200);
    var sIA = G.sceltaBersaglio;
    var scelta = sIA && sIA.valuta ? sIA.valuta(sIA) : undefined;
    dice(scelta === key(1,0), 'l-IA scambia quando dalla casella nuova conquista di piu-', JSON.stringify(scelta));
    aiResolvePendingAbilityIfAny();
    await respira(4000);
    dice(G.board[key(2,0)].owner === 2 && G.board[key(2,-1)].owner === 2 && G.board[key(1,0)].card === badrIA,
      'e conquista le due carte che da dove era non raggiungeva', chi('1,0') + ', ' + chi('2,0') + ', ' + chi('2,-1'));
    // E quando lo scambio non conviene, rinuncia.
    prepara(2);
    G.board[key(1,0)] = { card: fai(DEBOLE, 1), owner: 1 };
    var badrIA2 = fai(BADR, 2, tutti(5));
    G.p2Hand = [badrIA2, fai(DEBOLE, 2)];
    _firmaTabellonePrecedente = null; renderBoard(); render();
    await respira(400);
    doPlace(badrIA2, 1, 0, 0);
    await respira(200);
    var sIA2 = G.sceltaBersaglio;
    var scelta2 = sIA2 && sIA2.valuta ? sIA2.valuta(sIA2) : 'nessuna finestra';
    dice(scelta2 === null, 'se dalla casella nuova non rende di piu-, l-IA non scambia', JSON.stringify(scelta2));
    if(G.sceltaBersaglio) chiudiSceltaBersaglio(null);
    await respira(3000);
    return d.join(String.fromCharCode(10));
  } catch(e) {
    return 'PIANTATA: ' + (e && e.message) + ' @ ' + ((e && e.stack) || '').split(String.fromCharCode(10))[1]
      + String.fromCharCode(10) + d.join(String.fromCharCode(10));
  }
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, frame: false,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await win.loadURL('file:///' + path.resolve(__dirname, '..').split(path.sep).join('/') + '/play/index.html');
  // Mostrata fuori dallo schermo: nascosta, la plancia nasce larga zero e non si disegna.
  win.setPosition(-3200, 0); win.showInactive();
  await new Promise(r => setTimeout(r, 14000));
  await win.webContents.insertCSS("#splash{display:none!important}");
  let out;
  try { out = await win.webContents.executeJavaScript(CORPO); }
  catch(e){ out = 'ERRORE NELL\'INIEZIONE: ' + (e && e.message); }
  console.log('\n' + out + '\n');
  app.exit(String(out).indexOf('  NO  ') !== -1 || String(out).indexOf('PIANTATA') === 0 ? 1 : 0);
});
