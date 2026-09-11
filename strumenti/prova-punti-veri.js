// I PUNTI SI INCASSANO TUTTI, E LA MUSICA DI FINE PARTITA E' QUELLA GIUSTA.
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-punti-veri.js
//
// Segnalazione di Lorenzo (v0.80.1): "a volte suona la musica di vittoria se
// si perde e di sconfitta se si vince".
// La causa: due colpi ravvicinati aprivano UNA bolla del punteggio e la
// chiudevano due volte; la seconda chiusura trovava la bolla sparita e usciva
// senza incassare. Due colpi da 3 e 4 a 300ms davano 3 punti invece di 7. E i
// punti — G.hp — decidevano il vincitore, il titolo, la musica e il racconto
// mandato al server.
// Adesso i punti veri (G.puntiFatti) si scrivono nell'istante in cui vengono
// assegnati, i contatori del ritratto girano in fila, e la fine partita legge
// i punti veri.
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
    await respira(400);
    fermaIlConto();
    dice(!!G.puntiFatti && G.puntiFatti[1] === 0 && G.puntiFatti[2] === 0, 'una partita nuova parte coi punti veri a zero');
    var aSchermo = function(p){ var el = document.querySelector('#p' + p + '-info .player-hp-value'); return el ? Number(el.textContent) : NaN; };
    var colpi = async function(player, passi){
      G.hp = {1:0, 2:0}; G.puntiFatti = {1:0, 2:0};
      var tot = 0;
      for(var i=0;i<passi.length;i++){
        if(passi[i].dopo) await respira(passi[i].dopo);
        assegnaPunti(player, passi[i].punti); tot += passi[i].punti;
      }
      var subito = G.puntiFatti[player];
      await respira(6000);
      return { tot: tot, subito: subito, hp: G.hp[player], schermo: aSchermo(player) };
    };

    // ── i colpi ravvicinati ─────────────────────────────────────────
    var r = await colpi(1, [{punti:3},{punti:4, dopo:300}]);
    dice(r.subito === 7, 'due colpi a 300ms: i punti veri sono 7 subito', r.subito);
    dice(r.hp === 7 && r.schermo === 7, 'e a conto finito il ritratto dice 7', r.hp + ' / ' + r.schermo);
    r = await colpi(2, [{punti:2},{punti:5, dopo:450},{punti:1, dopo:450}]);
    dice(r.hp === 8 && r.schermo === 8 && r.subito === 8, 'tre colpi a 450ms: 8 dappertutto', r.subito + ' / ' + r.hp + ' / ' + r.schermo);
    r = await colpi(1, [{punti:6}]);
    dice(r.hp === 6 && r.schermo === 6, 'un colpo solo, come sempre', r.hp);

    // ── l'onda di fine turno scrive subito ──────────────────────────
    G.hp = {1:0, 2:0}; G.puntiFatti = {1:0, 2:0};
    ondataDanno(2, [{k:'0,0', punti:2}, {k:'1,0', punti:3}], function(){});
    dice(G.puntiFatti[2] === 5, 'l-onda di fine turno scrive i punti veri subito', G.puntiFatti[2]);
    await respira(4000);
    dice(G.hp[2] === 5, 'e il contatore arriva allo stesso numero', G.hp[2]);

    // ── la fine partita legge i punti veri ─────────────────────────
    var suoni = [];
    var veroSuono = playSfxFile;
    window.playSfxFile = function(nome){ suoni.push(nome); return null; };
    var veroRiferisci = window.riferisciPartita;
    window.riferisciPartita = function(){};
    var fine = async function(mio, suo, ioSono){
      suoni.length = 0;
      G.gameOver = true; G.ioSonoIlNumero = ioSono || 1;
      // il contatore e- ancora indietro: G.hp dice il contrario dei punti veri
      G.hp = { 1: 0, 2: 0 };
      G.puntiFatti = ioSono === 2 ? { 1: suo, 2: mio } : { 1: mio, 2: suo };
      G.hp[ioSono === 2 ? 1 : 2] = 99;
      finishGameWithResult();
      await respira(700);
      return suoni.filter(function(s){ return /end-game/.test(s); }).join(',');
    };
    dice(await fine(10, 7) === 'end-game-win.mp3', 'vinco coi punti veri anche se il contatore dice il contrario: musica di vittoria');
    dice(/ wins!/.test(document.getElementById('gameover-title-text').textContent), 'e il titolo lo dice', document.getElementById('gameover-title-text').textContent);
    dice(await fine(4, 9) === 'end-game-loss.mp3', 'perdo: musica di sconfitta');
    dice(await fine(12, 5, 2) === 'end-game-win.mp3', 'in rete da numero due, vinco: musica di vittoria');
    dice(await fine(5, 12, 2) === 'end-game-loss.mp3', 'in rete da numero due, perdo: musica di sconfitta');
    document.getElementById('gameover').classList.remove('show');
    window.playSfxFile = veroSuono; window.riferisciPartita = veroRiferisci;

    // ── il racconto al server usa i punti veri ─────────────────────
    var mandato = null;
    var veroManda = mmManda;
    window.mmManda = function(m){ if(m.match_data_send && m.match_data_send.op_code === 7) mandato = JSON.parse(atob(m.match_data_send.data)); };
    PARTITA_RETE = { matchId:'prova', io:1, numeroTurno:5 };
    G.hp = {1:1, 2:1}; G.puntiFatti = {1:14, 2:11};
    reteMandaImpronta(true);
    PARTITA_RETE = null; window.mmManda = veroManda;
    dice(!!mandato && mandato.hp[1] === 14 && mandato.hp[2] === 11, 'il racconto di fine partita porta i punti veri', mandato && JSON.stringify(mandato.hp));
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
