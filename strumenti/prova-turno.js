// Due cose che il turno deve sapere di se': CHI sono io, e QUANTO manca.
//
//   npx electron strumenti/prova-turno.js
//
// Sono due difetti trovati insieme il 10 settembre 2026, e si somigliano: tutti
// e due nascono da una cosa che viene RIFATTA DA CAPO quando doveva essere
// portata avanti.
//
// 1. G.ioSonoIlNumero. In rete il server dice quale dei due numeri siamo, e la
//    riga che lo scriveva girava un istante PRIMA che initGame rifacesse G da
//    zero. Da allora _goIoSono rispondeva 1 a tutti e due i giocatori: chi era
//    il numero 2 sentiva la fanfara al contrario — vittoria quando aveva perso
//    — e vedeva i due punteggi scambiati nel riquadro finale.
//
// 2. startTimer. Aprendo la finestra di una scelta il conto veniva fatto
//    ripartire DA CAPO, e con lui la barra tornava piena: chi giocava una carta
//    con abilita' si ritrovava il turno intero da rifare. In rete non si vedeva,
//    perche' li' la scadenza la detta il server e startTimer la ripescava
//    comunque; era tutto delle partite contro l'IA.
//
// Nessuno dei due da' un errore. Si vedono soltanto — e solo se si sta
// guardando quella cosa li'.
const { app, BrowserWindow } = require('electron');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  try {
    var sp = document.getElementById('splash'); if(sp) sp.remove();
    // initGame vuole la pagina di gioco MONTATA: le pagine sono ermetiche, e
    // fuori da quella i suoi getElementById tornano nulli.
    showPage('game');

    // ── 1. CHI SONO IO, dopo che G e- stato rifatto ─────────────────────
    // Si finge una partita in rete in cui il server ci ha chiamati "2", poi si
    // fa quello che fa il gioco davvero: initGame rifa- G da zero. Il numero
    // deve sopravvivere a quel giro, perche- e- li- che si perdeva.
    var reteVera = PARTITA_RETE;
    PARTITA_RETE = { matchId:'prova', io:2, mano:[], mazzo:[], buchi:[],
                     turno:1, scadenza:0, numeroTurno:1, pubblico:{} };
    initGame(false);
    dice(G.ioSonoIlNumero === 2, 'il numero del server sopravvive a initGame', G.ioSonoIlNumero);
    dice(_goIoSono() === 2, 'e _goIoSono lo dice', _goIoSono());
    // Fuori rete si e- sempre il primo: l-altro e- la macchina.
    PARTITA_RETE = null;
    initGame(true);
    dice(_goIoSono() === 1, 'fuori rete sono sempre il primo', _goIoSono());
    PARTITA_RETE = reteVera;

    // ── 2. RIPRENDERE NON E- RICOMINCIARE ───────────────────────────────
    // Si porta il conto a meta- turno e si chiede a startTimer di RIPRENDERE:
    // la scadenza non si deve muovere di un millisecondo.
    G.gameOver = true;   // cosi- il tic non prova a giocare una carta da solo
    startTimer();
    var pieno = timerDeadline;
    dice(Math.abs(pieno - (Date.now() + TURN_SECS*1000)) < 400,
      'un turno nuovo parte da TURN_SECS', TURN_SECS + 's');

    // Si finge che siano passati venti secondi.
    timerDeadline = Date.now() + (TURN_SECS - 20) * 1000;
    var meta = timerDeadline;
    startTimer(true);
    dice(timerDeadline === meta, 'riprendendo, la scadenza non si sposta',
      Math.round((timerDeadline - meta)) + 'ms di scarto');
    dice(Math.abs(timerLeft - (TURN_SECS - 20)) <= 1,
      'e i secondi rimasti sono quelli che restavano', timerLeft + 's');

    // E chiamandola SENZA riprendere, invece, riparte davvero.
    timerDeadline = Date.now() + (TURN_SECS - 20) * 1000;
    startTimer();
    dice(Math.abs(timerDeadline - (Date.now() + TURN_SECS*1000)) < 400,
      'senza riprendere riparte da capo, come deve', timerLeft + 's');

    // Una scadenza gia- passata non si "riprende": si riparte, o il turno non
    // finirebbe piu-.
    timerDeadline = Date.now() - 5000;
    startTimer(true);
    dice(timerLeft > 0, 'una scadenza gia- scaduta fa ripartire il conto', timerLeft + 's');

    clearInterval(timerInterval);
    return d.join(String.fromCharCode(10));
  } catch(e) {
    return 'PIANTATA: ' + (e && e.message) + ' @ ' + ((e && e.stack) || '').split(String.fromCharCode(10))[1]
      + String.fromCharCode(10) + d.join(String.fromCharCode(10));
  }
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1600, height: 1000,
    webPreferences: { contextIsolation: false, webSecurity: false } });
  await win.loadURL('file:///C:/Users/masil/Desktop/Hextale/game-assets/play/index.html');
  await new Promise(r => setTimeout(r, 12000));
  let out;
  try { out = await win.webContents.executeJavaScript(CORPO); }
  catch(e){ out = 'ERRORE NELL\'INIEZIONE: ' + (e && e.message); }
  console.log('\n' + out + '\n');
  app.exit(String(out).indexOf('  NO  ') !== -1 || String(out).indexOf('PIANTATA') === 0 ? 1 : 0);
});
