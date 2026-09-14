// SHERAZADE CONGELA IL TASSELLO CHE SCEGLI (v0.80.20).
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-sherazade.js
//
// Lorenzo: "sherazade non funziona. insegna ad interpretare la stringa al
// gioco". La riga del foglio (reimport del 14/09): "on play, once per game,
// freeze chosen any board tile free 1 n_turns". Qui, con la carta vera del
// catalogo:
//   1. giocata, si apre la finestra sui tasselli liberi (non sui muri, non su
//      quelli gia' congelati, non sulla sua casella), e senza gelo automatico;
//   2. scelto un tassello, gela quello e basta, per un turno: non ci si gioca
//      sopra, e al turno dopo si scioglie;
//   3. rinunciando non gela niente;
//   4. l'IA sceglie da sola la casella che rende di piu';
//   5. in rete la scelta parte al server (op 10) e il gelo arriva con l'op 11;
//   6. l'anteprima non gela niente, e la carta non e' NO_SCRIPT.
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
    var voce = FINAL_CARDS.find(function(e){ return e && e.slug === 'sherazade'; });
    dice(voce && voce.abilita && voce.abilita.effetto && voce.abilita.effetto.azione === 'freeze' && voce.abilita.effetto.scelta === true, 'nel catalogo Sherazade e- "freeze chosen tile"', voce && voce.abilita && voce.abilita.riepilogo);
    var modello = FINAL_CARDS.find(function(e){ return e && e.values && !Array.isArray(e.values); });
    var tutti = function(v){ return {NE:v,E:v,SE:v,SW:v,W:v,NW:v}; };
    var UNO = Object.assign(JSON.parse(JSON.stringify(modello)), { id:'final-prova-uno-s', slug:'prova-uno-s', numero:9501, name:'Prova Uno', cardAbility:'', abilita:null, traits:[], traitNames:[], values:tutti(1), valuesBase:tutti(1) });
    FINAL_CARDS.push(UNO);
    _sinergieDaFoglioNoto = null;
    var n = 0;
    var fai = function(v, o){ var c = _makeCardDbCard(v, o); c.id = v.id + '-' + o + '-h' + (n++); c.baseId = v.id; return c; };
    var giocatrice = function(o){ var c = fai(voce, o); c.abilityLocked = false; return c; };
    showPage('game'); startGame(true); await respira(16000);
    var prepara = function(g, vsAI){ try{ fermaIlConto(); }catch(_){} G.board = {}; G.holes = new Set(); G.destroyedHoles = new Set(); G.gelo = {}; G.briciole = {};
      G.gameOver = false; G.currentPlayer = g; G.turnPlayLocked = false; G.turnBannerActive = false; G.sceltaBersaglio = null; G.vsAI = !!vsAI; G.numeroTurno = 3;
      G.p1Hand = [fai(UNO, 1), fai(UNO, 1)]; G.p2Hand = [fai(UNO, 2), fai(UNO, 2)]; _firmaTabellonePrecedente = null; renderBoard(); render(); };
    var cheGelo = function(){ return Object.keys(G.gelo || {}).filter(cellaCongelata).sort(); };

    dice(abilitaEseguibile(giocatrice(1)), 'la carta risulta programmata (niente NO_SCRIPT)');

    // ── 1. la finestra ──
    prepara(1);
    var muro = key(2, -1); G.holes.add(muro);
    var giaGelato = key(-2, 1); G.gelo[giaGelato] = G.numeroTurno + 1;
    var sh = giocatrice(1);
    G.p1Hand.unshift(sh);
    var semplici = 0, orig = congelaTasselli; congelaTasselli = function(c){ semplici++; return orig(c); };
    doPlace(sh, 0, 0, 0);
    await respira(900);
    congelaTasselli = orig;
    var s = G.sceltaBersaglio;
    dice(s && s.chiave === 'congela_tassello', 'giocata Sherazade si apre la scelta del tassello', s && s.chiave);
    var libere = celleLibere().filter(function(k){ return !cellaCongelata(k); }).sort();
    dice(s && s.bersagli.slice().sort().join('|') === libere.join('|'), 'i bersagli sono tutti i tasselli liberi', s && (s.bersagli.length + ' su ' + libere.length));
    dice(s && s.bersagli.indexOf(muro) < 0 && s.bersagli.indexOf(giaGelato) < 0 && s.bersagli.indexOf(key(0,0)) < 0, 'ma non il muro, non quello gia- gelato, non la sua casella');
    dice(semplici === 0 && cheGelo().join() === giaGelato, 'e nessun tassello si gela da solo', cheGelo().join(' '));
    dice(document.querySelectorAll('#board-svg image, #board image').length >= 0 && G.turnPlayLocked, 'il turno aspetta la scelta');

    // ── 2. la scelta ──
    var bersaglio = key(1, 1);
    dice(s && s.bersagli.indexOf(bersaglio) >= 0, 'il tassello (1,1) si puo- scegliere');
    var turnoGelo = G.numeroTurno;
    scegliBersaglio(bersaglio);
    await respira(200);
    dice(!G.sceltaBersaglio && cellaCongelata(bersaglio), 'scelto, quel tassello e- gelato');
    dice(cheGelo().length === 2 && G.gelo[bersaglio] === turnoGelo + 2, 'solo lui (piu- quello di prima), per un turno', JSON.stringify(G.gelo));
    dice(!canPlace(1, 1, fai(UNO, 2)), 'sopra non si puo- giocare');
    // G.numeroTurno sale a ogni cambio di giocatore: il turno dopo e- quello
    // dell-avversario, ed e- li- che il gelo deve fermarlo.
    var tieni = G.numeroTurno; G.numeroTurno = turnoGelo + 1;
    dice(cellaCongelata(bersaglio) && !canPlace(1, 1, fai(UNO, 2)), 'nel turno dell-avversario e- ancora gelato (e- li- che serve)');
    G.numeroTurno = turnoGelo + 2;
    dice(!cellaCongelata(bersaglio) && canPlace(1, 1, fai(UNO, 1)), 'e si scioglie quando tocca di nuovo a chi l-ha gelato');
    G.numeroTurno = tieni;
    await respira(2500);

    // ── 3. la rinuncia ──
    prepara(1);
    var sh2 = giocatrice(1);
    G.p1Hand.unshift(sh2);
    doPlace(sh2, 0, 0, 0);
    await respira(900);
    dice(G.sceltaBersaglio && G.sceltaBersaglio.chiave === 'congela_tassello', 'di nuovo la finestra');
    rinunciaSceltaBersaglio();
    await respira(200);
    dice(!G.sceltaBersaglio && cheGelo().length === 0, 'rinunciando non si gela niente', cheGelo().join(' '));
    await respira(2500);

    // ── 4. l-IA ──
    prepara(2, true);
    var shIA = giocatrice(2);
    G.p2Hand.unshift(shIA);
    doPlace(shIA, 1, 0, 0);
    await respira(900);
    var sIA = G.sceltaBersaglio;
    var attesa = sIA && sIA.valuta(sIA);
    dice(sIA && sIA.giocatore === 2 && typeof sIA.valuta === 'function' && sIA.bersagli.indexOf(attesa) >= 0, 'l-IA ha la sua scelta da valutare', attesa);
    aiResolvePendingAbilityIfAny();
    await respira(200);
    var gelIA = cheGelo();
    var migliore = sIA ? Math.max.apply(null, sIA.bersagli.map(function(k){ var p = k.split(',').map(Number); return aiVicinatoUtile(p[0], p[1]); })) : null;
    var qr = (gelIA[0] || '').split(',').map(Number);
    dice(gelIA.length === 1 && aiVicinatoUtile(qr[0], qr[1]) === migliore, 'l-IA gela la casella che rende di piu-', gelIA.join(' ') + ' valore ' + (gelIA.length ? aiVicinatoUtile(qr[0], qr[1]) : '-') + ' / migliore ' + migliore);
    await respira(2500);

    // ── 5. in rete ──
    prepara(1);
    var mandati = [], mmVero = mmManda;
    mmManda = function(x){ mandati.push(x); };
    PARTITA_RETE = { matchId:'prova', io:1, numeroTurno:3 };
    var shR = giocatrice(1);
    G.p1Hand.unshift(shR);
    doPlace(shR, 0, 0, 0, true);
    await respira(900);
    dice(G.sceltaBersaglio && G.sceltaBersaglio.chiave === 'congela_tassello', 'in rete la finestra si apre anche a chi gioca');
    chiudiSceltaBersaglio(key(1, 1));
    var scelgo = mandati.map(function(m){ return m.match_data_send; }).filter(function(x){ return x && x.op_code === 10; })[0];
    dice(scelgo && JSON.parse(atob(scelgo.data)).cella === key(1, 1) && cheGelo().length === 0 && !!G.sceltaBersaglio, 'la scelta parte al server (op 10) e il gelo aspetta la risposta', scelgo && atob(scelgo.data));
    reteMessaggio({ op_code:11, data: btoa(JSON.stringify({ cella: key(1, 1), di: 1 })) });
    await respira(200);
    dice(cellaCongelata(key(1, 1)) && !G.sceltaBersaglio, 'arrivata l-op 11 il tassello si gela', cheGelo().join(' '));
    mmManda = mmVero; PARTITA_RETE = null;
    await respira(2500);

    // ── 6. l-anteprima ──
    prepara(1);
    var shA = giocatrice(1);
    var primaA = JSON.stringify(G.gelo);
    simulaPiazzamento(shA, 0, 0);
    simulaPiazzamento(shA, 1, 0);
    dice(JSON.stringify(G.gelo) === primaA && !G.sceltaBersaglio, 'l-anteprima non gela niente e non apre finestre');

    // ── 7. v0.80.21: il suono del gelo e il ghiaccio che si scioglie ──
    var suoni = [], sfxVero = playSfxFile;
    playSfxFile = function(f){ suoni.push(f); };
    prepara(1);
    congelaTassello(key(1, 1), 1);
    dice(suoni.indexOf('freeze.mp3') >= 0, 'gelando un tassello suona freeze.mp3', suoni.join(','));
    suoni = [];
    var cartaGelo = fai(UNO, 2);
    applicaCambiamenti([{ azione:'freeze', cosa:'card', carta: cartaGelo, turni: 2 }]);
    dice(suoni.indexOf('freeze.mp3') >= 0 && cartaCongelata(cartaGelo), 'e anche gelando una carta', suoni.join(','));
    suoni = [];
    _simulazioneInCorso = true;
    try{ applicaCambiamenti([{ azione:'freeze', cosa:'card', carta: fai(UNO, 2), turni: 2 }]); congelaTasselli({ quanto:{ numero:1 } }); } finally { _simulazioneInCorso = false; }
    dice(suoni.indexOf('freeze.mp3') < 0, 'ma non nell-anteprima', suoni.join(','));
    playSfxFile = sfxVero;
    // lo scioglimento: gelato e disegnato, poi scade
    G.gelo = {}; congelaTassello(key(1, 1), 1);
    renderBoard();
    var lastra = function(){ return document.querySelector('#board-svg image[href$="frozen-tile.png"]'); };
    dice(!!lastra() && !document.querySelector('[data-gelo-scioglie]'), 'gelato, la lastra c-e- e non si sta sciogliendo');
    G.numeroTurno = G.gelo[key(1, 1)];
    renderBoard();
    var sciolta = document.querySelector('[data-gelo-scioglie]');
    var anim = sciolta && getComputedStyle(sciolta).animationName;
    dice(sciolta && anim === 'geloScioglie' && !cellaCongelata(key(1, 1)), 'scaduto il gelo, la lastra resta a sciogliersi (lampo e dissolvenza)', anim);
    // renderBoard non ridisegna se la firma del tabellone non e- cambiata: per
    // provare un ridisegno a meta- scioglimento lo si forza.
    await respira(120);
    _firmaTabellonePrecedente = null; renderBoard();
    var ancora = document.querySelector('[data-gelo-scioglie]');
    dice(ancora && parseFloat(ancora.style.animationDelay) <= -100, 'un ridisegno a meta- la riprende dal punto in cui era', ancora && ancora.style.animationDelay);
    await respira(700);
    _firmaTabellonePrecedente = null; renderBoard();
    dice(!document.querySelector('[data-gelo-scioglie]') && !lastra(), 'finito lo scioglimento non resta niente');
    G.gelo = {}; _firmaTabellonePrecedente = null; renderBoard();
    dice(!document.querySelector('[data-gelo-scioglie]'), 'e una partita nuova non scioglie ghiacci che non ci sono');
  } catch(err){ dice(false, 'il banco e- arrivato in fondo', err.message + ' ' + String(err.stack || '').split('\\n')[1]); }
  return d.join('\\n');
})()`;

app.whenReady().then(async () => {
  setTimeout(() => { console.log('  NO  il banco non ha finito in tempo'); app.exit(2); }, 150000);
  let carte = null;
  try { const c = JSON.parse(fs.readFileSync(FILE_CATALOGO, 'utf8')); carte = Array.isArray(c) ? c : (c.carte || null); } catch (e) { carte = null; }
  if (!carte) { console.log('  NO  catalogo non letto: ' + FILE_CATALOGO); app.exit(1); return; }
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, frame: false, useContentSize: true,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
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
