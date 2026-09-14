// LO YETI SI NASCONDE E ATTACCA SOLO QUANDO GLI SI VA ACCANTO (v0.80.21).
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-yeti.js
//
// Le regole di Lorenzo (vedi il blocco YETI in play/index.html). Con la carta
// vera del catalogo e due carte finte (tutti 1, tutti 9):
//   1. giocato non attacca, resta a meta' per chi l'ha giocato, e si apre il
//      trascinamento (la X nell'angolo);
//   2. portato altrove: fuori dal tabellone, due impronte (una normale e una
//      specchiata, alte 110 in HD) a 300ms l'una dall'altra, un passo nella neve
//      ciascuna; lui a meta' sulla casella vera per chi l'ha giocato, e basta
//      impronte per l'altro; chi puo' giocare dove;
//   3. una carta avversaria accanto lo scopre (lampo) e chi e' piu' alto attacca:
//      vince lo Yeti, vince la carta, pareggio; accanto alla finta niente;
//   4. con la X resta dov'e' e si sceglie l'impronta finta (foot-yeti-icon);
//   5. le briciole: mangiate in silenzio dove sta, via senza niente dalla finta;
//   6. il tempo scaduto lo porta a caso; il bot lo nasconde da solo e non si vede;
//   7. a fine partita si mostra;
//   8. in rete: la decisione va al server (op 17) e si nasconde con op 18; per
//      l'avversario sparisce, niente casella vera, e lo scopre la giocata (op 3).
const { app, BrowserWindow } = require('electron');
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
    var voce = FINAL_CARDS.find(function(e){ return e && e.slug === 'yeti'; });
    dice(!!voce && voce.cardAbility === '!yeti', 'lo Yeti e- nel catalogo con la sua chiave', voce && voce.cardAbility);
    var modello = FINAL_CARDS.find(function(e){ return e && e.values && !Array.isArray(e.values); });
    var tutti = function(v){ return {NE:v,E:v,SE:v,SW:v,W:v,NW:v}; };
    var finta = function(id, n, v){ return Object.assign(JSON.parse(JSON.stringify(modello)), { id:id, slug:id, numero:n, name:id, cardAbility:'', abilita:null, traits:[], traitNames:[], values:tutti(v), valuesBase:tutti(v), groupSides:[['NE','E','SE','SW','W','NW']] }); };
    var UNO = finta('prova-uno-y', 9601, 1), NOVE = finta('prova-nove-y', 9602, 9);
    FINAL_CARDS.push(UNO, NOVE);
    _sinergieDaFoglioNoto = null;
    var n = 0;
    var fai = function(v, o){ var c = _makeCardDbCard(v, o); c.id = v.id + '-' + o + '-y' + (n++); c.baseId = v.id; return c; };
    var yeti = function(o){ var c = fai(voce, o); c.abilityLocked = false; return c; };
    dice(eYeti(yeti(1)) && abilitaEseguibile(yeti(1)), 'la carta risulta programmata (niente NO_SCRIPT)');
    var suoni = [], sfxVero = playSfxFile;
    playSfxFile = function(f){ suoni.push({ f:f, t:performance.now() }); };

    showPage('game'); startGame(true); await respira(16000);
    var celle = G.cells.map(function(c){ return key(c.q, c.r); });
    var qr = function(k){ return k.split(',').map(Number); };
    var dist = function(a, b){ var A = qr(a), B = qr(b), dq = A[0]-B[0], dr = A[1]-B[1]; return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq+dr)) / 2; };
    var vicini = function(k){ var p = qr(k); return DIRS.map(function(dd){ return key(p[0]+dd.dq, p[1]+dd.dr); }).filter(function(x){ return celle.indexOf(x) >= 0; }); };
    var prepara = function(g, vsAI){ try{ fermaIlConto(); }catch(_){} G.board = {}; G.holes = new Set(); G.destroyedHoles = new Set(); G.gelo = {}; G.briciole = {}; G.yeti = [];
      G.gameOver = false; G.currentPlayer = g; G.turnPlayLocked = false; G.turnBannerActive = false; G.sceltaBersaglio = null; G.vsAI = !!vsAI; G.numeroTurno = 3; G.ioSonoIlNumero = 1;
      G.p1Hand = [fai(UNO, 1), fai(UNO, 1)]; G.p2Hand = [fai(UNO, 2), fai(UNO, 2)]; PARTITA_RETE = null; _firmaTabellonePrecedente = null; renderBoard(); render(); };
    var gioca = function(carta, g, k, daServer){ try{ fermaIlConto(); }catch(_){} G.currentPlayer = g; G.turnPlayLocked = false; G.turnBannerActive = false; G.gameOver = false;
      if(g === 1) G.p1Hand = [carta].concat([fai(UNO, 1), fai(UNO, 1)]); else G.p2Hand = [carta].concat([fai(UNO, 2), fai(UNO, 2)]);
      var p = qr(k); doPlace(carta, g - 1, p[0], p[1], !!daServer); };
    var padrone = function(k){ return G.board[k] ? G.board[k].owner : 0; };
    var impronteDom = function(){ return document.querySelectorAll('#board-svg [data-impronta-yeti]'); };
    var ridisegna = function(){ _firmaTabellonePrecedente = null; renderBoard(); };

    // Le caselle: A dove si gioca, B lontana (dove va), C accanto a B ma non ad A,
    // F accanto ad A ma non a B, E accanto ad A (il nemico debole).
    var A = '0,0';
    var B = celle.filter(function(k){ return dist(k, A) >= 2 && vicini(k).some(function(v){ return dist(v, A) >= 2; }); })[0];
    var C = vicini(B).filter(function(v){ return dist(v, A) >= 2; })[0];
    var F = vicini(A).filter(function(v){ return dist(v, B) >= 2; })[0];
    var E = vicini(A).filter(function(v){ return v !== F && dist(v, B) >= 2; })[0] || vicini(A)[0];
    // LONTANA: un nemico lontano da tutto, perche' a fine turno ci sia chi prende punti
    var LONTANA = celle.filter(function(k){ return dist(k, A) >= 2 && dist(k, B) >= 2 && dist(k, C) >= 2 && k !== F && k !== E; })[0];
    dice(A && B && C && F && E && LONTANA, 'caselle della prova', [A,B,C,F,E,LONTANA].join(' '));

    // ── 1. giocato ────────────────────────────────────────────────────────
    prepara(1);
    G.board[LONTANA] = { card: fai(UNO, 2), owner: 2 };
    var y1 = yeti(1);
    suoni = [];
    gioca(y1, 1, A);
    await respira(600);
    var s = G.sceltaBersaglio;
    dice(G.board[A] && G.board[A].card === y1 && G.yeti.length === 1 && G.yeti[0].stato === 'sceglie', 'senza avversari accanto resta sulla casella e sta per nascondersi');
    dice(s && s.chiave === 'yeti_sposta' && s.modo === 'trascina' && s.bersagli.join() === A && s.rinunciaSottoLaMano && s.privata, 'si apre il trascinamento dello Yeti', s && s.chiave);
    var host = document.querySelector('#board-svg [data-conquered="' + A + '"] [data-role="yeti-host"]');
    dice(host && host.style.opacity === '0.5', 'per chi l-ha giocato e- a meta- opacita-', host && host.style.opacity);
    var croce = [].slice.call(document.querySelectorAll('#board-svg .hx-icon-scelta image')).filter(function(i){ return /close-icon-red/.test(i.getAttribute('href')); })[0];
    var mano = [].slice.call(document.querySelectorAll('#board-svg .hx-icon-scelta image')).filter(function(i){ return /hand-icon/.test(i.getAttribute('href')); })[0];
    var centro = function(i){ return { x: parseFloat(i.getAttribute('x')) + parseFloat(i.getAttribute('width'))/2, y: parseFloat(i.getAttribute('y')) + parseFloat(i.getAttribute('height'))/2 }; };
    dice(croce && mano && Math.abs(centro(croce).x - centro(mano).x) < 1 && centro(croce).y - centro(mano).y > 15, 'la X sta sotto alla mano, sulla stessa verticale (Lorenzo)', croce && mano && JSON.stringify([centro(croce), centro(mano)]));

    // ── 2. portato altrove ────────────────────────────────────────────────
    s.destinazioneScelta = B;
    var t0 = performance.now();
    scegliBersaglio(A);
    var yy = G.yeti[0];
    dice(yy && yy.stato === 'nascosto' && yy.cella === B && !G.board[A] && !G.board[B], 'portato in ' + B + ': sparisce dal tabellone', yy && (yy.stato + ' ' + yy.cella));
    dice(yy && yy.impronte.map(function(i){ return i.cella; }).join('|') === A + '|' + B && yy.impronte[0].specchio !== yy.impronte[1].specchio, 'due impronte, partenza e arrivo, una normale e una specchiata', yy && JSON.stringify(yy.impronte.map(function(i){ return [i.cella, i.specchio, Math.round(i.angolo)]; })));
    dice(impronteDom().length === 1, 'subito se ne vede una', impronteDom().length);
    await respira(380);
    ridisegna();
    dice(impronteDom().length === 2, 'e 300ms dopo anche l-altra', impronteDom().length);
    var passi = suoni.filter(function(x){ return /snow-footstep-[123]\\.mp3/.test(x.f); });
    dice(passi.length === 2 && passi[1].t - passi[0].t >= 250, 'un passo nella neve per impronta, 300ms l-uno dall-altro', passi.map(function(x){ return x.f + '@' + Math.round(x.t - t0); }).join(' '));
    var imm = document.querySelector('#board-svg [data-impronta-yeti] image');
    var alta = parseFloat(imm.getAttribute('height')), attesa = 110 * (_ultimoRaggioCella / 126.77);
    dice(Math.abs(alta - attesa) < 0.5 && /foot-yeti\\.png$/.test(imm.getAttribute('href')), 'l-impronta e- foot-yeti, alta 110 al tabellone in HD', alta.toFixed(1) + ' / ' + attesa.toFixed(1));
    var fantasma = document.querySelector('#board-svg [data-yeti-fantasma="' + B + '"]');
    dice(fantasma && fantasma.style.opacity === '0.5', 'chi l-ha giocato lo vede a meta- sulla casella vera');
    var frutti = carteCheFruttano();
    calcScores(); aggiornaBoardScore();
    dice(frutti[1].filter(function(c){ return c.k === B && c.punti === puntiDiCarta(y1); }).length === 1 && G.scores[1] === 1
      && document.getElementById('bs-p1-num').textContent === String(puntiDiCarta(y1)),
      'nascosto da- punti sul tabellone (Lorenzo), e conta fra le carte in campo', JSON.stringify(frutti[1]) + ' carte ' + G.scores[1] + ' pannello ' + document.getElementById('bs-p1-num').textContent);
    G.currentPlayer = 2;
    dice(!canPlace(qr(A)[0], qr(A)[1]) && !canPlace(qr(B)[0], qr(B)[1]), 'l-avversario non gioca su nessuna delle due impronte');
    G.currentPlayer = 1;
    dice(canPlace(qr(A)[0], qr(A)[1]) && !canPlace(qr(B)[0], qr(B)[1]), 'il padrone gioca su quella vuota, non sopra allo Yeti');
    dice(celleLibere().indexOf(A) < 0 && celleLibere().indexOf(B) < 0, 'e per le abilita- nessuna delle due e- libera');
    G.ioSonoIlNumero = 2; ridisegna();
    dice(!document.querySelector('#board-svg [data-yeti-fantasma]') && impronteDom().length === 2, 'l-avversario vede solo le impronte');
    var fruttiLui = carteCheFruttano();
    dice(fruttiLui[1].length === 1 && fruttiLui[1][0].k === null && fruttiLui[1][0].punti === puntiDiCarta(y1), 'e i punti dello Yeti li conta, senza sapere da quale casella', JSON.stringify(fruttiLui[1]));
    G.ioSonoIlNumero = 1; ridisegna();
    // endTurn ha le sue pause (fine turno, danno di fine turno col nemico in
    // campo): si aspetta che il turno cambi, fino a sei secondi.
    var inizioAttesa = performance.now();
    while(G.currentPlayer !== 2 && performance.now() - inizioAttesa < 6000) await respira(150);
    dice(G.currentPlayer === 2, 'e il turno passa', G.currentPlayer + ' dopo ' + Math.round(performance.now() - inizioAttesa) + 'ms');
    dice(reteImpronta().indexOf(B) < 0, 'nascosto non entra nell-impronta del tabellone');

    // ── 3. scoperto ───────────────────────────────────────────────────────
    var debole = fai(UNO, 2);
    gioca(debole, 2, C);
    dice(G.board[B] && G.board[B].card === y1 && yy.stato === 'rivelato', 'una carta avversaria accanto lo scopre');
    await respira(80); ridisegna();
    var riv = document.querySelector('#board-svg [data-conquered="' + B + '"] [data-role="yeti-host"]');
    dice(riv && riv.classList.contains('yeti-rivela') && getComputedStyle(riv).animationName === 'yetiRivela', 'si rivela con dissolvenza e lampo', riv && getComputedStyle(riv).animationName);
    await respira(3200);
    dice(padrone(C) === 1 && padrone(B) === 1, 'con il numero piu- alto attacca lui e prende la carta', padrone(C) + '/' + padrone(B));

    prepara(1);
    var y2 = yeti(1);
    gioca(y2, 1, A); await respira(400);
    G.sceltaBersaglio.destinazioneScelta = B; scegliBersaglio(A); await respira(1200);
    var forte = fai(NOVE, 2);
    gioca(forte, 2, C);
    await respira(3200);
    dice(padrone(B) === 2 && padrone(C) === 2, 'con il numero piu- alto la carta avversaria lo conquista, e lui non contrattacca', padrone(B) + '/' + padrone(C));

    prepara(1);
    var y3 = yeti(1);
    gioca(y3, 1, A); await respira(400);
    G.sceltaBersaglio.destinazioneScelta = B; scegliBersaglio(A); await respira(1200);
    var pb = qr(B), dirDaB = DIRS.find(function(dd){ return key(pb[0]+dd.dq, pb[1]+dd.dr) === C; });
    var PARI = finta('prova-pari-y', 9603, y3.values[dirDaB.mySide]);
    FINAL_CARDS.push(PARI);
    gioca(fai(PARI, 2), 2, C);
    await respira(3200);
    dice(padrone(B) === 1 && padrone(C) === 2 && G.yeti[0].stato === 'rivelato', 'a parita- si scopre e non succede niente', padrone(B) + '/' + padrone(C) + ' valore ' + PARI.values.E);

    prepara(1);
    var y4 = yeti(1);
    gioca(y4, 1, A); await respira(400);
    G.sceltaBersaglio.destinazioneScelta = B; scegliBersaglio(A); await respira(1200);
    gioca(fai(UNO, 2), 2, F);
    await respira(1500);
    dice(G.yeti[0].stato === 'nascosto' && !G.board[B], 'una carta accanto alla sola impronta finta non lo scopre');

    // ── 3b. accanto a una carta avversaria non si nasconde ────────────────
    prepara(1);
    G.board[E] = { card: fai(UNO, 2), owner: 2 };
    var yv = yeti(1);
    gioca(yv, 1, A);
    await respira(300);
    dice(!G.sceltaBersaglio && G.board[A] && G.board[A].card === yv && !G.yeti.length, 'giocato accanto a una carta avversaria non si nasconde (Lorenzo)', (G.sceltaBersaglio && G.sceltaBersaglio.chiave) + ' ' + G.yeti.length);
    await respira(3000);
    dice(padrone(E) === 1, 'e attacca subito, come una carta qualunque', padrone(E));

    // ── 3c. accanto allo Yeti nemico nascosto: lo scopre, e il mio resta scoperto
    prepara(2);
    var yn = yeti(2);
    gioca(yn, 2, A); await respira(400);
    G.sceltaBersaglio.destinazioneScelta = B; scegliBersaglio(A); await respira(1500);
    var mio = yeti(1);
    gioca(mio, 1, C);
    await respira(300);
    dice(G.board[B] && G.board[B].card === yn && G.yeti.length === 1 && G.yeti[0].stato === 'rivelato' && G.board[C] && G.board[C].card === mio && !G.sceltaBersaglio,
      'giocato accanto allo Yeti nemico nascosto: lo scopre, e il mio non si nasconde', G.yeti.length + ' ' + (G.sceltaBersaglio && G.sceltaBersaglio.chiave));
    var pc = qr(C), dirCB = DIRS.find(function(dd){ return key(pc[0]+dd.dq, pc[1]+dd.dr) === B; });
    var mv = mio.values[dirCB.mySide], ev = yn.values[dirCB.theirSide];
    var atteso = mv > ev ? '1/1' : (ev > mv ? '2/2' : '2/1');
    await respira(3200);
    dice(padrone(B) + '/' + padrone(C) === atteso, 'e fra i due attacca chi ha il numero piu- alto (' + mv + ' contro ' + ev + ')', padrone(B) + '/' + padrone(C));

    // ── 4. la X ───────────────────────────────────────────────────────────
    prepara(1);
    var y5 = yeti(1);
    gioca(y5, 1, A); await respira(400);
    rinunciaSceltaBersaglio();
    var s2 = G.sceltaBersaglio;
    dice(s2 && s2.chiave === 'yeti_impronta' && s2.icona === ICONA_IMPRONTA_YETI && !s2.cellaOrigine && s2.bersagli.indexOf(A) < 0 && s2.bersagli.length === celleLibere().filter(function(k){ return !cellaCongelata(k); }).length,
      'con la X si sceglie dove lasciare l-impronta finta', s2 && (s2.chiave + ' ' + s2.bersagli.length));
    await respira(60); ridisegna();
    var icone = [].slice.call(document.querySelectorAll('#board-svg .hx-icon-scelta image')).filter(function(i){ return /foot-yeti-icon\\.png$/.test(i.getAttribute('href')); });
    var croci = [].slice.call(document.querySelectorAll('#board-svg .hx-icon-scelta image')).filter(function(i){ return /close-icon-red/.test(i.getAttribute('href')); });
    dice(icone.length === s2.bersagli.length && croci.length === 0, 'un-icona foot-yeti-icon su ogni casella, e nessuna X', icone.length + ' icone, ' + croci.length + ' X');
    var mirino = [].slice.call(document.querySelectorAll('#board-svg .hx-icon-scelta image')).filter(function(i){ return /crosshair/.test(i.getAttribute('href')); })[0];
    dice(icone[0] && Math.abs(parseFloat(icone[0].getAttribute('width')) - _ultimoRaggioCella * 0.62 * SCALA_ICONE_SCELTA) < 0.5, 'grande come le altre icone di scelta', icone[0] && icone[0].getAttribute('width'));
    scegliBersaglio(F);
    dice(G.yeti[0].stato === 'nascosto' && G.yeti[0].cella === A && G.yeti[0].impronte.map(function(i){ return i.cella; }).join('|') === A + '|' + F, 'resta in ' + A + ', con l-impronta finta in ' + F);
    await respira(1200);

    // ── 5. le briciole ────────────────────────────────────────────────────
    prepara(1);
    G.briciole[A] = { owner:1, da:'tom-prova', nome:'Tom Thumb', variante:1 };
    G.briciole[B] = { owner:1, da:'tom-prova', nome:'Tom Thumb', variante:1 };
    var y6 = yeti(1), nw0 = y6.values.NW;
    suoni = [];
    gioca(y6, 1, A); await respira(600);
    dice(y6.values.NW === nw0 + 2 && !G.briciole[A], 'giocato su una briciola la mangia (+2 sul piu- alto)', nw0 + ' -> ' + y6.values.NW);
    G.sceltaBersaglio.destinazioneScelta = B; scegliBersaglio(A); await respira(900);
    dice(y6.values.NW === nw0 + 4 && !G.briciole[B], 'e se va a stare su una briciola, mangia anche quella', y6.values.NW);
    dice(!suoni.some(function(x){ return x.f === 'munch.mp3'; }), 'tutto senza suono', suoni.map(function(x){ return x.f; }).join(','));
    prepara(1);
    G.briciole[F] = { owner:1, da:'tom-prova', nome:'Tom Thumb', variante:1 };
    var y7 = yeti(1), nw7 = y7.values.NW;
    gioca(y7, 1, A); await respira(400);
    rinunciaSceltaBersaglio(); scegliBersaglio(F); await respira(900);
    dice(!G.briciole[F] && y7.values.NW === nw7, 'la briciola sotto l-impronta finta sparisce senza dare niente', y7.values.NW);

    // ── 6. il tempo, il bot ───────────────────────────────────────────────
    prepara(1);
    var y8 = yeti(1);
    gioca(y8, 1, A); await respira(400);
    autoPlay(1);
    dice(G.yeti[0].stato === 'nascosto' && G.yeti[0].cella && G.yeti[0].cella !== A, 'tempo scaduto: va su una casella libera a caso', G.yeti[0].cella);
    await respira(1200);
    prepara(2, true);
    var yb = yeti(2);
    gioca(yb, 2, A);
    aiResolvePendingAbilityIfAny();
    await respira(500);
    var sb = G.sceltaBersaglio; if(sb && sb.chiave === 'yeti_impronta') aiResolvePendingAbilityIfAny();
    await respira(500); ridisegna();
    dice(G.yeti[0].stato === 'nascosto' && G.yeti[0].di === 2 && !document.querySelector('#board-svg [data-yeti-fantasma]') && impronteDom().length === 2, 'il bot lo nasconde da solo, e io vedo solo le impronte', G.yeti[0].stato + ' ' + impronteDom().length);
    await respira(1200);

    // ── 7. fine partita ───────────────────────────────────────────────────
    prepara(1);
    var y9 = yeti(1);
    gioca(y9, 1, A); await respira(400);
    G.sceltaBersaglio.destinazioneScelta = B; scegliBersaglio(A); await respira(1200);
    try{ endGame(); }catch(e){}
    await respira(300);
    dice(G.yeti[0].stato === 'rivelato' && G.board[B] && G.board[B].card === y9, 'a fine partita si mostra');
    try{ document.getElementById('gameover').classList.remove('show'); }catch(_){}
    await respira(300);

    // ── 8. in rete ────────────────────────────────────────────────────────
    var mandati = [], mmVero = mmManda;
    mmManda = function(x){ mandati.push(x); };
    // chi lo gioca
    prepara(1);
    PARTITA_RETE = { matchId:'prova', io:1, numeroTurno:3, turno:2, scadenza: Date.now() + 30000 };
    var yr = yeti(1);
    gioca(yr, 1, A, true); await respira(400);
    G.sceltaBersaglio.destinazioneScelta = B; scegliBersaglio(A);
    var op17 = mandati.map(function(m){ return m.match_data_send; }).filter(function(x){ return x && x.op_code === 17; })[0];
    dice(op17 && JSON.parse(atob(op17.data)).vera === B && !mandati.some(function(m){ return m.match_data_send && m.match_data_send.op_code === 10; }), 'in rete la decisione va al server con op 17 (e non con op 10)', op17 && atob(op17.data));
    dice(G.sceltaBersaglio && G.sceltaBersaglio.chiave === 'yeti_attesa' && G.board[A] && G.board[A].card === yr, 'e si aspetta la risposta con lo Yeti ancora in campo');
    autoPlay(1);
    dice(G.sceltaBersaglio && G.sceltaBersaglio.chiave === 'yeti_attesa', 'l-attesa non la chiude il tempo');
    reteMessaggio({ op_code:18, data: btoa(JSON.stringify({ di:1, da:A, impronte:[A, B], vera:B })) });
    dice(G.yeti[0].stato === 'nascosto' && G.yeti[0].cella === B && !G.sceltaBersaglio, 'con op 18 si nasconde nella casella vera');
    await respira(1200);
    // l'avversario
    prepara(2);
    G.ioSonoIlNumero = 2;
    PARTITA_RETE = { matchId:'prova', io:2, numeroTurno:3, turno:2, scadenza: Date.now() + 30000 };
    var ya = yeti(1);
    G.currentPlayer = 1; G.turnPlayLocked = false;
    // con la mano vuota, a fine turno la partita finirebbe (e la giocata dopo non scenderebbe)
    G.p1Hand = [ya, fai(UNO, 1), fai(UNO, 1)];
    doPlace(ya, 0, qr(A)[0], qr(A)[1], true);
    await respira(120); ridisegna();
    var hostA = document.querySelector('#board-svg [data-conquered="' + A + '"] [data-role="yeti-host"]');
    dice(G.sceltaBersaglio && G.sceltaBersaglio.chiave === 'yeti_attesa' && G.sceltaBersaglio.giocatore === 1 && hostA && hostA.classList.contains('yeti-sparisce'), 'dall-altra parte sparisce e si aspetta, senza comandi');
    reteMessaggio({ op_code:18, data: btoa(JSON.stringify({ di:1, da:A, impronte:[A, B] })) });
    await respira(400); ridisegna();
    dice(G.yeti[0].stato === 'nascosto' && G.yeti[0].cella === null && !document.querySelector('#board-svg [data-yeti-fantasma]') && impronteDom().length === 2, 'arrivano le impronte, ma non dov-e-');
    G.currentPlayer = 2;
    dice(!canPlace(qr(A)[0], qr(A)[1]) && !canPlace(qr(B)[0], qr(B)[1]), 'e non si gioca su nessuna delle due');
    // la fine del turno dello Yeti (coi suoi punti) prende il suo tempo, e con la
    // mano vuota la partita finirebbe prima dello scontro
    await respira(2600);
    var miaCarta = fai(UNO, 2);
    G.currentPlayer = 2; G.turnPlayLocked = false; G.p2Hand = [miaCarta, fai(UNO, 2), fai(UNO, 2)];
    reteMessaggio({ op_code:3, data: btoa(JSON.stringify({ giocatore:2, carta:_idDelMazzo(miaCarta), forma: miaCarta.baseId, q: qr(C)[0], r: qr(C)[1], valori: miaCarta.values,
      turno:1, scadenza: Date.now() + 30000, numeroTurno:4, yeti:[{ di:1, da:A, cella:B }] })) });
    dice(G.board[B] && G.board[B].card === ya && G.yeti[0].stato === 'rivelato', 'la giocata del server lo scopre, nella casella che dice lui');
    await respira(3200);
    dice(padrone(C) === 1, 'e lo scontro va come fuori rete', padrone(C));
    mmManda = mmVero; PARTITA_RETE = null; G.ioSonoIlNumero = 1;
    playSfxFile = sfxVero;
  } catch(err){ dice(false, 'il banco e- arrivato in fondo', err.message + ' ' + String(err.stack || '').split('\\n').slice(1,3).join(' | ')); }
  return d.join('\\n');
})()`;

app.whenReady().then(async () => {
  setTimeout(() => { console.log('  NO  il banco non ha finito in tempo'); app.exit(2); }, 240000);
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
