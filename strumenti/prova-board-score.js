// IL PANNELLO "BOARD SCORE" IN CIMA ALLA PARTITA.
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-board-score.js
//
// Richiesta di Lorenzo (v0.80.7): il componente "!board-score" del Figma
// (Battle Screen, 975:28506) va in partita. Tiene il conto dei punti delle
// carte in tavola, cosi' si capisce al volo chi e' indietro con i punti di fine
// turno. Attaccato al bordo superiore, 2px fuori. dark-card-icon per il
// giocatore dark, light-card-icon per il light. Il tabellone scende quanto
// basta a non finirci sotto.
//
// Qui:
//   1. le misure del disegno: 68 di altezza, top -2, centrato, 16 fra i pezzi,
//      icone 26x44, numero 50 e scritta 22 in Marcellus SC;
//   2. il numero e' quello che l'onda di fine turno consegnera' (common 3,
//      rare 2, mythic 1, timeless 0), e cambia appena cambia il tabellone;
//   3. le icone seguono la fazione, e il lato segue io-sono-2;
//   4. la punta del tabellone resta sotto al pannello;
//   5. fuori dalla partita il pannello non c'e'.
const { app, BrowserWindow } = require('electron');
const path = require('path');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
setTimeout(() => { console.error('PIANTATA: nessuna risposta in 150s'); app.exit(2); }, 150000);

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var giro = function(v){ return Math.round(v * 10) / 10; };
  try {
    var carte = FINAL_CARDS.filter(function(e){ return e && e.values && !Array.isArray(e.values); });
    var di = function(r){ return carte.find(function(e){ return String(e.rarity).toLowerCase() === r; }); };
    var n = 0;
    var fai = function(e, o){ var c = _makeCardDbCard(e, o); c.id = e.id + '-' + o + '-b' + (n++); c.baseId = e.id; return c; };

    showPage('game');
    startGame(true);
    await respira(16000);
    try{ fermaIlConto(); }catch(_){}
    var el = document.getElementById('board-score');
    dice(!!el, 'in partita il pannello c-e-');
    var r = el.getBoundingClientRect();
    dice(giro(r.top) === -2, 'appeso al bordo superiore, 2px fuori', giro(r.top));
    dice(giro(r.height) === 68, 'alto 68 come nel disegno (il bordo non conta)', giro(r.height));
    dice(Math.abs((r.left + r.width / 2) - 960) < 0.6, 'centrato', giro(r.left + r.width / 2));
    var cs = getComputedStyle(el);
    dice(cs.gap === '16px' && cs.paddingTop === '12px', '16 fra i pezzi, 12 di margine', cs.gap + ' / ' + cs.paddingTop);
    dice(cs.borderBottomLeftRadius === '12px' && cs.borderTopLeftRadius === '0px', 'angoli bassi a 12, alti dritti');
    var ico = document.getElementById('bs-p1-icona').getBoundingClientRect();
    dice(giro(ico.width) === 26 && giro(ico.height) === 44, 'icone 26x44', giro(ico.width) + 'x' + giro(ico.height));
    var num = getComputedStyle(document.getElementById('bs-p1-num'));
    dice(num.fontSize === '50px' && /Marcellus SC/.test(num.fontFamily), 'numero a 50 in Marcellus SC', num.fontSize);
    var et = document.querySelector('#board-score .bs-etichetta');
    var cse = getComputedStyle(et);
    dice(et.textContent === 'Board score' && cse.fontSize === '22px' && cse.color === 'rgb(221, 202, 161)', 'scritta "Board score" a 22, DDCAA1', cse.color);

    // ── 2. il numero ─────────────────────────────────────────────────────
    G.board = {}; G.holes = new Set(); G.destroyedHoles = new Set();
    _firmaTabellonePrecedente = null; renderBoard();
    var p1 = function(){ return document.getElementById('bs-p1-num').textContent; };
    var p2 = function(){ return document.getElementById('bs-p2-num').textContent; };
    dice(p1() === '0' && p2() === '0', 'tabellone vuoto: 0 e 0', p1() + ' / ' + p2());
    // Col disegno a 0 e 0 il pannello e' largo esattamente 329: il testo "0"
    // in Figma e' largo 41, e tutto il resto sono misure fisse.
    var w0 = document.getElementById('board-score').getBoundingClientRect().width;
    dice(Math.abs(w0 - 329) <= 1.5, 'a 0 e 0 e- largo 329 come nel disegno', giro(w0));
    G.board[key(0,0)] = { card: fai(di('common'), 1), owner: 1 };
    G.board[key(-1,1)] = { card: fai(di('rare'), 1), owner: 1 };
    G.board[key(1,0)] = { card: fai(di('mythic'), 2), owner: 2 };
    if(di('timeless')) G.board[key(1,-1)] = { card: fai(di('timeless'), 2), owner: 2 };
    _firmaTabellonePrecedente = null; renderBoard();
    dice(p1() === '5' && p2() === '1', 'common 3 + rare 2 = 5; mythic 1 + timeless 0 = 1', p1() + ' / ' + p2());
    var attese = carteCheFruttano();
    var somma = function(l){ return String(l.reduce(function(a, c){ return a + c.punti; }, 0)); };
    dice(p1() === somma(attese[1]) && p2() === somma(attese[2]), 'e sono i punti che l-onda di fine turno consegnera-');
    // Una conquista cambia il conto senza che nessuno lo chieda.
    G.board[key(1,0)].owner = 1;
    render();
    dice(p1() === '6' && p2() === '0', 'una carta conquistata passa dall-altra parte', p1() + ' / ' + p2());

    // ── 3. icone e lati ──────────────────────────────────────────────────
    var src = function(p){ return document.getElementById('bs-p' + p + '-icona').getAttribute('src') || ''; };
    var dark1 = playerFactionIsDark(1);
    dice(/dark-card-icon/.test(src(dark1 ? 1 : 2)) && /light-card-icon/.test(src(dark1 ? 2 : 1)),
      'dark-card-icon al giocatore dark, light-card-icon al light', src(1).split('/').pop() + ' / ' + src(2).split('/').pop());
    var xs = function(){ return ['bs-p1-icona','bs-p1-num','bs-p2-num','bs-p2-icona'].map(function(id){ return document.getElementById(id).getBoundingClientRect().left; }); };
    var a = xs();
    dice(a[0] < a[1] && a[1] < a[2] && a[2] < a[3], 'il giocatore 1 a sinistra, le icone sui bordi esterni');
    document.body.classList.add('io-sono-2');
    var b = xs();
    dice(b[3] < b[2] && b[2] < b[1] && b[1] < b[0], 'da giocatore 2 i lati si scambiano, icone sempre fuori');
    document.body.classList.remove('io-sono-2');

    // ── 4. il tabellone sta sotto ────────────────────────────────────────
    G.board = {}; _firmaTabellonePrecedente = null; renderBoard();
    await respira(300);
    // Le caselle vere, non tutti i poligoni: quelli dentro a un clipPath non si
    // disegnano e getBoundingClientRect li mette a zero.
    var celle = Array.prototype.slice.call(document.querySelectorAll('#board-svg [data-cellkey]'))
      .map(function(p){ return p.getBoundingClientRect(); })
      .filter(function(b){ return b.height > 0; });
    var cima = Math.min.apply(null, celle.map(function(b){ return b.top; }));
    dice(cima > r.bottom, 'la punta del tabellone resta sotto al pannello', 'tabellone da ' + giro(cima) + ', pannello fino a ' + giro(r.bottom));

    // ── 5. fuori dalla partita ───────────────────────────────────────────
    showPage('mainmenu');
    await respira(300);
    dice(!document.getElementById('board-score'), 'nel menu il pannello non c-e-');
    return d.join(String.fromCharCode(10));
  } catch(e) {
    return 'PIANTATA: ' + (e && e.message) + ' @ ' + ((e && e.stack) || '').split(String.fromCharCode(10))[1]
      + String.fromCharCode(10) + d.join(String.fromCharCode(10));
  }
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, frame: false, useContentSize: true,
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
