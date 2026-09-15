// LA BARRA DELL'ESPERIENZA AL CAMBIO DI LIVELLO (v0.80.29).
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-v08029.js
//
// Lorenzo: "la barra di livello, quando si fa lvl up, per svuotarsi torna
// indietro. Sembra un errore. quando si riempie dovrebbe ripartire
// istantaneamente da zero". Qui mm2MostraGuadagno con un livello guadagnato, e
// un osservatore sulla maschera che segna ogni larghezza insieme alle
// transizioni che partono. La finestra sta fuori schermo e non disegna a tempo:
// invece di campionare la larghezza a meta', si guardano le transizioni create.
//   1. la barra si riempie fino in fondo e resta a riempirsi il tempo della
//      transizione (1,1 s);
//   2. poi va a zero di colpo: nessuna transizione sulla larghezza, e la
//      larghezza calcolata e' gia' zero;
//   3. da zero risale al valore nuovo, con la transizione in avanti;
//   4. la transizione della barra torna quella del CSS, e livello e testo sono i nuovi.
const { app, BrowserWindow } = require('electron');
require('./dal-disco');   // gli asset di hextalegame.com dal disco, non dal sito
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  setTimeout(() => { console.log('  NO  il banco non ha finito in tempo'); app.exit(2); }, 120000);
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, frame: false, useContentSize: true,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await win.loadURL(PAGINA);
  win.setPosition(-3200, 0); win.showInactive();
  await new Promise(r => setTimeout(r, 14000));
  await win.webContents.insertCSS('#splash{display:none!important} #tutorial-overlay{display:none!important}');

  const esito = await win.webContents.executeJavaScript(`(async function(){
    var d = [];
    var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
    var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
    try {
      showPage('mainmenu');
      await respira(1500);
      var mask = document.getElementById('mm2-xp-mask');
      dice(mask && mask.getClientRects().length > 0, 'la barra dell-esperienza e- a schermo (le transizioni partono solo su cio- che si vede)');
      PROFILO_STAGIONE = Object.assign({}, PROFILO_STAGIONE || {}, { livello: 3, xp: 20, rank: 0 });
      // si parte da una barra ferma a 120/150 del livello 2
      mask.style.transition = 'none'; mm2AggiornaXp(120, 150); void mask.offsetWidth; mask.style.transition = '';
      var larghezze = function(){
        return mask.getAnimations().filter(function(a){ return a.transitionProperty === 'width'; })
          .map(function(a){ var k = a.effect.getKeyframes(); return [parseFloat(k[0].width), parseFloat(k[k.length - 1].width)]; });
      };
      var segni = [], t0 = performance.now();
      var oss = new MutationObserver(function(){
        segni.push({ t: performance.now() - t0, w: mask.style.width, px: parseFloat(getComputedStyle(mask).width), tr: larghezze() });
      });
      oss.observe(mask, { attributes: true, attributeFilter: ['style'] });
      _daMostrareDopoPartita = { prima: { xp: 120, xpPerSalire: 150, livello: 2 }, profilo: { livello: 3, xp: 20, rank: 0 }, salito: false };
      await mm2MostraGuadagno();
      await respira(200);
      oss.disconnect();
      var elenco = segni.map(function(s){ return Math.round(s.t) + 'ms:' + s.w + ' ' + JSON.stringify(s.tr); }).join(' | ');
      // (il browser riscrive "100.0%" come "100%": si confrontano i numeri)
      var pieno = segni.filter(function(s){ return parseFloat(s.w) === 100; })[0];
      var zero = segni.filter(function(s){ return parseFloat(s.w) === 0; })[0];
      var dopo = zero && segni.filter(function(s){ return s.t > zero.t && parseFloat(s.w) !== 0; })[0];
      dice(pieno && pieno.tr.length === 1 && pieno.tr[0][1] > pieno.tr[0][0], 'la barra sale fino in fondo, con la sua transizione', elenco);
      dice(pieno && zero && zero.t > pieno.t, 'e poi riparte da zero', elenco);
      dice(pieno && zero && zero.t - pieno.t >= 1050, 'si azzera solo dopo il tempo della salita (1,1 s)', pieno && zero && Math.round(zero.t - pieno.t) + 'ms');
      dice(zero && zero.tr.length === 0 && zero.px < 1, 'a zero ci va di colpo: nessuna transizione all-indietro, larghezza gia- 0', zero && (JSON.stringify(zero.tr) + ' ' + zero.px + 'px'));
      dice(dopo && parseFloat(dopo.w) === 10 && dopo.tr.length === 1 && dopo.tr[0][0] < 1 && dopo.tr[0][1] > dopo.tr[0][0], 'da zero risale a 20/200, in avanti', dopo && (dopo.w + ' ' + JSON.stringify(dopo.tr)));
      dice(mask.style.transition === '' && /width 1\\.1s/.test(getComputedStyle(mask).transition), 'la transizione della barra torna quella del CSS', getComputedStyle(mask).transition);
      dice(document.getElementById('mm2-livello').textContent === '3' && document.getElementById('mm2-xp-testo').textContent === '20/200 XP', 'livello 3, 20/200 XP', document.getElementById('mm2-livello').textContent + ' ' + document.getElementById('mm2-xp-testo').textContent);
    } catch(err){ dice(false, 'il banco e- arrivato in fondo', err.message + ' ' + String(err.stack || '').split('\\n')[1]); }
    return d.join('\\n');
  })()`);
  console.log(esito);
  const no = (esito.match(/^  NO  /gm) || []).length;
  const ok = (esito.match(/^  ok  /gm) || []).length;
  console.log('\n' + ok + ' ok, ' + no + ' NO');
  app.exit(no ? 1 : 0);
});
