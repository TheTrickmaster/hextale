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
//
// v0.79.59 — TRE SEZIONI IN PIU', tutte sulla stessa regola di Lorenzo: il
// conto NON si ferma mai.
//   3. a zero con la carta gia' giocata non succede niente (e' un turno che
//      sta finendo da solo, non un tempo scaduto); con una scelta aperta si
//      passa da autoPlay, che la chiude come rinuncia;
//   4. in rete la scelta scade DAVVERO: il ritorno anticipato per la rete
//      stava sopra al ramo della scelta, che era codice morto — una finestra
//      di bersaglio online non scadeva mai, e la mossa dell'avversario
//      arrivava sopra a una scelta ancora aperta;
//   5. i valori della carta viaggiano con la giocata (reteGioca ->
//      reteApplicaGiocata): sull'altro schermo la carta e' ricostruita dal
//      catalogo, e senza questo cio' che le era successo in mano si perdeva.
const { app, BrowserWindow } = require('electron');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
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

    // ── 3. A ZERO CON LA CARTA GIA- GIOCATA: NON SI FA NIENTE (v0.79.59) ──
    // Il conto non si ferma piu- a carta giocata: se arriva a zero mentre lo
    // scontro sta risolvendo, non e- un tempo scaduto — e- un turno che sta
    // finendo da solo. Niente giocata d-ufficio, niente scritta.
    var giocateDUfficio = 0, scritte = 0;
    var veroAuto = autoPlay, veroScritta = mostraTempoScaduto;
    window.autoPlay = function(){ giocateDUfficio++; };
    window.mostraTempoScaduto = function(){ scritte++; };
    G.gameOver = false; G.currentPlayer = 1; G.turnPlayLocked = true; G.sceltaBersaglio = null;
    PARTITA_RETE = null;
    startTimer();
    timerDeadline = Date.now() - 10;
    await respira(600);
    clearInterval(timerInterval);
    dice(giocateDUfficio === 0 && scritte === 0, 'a zero con la carta gia- giocata non succede niente',
      giocateDUfficio + ' giocate, ' + scritte + ' scritte');
    // ...ma con una scelta aperta si- : la si chiude come rinuncia.
    G.turnPlayLocked = true; G.sceltaBersaglio = { giocatore:1, chiave:'prova', bersagli:[] };
    startTimer();
    timerDeadline = Date.now() - 10;
    await respira(600);
    clearInterval(timerInterval);
    dice(giocateDUfficio === 1, 'con una scelta aperta il tic passa da autoPlay (che la chiude)', giocateDUfficio);
    window.autoPlay = veroAuto; window.mostraTempoScaduto = veroScritta;
    G.sceltaBersaglio = null; G.turnPlayLocked = false;

    // ── 4. IN RETE LA SCELTA SCADE DAVVERO (v0.79.59) ──────────────────────
    // Prima il ritorno anticipato per la rete stava sopra al ramo della
    // scelta: era codice morto, e una finestra di bersaglio online non
    // scadeva mai. Adesso a scadenza si manda la rinuncia al server.
    var mandate = [];
    var veroScegli = reteScegli;
    window.reteScegli = function(c){ mandate.push(c); };
    PARTITA_RETE = { matchId:'prova', io:1, mano:[], mazzo:[], buchi:[], turno:1, scadenza:0, numeroTurno:1, pubblico:{} };
    G.sceltaBersaglio = { giocatore:1, chiave:'prova', bersagli:[], rinuncia:function(){}, applica:function(){} };
    autoPlay(1);
    dice(mandate.length === 1 && mandate[0] === null, 'in rete la scelta scaduta manda la rinuncia al server', JSON.stringify(mandate));
    // E chi NON deve scegliere non manda niente.
    mandate.length = 0;
    G.sceltaBersaglio = { giocatore:2, chiave:'prova', bersagli:[], rinuncia:function(){}, applica:function(){} };
    autoPlay(2);
    dice(mandate.length === 0, 'e chi non deve scegliere non manda niente', mandate.length);
    window.reteScegli = veroScegli;
    G.sceltaBersaglio = null;

    // ── 5. I VALORI VIAGGIANO CON LA GIOCATA (v0.79.59) ────────────────────
    var eA = (FINAL_CARDS||[])[0];
    var mia = _makeCardDbCard(eA, 1);
    mia.valoriBase = { NE:1, E:2, SE:3, SW:4, W:5, NW:6 };
    var v = _valoriDaMandare(mia);
    dice(!!v && v.NE === 1 && v.NW === 6, 'la giocata porta la BASE della carta', JSON.stringify(v));
    // E chi la riceve la mette addosso alla carta ricostruita.
    PARTITA_RETE = { matchId:'prova', io:1, mano:[], mazzo:[], buchi:[], turno:2, scadenza:0, numeroTurno:1, pubblico:{} };
    G.p2Hand = [_cartaSconosciuta(2, 0)];
    var veroPlace = doPlace;
    var ricevuta = null;
    window.doPlace = function(carta){ ricevuta = carta; };
    var veroRacconta = reteRaccontaQuandoFermo;
    window.reteRaccontaQuandoFermo = function(){};
    reteApplicaGiocata({ giocatore:2, carta:eA.id, q:0, r:0, turno:1, scadenza:0, numeroTurno:2, valori:{ NE:7, E:7, SE:7, SW:7, W:7, NW:7 } });
    window.doPlace = veroPlace; window.reteRaccontaQuandoFermo = veroRacconta;
    dice(!!ricevuta && ricevuta.values.NE === 7 && ricevuta.valoriBase.NW === 7,
      'e chi riceve la ricostruisce con quei valori', ricevuta && JSON.stringify(ricevuta.values));
    PARTITA_RETE = reteVera;
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
