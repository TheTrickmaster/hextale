// Il banco dei punti di fine turno.
//
//   npx electron strumenti/prova-punti.js
//
// Dalla v0.79.56 una carta in campo non vale piu' un punto: vale AL CONTRARIO
// della propria rarita' — common 3, rare 2, mythic 1, timeless 0. E' la regola
// che decide chi vince la partita (vedi salePunteggio e la scelta del
// vincitore in endGame), quindi e' la cosa piu' importante di tutto il file, e
// l'unica che se sbaglia non se ne accorge nessuno: un punteggio storto e' un
// numero plausibile.
//
// L'esempio e' quello di Lorenzo, alla lettera: due common, una mitica e una
// timeless in campo fanno SETTE. Se un giorno qualcuno cambia la tabella senza
// volere, e' questa riga a dirlo.
//
// PERCHE' SI GUARDA L'ONDA E NON SOLO LA TABELLA. puntiDiCarta da sola direbbe
// che i numeri sono giusti anche il giorno in cui l'onda smettesse di
// consegnarli — e' successo l'opposto in passato (la bolla contava e il
// punteggio no). Qui si contano gli INCREMENTI davvero chiesti alla bolla e il
// totale con cui si chiude, che sono le due cose che il giocatore vede.
const { app, BrowserWindow } = require('electron');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  try {
    var sp = document.getElementById('splash'); if(sp) sp.remove();

    // ── A. la tabella ───────────────────────────────────────────────────
    dice(puntiDiCarta({rarity:'common'})   === 3, 'una common vale 3', puntiDiCarta({rarity:'common'}));
    dice(puntiDiCarta({rarity:'rare'})     === 2, 'una rare vale 2',   puntiDiCarta({rarity:'rare'}));
    dice(puntiDiCarta({rarity:'mythic'})   === 1, 'una mythic vale 1', puntiDiCarta({rarity:'mythic'}));
    dice(puntiDiCarta({rarity:'timeless'}) === 0, 'una timeless vale 0', puntiDiCarta({rarity:'timeless'}));
    dice(puntiDiCarta({rarity:'COMMON'})   === 3, 'e la maiuscola non cambia niente', puntiDiCarta({rarity:'COMMON'}));
    // Una rarita' che non esiste vale come una common, NON zero: zero vorrebbe
    // dire che un dato scritto male sparisce dal conto senza dirlo.
    dice(puntiDiCarta({rarity:'sbagliata'}) === 3, 'una rarita- ignota vale come una common',
      puntiDiCarta({rarity:'sbagliata'}));
    dice(puntiDiCarta({}) === 3, 'e una carta senza rarita- pure', puntiDiCarta({}));

    // ── B. l'esempio di Lorenzo, dall'onda vera ─────────────────────────
    var carta = function(rar){ return { rarity:rar, name:rar, id:rar+Math.random() }; };
    G.gameOver = false;
    G.board = {
      'a': { owner:1, card:carta('common')   },
      'b': { owner:1, card:carta('common')   },
      'c': { owner:1, card:carta('mythic')   },
      'd': { owner:1, card:carta('timeless') },
      'e': { owner:2, card:carta('rare')     }
    };
    var salite = {1:[], 2:[]}, chiusure = {};
    var veroApri = apriBollaPunti, veroInc = incrementaBollaPunti, veroChiudi = chiudiBollaPunti;
    window.apriBollaPunti = function(){};
    window.incrementaBollaPunti = function(p, n){ salite[p].push(n); };
    window.chiudiBollaPunti = function(p, punti, poi){ chiusure[p] = punti; if(poi) poi(); };

    var finito = false;
    dannoDiFineTurno(function(){ finito = true; });
    await respira(1400);

    window.apriBollaPunti = veroApri;
    window.incrementaBollaPunti = veroInc;
    window.chiudiBollaPunti = veroChiudi;

    dice(finito, 'il turno prosegue quando l-onda ha finito');
    var somma1 = salite[1].reduce(function(a,b){ return a+b; }, 0);
    dice(somma1 === 7, '2 common + 1 mythic + 1 timeless fanno 7', somma1 + '  (' + salite[1].join('+') + ')');
    dice(chiusure[1] === 7, 'e la bolla si chiude sullo stesso totale', chiusure[1]);
    dice(salite[1].length === 3, 'la timeless non consegna niente e non entra nell-onda',
      salite[1].length + ' carte accese su 4');
    dice(chiusure[2] === 2, 'e l-avversario prende i 2 della sua rare', chiusure[2]);

    // ── C. un tabellone di sole timeless non blocca il turno ────────────
    // E- il caso che si dimentica: l-onda con zero carte deve chiamare
    // comunque chi la aspetta, o la partita si ferma li- per sempre.
    G.board = { 'a': { owner:1, card:carta('timeless') }, 'b': { owner:2, card:carta('timeless') } };
    var finito2 = false;
    window.apriBollaPunti = function(){};
    window.incrementaBollaPunti = function(){};
    window.chiudiBollaPunti = function(p, punti, poi){ if(poi) poi(); };
    dannoDiFineTurno(function(){ finito2 = true; });
    await respira(700);
    window.apriBollaPunti = veroApri;
    window.incrementaBollaPunti = veroInc;
    window.chiudiBollaPunti = veroChiudi;
    dice(finito2, 'solo timeless in campo: il turno prosegue lo stesso');

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
