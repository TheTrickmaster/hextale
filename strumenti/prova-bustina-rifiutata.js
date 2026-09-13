// UN PACCHETTO CHE IL SERVER NON APRE NON SI APRE (v0.80.18).
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-bustina-rifiutata.js
//
// Registro di Nakama, 13 set 2026 12:48-12:49 UTC: tre volte "hx_bustina_apri
// ... non hai un pacchetto di tipo reward". A ogni rifiuto il client pescava
// tre carte da solo e le mostrava: il giocatore le vedeva uscire dalla busta e
// volare nella collezione, e non gli arrivava niente. La rete qui e' finta
// (fetch risponde da qui per le RPC, coi tempi che servono) e si guarda che:
//   1. un rifiuto del server non mostri carte: la busta se ne va, un avviso lo
//      dice, e quanti pacchetti ci sono lo dice di nuovo il server;
//   2. se il server dice che il pacchetto c'e', torni nella fila;
//   3. un rifiuto che arriva a sigillo gia' rotto non apra la busta;
//   4. a rete muta non si peschi in locale e il pacchetto non si consumi;
//   5. un'apertura vera funzioni come prima;
//   6. una risposta per una busta gia' lasciata non tocchi niente.
// Gli errori passano dalla strada vera (nakamaRpc -> nakamaChiedi): un 500 col
// messaggio del server porta un codice, una fetch che non parte porta zero.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var qa = function(s){ return [].slice.call(document.querySelectorAll(s)); };
  try {
    var sp = document.getElementById('splash'); if(sp) sp.remove();
    // Prima la pagina, poi i suoi pezzi: le pagine che non si vedono non sono
    // nel documento, e #pack-overlay cercato prima risponde null.
    showPage('packs');
    var scena = q('#pack-overlay');
    scena.classList.add('show');
    vestiPulsantiDi('pack-overlay');
    initPackTilt(); montaGraficaBustine(); initPacchettiGesti(); montaValuteBustine();
    tornaAllaBustina();

    // La rete finta. Ogni RPC dice cosa risponde e dopo quanto; rete:false vuol
    // dire che la richiesta non arriva (fetch rifiuta, come senza connessione).
    // Tutto il resto (le note, l-arte) va alla fetch vera.
    var piano = {};
    var viste = [];
    var fetchVera = fetch;
    fetch = function(url, opzioni){
      if(String(url).indexOf('/v2/rpc/') === -1) return fetchVera.apply(this, arguments);
      var nome = String(url).split('/v2/rpc/')[1].split('?')[0];
      viste.push(nome);
      var p = piano[nome] || { dopo:0, corpo:{} };
      return new Promise(function(ok, ko){ setTimeout(function(){
        if(p.rete === false){ ko(new TypeError('Failed to fetch')); return; }
        var stato = p.stato || 200;
        ok({ ok: stato >= 200 && stato < 300, status: stato, text: async function(){ return JSON.stringify(p.corpo || {}); } });
      }, p.dopo || 0); });
    };
    sessioneAccount = { token: 'finto' };
    var quante = function(nome){ return viste.filter(function(v){ return v === nome; }).length; };
    var rifiuto = function(msg, dopo){ return { dopo: dopo, stato: 500, corpo: { error: msg, message: msg, code: 13 } }; };
    var avviso = function(){ return { aperto: q('#avviso-overlay').classList.contains('show'), titolo: q('#avviso-titolo').textContent, testo: q('#avviso-testo').textContent }; };
    var inScena = function(){ return qa('#pack-reveal .pack-card').length; };
    var caselle = function(tipo){ return qa('#pk-tutti .pk-slot.pk-pieno[data-tipo=' + tipo + ']').length; };
    var LONTANO = Date.now() + 5*3600*1000;

    dice(typeof _pescaCartaBustina === 'undefined', 'la pescata locale non c-e- piu-');

    // ── 1. il rifiuto di quel giorno ───────────────────────────────────────
    PREFERENZE.bustinaProssima = LONTANO; BUSTINE_VINTE = 1; BUSTINE_TESORO = 0; pkDisegnaTutto();
    piano.hx_bustina_apri = rifiuto('non hai un pacchetto di tipo reward', 120);
    piano.hx_avvio = { dopo: 60, corpo: { bustineExtra: 0, bustineTesoro: 0, bustinaProssima: LONTANO } };
    viste.length = 0;
    dice(bustaSolleva('reward', 900, 500), 'si prende in mano il reward che il client crede di avere');
    bustaPosa();
    dice(scena.classList.contains('sbustando') && BUSTINE_VINTE === 0, 'posato, la scena parte e il contatore si scala subito (niente doppie aperture)', BUSTINE_VINTE);
    await respira(30);
    bustaColpo(); bustaColpo();
    dice(_bustaColpi === 2, 'mentre il server risponde si martella la ceralacca', _bustaColpi);
    await respira(200);
    var a1 = avviso();
    dice(a1.aperto && a1.titolo.indexOf('open pack') !== -1, 'al rifiuto si apre un avviso', a1.titolo);
    dice(a1.testo.indexOf('not available') !== -1 && a1.testo.indexOf('connection') === -1, 'che dice che il pacchetto non e- disponibile, non che manca la rete', a1.testo);
    dice(inScena() === 0 && !_bustaCarte && !_bustinaDalServer, 'e non esce nessuna carta', inScena());
    dice(_busta === null && scena.classList.contains('busta-via') && !scena.classList.contains('busta-viva'), 'la busta se ne va in dissolvenza', scena.className);
    bustaColpo();
    dice(_bustaColpi === 2, 'e i colpi sulla ceralacca non contano piu-', _bustaColpi);
    dice(_bustinaInCorso, 'finche- svanisce la pagina resta occupata');
    await respira(500);
    dice(!scena.classList.contains('sbustando') && !_bustinaInCorso, 'poi si torna alla pagina dei pacchetti', scena.className);
    dice(quante('hx_avvio') === 1, 'e quanti pacchetti ci sono si richiede al server', viste.join(','));
    dice(BUSTINE_VINTE === 0 && caselle('reward') === 0, 'che dice che quel reward non c-e-: non torna nella fila', BUSTINE_VINTE + ' / ' + caselle('reward'));
    dice(!bustaSolleva('reward', 900, 500), 'e non si puo- andare incontro allo stesso rifiuto una seconda volta');
    await respira(1300);
    dice(!scena.classList.contains('busta-apre') && inScena() === 0, 'e piu- tardi la busta non si apre da sola');
    chiudiAvviso();

    // ── 2. il server dice di no, ma il pacchetto c-e- ancora ──────────────
    PREFERENZE.bustinaProssima = LONTANO; BUSTINE_VINTE = 0; BUSTINE_TESORO = 1; pkDisegnaTutto();
    piano.hx_bustina_apri = rifiuto('non ci sono abbastanza carte sorteggiabili', 50);
    piano.hx_avvio = { dopo: 50, corpo: { bustineExtra: 0, bustineTesoro: 1, bustinaProssima: LONTANO } };
    dice(bustaSolleva('treasure', 900, 500), 'si prende in mano un treasure');
    bustaPosa();
    dice(BUSTINE_TESORO === 0, 'posato, si scala', BUSTINE_TESORO);
    await respira(650);
    dice(avviso().aperto && inScena() === 0, 'il server non lo apre: avviso, e niente carte');
    dice(BUSTINE_TESORO === 1 && caselle('treasure') === 1, 'e siccome per il server c-e- ancora, torna nella fila', BUSTINE_TESORO + ' / ' + caselle('treasure'));
    chiudiAvviso();

    // ── 3. il rifiuto arriva a sigillo gia- rotto ─────────────────────────
    PREFERENZE.bustinaProssima = LONTANO; BUSTINE_VINTE = 1; BUSTINE_TESORO = 0; pkDisegnaTutto();
    piano.hx_bustina_apri = rifiuto('non hai un pacchetto di tipo reward', 1500);
    piano.hx_avvio = { dopo: 20, corpo: { bustineExtra: 0, bustineTesoro: 0, bustinaProssima: LONTANO } };
    bustaSolleva('reward', 900, 500); bustaPosa();
    for(var k = 0; k < 5; k++) bustaColpo();
    dice(scena.classList.contains('busta-rotta'), 'si rompe il sigillo prima che il server risponda');
    await respira(1000);
    dice(!scena.classList.contains('busta-apre') && inScena() === 0, 'la busta aspetta la risposta invece di aprirsi');
    await respira(800);
    dice(avviso().aperto, 'arriva il rifiuto: avviso');
    dice(!scena.classList.contains('busta-apre') && !q('#pack-beam').classList.contains('firing') && inScena() === 0, 'e la busta non si apre: niente lampo, niente carte', scena.className);
    await respira(500);
    dice(!scena.classList.contains('sbustando') && !_bustinaInCorso && !scena.classList.contains('busta-rotta'), 'e si torna alla pagina, col sigillo intero', scena.className);
    chiudiAvviso();

    // ── 4. rete muta ─────────────────────────────────────────────────────
    PREFERENZE.bustinaProssima = 0; BUSTINE_VINTE = 0; BUSTINE_TESORO = 0; pkDisegnaTutto();
    piano.hx_bustina_apri = { dopo: 80, rete: false };
    piano.hx_avvio = { dopo: 20, rete: false };
    dice(bustaSolleva('daily', 900, 500), 'si prende in mano il pacchetto a tempo');
    bustaPosa();
    dice(!bustinaDailyPronta(), 'posato, l-attesa riparte subito');
    await respira(250);
    var a4 = avviso();
    dice(a4.aperto && a4.testo.indexOf('connection') !== -1, 'a rete muta l-avviso parla della connessione', a4.testo);
    dice(inScena() === 0 && !_bustaCarte, 'e non si pescano carte in locale', inScena());
    await respira(450);
    dice(bustinaDailyPronta() && PREFERENZE.bustinaProssima === 0, 'e il pacchetto a tempo non si e- consumato', PREFERENZE.bustinaProssima);
    dice(qa('#pk-daily .pk-slot.pk-pieno').length === 1, 'la sua casella e- di nuovo piena');
    chiudiAvviso();

    // ── 5. un-apertura vera ──────────────────────────────────────────────
    PREFERENZE.bustinaProssima = LONTANO; BUSTINE_VINTE = 1; BUSTINE_TESORO = 0; pkDisegnaTutto();
    var tre = (FINAL_CARDS || []).slice(0, 3).map(function(c){ return c.slug; });
    var prezzi = {}; tre.forEach(function(s){ prezzi[s] = 50; });
    dice(tre.length === 3, 'il catalogo offline ha tre carte da mettere nel pacchetto', tre.join(', '));
    piano.hx_bustina_apri = { dopo: 80, corpo: { carte: tre, ripresa: false, prezzi: prezzi, tipo: 'reward' } };
    viste.length = 0;
    bustaSolleva('reward', 900, 500); bustaPosa();
    await respira(200);
    dice(_bustinaDalServer && _bustaCarte && _bustaCarte.length === 3, 'col si- del server le carte arrivano');
    for(var k2 = 0; k2 < 5; k2++) bustaColpo();
    await respira(1000);
    dice(inScena() === 3 && scena.classList.contains('busta-apre'), 'e la busta si apre con quelle tre', inScena());
    dice(!avviso().aperto && quante('hx_avvio') === 0, 'senza avvisi e senza richiedere i pacchetti', viste.join(','));
    tornaAllaBustina();

    // ── 6. una busta lasciata ────────────────────────────────────────────
    PREFERENZE.bustinaProssima = LONTANO; BUSTINE_VINTE = 1; BUSTINE_TESORO = 0; pkDisegnaTutto();
    piano.hx_bustina_apri = rifiuto('non hai un pacchetto di tipo reward', 300);
    viste.length = 0;
    bustaSolleva('reward', 900, 500); bustaPosa();
    // La pagina torna indietro prima della risposta (lo fa il menu di debug
    // azzerando il timer, o rientrando nella pagina).
    tornaAllaBustina();
    BUSTINE_VINTE = 7;
    await respira(600);
    dice(!avviso().aperto && BUSTINE_VINTE === 7 && quante('hx_avvio') === 0, 'la risposta di una busta lasciata non apre avvisi e non tocca i contatori', 'avviso ' + avviso().aperto + ', reward ' + BUSTINE_VINTE + ', ' + viste.join(','));
  } catch(e){
    dice(false, 'il banco e- arrivato in fondo', e.message + ' ' + (e.stack || '').split('\\n')[1]);
  }
  return d.join('\\n');
})()`;

app.whenReady().then(async () => {
  setTimeout(() => { console.log('  NO  il banco non ha finito in tempo'); app.exit(2); }, 120000);
  const win = new BrowserWindow({ show:false, width:1920, height:1080, frame:false, useContentSize:true,
    webPreferences:{ contextIsolation:false, webSecurity:false, backgroundThrottling:false } });
  await win.loadURL(pathToFileURL(path.join(__dirname, '..', 'play', 'index.html')).href);
  win.setPosition(-3200, 0); win.showInactive();
  await new Promise(r => setTimeout(r, 10000));
  await win.webContents.insertCSS('#splash{display:none!important} #tutorial-overlay{display:none!important}');
  const esito = await win.webContents.executeJavaScript(CORPO);
  console.log(esito);
  const no = (esito.match(/^  NO  /gm) || []).length;
  const ok = (esito.match(/^  ok  /gm) || []).length;
  console.log('\n' + ok + ' ok, ' + no + ' NO');
  app.exit(no ? 1 : 0);
});
