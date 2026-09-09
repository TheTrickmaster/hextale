// Il banco della cascata d'ingresso della Libreria.
//
//   npx electron strumenti/prova-cascata.js
//
// Le carte entrano una dopo l'altra: dissolvenza breve, cinquanta millisecondi
// di distacco. Tre cose vanno guardate, e nessuna delle tre si vede a occhio
// senza fermare il tempo:
//   1. che il RITARDO cresca davvero di 50ms per carta, e non che siano tutte
//      uguali (un errore di indice qui si vede solo come "entrano insieme");
//   2. che durante l'attesa la carta sia a ZERO — e' il fill:'backwards'. Senza,
//      compaiono tutte subito e poi rifanno la dissolvenza, che e' peggio di
//      non averla;
//   3. che le caselle NASCOSTE da un filtro non si prendano il proprio turno,
//      o la fila avrebbe buchi di cinquanta millisecondi in cui non entra
//      niente.
//
// E che NON si rigiochi a ogni ridisegno: ordinare o filtrare sono gesti in
// cui si confronta qualcosa, e cinque secondi e mezzo di cascata li' dentro
// sarebbero un'attesa.
const { app, BrowserWindow } = require('electron');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var cascate = function(){
    var fuori = [];
    document.querySelectorAll('#card-db-grid .card-db-card-slot').forEach(function(s){
      s.getAnimations().forEach(function(a){ if(a.id === 'cascata') fuori.push({ slot:s, a:a }); });
    });
    return fuori;
  };
  try {
    var sp = document.getElementById('splash'); if(sp) sp.remove();
    CARTE_POSSEDUTE = {};
    (FINAL_CARDS||[]).forEach(function(c){ CARTE_POSSEDUTE[c.slug] = 4; });
    _possessoNoto = true;
    showPage('collection');
    var ov = document.getElementById('card-db-overlay');
    if(ov) ov.classList.add('show');
    try{ montaGraficaLibreria(); }catch(e){}

    // L'apertura vera: e' openCardDbOverlay a chiedere la cascata, e la
    // richiesta deve valere per il ridisegno che segue e per quello solo.
    cardDbCascataAllaProssimaApertura();
    cardDbRenderRoster();

    var c = cascate();
    dice(c.length > 0, 'all-apertura le carte hanno un-animazione d-ingresso', c.length);
    var ritardi = c.map(function(x){ return x.a.effect.getTiming().delay; });
    dice(ritardi[0] === 0, 'la prima non aspetta', ritardi[0]);
    var passi = [];
    for(var i = 1; i < ritardi.length; i++) passi.push(ritardi[i] - ritardi[i-1]);
    var tuttiCinquanta = passi.every(function(p){ return p === 50; });
    dice(tuttiCinquanta, 'e ognuna aspetta 50ms piu- della precedente',
      'passi distinti: ' + passi.filter(function(v,j,a){ return a.indexOf(v)===j; }).join(','));
    var dur = c[0].a.effect.getTiming().duration;
    dice(dur > 0 && dur <= 400, 'la dissolvenza e- breve', dur + 'ms');
    dice(c[0].a.effect.getTiming().fill === 'backwards',
      'e prima del proprio turno la carta e- gia- a zero (fill backwards)',
      c[0].a.effect.getTiming().fill);
    // Il fill si guarda anche per come si VEDE: l-ultima, che deve ancora
    // entrare, in questo istante non si vede.
    var ultima = c[c.length-1].slot;
    dice(getComputedStyle(ultima).opacity === '0', 'l-ultima non si vede ancora',
      getComputedStyle(ultima).opacity);

    // ── un secondo ridisegno NON la rigioca ──────────────────────────────
    cardDbFermaCascata(document.getElementById('card-db-grid'));
    cardDbRenderRoster();
    dice(cascate().length === 0, 'un ridisegno qualunque non rigioca la cascata', cascate().length);

    // ── un filtro la interrompe ─────────────────────────────────────────
    cardDbCascataAllaProssimaApertura();
    cardDbRenderRoster();
    dice(cascate().length > 0, 'si rigioca quando la si chiede', cascate().length);
    cardDbApplyFilters(true);
    await respira(30);
    dice(cascate().length === 0, 'e un filtro la ferma', cascate().length);
    // Fermata vuol dire VISIBILE, non a mezz-aria: e- il difetto che si
    // pagherebbe caro, perche- resterebbe una carta trasparente per sempre.
    var trasparenti = [].slice.call(document.querySelectorAll('#card-db-grid .card-db-card-slot'))
      .filter(function(s){ return s.style.display !== 'none' && +getComputedStyle(s).opacity < 0.99; });
    dice(trasparenti.length === 0, 'e nessuna carta resta a mezza opacita-', trasparenti.length);

    // ── le nascoste non prendono il proprio turno ───────────────────────
    var slots = [].slice.call(document.querySelectorAll('#card-db-grid .card-db-card-slot'));
    slots[0].style.display = 'none';
    slots[1].style.display = 'none';
    cardDbCascataDIngresso(document.getElementById('card-db-grid'));
    var c2 = cascate();
    dice(c2.length === slots.length - 2, 'le nascoste non entrano in fila',
      c2.length + ' animate su ' + slots.length + ' caselle');
    var r2 = c2.map(function(x){ return x.a.effect.getTiming().delay; });
    var senzaBuchi = true;
    for(var j = 1; j < r2.length; j++) if(r2[j] - r2[j-1] !== 50) senzaBuchi = false;
    dice(senzaBuchi, 'e la fila non ha buchi');

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
