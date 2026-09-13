// LE ICONE DI SCELTA SONO META' DI PRIMA.
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-icone-scelta.js
//
// Richiesta di Lorenzo (v0.80.6): "rendi tutte le icone che appaiono quando si
// gioca un'abilita' che necessita di un'azione del giocatore piu' piccole del
// 50%". Sulla plancia nascono tutte da buildSvgIconBtn (mirino o icona della
// scelta, mano da trascinare, X per rinunciare); nella mano c'e' la croce dello
// scarto, che e' CSS.
//
// La misura si legge contro il tabellone: R non e' globale, ma la distanza fra
// i centri di due icone su caselle opposte rispetto alla carta la dice.
//   1. il mirino e' largo R*0.31 (era R*0.62);
//   2. la X per rinunciare R*0.21 (era R*0.42);
//   3. la croce dello scarto nella mano 37px (era 74);
//   4. e le icone si cliccano ancora.
const { app, BrowserWindow } = require('electron');
const path = require('path');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
setTimeout(() => { console.error('PIANTATA: nessuna risposta in 150s'); app.exit(2); }, 150000);

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var vicino = function(a, b){ return Math.abs(a - b) <= Math.max(0.6, b * 0.03); };
  try {
    var modello = FINAL_CARDS.find(function(e){ return e && e.values && !Array.isArray(e.values); });
    var copia = function(extra){ return Object.assign(JSON.parse(JSON.stringify(modello)), extra); };
    var tutti = function(v){ return {NE:v,E:v,SE:v,SW:v,W:v,NW:v}; };
    // Una carta che, giocata, chiede di indicare un nemico accanto: la stessa
    // riga di Badr al-Budur, che apre il mirino su ogni nemico adiacente.
    var SCEGLIE = copia({ id:'final-prova-icone', slug:'prova-icone', numero:9181, name:'Prova Icone', cardAbility:'!prova_icone', abilityLocked:false, abilityUnlockLevel:1,
      traits:[], traitNames:[], values:tutti(9), valuesBase:tutti(9),
      abilita:{ unica:false, trigger:'on_play', frequenza:'once_per_game', finestra:{ tipo:'always' }, se:null, regola:null,
        legame:null, se2:null, regola2:null, effetto2:null,
        effetto:{ azione:'swap', scelta:true, chi:'opponent', dove:'adjacent', cosa:'card', quale:'single' } } });
    var DEBOLE = copia({ id:'final-prova-debole-i', slug:'prova-debole-i', numero:9182, name:'Prova Debole', cardAbility:'', abilita:null,
      traits:[], traitNames:[], values:tutti(1), valuesBase:tutti(1) });
    FINAL_CARDS.push(SCEGLIE, DEBOLE);
    _sinergieDaFoglioNoto = null;
    var n = 0;
    var fai = function(v, o){ var c = _makeCardDbCard(v, o); c.id = v.id + '-' + o + '-i' + (n++); c.baseId = v.id; return c; };

    showPage('game');
    startGame(true);
    await respira(16000);
    try{ fermaIlConto(); }catch(_){}
    G.board = {}; G.holes = new Set(); G.destroyedHoles = new Set(); G.gelo = {}; G.briciole = {};
    G.gameOver = false; G.currentPlayer = 1; G.turnPlayLocked = false; G.sceltaBersaglio = null; G.vsAI = true;
    G.board[key(1,0)] = { card: fai(DEBOLE, 2), owner: 2 };
    G.board[key(-1,0)] = { card: fai(DEBOLE, 2), owner: 2 };
    var carta = fai(SCEGLIE, 1);
    G.p1Hand = [carta, fai(DEBOLE, 1)];
    _firmaTabellonePrecedente = null; renderBoard(); render();
    await respira(400);
    doPlace(carta, 0, 0, 0);
    await respira(300);
    dice(!!G.sceltaBersaglio && G.sceltaBersaglio.bersagli.length === 2, 'la scelta si apre su due nemici',
      G.sceltaBersaglio && JSON.stringify(G.sceltaBersaglio.bersagli));

    var icone = Array.prototype.slice.call(document.querySelectorAll('#board-svg .hx-icon-scelta'));
    var misura = function(g){ var im = g.querySelector('image');
      var w = +im.getAttribute('width'); return { w: w, x: +im.getAttribute('x') + w / 2, y: +im.getAttribute('y') + w / 2, g: g }; };
    var m = icone.map(misura);
    dice(m.length === 3, 'tre icone: due mirini e la X', m.length);
    // La X e' la piu' piccola; i due mirini sono le altre.
    m.sort(function(a, b){ return a.w - b.w; });
    var x = m[0], mirini = m.slice(1);
    // Fra (1,0) e (-1,0) ci sono due passi di tabellone.
    var p0 = axialToPixel(1, 0, 0, 0, 1), p1 = axialToPixel(-1, 0, 0, 0, 1);
    var passiPerR = Math.hypot(p0.x - p1.x, p0.y - p1.y);
    var R = Math.hypot(mirini[0].x - mirini[1].x, mirini[0].y - mirini[1].y) / passiPerR;
    dice(R > 10, 'il raggio delle caselle si ricava dalle icone', R.toFixed(1));
    dice(vicino(mirini[0].w, R * 0.31) && vicino(mirini[1].w, R * 0.31), 'il mirino e- largo R*0.31, meta- di prima',
      mirini[0].w.toFixed(1) + ' contro ' + (R * 0.31).toFixed(1) + ' (prima ' + (R * 0.62).toFixed(1) + ')');
    dice(vicino(x.w, R * 0.21), 'la X per rinunciare e- larga R*0.21, meta- di prima',
      x.w.toFixed(1) + ' contro ' + (R * 0.21).toFixed(1) + ' (prima ' + (R * 0.42).toFixed(1) + ')');

    // E si cliccano ancora: un clic sul mirino chiude la scelta.
    mirini[0].g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await respira(80);
    dice(!G.sceltaBersaglio, 'il mirino rimpicciolito si clicca ancora');
    await respira(3500);

    // La croce dello scarto, nella mano: e' CSS.
    var croce = document.createElement('div');
    croce.className = 'scarta-croce';
    document.body.appendChild(croce);
    var cs = getComputedStyle(croce);
    dice(cs.width === '37px' && cs.height === '37px', 'la croce dello scarto nella mano e- 37px, meta- di prima', cs.width + 'x' + cs.height);
    croce.remove();
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
