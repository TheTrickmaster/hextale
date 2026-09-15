// GLI STICKER NEL CLIENT (v0.80.19).
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-sticker.js
//
// Figma "Battle Screen - Stickers" e le regole di Lorenzo (13 set 2026):
//   - l'icona sotto alle impostazioni, solo per chi gioca; cliccandola si apre
//     il menu "Send a sticker" con gli sticker di ui/sticker, che si illuminano al passaggio;
//   - v0.80.28: sei colonne e tre righe a vista, oltre una barra verticale;
//   - cliccando uno sticker il menu si chiude e compare sticker-bubble con lo
//     sticker in mezzo, per tre secondi, dal lato di chi l'ha mandato; la punta
//     sul centro dell'avatar, specchiata per il giocatore di sinistra; col suono;
//   - piu' di 5 in 10 secondi: bloccati 2 minuti, "Send a sticker (1:59)" o
//     "(7s)", sticker al 30%; vale solo dentro la partita;
//   - in rete lo sticker parte al server (op 14), quello dell'avversario arriva
//     (op 15) e si mostra dal suo lato, il blocco del server arriva (op 16);
//   - il menu si chiude con Esc e cliccando fuori; a fine partita l'icona sparisce.
const { app, BrowserWindow } = require('electron');
require('./dal-disco');   // v0.80.22 — gli asset di hextalegame.com dal disco, non dal sito
const path = require('path');
const fs = require('fs');

const RADICE = path.resolve(__dirname, '..');
// v0.80.28 — gli sticker che il gioco deve mostrare: i file della cartella.
const CARTELLA = fs.readdirSync(path.join(RADICE, 'ui', 'sticker')).filter(f => /^[a-z0-9]+(-[a-z0-9]+)*\.png$/.test(f)).map(f => f.slice(0, -4)).sort();
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  setTimeout(() => { console.log('  NO  il banco non ha finito in tempo'); app.exit(2); }, 150000);
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, frame: false, useContentSize: true,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await win.loadURL(PAGINA);
  win.setPosition(-3200, 0); win.showInactive();
  await new Promise(r => setTimeout(r, 14000));
  await win.webContents.insertCSS('#splash{display:none!important} #tutorial-overlay{display:none!important}');
  await win.webContents.executeJavaScript(`(function(){ try{ PARTITA_RETE = null; showPage('game'); startGame(true); return 'ok'; }catch(e){ return e.message; } })()`);
  await new Promise(r => setTimeout(r, 16000));

  const esito = await win.webContents.executeJavaScript(`(async function(){
    var CARTELLA = ${JSON.stringify(CARTELLA)};
    var d = [];
    var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
    var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
    var radice = document.getElementById('game-root').getBoundingClientRect(), k = radice.width / 1920;
    var r = function(el){ var b = el.getBoundingClientRect(); return { x:(b.left-radice.left)/k, y:(b.top-radice.top)/k, w:b.width/k, h:b.height/k }; };
    var vicino = function(a, b, t){ return Math.abs(a - b) <= (t === undefined ? 1 : t); };
    var tondo = function(v){ return Math.round(v * 10) / 10; };
    var centroAvatar = function(n){ var q = r(document.querySelector('#p' + n + '-info .player-avatar')); return { x: q.x + q.w / 2, y: q.y + q.h / 2 }; };
    try {
      G.gameOver = false;
      var suoni = [];
      var sfxVero = playSfxFile;
      playSfxFile = function(f){ suoni.push(f); try{ return sfxVero.apply(null, arguments); }catch(_){ } };

      // ── l'icona e il menu ──
      var btn = document.getElementById('sticker-btn');
      dice(getComputedStyle(btn).display !== 'none', 'in partita c-e- l-icona degli sticker');
      var rb = r(btn);
      var rs0 = r(document.getElementById('settings-btn'));
      dice(vicino(rs0.x, 369) && vicino(rs0.y, 30), 'le impostazioni a 369 (55 piu- a sinistra dei 424 di prima)', tondo(rs0.x) + ',' + tondo(rs0.y));
      dice(vicino(rb.x, 371) && vicino(rb.y, 119.74) && vicino(rb.w, 63) && vicino(rb.h, 63), 'sotto alle impostazioni, 63x63 (Figma)', tondo(rb.x) + ',' + tondo(rb.y) + ' ' + tondo(rb.w) + 'x' + tondo(rb.h));
      dice(btn.querySelector('img').naturalWidth > 0, 'con sticker-icon.png');
      btn.click();
      await respira(200);
      var menu = document.getElementById('sticker-menu');
      dice(menu.classList.contains('show'), 'cliccandola si apre il menu');
      var rm = r(menu);
      dice(vicino(rm.x, 351) && vicino(rm.y, 99.74) && vicino(rm.w, 928), 'il menu tiene l-icona dov-era: 928 di larghezza (sei colonne) con 20 di margine', tondo(rm.x) + ',' + tondo(rm.y) + ' ' + tondo(rm.w));
      var ri = r(menu.querySelector('.sticker-testa-icona'));
      dice(vicino(ri.x, rb.x) && vicino(ri.y, rb.y), 'l-icona del menu cade sopra all-icona');
      var titolo = document.getElementById('sticker-titolo');
      dice(titolo.textContent === 'Send a sticker' && getComputedStyle(titolo).fontSize === '30px', '"Send a sticker" a 30', titolo.textContent);
      var rt = r(titolo);
      dice(vicino(rt.x, ri.x + ri.w + 16) && rt.x + rt.w < rm.x + rm.w / 2, 'titolo allineato a sinistra, 16 dopo l-icona', tondo(rt.x) + ' (icona finisce a ' + tondo(ri.x + ri.w) + ')');
      var voci = [].slice.call(menu.querySelectorAll('.sticker-voce'));
      // v0.80.28 — gli sticker sono i file di ui/sticker, in ordine alfabetico
      // (strumenti/aggiorna-sticker.js), non piu- i cinque scritti a mano.
      dice(voci.length === CARTELLA.length && voci.map(function(v){ return v.dataset.sticker; }).join() === CARTELLA.join(), 'gli sticker sono quelli di ui/sticker (' + CARTELLA.length + '), in ordine alfabetico', voci.map(function(v){ return v.dataset.sticker; }).join());
      await respira(600);
      dice(voci.every(function(v){ var q = r(v); return vicino(q.w, 128) && vicino(q.h, 128) && v.querySelector('img').naturalWidth > 0; }), 'da 128, con le immagini di ui/sticker');
      dice(vicino(r(voci[1]).x - r(voci[0]).x - 128, 24), '24 fra uno e l-altro');
      var regolaHover = [].slice.call(document.styleSheets).some(function(s){ try{ return [].slice.call(s.cssRules).some(function(cr){ return cr.selectorText === '.sticker-voce:hover' && /drop-shadow/.test(cr.cssText) && /(250, 238, 210|#faeed2)/i.test(cr.cssText); }); }catch(_){ return false; } });
      dice(regolaHover, 'al passaggio si illumina (drop-shadow 0 0 10 #FAEED2)');

      // ── v0.80.28 — sei colonne, tre righe a vista, poi la barra (Lorenzo) ──
      var set = document.getElementById('sticker-set');
      dice(getComputedStyle(set).gridTemplateColumns.split(' ').length === 6, 'sei colonne da 128', getComputedStyle(set).gridTemplateColumns);
      dice(voci.length > 18 || !menu.classList.contains('scorre'), 'fino a diciotto sticker niente barra');
      var finte = [];
      for(var f = voci.length; f < 20; f++){ var cl = voci[0].cloneNode(true); cl.dataset.sticker = 'finto-' + f; set.appendChild(cl); finte.push(cl); }
      stickerAdattaSet();
      await respira(150);
      var tutte = [].slice.call(set.children), rset = r(set);
      dice(menu.classList.contains('scorre') && getComputedStyle(set).overflowY === 'auto', 'con venti sticker il set scorre in verticale');
      dice(vicino(r(tutte[6]).x, r(tutte[0]).x) && vicino(r(tutte[6]).y - r(tutte[0]).y, 152), 'il settimo va a capo, sotto al primo', tondo(r(tutte[6]).x) + ',' + tondo(r(tutte[6]).y - r(tutte[0]).y));
      dice(vicino(set.clientHeight, 452) && set.scrollHeight > set.clientHeight + 100, 'a vista tre righe (452 col respiro della luce), il resto sotto', set.clientHeight + ' / ' + set.scrollHeight);
      dice(set.scrollWidth <= set.clientWidth, 'niente scorrimento di lato: la sesta colonna non finisce sotto alla barra', set.scrollWidth + ' / ' + set.clientWidth);
      dice(set.offsetWidth - set.clientWidth >= 8 && set.classList.contains('hx-scorre'), 'la barra si vede, ed e- quella del gioco (hx-scorre)', set.offsetWidth - set.clientWidth);
      dice(vicino(r(menu).w, 948), 'il menu si allarga della barra', tondo(r(menu).w));
      set.scrollTop = 1000;
      await respira(80);
      dice(set.scrollTop > 0 && r(tutte[19]).y + r(tutte[19]).h <= rset.y + rset.h + 1, 'scorrendo si arriva all-ultimo', set.scrollTop);
      finte.forEach(function(x){ x.remove(); });
      set.scrollTop = 0;
      stickerAdattaSet();
      await respira(80);
      dice(!menu.classList.contains('scorre') && vicino(r(menu).w, 928), 'tolti, il menu torna senza barra e largo 928', tondo(r(menu).w));

      // ── mandare ──
      voci.filter(function(v){ return v.dataset.sticker === 'merlin-perfect'; })[0].click();
      await respira(250);
      dice(!menu.classList.contains('show'), 'cliccando uno sticker il menu si chiude');
      await respira(300);   // che la dissolvenza sia finita davvero, anche su una macchina carica
      var cm = getComputedStyle(menu);
      dice(cm.opacity === '0' && cm.visibility === 'hidden' && cm.pointerEvents === 'none', 'finita la dissolvenza e- trasparente, invisibile e senza clic', cm.opacity + ' ' + cm.visibility + ' ' + cm.pointerEvents);
      dice(/opacity 0\\.2s/.test(cm.transition), 'in dissolvenza di 200ms', cm.transition);
      // La finestra del banco sta fuori schermo e non disegna fotogrammi a
      // tempo: invece di campionare l-opacita- a meta-, si guarda che la
      // transizione sull-opacita- parta davvero, da 200ms, in tutti e due i versi.
      var sfuma = function(){ getComputedStyle(menu).opacity; return menu.getAnimations().filter(function(a){ return a.transitionProperty === 'opacity'; }).map(function(a){ return a.effect.getTiming().duration; }); };
      stickerApriMenu();
      var inApertura = sfuma();
      await respira(300);
      var cm2 = getComputedStyle(menu);
      dice(inApertura.length === 1 && Math.round(inApertura[0]) === 200 && cm2.opacity === '1' && cm2.visibility === 'visible' && cm2.pointerEvents === 'auto', 'e si riapre in dissolvenza di 200ms, fino a piena', JSON.stringify(inApertura) + ' -> ' + cm2.opacity);
      stickerChiudiMenu();
      var inChiusura = sfuma();
      dice(inChiusura.length === 1 && Math.round(inChiusura[0]) === 200 && getComputedStyle(menu).visibility === 'visible', 'anche la chiusura sfuma in 200ms (e intanto si vede)', JSON.stringify(inChiusura));
      await respira(300);
      var sx = document.getElementById('sticker-bolla-sinistra');
      dice(sx.classList.contains('show') && sx.dataset.sticker === 'merlin-perfect', 'e compare la bolla con lo sticker scelto', sx.dataset.sticker);
      dice(/sticker\\/merlin-perfect\\.png/.test(sx.querySelector('.sticker-bolla-img').src), 'l-immagine e- quella dello sticker');
      dice(/matrix\\(-1/.test(getComputedStyle(sx.querySelector('.sticker-bolla-fondo')).transform), 'per chi gioca a sinistra la bolla e- specchiata');
      var io = _goIoSono(), ca = centroAvatar(io), rs = r(sx);
      dice(vicino(rs.x + 1, ca.x, 1.5) && vicino(rs.y + 36, ca.y, 1.5), 'la punta sta sul centro del mio avatar', 'punta ' + tondo(rs.x + 1) + ',' + tondo(rs.y + 36) + ' avatar ' + tondo(ca.x) + ',' + tondo(ca.y));
      await respira(400);   // l-entrata elastica e- una scala: si misura a molla ferma
      var img = r(sx.querySelector('.sticker-bolla-img'));
      dice(vicino(img.w, 161) && vicino(img.x - rs.x, 180) && vicino(img.y - rs.y, 27), 'lo sticker da 161 nel corpo della bolla', tondo(img.x - rs.x) + ',' + tondo(img.y - rs.y));
      dice(suoni.indexOf('sticker.mp3') < 0, 'senza suono (Lorenzo: troppo spammy)', suoni.join(','));
      await respira(3500);
      dice(!sx.classList.contains('show'), 'dopo tre secondi se ne va');

      // ── il limite ──
      stickerNuovaPartita();
      for(var i = 0; i < 5; i++) stickerManda('frog-prince-okay');
      dice(_stickerBloccatoFino <= performance.now(), 'cinque di fila passano');
      stickerApriMenu();
      stickerManda('frog-prince-okay');
      await respira(300);
      dice(_stickerBloccatoFino - performance.now() > 115000, 'il sesto entro dieci secondi blocca per due minuti');
      dice(menu.classList.contains('show') && menu.classList.contains('bloccato'), 'il menu resta aperto e dice che si e- bloccati');
      dice(/^Send a sticker \\((2:00|1:59)\\)$/.test(titolo.textContent), 'accanto al titolo quanto manca', titolo.textContent);
      dice(getComputedStyle(voci[0]).opacity === '0.3', 'e gli sticker sono trasparenti al 30%', getComputedStyle(voci[0]).opacity);
      stickerNascondiBolle();
      voci[4].click();
      await respira(200);
      dice(!document.getElementById('sticker-bolla-sinistra').classList.contains('show'), 'bloccati, cliccare non manda niente');
      _stickerBloccatoFino = performance.now() + 7000;
      stickerAggiornaBlocco();
      dice(titolo.textContent === 'Send a sticker (7s)', 'sotto il minuto si conta in secondi', titolo.textContent);

      // ── Esc e clic fuori ──
      document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
      await respira(100);
      dice(!menu.classList.contains('show'), 'Esc chiude il menu');
      stickerApriMenu();
      document.getElementById('board-svg') ? document.getElementById('board-svg').dispatchEvent(new PointerEvent('pointerdown', { bubbles:true })) : document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true }));
      await respira(100);
      dice(!menu.classList.contains('show'), 'un clic fuori chiude il menu');

      // ── in rete ──
      stickerNuovaPartita();
      var partiti = [], mmVero = mmManda;
      mmManda = function(x){ partiti.push(x); };
      PARTITA_RETE = { matchId:'partita-prova', io:1 };
      stickerManda('queen-of-hearts-angry');
      var p0 = partiti[0] && partiti[0].match_data_send;
      dice(p0 && p0.op_code === 14 && p0.match_id === 'partita-prova' && JSON.parse(atob(p0.data)).sticker === 'queen-of-hearts-angry', 'in rete lo sticker parte al server (op 14)', p0 && JSON.stringify(p0));
      var dx = document.getElementById('sticker-bolla-destra');
      reteMessaggio({ op_code:15, data: btoa(JSON.stringify({ di:2, sticker:'bagheera-scared' })) });
      await respira(150);
      var cb = centroAvatar(2), rd = r(dx);
      dice(dx.classList.contains('show') && dx.dataset.sticker === 'bagheera-scared', 'quello dell-avversario (op 15) compare dal suo lato');
      dice(!/matrix\\(-1/.test(getComputedStyle(dx.querySelector('.sticker-bolla-fondo')).transform) && vicino(rd.x + 359, cb.x, 1.5) && vicino(rd.y + 36, cb.y, 1.5), 'non specchiata, con la punta sul centro del suo avatar', 'punta ' + tondo(rd.x + 359) + ',' + tondo(rd.y + 36) + ' avatar ' + tondo(cb.x) + ',' + tondo(cb.y));
      var giaMia = document.getElementById('sticker-bolla-sinistra').dataset.sticker;
      reteMessaggio({ op_code:15, data: btoa(JSON.stringify({ di:1, sticker:'carabosse-menacing' })) });
      dice(document.getElementById('sticker-bolla-sinistra').dataset.sticker === giaMia, 'il mio che torna dal server non si ridisegna (l-ho gia- mostrato)');
      reteMessaggio({ op_code:16, data: btoa(JSON.stringify({ resta:5000 })) });
      stickerApriMenu();
      dice(titolo.textContent === 'Send a sticker (5s)' && menu.classList.contains('bloccato'), 'il blocco detto dal server (op 16) si vede', titolo.textContent);
      stickerChiudiMenu();
      mmManda = mmVero; PARTITA_RETE = null;

      // ── io sono il 2: il mio avatar e- a sinistra lo stesso ──
      stickerNuovaPartita();
      document.body.classList.add('io-sono-2'); G.ioSonoIlNumero = 2;
      await respira(100);
      stickerMostra(2, 'merlin-perfect');
      var s2 = r(document.getElementById('sticker-bolla-sinistra')), c2 = centroAvatar(2);
      dice(document.getElementById('sticker-bolla-sinistra').classList.contains('show') && vicino(s2.x + 1, c2.x, 1.5) && c2.x < 960, 'da giocatore 2 il mio sticker va comunque a sinistra, sul mio avatar', tondo(s2.x + 1) + ' / ' + tondo(c2.x));
      document.body.classList.remove('io-sono-2'); G.ioSonoIlNumero = 1;
      stickerNascondiBolle();

      // ── fine partita e partita nuova ──
      _stickerBloccatoFino = performance.now() + 60000;
      stickerApriMenu();
      stickerFinePartita();
      dice(getComputedStyle(btn).display === 'none' && !menu.classList.contains('show'), 'a fine partita l-icona sparisce e il menu si chiude');
      stickerNuovaPartita();
      dice(_stickerBloccatoFino === 0 && _stickerInvii.length === 0, 'una partita nuova non si porta dietro il blocco');
      playSfxFile = sfxVero;
    } catch(err){ dice(false, 'il banco e- arrivato in fondo', err.message + ' ' + String(err.stack || '').split('\\n')[1]); }
    return d.join('\\n');
  })()`);
  console.log(esito);
  const no = (esito.match(/^  NO  /gm) || []).length;
  const ok = (esito.match(/^  ok  /gm) || []).length;
  console.log('\n' + ok + ' ok, ' + no + ' NO');
  app.exit(no ? 1 : 0);
});
