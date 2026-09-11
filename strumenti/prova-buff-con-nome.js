// NEL RIQUADRO "BUFFS/DEBUFFS" OGNI RIGA DICE DA CHI.
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-buff-con-nome.js
//
// Segnalazione di Lorenzo (v0.80.2), con lo screenshot del Bianconiglio:
//   +1
//   +2
//   +2 ALL Self
//   −1 from Robin Hood
// "Se un buff o debuff non ha un nome, vuol dire che non e' valido e non va
// mostrato."
// I due numeri nudi erano i TOTALI per gruppo (+2 ALL e -1 su un gruppo fanno
// +1 li' e +2 negli altri). Il riquadro li scriveva per non tacere mai, e li
// toglieva solo se una riga col nome diceva alla lettera la stessa cosa: con
// due fonti sulla stessa carta non succedeva mai.
// Adesso il totale si scrive solo quando ha un nome ("Self", se nessun altro
// spiega e la carta agisce su se stessa); una voce del registro senza nome non
// si scrive.
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
    initGame(true);
    await respira(300);
    fermaIlConto();
    G.board = {};
    var righe = function(card){
      var html = bloccoModificatoriHTML(card);
      if(!html) return [];
      var el = document.createElement('div'); el.innerHTML = html;
      return Array.prototype.map.call(el.querySelectorAll('.ct-mod'), function(e){ return e.textContent; });
    };
    var conNome = function(t){ return t.indexOf(' from ') >= 0 || / Self$/.test(t); };
    var nato = { NE:5, E:5, SE:5, SW:4, W:4, NW:4 };
    var carta = function(){
      return { id:'final-white-rabbit-1-x', name:'White Rabbit', owner:1, rarity:'rare', level:1,
        groupSides:[['NE','E','SE'],['SW','W','NW']],
        values:Object.assign({}, nato), valoriBase:Object.assign({}, nato), valoriNascita:Object.assign({}, nato),
        cardAbility:null, abilita:null, modificatori:null };
    };

    // ── lo screenshot: +2 ALL da se stessa, -1 su un gruppo da Robin Hood ──
    var c = carta();
    SIDES.forEach(function(l){ c.values[l] += 2; c.valoriBase[l] += 2; });
    ['SW','W','NW'].forEach(function(l){ c.values[l] -= 1; c.valoriBase[l] -= 1; });
    sommaModificatore(c, 'rush_hour', 'White Rabbit', 2, 'ALL', c.id);
    sommaModificatore(c, 'eat_the_rich:robin', 'Robin Hood', -1, '', 'final-robin-hood-2-x');
    var r = righe(c);
    dice(r.length === 2, 'due righe, una per fonte', JSON.stringify(r));
    dice(r.every(conNome), 'e tutte e due dicono da chi', JSON.stringify(r));
    dice(r.indexOf('+2 ALL Self') >= 0 && r.indexOf('−1 from Robin Hood') >= 0, 'esattamente quelle dello screenshot, senza i numeri nudi', JSON.stringify(r));

    // ── una voce del registro senza nome non si scrive ──
    c = carta();
    SIDES.forEach(function(l){ c.values[l] += 1; });
    sommaModificatore(c, 'misteriosa', '', 1, 'ALL', null);
    r = righe(c);
    dice(r.length === 0, 'un buff senza nome non compare', JSON.stringify(r));

    // ── un numero cambiato senza nessuno che lo spieghi: niente riga ──
    c = carta();
    ['NE','E','SE'].forEach(function(l){ c.values[l] += 3; });
    r = righe(c);
    dice(r.length === 0, 'un +3 su un gruppo che nessuno spiega non compare', JSON.stringify(r));

    // ── ma se la carta agisce su se stessa, il totale ha un nome: "Self" ──
    c = carta();
    c.cardAbility = 'prova_se'; c.abilityLocked = false;
    c.abilita = { unica:false, trigger:'on_play', frequenza:'once_per_game', finestra:{ tipo:'always' }, se:null, regola:null,
      legame:null, se2:null, regola2:null, effetto2:null,
      effetto:{ azione:'buff', chi:'self', cosa:'power', ambito:'ALL', quanto:{ numero:2 } } };
    SIDES.forEach(function(l){ c.values[l] += 2; });
    var veroNoto = _sinergieDaFoglioNoto;
    r = righe(c);
    dice(r.length === 1 && r[0] === '+2 ALL Self', 'una carta che si e- buffata da sola: "+2 ALL Self"', JSON.stringify(r));

    // ── una riga con un nome resta anche da sola ──
    c = carta();
    SIDES.forEach(function(l){ c.values[l] -= 3; c.valoriBase[l] -= 3; });
    sommaModificatore(c, 'hex:baba', 'Baba Yaga', -3, 'ALL', 'final-baba-yaga-2-x');
    r = righe(c);
    dice(r.length === 1 && r[0] === '−3 ALL from Baba Yaga', 'un debuff con un nome si vede come sempre', JSON.stringify(r));
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
