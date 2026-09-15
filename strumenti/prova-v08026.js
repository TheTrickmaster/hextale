// QUATTRO SEGNALAZIONI DI LORENZO (v0.80.26), DAL LATO DEL GIOCO.
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-v08026.js
//
//   1. Da Matchmaking a Play vs Bot il riquadro del rank e del mazzo (#mm2-testata)
//      resta fermo; i riquadri delle modalita' e il pulsante si animano ancora.
//   2. Al posto di "prese/5" il pannello delle daily dice quanto manca al cambio
//      delle quest (mezzanotte GMT): "7h 32m", sotto l'ora "32m 05s", riscritto
//      ogni secondo; passata la mezzanotte si chiede l'elenco nuovo.
//   3. Gli avvisi dell'avanzamento delle quest sono il 30% piu' grandi, con tutto
//      quel che hanno dentro.
//   4. I punti di fine partita: il racconto (op 7) porta i valori delle carte, e op
//      6 "finita" porta i punti del server, che la schermata di fine partita mostra
//      (numeri e vincitore) anche se questo schermo ne aveva contati altri.
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
  var q = function(s){ return document.querySelector(s); };
  try {
    showPage('mainmenu');
    var finoA = performance.now();
    await respira(200);
    while(transizioneInCorso() && performance.now() - finoA < 4000) await respira(50);
    await respira(300);
    mm2Vista('matchmaking');
    await respira(500);

    // ── 1. il rank e il mazzo fermi ─────────────────────────────────────────
    var anima = function(s){ return q(s).getAnimations().filter(function(a){ return a.playState !== 'finished'; }).length; };
    mm2Vista('ai');
    dice(anima('#mm2-testata') === 0 && anima('#mm2-modo-draft') > 0 && anima('#mm2-modo-normal') > 0 && anima('#mm2-gioca') > 0, 'cambiando vista il rank e il mazzo non si animano, il resto si', [anima('#mm2-testata'), anima('#mm2-modo-draft'), anima('#mm2-modo-normal'), anima('#mm2-gioca')].join(' '));
    await respira(TRANSIZIONE_MS + 60);
    dice(anima('#mm2-testata') === 0 && getComputedStyle(q('#mm2-testata')).opacity === '1' && !q('#mm2-testata').classList.contains('pezzo-attende'), 'e a meta- restano visibili');
    await respira(700);
    mm2Vista('matchmaking');
    await respira(900);

    // ── 2. il conto alla rovescia ───────────────────────────────────────────
    dice(questTempoAlCambio(Date.UTC(2026, 8, 15, 16, 28, 0)) === '7h 32m left', '16:28 GMT: 7h 32m left', questTempoAlCambio(Date.UTC(2026, 8, 15, 16, 28, 0)));
    dice(questTempoAlCambio(Date.UTC(2026, 8, 15, 23, 27, 55)) === '32m 05s left', 'sotto l-ora i secondi: 32m 05s left', questTempoAlCambio(Date.UTC(2026, 8, 15, 23, 27, 55)));
    dice(questTempoAlCambio(Date.UTC(2026, 8, 15, 0, 0, 0)) === '24h 0m left' && questTempoAlCambio(Date.UTC(2026, 8, 15, 23, 59, 59, 500)) === '0m 00s left', 'a mezzanotte in punto 24h 0m left, all-ultimo mezzo secondo 0m 00s left', questTempoAlCambio(Date.UTC(2026, 8, 15, 0, 0, 0)));
    var conta = q('#mm2-quest-conta');
    mm2DisegnaQuest([{ id:'flip20', nome:'Flip 20 cards', quanto:20, premio:'ink', fatto:3, presa:true }]);
    dice(conta && !/\\//.test(conta.textContent) && conta.textContent === questTempoAlCambio(), 'il pannello dice quanto manca, non piu- prese/5', conta && conta.textContent);
    conta.textContent = 'x';
    await respira(1150);
    dice(/^\\d+h \\d+m left$|^\\d+m \\d{2}s left$/.test(conta.textContent), 'e si riscrive ogni secondo, con left', conta.textContent);
    var testata = q('#mm2-quest-testata');
    dice(testata && testata.scrollWidth <= testata.clientWidth + 1 && conta.getBoundingClientRect().right <= testata.getBoundingClientRect().right + 1, 'e la scritta piu- lunga ci sta nella testata del pannello', testata && (testata.scrollWidth + ' su ' + testata.clientWidth));
    var chiesteVero = questChiediAlServer, chieste = 0;
    questChiediAlServer = function(){ chieste++; };
    _questGiornoVisto = Math.floor(Date.now() / 86400000) - 1;
    await respira(1150);
    dice(chieste === 1 && _questGiornoVisto === Math.floor(Date.now() / 86400000), 'passata la mezzanotte si chiedono le quest nuove, una volta', chieste);
    await respira(1100);
    dice(chieste === 1, 'e non a ogni secondo dopo');
    questChiediAlServer = chiesteVero;

    // ── 3. gli avvisi piu' grandi ───────────────────────────────────────────
    var sfxVero = playSfxFile;
    playSfxFile = function(){};
    var nelPannello = q('#mm2-quest-corpo .quest-scheda');
    var rp = nelPannello && nelPannello.getBoundingClientRect();
    var scala = (typeof _fit === 'object' && _fit.scale) || 1;
    questPopup({ id:'flip20', nome:'Flip 20 cards', quanto:20, premio:'ink', fatto:4, presa:false }, false);
    var avviso = q('#quest-avvisi .quest-scheda');
    var ra = avviso.getBoundingClientRect();
    var nomeA = avviso.querySelector('.quest-nome').getBoundingClientRect(), barraA = avviso.querySelector('.quest-barra').getBoundingClientRect();
    dice(getComputedStyle(avviso).zoom === '1.3', 'l-avviso ha zoom 1.3', getComputedStyle(avviso).zoom);
    // la misura senza zoom, per il rapporto: 1.3 esatto, qualunque sia la larghezza a cui arriva la scheda
    avviso.style.zoom = '1';
    var r1 = avviso.getBoundingClientRect(), barra1 = avviso.querySelector('.quest-barra').getBoundingClientRect();
    avviso.style.zoom = '';
    dice(Math.abs(ra.width / r1.width - 1.3) < 0.01 && Math.abs(ra.height / r1.height - 1.3) < 0.01, 'il 30% piu- grande, in larghezza e in altezza', (ra.width / r1.width).toFixed(3) + ' x ' + (ra.height / r1.height).toFixed(3));
    dice(Math.abs(barraA.height / barra1.height - 1.3) < 0.05, 'e anche quel che ha dentro (la barra)', barraA.height.toFixed(1) + ' / ' + barra1.height.toFixed(1));
    var box = q('#quest-avvisi').getBoundingClientRect();
    dice(ra.left >= box.left - 1 && ra.right <= box.right + 1, 'e ci sta nel suo contenitore, allargato con lei', [ra.left, ra.right, box.left, box.right].map(function(n){ return n.toFixed(0); }).join(' '));
    playSfxFile = sfxVero;

    // ── 3b. il saldo aspetta l'icona ────────────────────────────────────────
    var rpcV = nakamaRpc, sessV = sessioneAccount, arrivaVero = questVoloArriva;
    MENU_GIOCATORE.magicInk = 100; aggiornaValuteAVideo();
    mm2DisegnaQuest([{ id:'flip20', nome:'Flip 20 cards', quanto:20, premio:'ink', fatto:20, presa:false }]);
    nakamaRpc = function(){ return Promise.resolve({ presi:[{ id:'flip20', premio:'ink', quanto:25 }],
      quest:[{ id:'flip20', nome:'Flip 20 cards', quanto:20, premio:'ink', fatto:20, presa:true }], valute:{ magicInk:125, fairyDust:100 }, bustineExtra:0 }); };
    sessioneAccount = { token:'prova' };
    var arrivi = [];
    questVoloArriva = function(v){ arrivi.push(q('#mm2-ink-value').textContent); return arrivaVero(v); };
    var t0 = performance.now(), campioni = [];
    var guarda = setInterval(function(){ campioni.push({ t: Math.round(performance.now() - t0), ink: q('#mm2-ink-value').textContent, arrivi: arrivi.length }); }, 20);
    await mm2RiscuotiQuest(null, null);
    await respira(2600);
    clearInterval(guarda);
    var primo = campioni.filter(function(c){ return c.ink !== '100'; })[0];
    dice(arrivi.length === 1 && arrivi[0] === '100', 'quando l-icona arriva a video c-e- ancora il saldo di prima', arrivi.join(' '));
    dice(primo && primo.arrivi === 1 && q('#mm2-ink-value').textContent === '125', 'e il saldo nuovo compare solo dopo l-arrivo', JSON.stringify(primo));
    questVoloArriva = arrivaVero; nakamaRpc = rpcV; sessioneAccount = sessV;

    // ── 4. i punti di fine partita ──────────────────────────────────────────
    showPage('game'); startGame(true);
    await respira(15000);
    var mandati = [], mmVero = mmManda;
    mmManda = function(m){ mandati.push(m); };
    PARTITA_RETE = { matchId:'prova', io:2, numeroTurno:9, turno:1, scadenza: Date.now() + 30000 };
    var cella = Object.keys(G.board)[0];
    if(!cella){
      var carta = (G.p1Hand && G.p1Hand[0]) || (G.p1Deck && G.p1Deck[0]);
      G.board['0,0'] = { card: carta, owner: 1 };
      cella = '0,0';
    }
    reteMandaImpronta(false);
    var corpo = mandati[0] && JSON.parse(atob(mandati[0].match_data_send.data));
    var v = G.board[cella].card.values;
    var atteso = cella + ':' + SIDES.map(function(s){ return v[s] | 0; }).join('.');
    dice(corpo && typeof corpo.valori === 'string' && corpo.valori.split('|').indexOf(atteso) >= 0, 'il racconto porta i valori delle carte in tavola', corpo && corpo.valori.slice(0, 80));
    mmManda = mmVero;
    G.ioSonoIlNumero = 2;
    G.puntiFatti = { 1: 118, 2: 199 };
    G.gameOver = true;
    q('#gameover-title-text').textContent = _goNomeDi(2) + ' wins!';
    goRiempiPunteggi(118, 199);
    var avvisi = [], warnVero = console.warn;
    console.warn = function(m){ avvisi.push(String(m)); };
    reteMessaggio({ op_code:6, data: btoa(JSON.stringify({ motivo:'finita', vincitore:2, pari:false, punti:{ 1:118, 2:203 }, yeti:[] })) });
    console.warn = warnVero;
    dice(q('#go-punti-mio').textContent === '203' && q('#go-punti-suo').textContent === '118', 'la schermata mostra i punti del server (203, non 199)', q('#go-punti-mio').textContent + ' / ' + q('#go-punti-suo').textContent);
    dice(G.puntiFatti[1] === 118 && G.puntiFatti[2] === 203 && q('#gameover-title-text').textContent === _goNomeDi(2) + ' wins!', 'e il vincitore del server');
    dice(avvisi.some(function(a){ return /punti di questo schermo 118-199, del server 118-203/.test(a); }), 'la console dice che i conti erano diversi');
    PARTITA_RETE = { matchId:'prova', io:2, numeroTurno:9, turno:1, scadenza: Date.now() + 30000 };
    G.puntiFatti = { 1: 150, 2: 140 };
    reteMessaggio({ op_code:6, data: btoa(JSON.stringify({ motivo:'finita', vincitore:1, pari:false, punti:{ 1:140, 2:150 }, yeti:[] })) });
    dice(q('#gameover-title-text').textContent === _goNomeDi(1) + ' wins!' && q('#go-punti-mio').textContent === '150', 'se il server rovescia il risultato, cambia anche il titolo');
    PARTITA_RETE = { matchId:'prova', io:2, numeroTurno:9, turno:1, scadenza: Date.now() + 30000 };
    G.gameOver = false;
    G.puntiFatti = { 1: 1, 2: 2 };
    q('#gameover-title-text').textContent = 'prima';
    reteMessaggio({ op_code:6, data: btoa(JSON.stringify({ motivo:'finita', vincitore:0, pari:true, punti:{ 1:30, 2:30 }, yeti:[] })) });
    dice(G.puntiFatti[1] === 30 && q('#gameover-title-text').textContent === 'prima', 'prima della schermata si tengono i punti (la scrivera- con quelli), e non si tocca niente');

    // ── 7. la X dello scarto ───────────────────────────────────────────────
    PARTITA_RETE = null;
    try{ fermaIlConto(); }catch(_){}
    G.gameOver = false; G.currentPlayer = 1; G.vsAI = true; G.ioSonoIlNumero = 1; G.dragging = null;
    var manoS = (G.p1Hand && G.p1Hand.length >= 2) ? G.p1Hand : (G.p1Deck || []).slice(0, 3);
    G.p1Hand = manoS;
    var scelti = [], scegliV = scegliBersaglio;
    scegliBersaglio = function(id){ scelti.push(id); };
    G.sceltaBersaglio = { chiave:'prova_scarto', modo:'mano', giocatore:1, bersagli: manoS.map(function(c){ return c.id; }), applica: function(){} };
    _firmaManoPrecedente['p1-hand-fan'] = null;
    renderHand('p1-hand-fan', G.p1Hand, 0);
    var croci = Array.from(document.querySelectorAll('#p1-hand-fan .scarta-croce'));
    dice(croci.length === manoS.length, 'una X per carta da scartare', croci.length + ' su ' + manoS.length);
    var c0 = croci[0], w0 = c0 && c0.closest('.hand-card-wrap'), z0 = c0 && c0.parentElement;
    dice(!!z0 && z0.classList.contains('hand-card-hitzone'), 'la X sta dentro alla zona sensibile (passarci sopra non fa uscire dalla carta)', z0 && z0.className);
    dice(c0 && c0.offsetLeft <= 20 && c0.offsetTop <= 20 && getComputedStyle(c0).left === '14px' && getComputedStyle(c0).top === '14px', 'in alto a sinistra', c0 && (c0.offsetLeft + ',' + c0.offsetTop));
    z0.dispatchEvent(new MouseEvent('mouseenter'));
    dice(w0.classList.contains('hover-lift') && w0.style.zIndex === '100', 'con la X a schermo l-hover alza la carta e la porta davanti', w0.className + ' z ' + w0.style.zIndex);
    z0.dispatchEvent(new MouseEvent('mouseleave'));
    dice(!w0.classList.contains('hover-lift') && w0.style.zIndex !== '100', 'e uscendo torna giu- e al suo posto', w0.style.zIndex);
    c0.dispatchEvent(new MouseEvent('pointerdown', { bubbles:true, cancelable:true }));
    dice(scelti.length === 1 && scelti[0] === w0.dataset.carta, 'premuta la X, si scarta quella carta', JSON.stringify(scelti));
    scegliBersaglio = scegliV; G.sceltaBersaglio = null;
    _firmaManoPrecedente['p1-hand-fan'] = null; renderHand('p1-hand-fan', G.p1Hand, 0);
    dice(!document.querySelector('#p1-hand-fan .scarta-croce'), 'finito lo scarto le X se ne vanno');

    // ── 6. chi resta senza carte perde ─────────────────────────────────────
    PARTITA_RETE = null;
    var qualsiasi = (G.p1Deck && G.p1Deck[0]) || (G.p2Deck && G.p2Deck[0]) || { id:'x' };
    G.p1Hand = []; G.p2Hand = [qualsiasi];
    dice(chiRestaSenzaCarte(3, 19, false) === 1, 'mano 1 vuota col tabellone che ha posto: il giocatore 1 e- senza carte');
    dice(chiRestaSenzaCarte(19, 19, false) === 0 && chiRestaSenzaCarte(3, 19, true) === 0, 'tabellone pieno (o chiuso dallo Yeti): decidono i punti');
    G.p2Hand = [];
    dice(chiRestaSenzaCarte(3, 19, false) === 0, 'tutti e due senza carte: decidono i punti');
    G.p1Hand = [qualsiasi];
    dice(chiRestaSenzaCarte(3, 19, false) === 2, 'mano 2 vuota: il giocatore 2');
    dice(/segnaSenzaCarte\\(placed, playable, bloccatoDalloYeti\\)/.test(endTurn.toString()), 'endTurn lo chiede prima di chiudere la partita');
    var riferiti = [], riferisciV = riferisciPartita, suoniF = [], sfxF = playSfxFile;
    riferisciPartita = function(v, p, ia){ riferiti.push([v, p, ia]); };
    playSfxFile = function(f){ suoniF.push(f); };
    G.gameOver = true; G.ioSonoIlNumero = 1; G.vsAI = true; G.vincitoreDichiarato = 0;
    G.puntiFatti = { 1: 50, 2: 10 };
    G.p1Hand = []; G.p2Hand = [qualsiasi];
    var chi = segnaSenzaCarte(3, 19, false);
    finishGameWithResult();
    await respira(900);
    dice(chi === 1 && q('#gameover-title-text').textContent === _goNomeDi(2) + ' wins!', 'con 50 punti contro 10, chi e- rimasto senza carte perde', q('#gameover-title-text').textContent);
    dice(q('#gameover-motivo').textContent === _goNomeDi(1) + ' ran out of cards.', 'e la schermata dice perche-', q('#gameover-motivo').textContent);
    dice(riferiti.length === 1 && riferiti[0][0] === false && riferiti[0][1] === false, 'al server contro il bot va una sconfitta, non una vittoria ai punti', JSON.stringify(riferiti));
    dice(suoniF.indexOf('end-game-loss.mp3') >= 0 && suoniF.indexOf('end-game-win.mp3') < 0, 'con la musica della sconfitta', suoniF.join(','));
    riferisciPartita = riferisciV; playSfxFile = sfxF;
    document.getElementById('gameover').classList.remove('show');
    PARTITA_RETE = { matchId:'prova', io:1, numeroTurno:9, turno:1, scadenza: Date.now() + 30000 };
    G.gameOver = true; G.puntiFatti = { 1: 80, 2: 20 };
    q('#gameover-motivo').textContent = '';
    reteMessaggio({ op_code:6, data: btoa(JSON.stringify({ motivo:'finita', vincitore:2, pari:false, punti:{ 1:80, 2:20 }, senzaCarte:1, yeti:[] })) });
    dice(q('#gameover-title-text').textContent === _goNomeDi(2) + ' wins!' && q('#gameover-motivo').textContent === _goNomeDi(1) + ' ran out of cards.', 'in rete la schermata segue il server: vince il 2, col motivo', q('#gameover-title-text').textContent + ' / ' + q('#gameover-motivo').textContent);
    PARTITA_RETE = { matchId:'prova', io:1, numeroTurno:9, turno:1, scadenza: Date.now() + 30000 };
    G.gameOver = false; G.vincitoreDichiarato = 0; _motivoFinePartita = '';
    reteMessaggio({ op_code:6, data: btoa(JSON.stringify({ motivo:'finita', vincitore:2, pari:false, punti:{ 1:80, 2:20 }, senzaCarte:1, yeti:[] })) });
    dice(G.vincitoreDichiarato === 2 && _motivoFinePartita === _goNomeDi(1) + ' ran out of cards.', 'e se la schermata non c-e- ancora, la scrivera- col vincitore e il motivo del server');
    G.vincitoreDichiarato = 0; _motivoFinePartita = '';

    // ── 5. il caso uguale sui due schermi ──────────────────────────────────
    PARTITA_RETE = { matchId:'partita-di-prova', io:1, numeroTurno:7, turno:1, scadenza: Date.now() + 30000 };
    G.numeroTurno = 7;
    var a1 = casoCondiviso('exaketededly|0,0|final-the-caterpillar'), a2 = casoCondiviso('exaketededly|0,0|final-the-caterpillar');
    var b1 = casoCondiviso('exaketededly|1,0|final-the-caterpillar');
    dice(a1 === a2 && a1 >= 0 && a1 < 1 && b1 !== a1, 'in rete: stessa etichetta stesso numero, etichetta diversa numero diverso', a1 + ' / ' + b1);
    G.numeroTurno = 8;
    dice(casoCondiviso('exaketededly|0,0|final-the-caterpillar') !== a1, 'e al turno dopo un altro caso');
    var conta = {}, n;
    for(n = 0; n < 600; n++){ var x = Math.floor(casoCondiviso('prova|' + n) * 5); conta[x] = (conta[x] || 0) + 1; }
    dice(Object.keys(conta).length === 5 && Object.keys(conta).every(function(k){ return conta[k] > 80 && conta[k] < 160; }), 'e i numeri si spargono (600 tiri su 5 esiti)', JSON.stringify(conta));
    var tutte = ['nascondiNelFumo', 'attivaSmokeAndMirrors', 'attivaScaredyCat', 'attivaHungerBites', 'impazzisciSeConquistato', 'spostaUnaCartaCheshire', 'giraScudoTrueStory'];
    var conRandom = tutte.filter(function(f){ return typeof window[f] !== 'function' || /Math\\.random/.test(window[f].toString()) || !/casoCondiviso/.test(window[f].toString()); });
    dice(conRandom.length === 0, 'le sette abilita- a caso tirano con casoCondiviso, non con Math.random', conRandom.join(', '));
    // due schermi: la stessa carta del Brucaliffo, lo stesso fumo
    var modello = FINAL_CARDS.find(function(e){ return e && e.values && !Array.isArray(e.values); });
    var copia = function(){ var c = _makeCardDbCard(modello, 1); c.id = 'schermo-' + Math.random(); c.baseId = 'final-the-caterpillar';
      c.values = { NE:1, E:2, SE:3, SW:4, W:5, NW:6 }; c.fumoDaAvviare = true; return c; };
    var sfxV = playSfxFile; playSfxFile = function(){};
    var mio = copia(), suo = copia();
    G.numeroTurno = 9;
    nascondiNelFumo(mio, 2, -1); nascondiNelFumo(suo, 2, -1);
    playSfxFile = sfxV;
    dice(mio.fumoPassi === suo.fumoPassi && JSON.stringify(mio.values) === JSON.stringify(suo.values), 'il Brucaliffo sui due schermi ruota degli stessi passi', mio.fumoPassi + ' / ' + suo.fumoPassi);
    PARTITA_RETE = null;
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
