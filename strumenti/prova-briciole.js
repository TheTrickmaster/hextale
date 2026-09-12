// LE BRICIOLE DI TOM THUMB.
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-briciole.js
//
// Regola di Lorenzo (v0.80.5): "Quando viene giocato, lascia al centro di 3
// tile casuali 3 briciole di pane (crumb-1,2,3.png, o crumb-dark-1,2,3.png se
// le lascia un Tom Thumb dark, larghe 80px). Quando una carta alleata viene
// giocata sopra a una di queste 3 caselle, riproduci munch.mp3, fai brillare e
// pulsare la carta e dai +2 al valore piu' alto di quella carta."
//
// Si prova, con un Tom Thumb finto che ha la chiave vera ("!tomthumb"):
//   1. le briciole: tre, su caselle libere, del giocatore e della sua fazione,
//      disegnate larghe 80 al tabellone in HD;
//   2. lo stesso caso sui due schermi: stesse caselle con lo stesso seme, anche
//      se la carta ha un altro id (in rete ce l'ha);
//   3. l'anteprima del trascinamento mostra il +2 senza mangiare la briciola;
//   4. un alleato giocato sopra: +2 sul gruppo piu' alto, munch.mp3, bagliore,
//      e la briciola sparisce;
//   5. un nemico giocato sopra: la briciola sparisce e non da' niente.
const { app, BrowserWindow } = require('electron');
const path = require('path');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  try {
    var modello = FINAL_CARDS.find(function(e){ return e && e.values && !Array.isArray(e.values); });
    var copia = function(extra){ return Object.assign(JSON.parse(JSON.stringify(modello)), extra); };
    var TOM = copia({ id:'final-prova-tom', slug:'prova-tom', numero:9024, name:'Prova Tom', cardAbility:'!tomthumb', abilityLocked:false, abilityUnlockLevel:1,
      traits:['small'], traitNames:['Small'], abilita:{ unica:true, trigger:null, riepilogo:'UNIQUE' },
      values:{NW:1,NE:1,E:1,SE:1,SW:1,W:1}, valuesBase:{NW:1,NE:1,E:1,SE:1,SW:1,W:1} });
    // Un alleato con un gruppo piu' alto riconoscibile: NE-E-SE a 6, il resto a 2.
    var ALLEATO = copia({ id:'final-prova-alleato', slug:'prova-alleato', numero:9025, name:'Prova Alleato', cardAbility:'', abilita:null, traits:[], traitNames:[],
      groupSides:[['NE','E','SE'],['SW','W','NW']], values:{NE:6,E:6,SE:6,SW:2,W:2,NW:2}, valuesBase:{NE:6,E:6,SE:6,SW:2,W:2,NW:2} });
    FINAL_CARDS.push(TOM, ALLEATO);
    _sinergieDaFoglioNoto = null;
    var n = 0;
    var fai = function(v, o){ var c = _makeCardDbCard(v, o); c.id = v.id + '-' + o + '-c' + (n++); c.baseId = v.id; return c; };
    var somma = function(v){ return SIDES.reduce(function(s, k){ return s + (v[k] || 0); }, 0); };

    dice(abilitaEseguibile(fai(TOM, 1)), 'l-abilita- di Tom Thumb risulta programmata (niente NO_SCRIPT)');

    showPage('game');
    startGame(true);
    await respira(16000);
    var prepara = function(){
      try{ fermaIlConto(); }catch(_){}
      G.board = {}; G.holes = new Set(); G.destroyedHoles = new Set(); G.gelo = {}; G.briciole = {};
      G.gameOver = false; G.currentPlayer = 1; G.turnPlayLocked = false; G.sceltaBersaglio = null; G.vsAI = true;
      G.numeroTurno = 5; G._semeSinergie = 'seme-di-prova';
    };

    // ── 1. le briciole ────────────────────────────────────────────────────
    prepara();
    var tom = fai(TOM, 1);
    G.p1Hand = [tom, fai(ALLEATO, 1)];
    _firmaTabellonePrecedente = null; renderBoard(); render();
    await respira(400);
    doPlace(tom, 0, 0, 0);
    await respira(900);
    var celle = Object.keys(G.briciole).sort();
    dice(celle.length === 3, 'Tom Thumb lascia tre briciole', JSON.stringify(celle));
    dice(celle.every(function(k){ return k !== '0,0' && !G.board[k] && !G.holes.has(k); }), 'tutte su caselle libere');
    dice(celle.every(function(k){ return G.briciole[k].owner === 1; }), 'e sono del giocatore che le ha lasciate');
    var scura = playerFactionIsDark(1);
    var bsvg = document.getElementById('board-svg');
    var imgs = Array.prototype.slice.call(bsvg.querySelectorAll('image[data-briciola]'));
    dice(imgs.length === 3, 'e si vedono sul tabellone', imgs.length);
    var nomi = imgs.map(function(i){ return String(i.getAttribute('href')).split('/').pop(); });
    dice(nomi.every(function(x){ return scura ? /^crumb-dark-[123]\\.png$/.test(x) : /^crumb-[123]\\.png$/.test(x); }),
      'con l-immagine della sua fazione (' + (scura ? 'dark' : 'light') + ')', nomi.join(', '));
    // La larghezza: 80 al tabellone in HD, cioe- 80 * R / 126.77 nelle unita- del disegno.
    var cella0 = celle[0];
    var tile = bsvg.querySelector('[data-tile-wrap="' + cella0 + 'f"]');
    var img0 = bsvg.querySelector('image[data-briciola="' + cella0 + '"]');
    var larghezzaTassello = tile ? tile.getBBox().width : 0;
    var attesa = 80 * ((larghezzaTassello / Math.sqrt(3)) / 126.77);
    var w0 = img0 ? parseFloat(img0.getAttribute('width')) : 0;
    dice(img0 && tile && Math.abs(w0 - attesa) / attesa < 0.08, 'larga 80 al tabellone in HD', 'briciola ' + w0.toFixed(1) + ', attesa ~' + attesa.toFixed(1));
    var bb = img0 && img0.getBBox(), tb = tile && tile.getBBox();
    dice(bb && tb && Math.abs((bb.x + bb.width/2) - (tb.x + tb.width/2)) < 3 && Math.abs((bb.y + bb.height/2) - (tb.y + tb.height/2)) < 3,
      'al centro della casella');

    // ── 2. lo stesso caso con lo stesso seme ──────────────────────────────
    var primaVolta = celle.join(' ');
    prepara();
    var tomBis = fai(TOM, 1);
    tomBis.id = 'un-altro-id-come-in-rete';
    G.board[key(0,0)] = { card: tomBis, owner: 1 };
    lasciaBriciole(tomBis, 0, 0);
    dice(Object.keys(G.briciole).sort().join(' ') === primaVolta, 'stessa partita, stessa casella, stesso turno: stesse caselle, anche con un altro id',
      Object.keys(G.briciole).sort().join(' ') + ' / ' + primaVolta);

    // ── 3. l-anteprima ────────────────────────────────────────────────────
    prepara();
    G.board[key(0,0)] = { card: fai(TOM, 1), owner: 1 };
    G.briciole[key(1,0)] = { owner:1, da:'x', nome:'Prova Tom', variante:1, scura:scura, ordine:0 };
    var alleato = fai(ALLEATO, 1);
    G.p1Hand = [alleato];
    dragState = { card: alleato, hoverCellKey: key(1,0) };
    _anteprimaTavolo = null;
    var ant = computeDragPreview(alleato, 1, 0);
    dragState = null; _anteprimaTavolo = null;
    dice(!!ant && ant.values.NE === 8 && ant.values.E === 8 && ant.values.SE === 8 && ant.values.W === 2,
      'trascinando un alleato sulla briciola l-anteprima mostra +2 sul gruppo piu- alto', ant && JSON.stringify(ant.values));
    dice(!!G.briciole[key(1,0)], 'e la briciola resta dov-e-');

    // ── 4. un alleato ci si posa sopra ────────────────────────────────────
    var suoni = [];
    var veroSuono = playSfxFile;
    window.playSfxFile = function(nome){ suoni.push(nome); try{ return veroSuono.apply(this, arguments); }catch(_){ return null; } };
    G.turnPlayLocked = false; G.currentPlayer = 1;
    _firmaTabellonePrecedente = null; renderBoard(); render();
    await respira(300);
    doPlace(alleato, 0, 1, 0);
    dice(alleato.values.NE === 8 && alleato.values.SE === 8 && alleato.values.SW === 2, 'l-alleato giocato sopra prende +2 sul gruppo piu- alto', JSON.stringify(alleato.values));
    dice(!G.briciole[key(1,0)], 'e la briciola viene mangiata');
    await respira(420);
    dice(suoni.indexOf('munch.mp3') >= 0, 'munch.mp3 suona quando la carta tocca il tassello', suoni.join(', '));
    var ospite = bsvg.querySelector('[data-conquered="1,0"] [data-role="wobble-host"]') || bsvg.querySelector('[data-conquered="1,0"]');
    dice(!!ospite && ospite.classList.contains('briciola-mangiata') && getComputedStyle(ospite).animationName.indexOf('briciolaMangiata') >= 0,
      'e la carta brilla e pulsa', ospite ? (ospite.getAttribute('class') + ' / ' + getComputedStyle(ospite).animationName) : 'nessun elemento');
    var righe = (function(){ var h = bloccoModificatoriHTML(alleato); var e = document.createElement('div'); e.innerHTML = h;
      return Array.prototype.map.call(e.querySelectorAll('.ct-mod'), function(x){ return x.textContent; }); })();
    dice(righe.some(function(t){ return /^\\+2 from Prova Tom$/.test(t); }), 'nel riquadro dei buff si legge da chi', JSON.stringify(righe));
    await respira(3500);

    // ── 5. un nemico ci si posa sopra ─────────────────────────────────────
    prepara();
    G.board[key(0,0)] = { card: fai(TOM, 1), owner: 1 };
    G.briciole[key(-1,0)] = { owner:1, da:'x', nome:'Prova Tom', variante:2, scura:scura, ordine:0 };
    G.currentPlayer = 2;
    var nemico = fai(ALLEATO, 2);
    G.p2Hand = [nemico];
    suoni.length = 0;
    _firmaTabellonePrecedente = null; renderBoard(); render();
    await respira(300);
    doPlace(nemico, 1, -1, 0);
    await respira(450);
    dice(!G.briciole[key(-1,0)], 'un nemico giocato sopra copre la briciola, che sparisce');
    dice(somma(nemico.values) === 24 && suoni.indexOf('munch.mp3') < 0, 'senza dargli niente e senza munch', somma(nemico.values) + ' / ' + suoni.join(', '));
    window.playSfxFile = veroSuono;
    await respira(3000);
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
