// SEGNALAZIONI E TELEMETRIA (v0.80.25), DAL LATO DEL GIOCO.
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-v08025.js
//
//   1. Da Matchmaking a Play vs Bot (Lorenzo): il riquadro del rank e del mazzo
//      sfuma fuori e dentro; il riquadro di sinistra esce a sinistra sfumando e
//      rientra verso destra, quello di destra al contrario; il pulsante sfuma.
//      Titoli e immagine cambiano a pezzi invisibili; un secondo cambio a meta'
//      vale l'ultimo; sulla stessa vista niente.
//   2. Tre righe nel riquadro Normal: "N players online" a 370, "N players in
//      matchmaking" a 400, "N players in a match" a 430; il battito dice `gioca`
//      e parte subito a inizio e fine partita.
//   3. La meta del trascinamento: parte con la scelta (op 10) e arriva a tutti e
//      due (op 11 `dest`). E il messaggio della partita fermata non da' la
//      colpa al server.
//   4. La telemetria: tempo per pagina, errori JS e di rete, e il registro di
//      una partita vera contro il bot (mazzi, pescate, giocate col tempo del
//      turno, conquiste, punti, vincitore) che parte con hx_telemetria.
const { app, BrowserWindow } = require('electron');
require('./dal-disco');   // v0.80.22 — gli asset di hextalegame.com dal disco, non dal sito
const fs = require('fs');
const path = require('path');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';
const FILE_CATALOGO = path.join(RADICE, 'server', 'importazione', '.lavoro', 'catalogo.json');
const sorgente = fs.readFileSync(path.join(RADICE, 'play', 'index.html'), 'utf8');
const statici = [
  (sorgente.indexOf('because of a server problem') < 0 && sorgente.indexOf("'The two boards went out of sync, so the match was stopped. '") >= 0 ? '  ok  ' : '  NO  ')
    + 'la partita fermata non da- la colpa al server'
];

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var chiamate = [], rpcVero = nakamaRpc, sessVera = sessioneAccount, risposta = { giocatori: 5, cercano: 2, inPartita: 1 };
  try {
    // ── 1. il cambio di vista ───────────────────────────────────────────────
    showPage('mainmenu');
    var finoA = performance.now();
    await respira(200);
    while(transizioneInCorso() && performance.now() - finoA < 4000) await respira(50);
    await respira(300);
    mm2Vista('matchmaking');
    await respira(500);
    // l'opacita' di partenza di ogni pezzo: Draft pick e' spento (0.3) e ci deve tornare
    var basi = {};
    ['#mm2-testata', '#mm2-modo-draft', '#mm2-modo-normal', '#mm2-gioca'].forEach(function(s){ basi[s] = getComputedStyle(q(s)).opacity; });
    var fermo = function(v){ return /^0px( 0px)?$/.test(String(v)); };
    var titolo = function(id){ return (q('#' + id + ' h2') || {}).textContent; };
    var ultimo = function(sel){
      var a = q(sel).getAnimations().filter(function(x){ return x.playState !== 'finished'; })[0];
      if(!a) return null;
      var k = a.effect.getKeyframes();
      return { da: k[0], a: k[k.length - 1] };
    };
    mm2Vista('ai');
    var t = ultimo('#mm2-testata'), dr = ultimo('#mm2-modo-draft'), nr = ultimo('#mm2-modo-normal'), gi = ultimo('#mm2-gioca');
    dice(titolo('mm2-modo-draft') === 'Draft pick' && titolo('mm2-modo-normal') === 'Normal', 'appena cliccato i titoli sono ancora quelli di prima (si cambia a pezzi invisibili)');
    dice(t && String(t.a.opacity) === '0' && fermo(t.a.translate), 'il rank e il mazzo sfumano fuori, fermi', t && JSON.stringify(t.a));
    dice(dr && String(dr.a.opacity) === '0' && /^-40px/.test(String(dr.a.translate)), 'il riquadro di sinistra esce verso sinistra sfumando', dr && JSON.stringify(dr.a));
    dice(nr && String(nr.a.opacity) === '0' && /^40px/.test(String(nr.a.translate)), 'quello di destra esce verso destra', nr && JSON.stringify(nr.a));
    dice(gi && String(gi.a.opacity) === '0', 'il pulsante sfuma');
    await respira(TRANSIZIONE_MS + 60);
    t = ultimo('#mm2-testata'); dr = ultimo('#mm2-modo-draft'); nr = ultimo('#mm2-modo-normal');
    dice(titolo('mm2-modo-draft') === 'Draft vs Bot' && titolo('mm2-modo-normal') === 'Normal vs Bot' && q('#mm2-centro').classList.contains('vista-bot'), 'a meta- cambiano titoli e immagine', titolo('mm2-modo-draft'));
    dice(dr && String(dr.da.opacity) === '0' && /^-40px/.test(String(dr.da.translate)) && fermo(dr.a.translate) && String(dr.a.opacity) === basi['#mm2-modo-draft'], 'quello di sinistra rientra verso destra', dr && JSON.stringify(dr));
    dice(nr && /^40px/.test(String(nr.da.translate)) && fermo(nr.a.translate) && String(nr.a.opacity) === basi['#mm2-modo-normal'], 'quello di destra rientra verso sinistra', nr && JSON.stringify(nr));
    dice(t && String(t.da.opacity) === '0' && String(t.a.opacity) === '1', 'il rank e il mazzo sfumano dentro');
    await respira(600);
    var PEZZI = ['#mm2-testata', '#mm2-modo-draft', '#mm2-modo-normal', '#mm2-gioca'];
    dice(PEZZI.every(function(s){ return getComputedStyle(q(s)).opacity === basi[s] && getComputedStyle(q(s)).translate === 'none' && !q(s).classList.contains('pezzo-attende'); }), 'finita, tutto e- al suo posto', PEZZI.map(function(s){ return getComputedStyle(q(s)).opacity + '/' + getComputedStyle(q(s)).translate; }).join(' '));
    mm2Vista('ai');
    dice(!ultimo('#mm2-modo-draft'), 'sulla stessa vista niente animazione');
    mm2Vista('matchmaking');
    await respira(60);
    mm2Vista('ai');
    await respira(900);
    dice(titolo('mm2-modo-normal') === 'Normal vs Bot' && PEZZI.every(function(s){ return getComputedStyle(q(s)).opacity === basi[s]; }), 'due cambi di fila: vale l-ultimo, e niente resta a meta-');
    mm2Vista('matchmaking');
    await respira(900);

    // ── 2. le tre righe ─────────────────────────────────────────────────────
    var top = function(s){ return getComputedStyle(q(s)).top; };
    dice(top('#mm2-online') === '370px' && top('#mm2-cercano') === '400px' && top('#mm2-in-partita') === '430px', 'online a 370, matchmaking a 400, in partita a 430', [top('#mm2-online'), top('#mm2-cercano'), top('#mm2-in-partita')].join(' '));
    var so = getComputedStyle(q('#mm2-online')), sp = getComputedStyle(q('#mm2-in-partita'));
    dice(so.fontFamily === sp.fontFamily && so.fontSize === sp.fontSize && so.color === sp.color, 'la nuova riga ha lo stesso aspetto');
    nakamaRpc = function(nome, c){ chiamate.push({ nome: nome, corpo: c }); return Promise.resolve(risposta); };
    sessioneAccount = { token: 'prova' };
    await aggiornaGiocatoriOnline();
    var ultimaHx = function(){ return chiamate.filter(function(c){ return c.nome === 'hx_giocatori'; }).slice(-1)[0]; };
    dice(q('#mm2-online').textContent === '5 players online' && q('#mm2-cercano').textContent === '2 players in matchmaking' && q('#mm2-in-partita').textContent === '1 player in a match', 'i tre numeri', [q('#mm2-online').textContent, q('#mm2-cercano').textContent, q('#mm2-in-partita').textContent].join(' / '));
    dice(ultimaHx().corpo.gioca === false, 'nel menu il battito dice che non si gioca');
    risposta = { giocatori: 5, cercano: 1, inPartita: 3 };
    await aggiornaGiocatoriOnline();
    dice(q('#mm2-cercano').textContent === '1 player in matchmaking' && q('#mm2-in-partita').textContent === '3 players in a match', 'singolare e plurale');
    mm2Vista('ai');
    await respira(700);
    dice(getComputedStyle(q('#mm2-in-partita')).display === 'none', 'contro il bot la riga non si vede');
    mm2Vista('matchmaking');
    await respira(700);

    // ── 4a. pagine, errori ──────────────────────────────────────────────────
    var tS = TELEMETRIA_STATO;
    var menuPrima = tS.pagine.mainmenu || 0;
    showPage('collection');
    await respira(300);
    dice((tS.pagine.mainmenu || 0) > menuPrima + 1000, 'uscendo dal menu il suo tempo si somma', menuPrima + ' -> ' + tS.pagine.mainmenu);
    dice(tS.paginaOra === 'collection' && tS.caricamentoMs > 0, 'la pagina di adesso e il tempo di caricamento sono noti', tS.caricamentoMs);
    var reteP = tS.erroriRete;
    erroreNakama('prova', 0); erroreNakama('prova', 500);
    dice(tS.erroriRete === reteP + 1, 'un errore di rete (codice 0) si conta, un errore del server no');
    var erroriP = tS.errori;
    window.dispatchEvent(new ErrorEvent('error', { message: 'boom di prova' }));
    dice(tS.errori === erroriP + 1 && tS.erroriTesti.indexOf('boom di prova') >= 0, 'un errore JS si conta, col suo testo');

    // ── 3. la meta del trascinamento ────────────────────────────────────────
    var mandati = [], mmVero = mmManda;
    mmManda = function(m){ mandati.push(m); };
    PARTITA_RETE = { matchId:'prova', io:1, numeroTurno:3, turno:1, scadenza: Date.now() + 30000 };
    G = G || {};
    G.sceltaBersaglio = { chiave:'open_celery', giocatore:1, privata:false, bersagli:['1,1'], destinazioneScelta:'2,0', applica: function(){} };
    chiudiSceltaBersaglio('1,1', false);
    var op10 = mandati.filter(function(m){ return m.match_data_send && m.match_data_send.op_code === 10; })[0];
    var corpo10 = op10 && JSON.parse(atob(op10.match_data_send.data));
    dice(corpo10 && corpo10.cella === '1,1' && corpo10.dest === '2,0', 'la scelta parte con la meta (op 10)', op10 && atob(op10.match_data_send.data));
    var chiudiVero = chiudiSceltaBersaglio, vista = null;
    chiudiSceltaBersaglio = function(cella, daServer){ vista = { cella: cella, daServer: daServer, dest: G.sceltaBersaglio && G.sceltaBersaglio.destinazioneScelta }; };
    G.sceltaBersaglio = { chiave:'open_celery', giocatore:2, bersagli:['1,1'] };
    reteMessaggio({ op_code:11, data: btoa(JSON.stringify({ cella:'1,1', di:2, dest:'-1,2' })) });
    dice(vista && vista.cella === '1,1' && vista.daServer === true && vista.dest === '-1,2', 'dall-altra parte la meta arriva prima di applicare la scelta', JSON.stringify(vista));
    G.sceltaBersaglio = { chiave:'open_celery', giocatore:2, bersagli:['1,1'] };
    vista = null;
    reteMessaggio({ op_code:11, data: btoa(JSON.stringify({ cella:'1,1', di:2, dest:null })) });
    dice(vista && vista.dest === undefined, 'senza meta (server di prima) resta com-era');
    chiudiSceltaBersaglio = chiudiVero;
    G.sceltaBersaglio = null;
    mmManda = mmVero; PARTITA_RETE = null;

    // ── 2b / 4b. una partita contro il bot ──────────────────────────────────
    chiamate.length = 0;
    tS.daMandare.length = 0;
    showPage('game'); startGame(true);
    await respira(16000);
    var p = tS.partita;
    dice(p && p.g === G && p.pvp === false && p.io === 1 && p.mazzi[1].length > 0 && p.mazzi[2].length > 0, 'a inizio partita il registro c-e-, coi due mazzi', p && (p.mazzi[1].length + '+' + p.mazzi[2].length));
    var pescate = p ? Object.keys(p.pescate[1]).length : 0;
    dice(pescate > 0, 'le pescate della mano iniziale si contano', pescate);
    dice(chiamate.some(function(c){ return c.nome === 'hx_giocatori' && c.corpo.gioca === true; }), 'cominciata la partita il battito dice gioca: true');
    var modello = FINAL_CARDS.find(function(e){ return e && e.values && !Array.isArray(e.values); });
    var tutti = function(v){ return {NE:v,E:v,SE:v,SW:v,W:v,NW:v}; };
    var finta = function(id, n, v){ return Object.assign(JSON.parse(JSON.stringify(modello)), { id:id, slug:id, numero:n, name:id, rarity:'common', cardAbility:'', abilita:null, traits:[], traitNames:[], values:tutti(v), valuesBase:tutti(v), groupSides:[['NE','E','SE','SW','W','NW']] }); };
    var UNO = finta('final-prova-uno', 9901, 1), NOVE = finta('final-prova-nove', 9902, 9);
    FINAL_CARDS.push(UNO, NOVE);
    var n = 0;
    var fai = function(v, o){ var c = _makeCardDbCard(v, o); c.id = v.id + '-' + o + '-t' + (n++); c.baseId = v.id; return c; };
    try{ fermaIlConto(); }catch(_){}
    try{ stopAiThinkingHover(); }catch(_){}
    G.board = {}; G.holes = new Set(); G.gameOver = false; G.currentPlayer = 1; G.turnPlayLocked = false; G.turnBannerActive = false; G.sceltaBersaglio = null;
    var E = DIRS.map(function(dd){ return key(dd.dq, dd.dr); })[0];
    G.board[E] = { card: fai(UNO, 2), owner: 2 };
    var nove = fai(NOVE, 1);
    G.p1Hand = [nove, fai(UNO, 1), fai(UNO, 1)];
    _firmaTabellonePrecedente = null; renderBoard(); render();
    teleInizioTurno();
    await respira(700);
    doPlace(nove, 0, 0, 0);
    await respira(3500);
    var mossa = p.mosse.filter(function(m){ return m[2] === 'final-prova-nove'; })[0];
    dice(mossa && mossa[1] === 1 && mossa[3] === '0,0' && mossa[4] >= 600 && mossa[4] < 5000, 'la giocata si segna con carta, casella e tempo del turno', JSON.stringify(mossa));
    var presa = p.conquiste.filter(function(c){ return c[1] === 'final-prova-nove' && c[2] === 'final-prova-uno'; })[0];
    dice(!!presa, 'la conquista si segna (chi ha preso chi)', JSON.stringify(p.conquiste));
    var finoP = performance.now();
    while(!p.punti.length && performance.now() - finoP < 8000) await respira(100);   // la fine del turno aspetta le animazioni
    dice(p.punti.length >= 1 && p.punti[p.punti.length - 1].length === 3, 'i punti a fine turno', JSON.stringify(p.punti));
    await respira(4000);
    chiamate.length = 0;
    try{ fermaIlConto(); }catch(_){}
    endGame();
    await respira(600);
    var registro = null;
    var tel = chiamate.filter(function(c){ return c.nome === 'hx_telemetria'; });
    tel.forEach(function(c){ if(c.corpo.partita) registro = c.corpo.partita; });
    dice(tS.partita === null && tS.partite >= 1, 'a fine partita il registro si chiude');
    dice(registro && registro.pvp === false && typeof registro.vincitore === 'number' && registro.durataMs > 10000 && registro.mosse.length >= 1 && registro.conquiste.length >= 1 && registro.mazzi[1].length > 0 && !('g' in registro), 'e parte con hx_telemetria (senza riferimenti alla partita)', registro && JSON.stringify({ v: registro.vincitore, d: registro.durataMs, m: registro.mosse.length }));
    var c0 = tel[tel.length - 1] && tel[tel.length - 1].corpo;
    dice(c0 && c0.sessione === SESSIONE_CLIENT && c0.piattaforma === 'electron' && c0.caricamentoMs > 0 && c0.pagine && c0.pagine.game > 0 && c0.erroriRete >= 1 && c0.errori >= 1, 'con la sessione: piattaforma, caricamento, pagine, errori', c0 && JSON.stringify({ p: c0.piattaforma, pag: c0.pagine }));
    dice(tS.daMandare.length === 0, 'mandato, la coda e- vuota');
    dice(chiamate.some(function(c){ return c.nome === 'hx_giocatori' && c.corpo.gioca === false; }), 'e il battito dice gioca: false');
    // un server che rifiuta: il registro si riprova e dopo tre volte si lascia
    nakamaRpc = function(){ return Promise.reject(erroreNakama('no', 500)); };
    tS.daMandare.push({ tentativi: 0 });
    await teleManda(); await teleManda(); await teleManda();
    dice(tS.daMandare.length === 0, 'un registro rifiutato tre volte si lascia andare (niente code infinite)');
  } catch(err){ dice(false, 'il banco e- arrivato in fondo', err.message + ' ' + String(err.stack || '').split('\\n').slice(1,3).join(' | ')); }
  nakamaRpc = rpcVero; sessioneAccount = sessVera;
  return d.join('\\n');
})()`;

app.whenReady().then(async () => {
  setTimeout(() => { console.log('  NO  il banco non ha finito in tempo'); app.exit(2); }, 150000);
  let carte = null;
  try { const c = JSON.parse(fs.readFileSync(FILE_CATALOGO, 'utf8')); carte = Array.isArray(c) ? c : (c.carte || null); } catch (e) { carte = null; }
  if (!carte) { console.log('  NO  catalogo non letto: ' + FILE_CATALOGO); app.exit(1); return; }
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, frame: false, useContentSize: true,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  win.webContents.on('console-message', (e, livello, msg) => { if (livello >= 3 && !/boom di prova/.test(msg)) console.log('[console] ' + msg); });
  await win.loadURL(PAGINA);
  win.setPosition(-3200, 0); win.showInactive();
  await new Promise(r => setTimeout(r, 14000));
  await win.webContents.insertCSS('#splash{display:none!important} #tutorial-overlay{display:none!important}');
  await win.webContents.executeJavaScript('_applicaCatalogo(' + JSON.stringify(carte) + '); "ok"');
  const esito = statici.join('\n') + '\n' + await win.webContents.executeJavaScript(CORPO);
  console.log(esito);
  const no = (esito.match(/^  NO  /gm) || []).length;
  const ok = (esito.match(/^  ok  /gm) || []).length;
  console.log('\n' + ok + ' ok, ' + no + ' NO');
  app.exit(no ? 1 : 0);
});
