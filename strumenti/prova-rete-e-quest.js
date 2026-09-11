// QUATTRO SEGNALAZIONI DI LORENZO (v0.80.1), VISTE DAL GIOCO.
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-rete-e-quest.js
//
//   1. "Right click to expand hand" deve restare sempre a sinistra: in rete
//      saltava da un giocatore all'altro col turno. Adesso in rete l'hint e'
//      solo della MIA mano, a qualunque turno.
//   2. Le daily quest non si aggiornavano (i popup si', il pannello no): il
//      pannello sta nel menu, che in partita e' staccato dalla pagina, e
//      mm2DisegnaQuest usciva prima di tenere l'elenco. Adesso l'elenco si tiene
//      sempre e il menu, all'ingresso, lo ridisegna e lo richiede al server.
//   3. Entrare in partita con se stessi: il biglietto porta l'id dell'account e
//      la domanda lo esclude; se un accoppiamento con se stessi arriva lo
//      stesso, si rimette in coda un biglietto e si continua a cercare.
//   4. Carabosse non colpisce i lati protetti: la scena del gioco dice al
//      motore quali lati sono sotto uno scudo (Pinocchio, la corona).
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

    // ── 2. le quest ─────────────────────────────────────────────────────
    var chiamate = [];
    var veroRpc = nakamaRpc;
    window.nakamaRpc = function(nome, dati){
      chiamate.push(nome + ' ' + JSON.stringify(dati || {}));
      if(nome === 'hx_quest') return Promise.resolve({ quest: [
        { id:'flip20', nome:'Flip 20 cards', quanto:20, premio:'ink', fatto:12, presa:false },
        { id:'win3pvp', nome:'Win 3 PvP matches', quanto:3, premio:'pack', fatto:3, presa:false } ] });
      return Promise.resolve({});
    };
    var veraSessione = sessioneAccount;
    sessioneAccount = { token: 'a.' + btoa(JSON.stringify({ uid:'f59b401d-073b-402f-b586-0837b0a8b907', exp: 9999999999 })) + '.b' };

    showPage('game');
    dice(!document.getElementById('mm2-quest-corpo'), 'in partita il pannello delle quest non e- nella pagina');
    mm2DisegnaQuest([{ id:'flip20', nome:'Flip 20 cards', quanto:20, premio:'ink', fatto:7, presa:false }]);
    dice(QUEST_OGGI.length === 1 && QUEST_OGGI[0].fatto === 7, 'ma l-elenco nuovo si tiene lo stesso', QUEST_OGGI[0] && QUEST_OGGI[0].fatto);
    chiamate.length = 0;
    showPage('mainmenu');
    var corpo = document.getElementById('mm2-quest-corpo');
    var conta = function(){ return Array.prototype.map.call((corpo || document).querySelectorAll('.quest-conta'), function(e){ return e.textContent; }).join(','); };
    dice(!!corpo && conta().indexOf('7/20') >= 0, 'tornati al menu il pannello mostra subito l-elenco tenuto', conta());
    dice(chiamate.some(function(c){ return c === 'hx_quest {}'; }), 'e chiede al server lo stato delle quest', chiamate.join(' | '));
    await respira(200);
    dice(conta() === '12/20,3/3', 'e disegna quello che il server risponde', conta());

    // ── 3. la ricerca ───────────────────────────────────────────────────
    dice(mmMioId() === 'f59b401d073b402fb5860837b0a8b907', 'l-id dell-account si legge dal token, senza trattini', mmMioId());
    var domanda = mmDomanda(3, { capacita: 18, livelloMedio: 1 }, 0);
    dice(domanda.indexOf('-properties.utente:f59b401d073b402fb5860837b0a8b907') >= 0, 'la domanda al matchmaker esclude se stessi', domanda);
    var mandati = [];
    var veroManda = mmManda;
    window.mmManda = function(m){ mandati.push(m); };
    mmConsegnaBiglietto(3, { capacita: 18, livelloMedio: 1 }, 'CODICE');
    var add = mandati[0] && mandati[0].matchmaker_add;
    dice(!!add && add.string_properties.utente === 'f59b401d073b402fb5860837b0a8b907', 'e il biglietto porta l-id', add && add.string_properties.utente);
    // Un accoppiamento con se stessi: niente avviso, e si torna in coda.
    mandati.length = 0;
    var avvisi = 0;
    var veroAvviso = apriAvviso;
    window.apriAvviso = function(){ avvisi++; };
    _mm2Cercando = true;
    var me = { presence: { user_id: 'f59b401d-073b-402f-b586-0837b0a8b907' } };
    mmTrovato({ self: me, users: [me, { presence: { user_id: 'f59b401d-073b-402f-b586-0837b0a8b907' } }] });
    await respira(1100);
    dice(avvisi === 0, 'accoppiati con se stessi: nessun avviso di errore', avvisi);
    dice(_mm2Cercando === true, 'e si continua a cercare');
    dice(mandati.some(function(m){ return m.matchmaker_add; }), 'con un biglietto nuovo in coda', mandati.length + ' messaggi');
    _mm2Cercando = false;
    window.mmManda = veroManda; window.apriAvviso = veroAvviso;

    // ── 1. l-hint della mano ────────────────────────────────────────────
    showPage('game');
    initGame(false);
    await respira(300);
    fermaIlConto();
    G.gameOver = false; handExpandState[1] = false; handExpandState[2] = false;
    var hint = function(p){ var el = document.getElementById('p' + p + '-hand-expand-hint'); return !!(el && el.classList.contains('show')); };
    PARTITA_RETE = { matchId:'prova', io:2, numeroTurno:3 };
    G.currentPlayer = 2; updateHandExpandHints();
    var mioTurno = [hint(1), hint(2)];
    G.currentPlayer = 1; updateHandExpandHints();
    var suoTurno = [hint(1), hint(2)];
    dice(!mioTurno[0] && mioTurno[1], 'in rete da numero due, al mio turno si accende solo il mio hint', JSON.stringify(mioTurno));
    dice(!suoTurno[0] && suoTurno[1], 'e al turno dell-avversario resta il mio, non il suo', JSON.stringify(suoTurno));
    dice(!isHandExpandEligible(1) && isHandExpandEligible(2), 'in rete la mano dell-avversario non si apre');
    // Da numero due il gioco scambia i lati (body.io-sono-2): il mio hint e- a sinistra.
    var aveva = document.body.classList.contains('io-sono-2');
    document.body.classList.add('io-sono-2');
    var box = document.getElementById('p2-hand-expand-hint').getBoundingClientRect();
    var larghezza = document.documentElement.clientWidth;
    dice(box.left < larghezza / 2, 'e il mio hint sta a sinistra', Math.round(box.left) + 'px su ' + larghezza);
    if(!aveva) document.body.classList.remove('io-sono-2');
    PARTITA_RETE = null;
    G.vsAI = true; G.currentPlayer = 2; updateHandExpandHints();
    dice(hint(1) && !hint(2), 'contro l-IA resta com-era: il mio hint, a ogni turno');

    // ── 4. Carabosse e gli scudi ───────────────────────────────────────
    var scena = _scenaTabellone();
    dice(typeof scena.latoProtetto === 'function', 'la scena del gioco dice quali lati sono protetti');
    var pinocchio = { id:'pino-2-x', name:'Pinocchio', owner:2, cardAbility:'true_story', abilityLocked:false,
      latiInvulnerabili:['NE','E','SE'], values:{NW:1,NE:1,E:1,SE:1,SW:1,W:1} };
    dice(scena.latoProtetto(pinocchio, 'E') === true && scena.latoProtetto(pinocchio, 'W') === false,
      'lo scudo di Pinocchio e- protetto, il lato scoperto no');

    sessioneAccount = veraSessione; window.nakamaRpc = veroRpc;
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
