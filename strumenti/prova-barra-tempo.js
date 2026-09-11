// LA BARRA DEL TEMPO HA TRE STATI, E NESSUN ALTRO.
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-barra-tempo.js
//
// Regola di Lorenzo (v0.79.99):
//   1. durante il turno si svuota lentamente, senza scatti;
//   2. durante il cambio turno sta ferma;
//   3. al cambio turno torna piena di colpo, senza transizione.
// E "a volte in partita la barra rimbalza avanti e indietro senza motivo".
//
// I rimbalzi avevano tre strade, e il banco le percorre tutte:
//   - il battito del server che, a carta appena giocata, portava gia' la
//     scadenza del turno DOPO (la barra risaliva a meta' risoluzione);
//   - la scadenza del server che arrivava dopo il riempimento (piena, poi un
//     secondo di discesa fino al numero giusto);
//   - una transizione CSS di un secondo sopra a ogni correzione.
// Si misura la LARGHEZZA vera della maschera, campionata nel tempo.
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
    var mask = document.getElementById('timer-fill-mask');
    var sig = document.getElementById('timer-signal-img');
    var larga = function(){ return parseFloat(mask.style.width) || 0; };
    // Campiona la larghezza per \`ms\` millisecondi, ogni \`passo\`.
    var campiona = async function(ms, passo){
      var out = [], fine = Date.now() + ms;
      while(Date.now() < fine){ out.push(larga()); await respira(passo || 40); }
      return out;
    };
    var maiSu = function(serie){ for(var i=1;i<serie.length;i++) if(serie[i] > serie[i-1] + 0.01) return false; return true; };
    var saltoMax = function(serie){ var m = 0; for(var i=1;i<serie.length;i++) m = Math.max(m, Math.abs(serie[i]-serie[i-1])); return m; };
    // La partita vera non deve muovere niente mentre si misura: niente IA,
    // e nessuna giocata d-ufficio allo scadere.
    G.gameOver = false; G.vsAI = false; G.turnPlayLocked = true; G.sceltaBersaglio = null;
    window.autoPlay = function(){};
    PARTITA_RETE = null;

    // ── niente transizioni sulla larghezza ────────────────────────────
    var tm = getComputedStyle(mask).transitionProperty + ' ' + getComputedStyle(mask).transitionDuration;
    dice(!/width|all/.test(getComputedStyle(mask).transitionProperty), 'la maschera non ha transizioni sulla larghezza', tm);
    var durate = getComputedStyle(sig).transitionDuration.split(',').map(function(x){ return parseFloat(x) || 0; });
    dice(durate.every(function(x){ return x === 0; }), 'e il pallino non ne ha sulla posizione', getComputedStyle(sig).transitionProperty + ' ' + getComputedStyle(sig).transitionDuration);

    // ── 1. si svuota piano, senza scatti ──────────────────────────────
    fermaIlConto();
    startTimer();
    var subito = larga();
    dice(Math.abs(subito - TIMER_FULL_BAR_W) < 1, 'un turno nuovo parte pieno', subito);
    var s1 = await campiona(1500, 50);
    dice(maiSu(s1), 'durante il turno non risale mai');
    var perso = s1[0] - s1[s1.length-1];
    var atteso = TIMER_FULL_BAR_W * 1.5 / TURN_SECS;
    dice(perso > atteso * 0.6 && perso < atteso * 1.6, 'in un secondo e mezzo scende di quel che deve', perso.toFixed(1) + ' px, attesi ~' + atteso.toFixed(1));
    dice(saltoMax(s1) < 20, 'e scende a piccoli passi, non a secondi interi', saltoMax(s1).toFixed(2) + ' px al massimo fra due campioni');

    // ── 2. ferma nel cambio turno ─────────────────────────────────────
    var src = String(endTurn);
    dice(src.indexOf('fermaIlConto()') >= 0 && src.indexOf('fermaIlConto()') < src.indexOf('svuotaLeRimozioniInAttesa'),
      'endTurn ferma il conto per prima cosa');
    fermaIlConto();
    var ferma = await campiona(800, 80);
    dice(ferma.every(function(v){ return Math.abs(v - ferma[0]) < 0.01; }), 'fermata, la barra non si muove', ferma[0].toFixed(1));
    dice(BARRA_TEMPO.modo === 'ferma', 'e lo dice', BARRA_TEMPO.modo);

    // ── 3. piena di colpo ─────────────────────────────────────────────
    resetTimerBarVisual();
    dice(Math.abs(larga() - TIMER_FULL_BAR_W) < 0.01, 'al cambio turno e- piena NELLO STESSO istante', larga());
    var piena = await campiona(500, 50);
    dice(piena.every(function(v){ return Math.abs(v - TIMER_FULL_BAR_W) < 0.01; }), 'e resta piena finche- il conto non riparte');

    // ── la rete: il server ha cominciato il turno qualche secondo prima ─
    PARTITA_RETE = { matchId:'prova', io:1, mano:[], mazzo:[], buchi:[], turno:1, numeroTurno:3, pubblico:{},
                     scadenza: Date.now() + (TURN_SECS - 6) * 1000 };
    G.currentPlayer = 1; G.turnBannerActive = false;
    resetTimerBarVisual();
    startTimer();
    var dopoAvvio = await campiona(600, 30);
    dice(Math.abs(dopoAvvio[0] - TIMER_FULL_BAR_W) < 5 && maiSu(dopoAvvio) && saltoMax(dopoAvvio) < 20,
      'in rete parte piena e scende, invece di cadere di colpo ai secondi del server', dopoAvvio[0].toFixed(1) + ' -> ' + dopoAvvio[dopoAvvio.length-1].toFixed(1));
    dice(timerLeft <= TURN_SECS - 5, 'mentre i secondi scritti restano quelli del server', timerLeft);

    // Il battito corregge la scadenza a turno in corso: la barra NON risale.
    G.turnPlayLocked = false;
    PARTITA_RETE.scadenza = Date.now() + (TURN_SECS - 1) * 1000;   // il server dice: ne restano di piu-
    var primaBattito = larga();
    reteAllineaTimer();
    var s2 = [primaBattito].concat(await campiona(900, 40));
    dice(maiSu(s2) && saltoMax(s2) < 20, 'una scadenza corretta a turno in corso non la fa risalire ne- saltare', 'salto max ' + saltoMax(s2).toFixed(2));
    dice(Math.abs(timerDeadline - PARTITA_RETE.scadenza) < 5, 'ma la scadenza e- quella nuova');

    // Carta gia- giocata: il server ha gia- passato il turno e il battito porta
    // la scadenza del turno DOPO. Non si tocca niente.
    G.turnPlayLocked = true;
    var scadenzaPrima = timerDeadline;
    PARTITA_RETE.turno = 2;
    PARTITA_RETE.scadenza = Date.now() + TURN_SECS * 1000;
    var primaGiocata = larga();
    reteAllineaTimer();
    var s3 = [primaGiocata].concat(await campiona(600, 40));
    dice(timerDeadline === scadenzaPrima, 'a carta giocata il battito del turno dopo non sposta la scadenza');
    dice(maiSu(s3), 'e la barra non risale a meta- risoluzione', s3[0].toFixed(1) + ' -> ' + s3[s3.length-1].toFixed(1));

    // Durante il banner, lo stesso.
    G.turnPlayLocked = false; G.turnBannerActive = true; PARTITA_RETE.turno = 1;
    scadenzaPrima = timerDeadline;
    PARTITA_RETE.scadenza = Date.now() + 20000;
    reteAllineaTimer();
    dice(timerDeadline === scadenzaPrima, 'e nemmeno col banner del cambio turno a schermo');
    G.turnBannerActive = false;

    fermaIlConto();
    PARTITA_RETE = null; G.gameOver = true;
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
