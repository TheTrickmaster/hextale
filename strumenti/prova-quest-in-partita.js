// GLI AVANZAMENTI DELLE DAILY SI VEDONO IN PARTITA (v0.80.23).
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-quest-in-partita.js
//
// Lorenzo: "ancora non appaiono i popup degli avanzamenti delle daily in
// partita (ho provato contro bot in anteprima e non andavano)". Qui una partita
// vera contro il bot, con una quest "Flip 20 cards" a 3/20: si gira una carta e
//   1. il conto sale (QUEST_CONTO.flip);
//   2. nel posto degli avvisi arriva una scheda con 4/20;
//   3. la scheda si vede davvero: niente sopra di lei, dentro allo schermo,
//      e nessun antenato spento.
const { app, BrowserWindow } = require('electron');
require('./dal-disco');   // v0.80.22 — gli asset di hextalegame.com dal disco, non dal sito
const fs = require('fs');
const path = require('path');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';
const FILE_CATALOGO = path.join(RADICE, 'server', 'importazione', '.lavoro', 'catalogo.json');

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  try {
    var box = document.getElementById('quest-avvisi');
    dice(!!box, 'c-e- il posto degli avvisi');
    var arrivate = [];
    var guarda = function(n){
      var r = n.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      // gli avvisi non prendono clic (pointer-events:none), e elementFromPoint
      // li salterebbe: per la misura si accendono un istante
      var pe = box.style.pointerEvents; box.style.pointerEvents = 'auto'; n.style.pointerEvents = 'auto';
      var e = document.elementFromPoint(cx, cy);
      box.style.pointerEvents = pe; n.style.pointerEvents = '';
      var spento = null;
      for(var a = n; a && a !== document.documentElement; a = a.parentElement){
        var cs = getComputedStyle(a);
        if(cs.display === 'none' || cs.visibility === 'hidden' || (a !== n && Number(cs.opacity) < 0.05)){ spento = (a.id || a.className || a.tagName) + ' ' + cs.display + '/' + cs.visibility + '/' + cs.opacity; break; }
      }
      return { testo: n.textContent, dentro: r.width > 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.top >= 0,
        sopra: e ? (n.contains(e) ? 'lei' : (e.id || String(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className) || e.tagName)) : 'niente', spento: spento };
    };
    new MutationObserver(function(m){ m.forEach(function(x){ [].forEach.call(x.addedNodes, function(n){
      if(n.nodeType !== 1) return;
      setTimeout(function(){ arrivate.push(guarda(n)); }, 700);
    }); }); }).observe(box, { childList:true });

    var suoni = [], sfxVero = playSfxFile;
    playSfxFile = function(f){ suoni.push(f); };
    mm2DisegnaQuest([{ id:'flip20', nome:'Flip 20 cards', quanto:20, premio:'ink', fatto:3, presa:false }]);
    dice(QUEST_OGGI.length === 1, 'la quest del giorno e- in elenco');

    var modello = FINAL_CARDS.find(function(e){ return e && e.values && !Array.isArray(e.values); });
    var tutti = function(v){ return {NE:v,E:v,SE:v,SW:v,W:v,NW:v}; };
    var finta = function(id, n, v){ return Object.assign(JSON.parse(JSON.stringify(modello)), { id:id, slug:id, numero:n, name:id, rarity:'common', cardAbility:'', abilita:null, traits:[], traitNames:[], values:tutti(v), valuesBase:tutti(v), groupSides:[['NE','E','SE','SW','W','NW']] }); };
    var UNO = finta('prova-uno-q', 9701, 1), NOVE = finta('prova-nove-q', 9702, 9);
    FINAL_CARDS.push(UNO, NOVE);
    var n = 0;
    var fai = function(v, o){ var c = _makeCardDbCard(v, o); c.id = v.id + '-' + o + '-q' + (n++); c.baseId = v.id; return c; };

    showPage('game'); startGame(true); await respira(16000);
    dice(QUEST_OGGI.length === 1, 'l-elenco resta anche a partita cominciata', QUEST_OGGI.length);
    var qr = function(k){ return k.split(',').map(Number); };
    try{ fermaIlConto(); }catch(_){}
    G.board = {}; G.holes = new Set(); G.gameOver = false; G.currentPlayer = 1; G.turnPlayLocked = false; G.turnBannerActive = false; G.sceltaBersaglio = null;
    var A = '0,0';
    var E = DIRS.map(function(dd){ return key(dd.dq, dd.dr); })[0];
    G.board[E] = { card: fai(UNO, 2), owner: 2 };
    var nove = fai(NOVE, 1);
    G.p1Hand = [nove, fai(UNO, 1), fai(UNO, 1)];
    _firmaTabellonePrecedente = null; renderBoard(); render();
    var prima = QUEST_CONTO.flip;
    doPlace(nove, 0, 0, 0);
    await respira(3000);
    dice(G.board[E] && G.board[E].owner === 1, 'la carta avversaria e- stata girata', G.board[E] && G.board[E].owner);
    dice(QUEST_CONTO.flip === prima + 1, 'il conto delle carte girate sale', prima + ' -> ' + QUEST_CONTO.flip);
    var a = arrivate[0];
    dice(!!a, 'arriva un avviso in partita', arrivate.length);
    dice(a && /4\\/20/.test(a.testo), 'e dice 4/20', a && a.testo);
    dice(a && a.dentro, 'sta dentro allo schermo');
    dice(a && a.sopra === 'lei', 'e niente gli sta sopra', a && a.sopra);
    dice(a && !a.spento, 'nessun antenato spento', a && a.spento);
    dice(suoni.indexOf('quest-advance.mp3') !== -1, 'col suono dell-avanzamento');

    // 4. le quest delle carte girate gia' finite o riscattate: niente popup (e'
    //    giusto), ma la console dice perche', una volta sola
    await respira(4500);   // il turno del bot
    var detti = [], infoVera = console.info;
    console.info = function(m){ detti.push(String(m)); };
    mm2DisegnaQuest([{ id:'flip20', nome:'Flip 20 cards', quanto:20, premio:'ink', fatto:20, presa:false },
                     { id:'fliptimeless', nome:'Flip a Timeless card', quanto:1, premio:'pack', fatto:1, presa:true },
                     { id:'win3pvp', nome:'Win 3 PvP matches', quanto:3, premio:'pack', fatto:0, presa:false }]);
    var gia = arrivate.length;
    var gira = async function(){
      try{ fermaIlConto(); }catch(_){}
      G.board = {}; G.holes = new Set(); G.gameOver = false; G.currentPlayer = 1; G.turnPlayLocked = false; G.turnBannerActive = false; G.sceltaBersaglio = null;
      G.board[E] = { card: fai(UNO, 2), owner: 2 };
      var c = fai(NOVE, 1);
      G.p1Hand = [c, fai(UNO, 1), fai(UNO, 1)];
      _firmaTabellonePrecedente = null; renderBoard(); render();
      doPlace(c, 0, 0, 0);
      await respira(3000);
    };
    await gira();
    var spiegate = detti.filter(function(m){ return /\\[quest\\] carte girate, ma nessun popup/.test(m); });
    dice(G.board[E] && G.board[E].owner === 1 && arrivate.length === gia, 'con le quest gia- finite la carta si gira e non sale niente', arrivate.length - gia);
    dice(spiegate.length === 1 && /flip20 20\\/20/.test(spiegate[0]) && /fliptimeless 1\\/1 riscattata/.test(spiegate[0]) && !/win3pvp/.test(spiegate[0]), 'e la console dice perche-, con lo stato delle quest delle carte girate', spiegate[0]);
    await respira(4500);
    await gira();
    spiegate = detti.filter(function(m){ return /\\[quest\\] carte girate, ma nessun popup/.test(m); });
    dice(spiegate.length === 1, 'una volta sola per partita', spiegate.length);
    console.info = infoVera;
    playSfxFile = sfxVero;
  } catch(err){ dice(false, 'il banco e- arrivato in fondo', err.message + ' ' + String(err.stack || '').split('\\n').slice(1,3).join(' | ')); }
  return d.join('\\n');
})()`;

app.whenReady().then(async () => {
  setTimeout(() => { console.log('  NO  il banco non ha finito in tempo'); app.exit(2); }, 120000);
  let carte = null;
  try { const c = JSON.parse(fs.readFileSync(FILE_CATALOGO, 'utf8')); carte = Array.isArray(c) ? c : (c.carte || null); } catch (e) { carte = null; }
  if (!carte) { console.log('  NO  catalogo non letto: ' + FILE_CATALOGO); app.exit(1); return; }
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, frame: false, useContentSize: true,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  win.webContents.on('console-message', (e, livello, msg) => { if (livello >= 3) console.log('[console] ' + msg); });
  await win.loadURL(PAGINA);
  win.setPosition(-3200, 0); win.showInactive();
  await new Promise(r => setTimeout(r, 14000));
  await win.webContents.insertCSS('#splash{display:none!important} #tutorial-overlay{display:none!important}');
  await win.webContents.executeJavaScript('_applicaCatalogo(' + JSON.stringify(carte) + '); "ok"');
  const esito = await win.webContents.executeJavaScript(CORPO);
  console.log(esito);
  const no = (esito.match(/^  NO  /gm) || []).length;
  const ok = (esito.match(/^  ok  /gm) || []).length;
  console.log('\n' + ok + ' ok, ' + no + ' NO');
  app.exit(no ? 1 : 0);
});
