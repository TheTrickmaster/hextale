// LE PAGINE ENTRANO ED ESCONO, LA STANZA RESTA (v0.80.20).
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-transizioni.js
//
// Lorenzo: cambiando pagina gli elementi escono dallo schermo o svaniscono in
// 200ms, e quelli della pagina nuova entrano o compaiono in 200ms:
//   - main menu: top bar su/giu, colonne ai lati fuori/dentro, il centro svanisce
//     e ricompare prima la barra mazzo e ranking, 50ms dopo le modalita', poco
//     dopo la barra in basso;
//   - library & decks: top bar, colonna dei mazzi a destra, carte in
//     dissolvenza, barra di ricerca in basso;
//   - card packs: top bar, i due riquadri ai lati, la barra in basso;
//   - lo sfondo e' lo stesso per tutte (quello del menu anche sulla library) e
//     non cambia, non sparisce e non riappare.
// Qui si guardano le animazioni vere (getAnimations), da che parte vanno, con
// che ritardi, e che il fondale sia sempre lo stesso elemento acceso.
const { app, BrowserWindow } = require('electron');
require('./dal-disco');   // v0.80.22 — gli asset di hextalegame.com dal disco, non dal sito
const path = require('path');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  try {
    var q = function(s){ return document.querySelector(s); };
    // Le animazioni della transizione: quelle fatte con el.animate, non le CSS.
    var anim = function(sel){ var el = q(sel); if(!el) return null; var tutte = el.getAnimations().filter(function(a){ return !(a instanceof CSSAnimation) && !(a instanceof CSSTransition); }); return tutte[tutte.length - 1] || null; };
    var kf = function(a){ return a ? a.effect.getKeyframes() : []; };
    var xy = function(t){ var p = String(t || '').split(/\\s+/).map(parseFloat); return { x: p[0] || 0, y: p[1] || 0 }; };
    var descrivi = function(a){ if(!a) return 'nessuna'; var k = kf(a); return JSON.stringify(k.map(function(f){ return f.translate || f.opacity; })) + ' ritardo ' + a.effect.getTiming().delay; };
    // da che parte va un pezzo: guardando il fotogramma "fuori" (l-ultimo se esce, il primo se entra)
    var lato = function(a, esce){ var k = kf(a); if(!k.length) return '?'; var f = esce ? k[k.length - 1] : k[0];
      if(f.opacity !== undefined && f.translate === undefined) return Number(f.opacity) === 0 ? 'sfuma' : '?';
      var p = xy(f.translate); if(p.y < -50) return 'su'; if(p.y > 50) return 'giu'; if(p.x < -50) return 'sinistra'; if(p.x > 50) return 'destra'; return '?'; };
    var ritardo = function(a){ return a ? a.effect.getTiming().delay : -1; };
    var stanza = q('#stanza');
    var accesa = function(){ return !!(stanza && stanza.isConnected && stanza.classList.contains('accesa') && getComputedStyle(stanza).display !== 'none'); };
    var montato = function(id){ return !!document.getElementById(id); };
    // v0.80.22 — un pezzo che entra parte quando i suoi asset sono pronti (vedi
    // _entraQuandoPronti): la sua animazione si aspetta, fino a un secondo e mezzo.
    var controllaPezzi = async function(nome, attesi, esce){
      for(var i = 0; i < attesi.length; i++){
        var a = anim(attesi[i][0]);
        var da = performance.now();
        while(!esce && !a && performance.now() - da < 1500){ await respira(30); a = anim(attesi[i][0]); }
        dice(a && lato(a, esce) === attesi[i][1] && ritardo(a) === (attesi[i][2] || 0) && Math.round(a.effect.getTiming().duration) === 200,
          nome + ': ' + attesi[i][0] + ' ' + (esce ? 'esce' : 'entra') + ' ' + attesi[i][1] + (attesi[i][2] ? ' dopo ' + attesi[i][2] + 'ms' : '') + ' in 200ms', descrivi(a));
      }
    };

    apriMenuPrincipale();
    await respira(2500);
    dice(accesa(), 'nel menu la stanza e- accesa');
    dice(getComputedStyle(q('#mm2-bg')).display === 'none' && /main-menu-bg\\.jpg/.test(getComputedStyle(q('#stanza-bg')).backgroundImage), 'il fondale e- quello della stanza (main-menu-bg), non piu- quello del menu');
    dice(!!(_scenaMenu.strati && _scenaMenu.strati.length === 3), 'e la sua polvere gira');
    var luce = q('#stanza-lit').getAnimations()[0];
    var strati = _scenaMenu.strati;
    var misuraPrima = { topbar: q('#mm2-topbar').getBoundingClientRect().top };

    // ── MENU -> LIBRARY ─────────────────────────────────────────────────────
    openCardDbOverlay();
    dice(montato('main-menu') && q('#main-menu').classList.contains('pagina-esce'), 'aprendo la library il menu resta a uscire, senza clic');
    dice(montato('card-db-overlay') && q('#card-db-overlay').classList.contains('pagina-attende') && getComputedStyle(q('#card-db-overlay')).opacity === '0', 'e la library e- gia- montata ma aspetta invisibile');
    await controllaPezzi('menu', [['#mm2-topbar','su'],['#mm2-sx','sinistra'],['#mm2-dx','destra'],['#mm2-testata','sfuma'],['#mm2-modi','sfuma'],['#mm2-gioca','sfuma',50],['#mm2-basso','sfuma',50]], true);
    var fuoriTop = xy(kf(anim('#mm2-topbar')).slice(-1)[0].translate).y;
    dice(fuoriTop <= -(102 + 20), 'la top bar sale di tutta la sua altezza (esce dallo schermo)', fuoriTop);
    var centroFind = q('#mm2-find').getBoundingClientRect();
    var sotto = document.elementFromPoint(centroFind.left + centroFind.width / 2, centroFind.top + centroFind.height / 2);
    dice(!(sotto && sotto.closest && sotto.closest('#main-menu, #card-db-overlay')), 'mentre esce, un clic sul menu non prende niente', sotto && (sotto.id || sotto.className));
    // La finestra del banco sta fuori schermo e non disegna fotogrammi a tempo:
    // invece di campionare la posizione a meta' si guarda che l-uscita corra.
    dice(anim('#mm2-topbar') && anim('#mm2-topbar').playState === 'running', 'l-uscita della top bar e- partita', anim('#mm2-topbar') && anim('#mm2-topbar').playState);
    await respira(120);
    dice(accesa() && q('#stanza') === stanza, 'intanto la stanza non si tocca');
    await respira(200);
    dice(!montato('main-menu'), 'finita l-uscita il menu si smonta');
    dice(!q('#card-db-overlay').classList.contains('pagina-attende') && q('#card-db-overlay').classList.contains('show'), 'e la library appare');
    await controllaPezzi('library', [['#card-db-header','su'],['#card-db-right','destra'],['#card-db-grid-viewport','sfuma'],['#card-db-barra-cerca','giu']], false);
    dice(getComputedStyle(q('#card-db-bg')).display === 'none', 'la library non ha piu- il suo fondale: sotto c-e- la stanza');
    dice(accesa() && q('#stanza-lit').getAnimations()[0] === luce && _scenaMenu.strati === strati, 'la stanza e- sempre la stessa: lanterna e polvere non ripartono');
    var finoA = performance.now();
    while(transizioneInCorso() && performance.now() - finoA < 3000) await respira(50);
    await respira(60);
    dice(!transizioneInCorso() && getComputedStyle(q('#card-db-header')).translate === 'none' && getComputedStyle(q('#card-db-grid-viewport')).opacity === '1', 'finita l-entrata tutto e- al suo posto', getComputedStyle(q('#card-db-header')).translate);
    var menuStaccato = _pageDetached.get('main-menu');
    dice(menuStaccato && !menuStaccato.classList.contains('pagina-esce'), 'il menu smontato non si porta dietro il segno dell-uscita');

    // ── LIBRARY -> MENU ─────────────────────────────────────────────────────
    closeCardDbOverlay();
    dice(montato('card-db-overlay') && q('#card-db-overlay').classList.contains('pagina-esce') && q('#card-db-overlay').classList.contains('show'), 'chiudendo la library esce animata (resta visibile mentre esce)');
    await controllaPezzi('library', [['#card-db-header','su'],['#card-db-right','destra'],['#card-db-grid-viewport','sfuma'],['#card-db-barra-cerca','giu']], true);
    await respira(320);
    dice(!montato('card-db-overlay') && montato('main-menu') && !q('#main-menu').classList.contains('pagina-attende'), 'poi si smonta e il menu appare');
    await controllaPezzi('menu', [['#mm2-topbar','su'],['#mm2-sx','sinistra'],['#mm2-dx','destra'],['#mm2-testata','sfuma'],['#mm2-modi','sfuma',50],['#mm2-gioca','sfuma',100],['#mm2-basso','sfuma',100]], false);
    dice(getComputedStyle(q('#mm2-modi')).opacity === '0' && getComputedStyle(q('#mm2-gioca')).opacity === '0', 'le modalita- e la barra in basso aspettano il loro turno (ancora invisibili)');
    await respira(500);
    dice(!transizioneInCorso() && getComputedStyle(q('#mm2-gioca')).opacity === '1' && Math.abs(q('#mm2-topbar').getBoundingClientRect().top - misuraPrima.topbar) < 1, 'finita l-entrata il menu e- com-era', getComputedStyle(q('#mm2-gioca')).opacity);
    dice(accesa() && q('#stanza-lit').getAnimations()[0] === luce && _scenaMenu.strati === strati, 'e la stanza non si e- mai spenta');

    // ── MENU -> CARD PACKS -> MENU ──────────────────────────────────────────
    openPackOverlay();
    await respira(260);
    dice(!montato('main-menu') && montato('pack-overlay'), 'card packs entra dopo l-uscita del menu');
    await controllaPezzi('card packs', [['#pack-header','su'],['#pack-ink-fisso','sinistra'],['#pack-compra-box','destra'],['#pack-basso','giu'],['#pack-stage','sfuma']], false);
    dice(getComputedStyle(q('#pack-bg')).display === 'none' && accesa() && _scenaMenu.strati === strati, 'anche card packs sta nella stessa stanza');
    await respira(500);
    closePackOverlay();
    await controllaPezzi('card packs', [['#pack-header','su'],['#pack-ink-fisso','sinistra'],['#pack-compra-box','destra'],['#pack-basso','giu']], true);
    await respira(700);
    dice(montato('main-menu') && !montato('pack-overlay') && !transizioneInCorso(), 'e si torna al menu');

    // ── v0.80.22: UN PEZZO ENTRA SOLO CON I SUOI ASSET PRONTI ────────────────
    var testata = _pageDetached.get('card-db-overlay') && _pageDetached.get('card-db-overlay').querySelector('#card-db-header');
    var sblocca = null;
    var lento = document.createElement('span');
    lento.__assetPronto = new Promise(function(r){ sblocca = r; });
    if(testata) testata.appendChild(lento);
    openCardDbOverlay();
    await respira(480);
    dice(montato('card-db-overlay') && q('#card-db-header').classList.contains('pezzo-attende') && getComputedStyle(q('#card-db-header')).opacity === '0', 'la top bar della library aspetta un suo asset: resta nascosta');
    dice(!q('#card-db-right').classList.contains('pezzo-attende'), 'mentre i pezzi con gli asset pronti entrano');
    sblocca();
    await respira(80);
    var entrataTop = anim('#card-db-header');
    dice(!q('#card-db-header').classList.contains('pezzo-attende') && entrataTop && lato(entrataTop, false) === 'su', 'arrivato l-asset, la top bar entra', descrivi(entrataTop));
    lento.remove();
    await respira(700);
    closeCardDbOverlay();
    await respira(900);
    var testata2 = _pageDetached.get('card-db-overlay').querySelector('#card-db-header');
    var mai = document.createElement('span');
    mai.__assetPronto = new Promise(function(){});
    testata2.appendChild(mai);
    openCardDbOverlay();
    await respira(2500);
    dice(q('#card-db-header').classList.contains('pezzo-attende'), 'un asset che non arriva la tiene nascosta...');
    await respira(2200);
    dice(!q('#card-db-header').classList.contains('pezzo-attende') && getComputedStyle(q('#card-db-header')).opacity !== '0', '...ma solo fino al tetto di ' + ASSET_ATTESA_MAX_MS + 'ms: poi entra lo stesso');
    mai.remove();
    closeCardDbOverlay();
    await respira(900);

    // ── CAMBI DI PAGINA A RAFFICA ───────────────────────────────────────────
    showPage('collection');
    showPage('packs');
    showPage('mainmenu');
    showPage('collection');
    await respira(800);
    var segni = document.querySelectorAll('.pagina-esce, .pagina-attende').length;
    dice(montato('card-db-overlay') && !montato('main-menu') && !montato('pack-overlay') && segni === 0 && !transizioneInCorso(), 'quattro cambi di fila: resta solo l-ultima pagina, senza pezzi a meta-', 'segni ' + segni);
    showPage('mainmenu');
    await respira(700);

    // ── PARTITA ─────────────────────────────────────────────────────────────
    showPage('game');
    dice(!montato('main-menu') && !accesa() && !_scenaMenu.strati, 'verso la partita il cambio e- secco, e la stanza con la sua polvere si spegne');
    showPage('mainmenu');
    dice(montato('main-menu') && !q('#main-menu').classList.contains('pagina-attende'), 'tornando dalla partita il menu non aspetta nessuna uscita');
    await respira(30);
    dice(anim('#mm2-topbar') && lato(anim('#mm2-topbar'), false) === 'su' && accesa(), 'ma entra animato, nella stanza riaccesa');
    await respira(600);
  } catch(err){ dice(false, 'il banco e- arrivato in fondo', err.message + ' ' + String(err.stack || '').split('\\n')[1]); }
  return d.join('\\n');
})()`;

app.whenReady().then(async () => {
  setTimeout(() => { console.log('  NO  il banco non ha finito in tempo'); app.exit(2); }, 120000);
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, frame: false, useContentSize: true,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await win.loadURL(PAGINA);
  win.setPosition(-3200, 0); win.showInactive();
  await new Promise(r => setTimeout(r, 14000));
  await win.webContents.insertCSS('#splash{display:none!important} #tutorial-overlay{display:none!important}');
  const esito = await win.webContents.executeJavaScript(CORPO);
  console.log(esito);
  const no = (esito.match(/^  NO  /gm) || []).length;
  const ok = (esito.match(/^  ok  /gm) || []).length;
  console.log('\n' + ok + ' ok, ' + no + ' NO');
  app.exit(no ? 1 : 0);
});
