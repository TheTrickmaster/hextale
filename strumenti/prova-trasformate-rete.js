// UNA CARTA TRASFORMATA IN MANO SI GIOCA ANCHE IN RETE — SUI DUE SCHERMI.
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-trasformate-rete.js
//
// Segnalazione di Lorenzo (11 settembre 2026): online uno Strigoi diventato
// Dark Strigoi IN MANO non si poteva giocare. Il client lo chiedeva al server
// col nome nuovo, il server lo conosce col nome con cui l'ha distribuito e
// rispondeva "quella carta non e' nella tua mano"; allo scadere del tempo lo
// giocava lui d'ufficio col nome vecchio, questo client non lo ritrovava e
// calava mano[0] — un'altra carta — e la partita si fermava. Nei registri del
// server: "racconti diversi al turno 12 ... final-strigoi contro
// final-dark-strigoi".
//
// Si prova qui, con due carte di catalogo scritte a mano (lo Strigoi e la sua
// forma scura, con la stessa riga del foglio):
//   1. chi la tiene: la trasformazione in mano ricorda il nome del mazzo;
//   2. la giocata parte col nome del mazzo e con la forma;
//   3. quando torna dal server si ritrova QUELLA carta, non mano[0] — anche
//      nella giocata d'ufficio, che la forma non la porta;
//   4. chi guarda la ricostruisce trasformata, coi valori arrivati, uguale a
//      quella di chi l'ha giocata;
//   5. senza forma (giocata d'ufficio) chi guarda la ricava dal turno: dall'8
//      in poi e' scura, prima no;
//   6. una forma che non e' una trasformazione della carta non la cambia.
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
    initGame(false);
    await respira(300);
    try{ clearInterval(timerInterval); }catch(_){}
    G.gameOver = true;

    // ── le due carte ────────────────────────────────────────────────────
    var modello = FINAL_CARDS.find(function(e){ return e && e.values && !Array.isArray(e.values); });
    var copia = function(extra){ return Object.assign(JSON.parse(JSON.stringify(modello)), extra); };
    var STRIGOI = copia({ id:'final-prova-strigoi', slug:'prova-strigoi', numero:9060, name:'Prova Strigoi',
      values:{ NW:2, NE:2, E:2, SE:2, SW:2, W:2 }, valuesBase:{ NW:2, NE:2, E:2, SE:2, SW:2, W:2 },
      groupSides:[['NE','E','SE'],['SW','W','NW']], cardAbility:'prova_notte', abilityUnlockLevel:1, abilityLocked:false,
      abilita:{ unica:false, trigger:'always', frequenza:'once_per_game', finestra:{ tipo:'from_turn', valore:8 },
        se:null, regola:null, legame:null, se2:null, regola2:null, effetto2:null,
        effetto:{ azione:'transform', scelta:false, chi:'self', cosa:'card', quanto:{ carta:'#9174' }, durata:'permanent' } } });
    var SCURO = copia({ id:'final-prova-dark-strigoi', slug:'prova-dark-strigoi', numero:9174, name:'Prova Dark Strigoi',
      values:{ NW:5, NE:5, E:5, SE:5, SW:5, W:5 }, valuesBase:{ NW:5, NE:5, E:5, SE:5, SW:5, W:5 },
      groupSides:[['NE','E','SE'],['SW','W','NW']], cardAbility:'', abilita:null, dropRate:0 });
    FINAL_CARDS.push(STRIGOI, SCURO);
    _sinergieDaFoglioNoto = null;
    dice(sinergieDalFoglio(), 'le sinergie vengono dal foglio (serve al momento "always")');

    var mandati = [];
    window.mmManda = function(m){ var md = m.match_data_send; if(md && md.op_code === 2) mandati.push(JSON.parse(atob(md.data))); };
    var ricevuta = null;
    var veroPlace = doPlace;
    window.doPlace = function(carta){ ricevuta = carta; };
    window.reteRaccontaQuandoFermo = function(){};
    var rete = function(io){ PARTITA_RETE = { matchId:'prova', io:io, mano:[], mazzo:[], buchi:[], turno:1, scadenza:0, numeroTurno:8, pubblico:{} }; };

    // ── 1. CHI LA TIENE ─────────────────────────────────────────────────
    rete(1);
    G.board = {};
    var volpe = _cartaDaIdRete(modello.id, 1, 0);
    var mia = _cartaDaIdRete(STRIGOI.id, 1, 1);
    G.p1Hand = [volpe, mia]; G.p2Hand = []; G.p1Deck = []; G.p2Deck = [];
    G.numeroTurno = 7;
    motoreMomentoSempre();
    dice(mia.baseId === STRIGOI.id, 'al turno 7 in mano resta uno Strigoi', mia.baseId);
    G.numeroTurno = 8;
    motoreMomentoSempre();
    dice(mia.baseId === SCURO.id && mia.name === SCURO.name, 'all-8 in mano diventa scuro', mia.baseId);
    dice(mia.idDelMazzo === STRIGOI.id, 'e ricorda con che nome sta nel mazzo', mia.idDelMazzo);
    dice(_idDelMazzo(volpe) === modello.id, 'una carta mai trasformata si chiama come sempre', _idDelMazzo(volpe));

    // ── 2. LA GIOCATA PARTE COI DUE NOMI ────────────────────────────────
    reteGioca(mia, 0, 0);
    var m = mandati[mandati.length - 1] || {};
    dice(m.carta === STRIGOI.id, 'si chiede al server col nome del mazzo', m.carta);
    dice(m.forma === SCURO.id, 'e si dice in che forma scende', m.forma);
    var valoriMandati = m.valori;

    // ── 3. AL RITORNO SI RITROVA QUELLA CARTA ───────────────────────────
    ricevuta = null;
    reteApplicaGiocata({ giocatore:1, carta:STRIGOI.id, forma:SCURO.id, q:0, r:0, turno:2, scadenza:0, numeroTurno:9, valori:valoriMandati });
    dice(ricevuta === mia, 'tornata dal server, si cala proprio lei e non mano[0]', ricevuta && ricevuta.name);
    ricevuta = null;
    reteApplicaGiocata({ giocatore:1, carta:STRIGOI.id, q:0, r:0, turno:2, scadenza:0, numeroTurno:9, dOfficio:true });
    dice(ricevuta === mia, 'anche giocata d-ufficio (senza forma)', ricevuta && ricevuta.name);

    // ── 4. CHI GUARDA ───────────────────────────────────────────────────
    rete(2);
    G.numeroTurno = 8;
    G.p1Hand = [_cartaSconosciuta(1, 0), _cartaSconosciuta(1, 1)];
    ricevuta = null;
    reteApplicaGiocata({ giocatore:1, carta:STRIGOI.id, forma:SCURO.id, q:0, r:0, turno:2, scadenza:0, numeroTurno:9, valori:valoriMandati });
    var sua = ricevuta;
    dice(!!sua && sua.baseId === SCURO.id && sua.name === SCURO.name, 'chi guarda la vede scendere scura', sua && sua.baseId);
    var uguali = function(a, b){ return JSON.stringify(a) === JSON.stringify(b); };
    dice(!!sua && uguali(sua.values, mia.values) && uguali(sua.valoriBase, mia.valoriBase),
      'con gli stessi numeri di chi l-ha giocata', sua && (JSON.stringify(sua.values) + ' / ' + JSON.stringify(mia.values)));
    dice(!!sua && sua.cardAbility === mia.cardAbility && !!sua.abilita === !!mia.abilita && sua.level === mia.level
      && uguali(sua.traits, mia.traits) && uguali(sua.groupSides, mia.groupSides),
      'e la stessa carta per abilita-, livello, tratti e gruppi',
      sua && (sua.cardAbility + '|' + !!sua.abilita + '|' + sua.level + ' contro ' + mia.cardAbility + '|' + !!mia.abilita + '|' + mia.level));
    dice(!!sua && sua.idDelMazzo === STRIGOI.id, 'e anche lei ricorda il nome del mazzo', sua && sua.idDelMazzo);

    // ── 5. SENZA FORMA, DAL TURNO ───────────────────────────────────────
    G.p1Hand = [_cartaSconosciuta(1, 0)];
    ricevuta = null;
    reteApplicaGiocata({ giocatore:1, carta:STRIGOI.id, q:0, r:0, turno:2, scadenza:0, numeroTurno:9, dOfficio:true });
    dice(!!ricevuta && ricevuta.baseId === SCURO.id, 'giocata d-ufficio al turno 8: chi guarda la ricava scura', ricevuta && ricevuta.baseId);
    G.numeroTurno = 5;
    G.p1Hand = [_cartaSconosciuta(1, 0)];
    ricevuta = null;
    reteApplicaGiocata({ giocatore:1, carta:STRIGOI.id, q:0, r:0, turno:2, scadenza:0, numeroTurno:6, dOfficio:true });
    dice(!!ricevuta && ricevuta.baseId === STRIGOI.id, 'giocata d-ufficio al turno 5: resta uno Strigoi', ricevuta && ricevuta.baseId);
    // E la forma, quando c-e-, vince sul turno: e- chi l-ha giocata a saperlo.
    G.numeroTurno = 8;
    G.p1Hand = [_cartaSconosciuta(1, 0)];
    ricevuta = null;
    reteApplicaGiocata({ giocatore:1, carta:STRIGOI.id, forma:STRIGOI.id, q:0, r:0, turno:2, scadenza:0, numeroTurno:9 });
    dice(!!ricevuta && ricevuta.baseId === STRIGOI.id, 'forma uguale al nome: resta uno Strigoi anche al turno 8', ricevuta && ricevuta.baseId);

    // ── 6. UNA FORMA CHE NON C-ENTRA ────────────────────────────────────
    G.p1Hand = [_cartaSconosciuta(1, 0)];
    ricevuta = null;
    reteApplicaGiocata({ giocatore:1, carta:STRIGOI.id, forma:modello.id, q:0, r:0, turno:2, scadenza:0, numeroTurno:9 });
    dice(!!ricevuta && ricevuta.baseId === STRIGOI.id, 'una forma che non e- una sua trasformazione non la cambia', ricevuta && ricevuta.baseId);

    window.doPlace = veroPlace;
    PARTITA_RETE = null;
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
