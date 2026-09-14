// SEI SEGNALAZIONI DI LORENZO (v0.80.23), DAL LATO DEL GIOCO.
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-v08023.js
//
//   1. Tutto cio' che legge il giocatore e' in inglese: i vecchi testi italiani
//      non ci sono piu', e "Move refused" traduce anche il server di prima.
//   2. Il racconto del tabellone (op 7) porta le caselle bloccate come sono
//      adesso: e' da li' che il server sa di un tassello spostato.
//   3. Il pulsante della ricerca dice "Searching...(Ns)", e ci sta dentro.
//   4. Sotto ai giocatori online, con lo stesso aspetto, quanti cercano una
//      partita: il battito dice `cerca`, parte subito cominciando e finendo
//      la ricerca, e batte ogni dieci secondi mentre si cerca; contro il bot
//      non si vede.
//   5. Passando da Matchmaking a Play vs Bot (e ritorno) il blocco centrale
//      sfuma dentro come all'ingresso nel menu; restando sulla stessa vista, o
//      durante un cambio di pagina, no.
// (Gli avvisi delle quest in partita li guarda prova-quest-in-partita.js.)
const { app, BrowserWindow } = require('electron');
require('./dal-disco');   // v0.80.22 — gli asset di hextalegame.com dal disco, non dal sito
const fs = require('fs');
const path = require('path');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';

// 1a. i testi di prima non devono esserci piu' (controllo sul file)
const sorgente = fs.readFileSync(path.join(RADICE, 'play', 'index.html'), 'utf8');
const VECCHI = ["Non è il tuo turno", "Questa carta è congelata", "Non puoi vedere le carte avversarie",
  ">Il mazzo dell'avversario<", "Abilità della carta", "Un racconto ancora da scrivere", "toast('Serve un accesso",
  "Non si e- potuto", "Nessun codice.", "Codice incompleto", 'aria-label="Impostazioni"', "Non hai abbastanza magic ink",
  "erroreNakama('serve un accesso'", "non riesco a collegarmi alla ricerca", "Nessuna carta trovata"];
const statici = VECCHI.map(v => (sorgente.includes(v) ? '  NO  ' : '  ok  ') + 'niente piu- "' + v + '"');

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  try {
    // ── 1b. Move refused ───────────────────────────────────────────────────
    dice(rifiutoInInglese("quella casella e' bloccata") === 'That tile is blocked.', 'il rifiuto italiano di prima diventa inglese', rifiutoInInglese("quella casella e' bloccata"));
    dice(rifiutoInInglese("non e' il tuo turno") === "It's not your turn." && rifiutoInInglese("quella casella e' gia' occupata") === 'That tile is already taken.', 'anche turno e casella occupata');
    dice(rifiutoInInglese("quella carta non si trasforma in dark-strigoi") === 'That card does not transform into dark-strigoi', 'e porta con se- il nome della forma', rifiutoInInglese("quella carta non si trasforma in dark-strigoi"));
    dice(rifiutoInInglese('That tile is blocked.') === 'That tile is blocked.' && rifiutoInInglese('') === 'That move is not allowed.', 'l-inglese del server nuovo passa com-e-, il vuoto ha il suo testo');
    var avvisi = [], apriVero = apriAvviso;
    apriAvviso = function(t, m){ avvisi.push(t + ': ' + m); };
    var reteVera = PARTITA_RETE;
    PARTITA_RETE = { matchId:'prova', io:1, numeroTurno:3, turno:1, scadenza: Date.now() + 30000 };
    try{ reteMessaggio({ op_code:5, data: btoa(JSON.stringify({ perche: "quella casella e' bloccata" })) }); }catch(e){ avvisi.push('errore ' + e.message); }
    dice(avvisi[0] === 'Move refused: That tile is blocked.', 'e la finestra lo dice in inglese', avvisi[0]);
    apriAvviso = apriVero;

    // ── 2. op 7 con le caselle bloccate ─────────────────────────────────────
    var mandati = [], mmVero = mmManda;
    mmManda = function(m){ mandati.push(m); };
    G.holes = new Set(['1,1', '-2,1']); G.board = G.board || {}; G.hp = G.hp || { 1:0, 2:0 }; G.scores = G.scores || { 1:0, 2:0 };
    reteMandaImpronta(false);
    var corpo = mandati[0] && JSON.parse(atob(mandati[0].match_data_send.data));
    dice(corpo && mandati[0].match_data_send.op_code === 7 && Array.isArray(corpo.buchi) && corpo.buchi.join('|') === '-2,1|1,1', 'il racconto porta le caselle bloccate, in ordine', corpo && JSON.stringify(corpo.buchi));
    G.holes = new Set();
    mandati.length = 0; reteMandaImpronta(false);
    corpo = mandati[0] && JSON.parse(atob(mandati[0].match_data_send.data));
    dice(corpo && Array.isArray(corpo.buchi) && corpo.buchi.length === 0, 'e senza caselle bloccate un elenco vuoto (non niente)');
    mmManda = mmVero; PARTITA_RETE = reteVera;

    // ── 3/4. il menu ────────────────────────────────────────────────────────
    showPage('mainmenu');
    var finoA = performance.now();
    await respira(200);
    while(transizioneInCorso() && performance.now() - finoA < 4000) await respira(50);
    await respira(300);
    mm2Vista('matchmaking');
    await respira(600);
    var online = q('#mm2-online'), cercano = q('#mm2-cercano'), box = q('#mm2-modo-normal');
    dice(!!online && !!cercano && cercano.parentElement === online.parentElement, 'c-e- la riga di chi cerca, accanto a quella dei giocatori online');
    var so = getComputedStyle(online), sc = getComputedStyle(cercano);
    dice(so.fontFamily === sc.fontFamily && so.fontSize === sc.fontSize && so.color === sc.color && so.textAlign === sc.textAlign && so.lineHeight === sc.lineHeight, 'stesso font, stessa misura, stesso colore', sc.fontFamily + ' ' + sc.fontSize + ' ' + sc.color);
    var ro = online.getBoundingClientRect(), rc = cercano.getBoundingClientRect(), rb = box.getBoundingClientRect();
    dice(Math.abs(rc.top - ro.bottom) <= 3, 'subito sotto', 'online finisce a ' + (ro.bottom - rb.top).toFixed(1) + ', cercano comincia a ' + (rc.top - rb.top).toFixed(1));
    dice(rc.bottom <= rb.bottom - 4 && sc.display !== 'none', 'e dentro al riquadro Normal', 'fondo ' + (rc.bottom - rb.top).toFixed(1) + ' su ' + rb.height.toFixed(1));

    var chiamate = [], rpcVero = nakamaRpc, sessVera = sessioneAccount, risposta = { giocatori: 7, cercano: 3 };
    nakamaRpc = function(nome, c){ chiamate.push({ nome: nome, corpo: c }); return Promise.resolve(risposta); };
    sessioneAccount = { token: 'prova' };
    await aggiornaGiocatoriOnline();
    dice(chiamate[0] && chiamate[0].nome === 'hx_giocatori' && chiamate[0].corpo.cerca === false, 'il battito dice che non si sta cercando', chiamate[0] && JSON.stringify(chiamate[0].corpo));
    dice(online.textContent === '7 players online' && cercano.textContent === '3 players in matchmaking', 'e scrive tutti e due i numeri', online.textContent + ' / ' + cercano.textContent);
    risposta = { giocatori: 1, cercano: 1 };
    await aggiornaGiocatoriOnline();
    dice(cercano.textContent === '1 player in matchmaking', 'al singolare con uno', cercano.textContent);
    risposta = { giocatori: 2 };
    await aggiornaGiocatoriOnline();
    dice(cercano.textContent === '1 player in matchmaking' && online.textContent === '2 players online', 'un server di prima (senza cercano) lascia il numero che c-era');
    risposta = { giocatori: 4, cercano: 2 };

    var n0 = chiamate.length;
    _mm2Cercando = true;
    mmAvviaCronometro();
    await respira(60);
    var et = q('#mm2-find .hxb-label');
    dice(et.textContent === 'Searching...(0s)', 'cominciando dice Searching...(0s)', et.textContent);
    dice(chiamate.length === n0 + 1 && chiamate[n0].corpo.cerca === true, 'e batte subito, dicendo che cerca', chiamate.length - n0);
    _mmCronoDa = Date.now() - 125000;
    await respira(1100);
    var btn = q('#mm2-find'), rbt = btn.getBoundingClientRect(), ret = et.getBoundingClientRect();
    dice(et.textContent === 'Searching...(125s)', 'i secondi salgono', et.textContent);
    dice(ret.left >= rbt.left && ret.right <= rbt.right && et.scrollWidth <= et.clientWidth + 1, 'e anche con tre cifre ci sta nel pulsante', 'etichetta ' + ret.width.toFixed(1) + ' in ' + rbt.width.toFixed(1));
    dice(chiamate.length === n0 + 1, 'fra un battito e l-altro non batte', chiamate.length - n0);
    _onlineBattitoDa = Date.now() - 10001;
    await respira(1100);
    dice(chiamate.length === n0 + 2 && chiamate[n0 + 1].corpo.cerca === true, 'dopo dieci secondi batte di nuovo', chiamate.length - n0);
    mm2FermaRicerca();
    await respira(60);
    dice(chiamate.length === n0 + 3 && chiamate[n0 + 2].corpo.cerca === false, 'smettendo di cercare batte subito senza il segno', chiamate.length - n0);
    mm2FermaRicerca();
    await respira(60);
    dice(chiamate.length === n0 + 3, 'e una seconda fermata non batte di nuovo', chiamate.length - n0);
    mm2AggiornaPulsanteGioca();
    nakamaRpc = rpcVero; sessioneAccount = sessVera;

    // ── 5. la dissolvenza cambiando vista ───────────────────────────────────
    var PEZZI = ['#mm2-testata', '#mm2-modi', '#mm2-gioca', '#mm2-basso'];
    var entrano = function(){ return PEZZI.map(function(s){
      var a = q(s).getAnimations().filter(function(x){ var k = x.effect && x.effect.getKeyframes(); return k && k.length && String(k[0].opacity) === '0'; })[0];
      return a ? (s + ':' + (a.effect.getTiming().delay || 0)) : null; }); };
    // v0.80.25 — l'animazione del cambio vista e' cambiata (esce e rientra, i due
    // riquadri di lato): i dettagli li guarda prova-v08025. Qui resta che a vista
    // cambiata tutto sia al suo posto.
    dice(!transizioneInCorso(), 'nessun cambio di pagina in corso');
    mm2Vista('ai');
    await respira(900);
    dice(getComputedStyle(cercano).display === 'none' && getComputedStyle(online).display === 'none', 'contro il bot le righe non si vedono');
    dice(PEZZI.every(function(s){ return !q(s).classList.contains('pezzo-attende') && getComputedStyle(q(s)).opacity === '1'; }), 'finita, tutto e- a piena opacita-', PEZZI.map(function(s){ return getComputedStyle(q(s)).opacity; }).join(' '));
    mm2Vista('ai');
    await respira(40);
    dice(!entrano().some(Boolean), 'restando sulla stessa vista non si anima');
    mm2Vista('matchmaking');
    await respira(900);
    showPage('collection');
    await respira(100);
    showPage('mainmenu');
    await respira(30);
    var durante = transizioneInCorso();
    mm2Vista('ai');
    // v0.80.25 — durante un cambio di pagina la vista cambia subito, senza la sua animazione
    dice(durante && _mm2VistaTimer === null && q('#mm2-modo-draft h2').textContent === 'Draft vs Bot', 'durante un cambio di pagina la vista cambia subito, senza la sua animazione', 'in corso ' + durante);
    finoA = performance.now();
    while(transizioneInCorso() && performance.now() - finoA < 4000) await respira(50);
    await respira(500);
    dice(PEZZI.every(function(s){ return getComputedStyle(q(s)).opacity === '1'; }), 'e a pagina entrata e- tutto a posto');
    mm2Vista('matchmaking');
  } catch(err){ dice(false, 'il banco e- arrivato in fondo', err.message + ' ' + String(err.stack || '').split('\\n').slice(1,3).join(' | ')); }
  return d.join('\\n');
})()`;

app.whenReady().then(async () => {
  setTimeout(() => { console.log('  NO  il banco non ha finito in tempo'); app.exit(2); }, 120000);
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, frame: false, useContentSize: true,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  win.webContents.on('console-message', (e, livello, msg) => { if (livello >= 3) console.log('[console] ' + msg); });
  await win.loadURL(PAGINA);
  win.setPosition(-3200, 0); win.showInactive();
  await new Promise(r => setTimeout(r, 14000));
  await win.webContents.insertCSS('#splash{display:none!important} #tutorial-overlay{display:none!important}');
  const esito = statici.join('\n') + '\n' + await win.webContents.executeJavaScript(CORPO);
  console.log(esito);
  const no = (esito.match(/^  NO  /gm) || []).length;
  const ok = (esito.match(/^  ok  /gm) || []).length;
  console.log('\n' + ok + ' ok, ' + no + ' NO');
  app.exit(no ? 1 : 0);
});
