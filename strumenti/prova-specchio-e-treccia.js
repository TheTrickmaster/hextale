// LO SPECCHIO NON EREDITA UNA TRASFORMAZIONE GIA' FATTA, E LA TRECCIA TIRA
// DAL PUNTO GIUSTO.
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-specchio-e-treccia.js
//
// Due segnalazioni di Lorenzo (v0.80.3).
//
// 1. "Magic Mirror ha copiato l'abilita' del Green Prince (Frog Prince gia'
//    trasformato) e, siccome era accanto a una principessa, si e' trasformato
//    in Green Prince anche lui." trasformaCartaIn cambiava chiave, nomi e testi
//    dell'abilita' ma non `abilita`, la riga che il motore esegue: il Green
//    Prince restava con la riga del Ranocchio ("se accanto a una Principessa,
//    trasformati"), e copiare vuol dire copiare quella riga. Adesso la carta
//    trasformata prende la riga della carta nuova (nessuna, per il Principe), e
//    _prendiAbilita scarta una trasformazione verso la forma che il donatore ha
//    gia' — per le carte trasformate prima di questa versione.
//
// 2. "Rapunzel, quando pulla una carta, la carta pullata fa un'animazione
//    strana all'indietro verso la direzione da cui e' stata pullata." Lo
//    strascico partiva da "centro della carta" meno "centro del TASSELLO
//    d'arrivo": riquadri diversi, e i quattro-cinque pixel di differenza
//    diventavano un primo fotogramma in cui la carta afferrata arretrava.
//    Adesso lo scostamento si misura carta contro carta.
const { app, BrowserWindow } = require('electron');
const path = require('path');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  try {
    try{ fermaIlConto(); }catch(_){}
    var modello = FINAL_CARDS.find(function(e){ return e && e.values && !Array.isArray(e.values); });
    var copia = function(extra){ return Object.assign(JSON.parse(JSON.stringify(modello)), extra); };
    var riga = function(effetto, extra){ return Object.assign({ unica:false, trigger:'on_play', frequenza:'once_per_game', finestra:{ tipo:'always' },
      se:null, regola:null, legame:null, se2:null, regola2:null, effetto2:null, effetto:effetto }, extra || {}); };
    var RANA = copia({ id:'final-prova-rana', slug:'prova-rana', numero:9015, name:'Prova Rana', cardAbility:'kiss', abilityLocked:false, abilityUnlockLevel:1,
      traits:[], traitNames:[],
      abilita: riga({ azione:'transform', scelta:false, chi:'self', cosa:'card', quanto:{ carta:'#9144' } },
        { se:{ soggetto:'adjacent', test:'has_trait', valore:{ tratti:['Princess'] } } }) });
    var PRINCIPE = copia({ id:'final-prova-principe', slug:'prova-principe', numero:9144, name:'Prova Principe', cardAbility:'', abilita:null, dropRate:0, traits:[], traitNames:[] });
    var CAVALIERE = copia({ id:'final-prova-cavaliere', slug:'prova-cavaliere', numero:9145, name:'Prova Cavaliere', cardAbility:'prova_forza', abilityLocked:false, abilityUnlockLevel:1,
      abilita: riga({ azione:'buff', scelta:false, chi:'self', cosa:'power', ambito:'ALL', quanto:{ numero:1 } }, { frequenza:'every_time' }) });
    var PRINCIPESSA = copia({ id:'final-prova-principessa', slug:'prova-principessa', numero:9001, name:'Prova Principessa', cardAbility:'', abilita:null,
      traits:['princess'], traitNames:['Princess'] });
    var SPECCHIO = copia({ id:'final-prova-specchio', slug:'prova-specchio', numero:9008, name:'Prova Specchio', cardAbility:'magic_mirror', abilityLocked:false, abilityUnlockLevel:1,
      abilita: riga({ azione:'copy', scelta:true, chi:'any', dove:'adjacent', cosa:'ability' }) });
    var TRECCIA = copia({ id:'final-prova-treccia', slug:'prova-treccia', numero:9013, name:'Prova Treccia', cardAbility:'braids', abilityLocked:false, abilityUnlockLevel:1, abilita:null,
      values:{NE:9,E:9,SE:9,SW:9,W:9,NW:9}, valuesBase:{NE:9,E:9,SE:9,SW:9,W:9,NW:9} });
    var DEBOLE = copia({ id:'final-prova-debole', slug:'prova-debole', numero:9020, name:'Prova Debole', cardAbility:'', abilita:null,
      values:{NE:1,E:1,SE:1,SW:1,W:1,NW:1}, valuesBase:{NE:1,E:1,SE:1,SW:1,W:1,NW:1} });
    FINAL_CARDS.push(RANA, PRINCIPE, CAVALIERE, PRINCIPESSA, SPECCHIO, TRECCIA, DEBOLE);
    _sinergieDaFoglioNoto = null;
    var fai = function(v, o, n){ var c = _makeCardDbCard(v, o); c.id = v.id + '-' + o + '-t' + n; c.baseId = v.id; return c; };

    // ── 1a. la carta trasformata prende la riga della carta nuova ──────────
    var rana = fai(RANA, 1, 1);
    trasformaCartaIn(rana, PRINCIPE.name, 'Kiss');
    dice(rana.baseId === PRINCIPE.id && rana.name === PRINCIPE.name, 'la rana diventa principe', rana.name);
    dice(!rana.abilita, 'e non ha piu- la riga della rana (il principe non ne ha)', rana.abilita ? rana.abilita.effetto.azione : 'nessuna');
    var rana2 = fai(RANA, 1, 2);
    trasformaCartaIn(rana2, CAVALIERE.name, 'Kiss');
    dice(!!rana2.abilita && rana2.abilita.effetto.azione === 'buff' && rana2.abilita !== CAVALIERE.abilita,
      'trasformandosi in una carta con una riga, prende quella (e una copia sua, non la stessa)', rana2.abilita && rana2.abilita.riepilogo);

    // ── 1b. chi copia dal principe non si porta via la trasformazione ──────
    var principe = fai(PRINCIPE, 1, 3);
    principe.abilita = JSON.parse(JSON.stringify(RANA.abilita));   // una carta trasformata prima di questa versione
    var specchio = fai(SPECCHIO, 1, 4);
    _prendiAbilita(principe, specchio, 'kiss');
    dice(!specchio.abilita, 'copiando da un principe con la riga vecchia, lo specchio non prende la trasformazione',
      specchio.abilita ? specchio.abilita.riepilogo || specchio.abilita.effetto.azione : 'nessuna');
    var ranaVera = fai(RANA, 1, 5);
    var specchio2 = fai(SPECCHIO, 1, 6);
    _prendiAbilita(ranaVera, specchio2, 'kiss');
    dice(!!specchio2.abilita && specchio2.abilita.effetto.azione === 'transform',
      'mentre da una rana non trasformata l-abilita- si copia come sempre');

    // ── 1c. nella partita: la rana calata accanto alla principessa ─────────
    showPage('game');
    startGame(true);
    await respira(16000);
    try{ fermaIlConto(); }catch(_){}
    G.board = {}; G.holes = new Set(); G.destroyedHoles = new Set(); G.gelo = {};
    G.gameOver = false; G.currentPlayer = 1; G.turnPlayLocked = false; G.sceltaBersaglio = null;
    G.board[key(0,0)] = { card: fai(PRINCIPESSA, 1, 7), owner: 1 };
    var calata = fai(RANA, 1, 8);
    G.p1Hand = [calata, fai(DEBOLE, 1, 9)];
    _firmaTabellonePrecedente = null; renderBoard(); render();
    await respira(400);
    doPlace(calata, 0, 1, 0);
    await respira(3200);
    var inCampo = G.board[key(1,0)] && G.board[key(1,0)].card;
    dice(!!inCampo && inCampo.baseId === PRINCIPE.id && !inCampo.abilita,
      'in partita la rana accanto alla principessa diventa principe, senza la riga della rana', inCampo && (inCampo.name + ' / ' + (inCampo.abilita ? 'riga' : 'nessuna riga')));

    // ── 2. la treccia tira dal punto giusto ────────────────────────────────
    await respira(2500);
    try{ fermaIlConto(); }catch(_){}
    G.board = {}; G.holes = new Set(); G.destroyedHoles = new Set(); G.gelo = {};
    G.gameOver = false; G.currentPlayer = 1; G.turnPlayLocked = false; G.sceltaBersaglio = null;
    var tirata = fai(DEBOLE, 2, 10);
    G.board[key(2,0)] = { card: tirata, owner: 2 };
    var rap = fai(TRECCIA, 1, 11);
    G.p1Hand = [rap, fai(DEBOLE, 1, 12)];
    _firmaTabellonePrecedente = null; renderBoard(); render();
    await respira(500);
    var bsvg = document.getElementById('board-svg');
    var centro = function(el){ var b = el.getBoundingClientRect(); return { x: b.left + b.width/2, y: b.top + b.height/2 }; };
    var elDa = bsvg.querySelector('[data-conquered="2,0"]');
    dice(!!elDa, 'la carta da tirare e- disegnata');
    var origine = elDa ? centro(elDa) : null;
    doPlace(rap, 0, 0, 0);
    await respira(150);
    dice(!!G.sceltaBersaglio && G.sceltaBersaglio.chiave === 'braids', 'la treccia chiede chi tirare', G.sceltaBersaglio && G.sceltaBersaglio.chiave);
    chiudiSceltaBersaglio('2,0');
    var campioni = [];
    var t0 = performance.now();
    while(performance.now() - t0 < 900){
      var el = bsvg.querySelector('[data-conquered="1,0"]');
      if(el && el.classList.contains('card-slide')) campioni.push(centro(el));
      await new Promise(function(r){ requestAnimationFrame(function(){ r(); }); });
    }
    var primo = campioni[0];
    dice(!!primo && !!origine && Math.abs(primo.x - origine.x) <= 1.5 && Math.abs(primo.y - origine.y) <= 1.5,
      'il primo fotogramma dello strascico e- dove la carta era, non un passo indietro',
      primo && origine ? ('origine ' + Math.round(origine.x) + ',' + Math.round(origine.y) + '  primo ' + Math.round(primo.x) + ',' + Math.round(primo.y)) : 'nessun campione');
    var indietro = 0;
    for(var i = 1; i < campioni.length; i++) if(campioni[i].x > campioni[i-1].x + 0.5) indietro++;
    dice(campioni.length > 3 && indietro === 0, 'e da li- va solo verso Rapunzel', campioni.length + ' campioni, ' + indietro + ' all-indietro');
    return d.join(String.fromCharCode(10));
  } catch(e) {
    return 'PIANTATA: ' + (e && e.message) + ' @ ' + ((e && e.stack) || '').split(String.fromCharCode(10))[1]
      + String.fromCharCode(10) + d.join(String.fromCharCode(10));
  }
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, frame: false,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await win.loadURL('file:///' + path.resolve(__dirname, '..').split(path.sep).join('/') + '/play/index.html');
  // Mostrata fuori dallo schermo: nascosta, la plancia nasce larga zero e non si disegna.
  win.setPosition(-3200, 0); win.showInactive();
  await new Promise(r => setTimeout(r, 14000));
  await win.webContents.insertCSS("#splash{display:none!important}");
  let out;
  try { out = await win.webContents.executeJavaScript(CORPO); }
  catch(e){ out = 'ERRORE NELL\'INIEZIONE: ' + (e && e.message); }
  console.log('\n' + out + '\n');
  app.exit(String(out).indexOf('  NO  ') !== -1 || String(out).indexOf('PIANTATA') === 0 ? 1 : 0);
});
