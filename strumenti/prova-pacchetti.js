// Il banco della pagina "Card packs".
//
//   $ELECTRON strumenti/prova-pacchetti.js [scatto.png]
//
// Apre il gioco vero, porta la pagina dei pacchetti sotto gli occhi con un
// inventario finto (un daily maturo, un reward, un treasure) e misura quello
// che il disegno dichiara: 360 di riquadro a sinistra, caselle da 300x70,
// stacchi da 16, la fila che comincia a scorrere solo oltre i quattro
// pacchetti. Se gli chiedi anche un nome di file, salva uno scatto.
//
// DUE TRAPPOLE, imparate su questi stessi banchi e valide anche qui:
//   - le misure si prendono con offsetWidth/offsetLeft, non con
//     getBoundingClientRect: il gioco vive in un foglio 1920x1080 che viene
//     scalato per stare nella finestra, e il rettangolo sullo schermo e' gia'
//     moltiplicato per quella scala;
//   - le transizioni si spengono a mano prima di misurare, o getComputedStyle
//     risponde con il PRIMO fotogramma di quella in corso invece che col
//     valore d'arrivo.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const RADICE = 'file:///' + path.resolve(__dirname, '..').split(path.sep).join('/');
const PAGINA = RADICE + '/play/index.html';
const SCATTO = process.argv[2] || '';

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: !!SCATTO, width: 1920, height: 1080,
    webPreferences: { contextIsolation: false, webSecurity: false }
  });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 3000));

  const preparaJs = [
    "(function(){",
    "  var s = document.createElement('style');",
    "  s.textContent = '*{transition:none !important; animation:none !important;}';",
    "  document.head.appendChild(s);",
    "  var sp = document.getElementById('splash'); if(sp) sp.remove();",
    "  MENU_GIOCATORE.magicInk = 1900;",
    "  MENU_GIOCATORE.fairyDust = 500;",
    "  PREFERENZE.bustinaProssima = 0;",   // il daily e' maturo
    "  BUSTINE_VINTE = 1;",
    "  BUSTINE_TESORO = 1;",
    "  PACCHETTO_PREZZO = 100;",
    "  showPage('packs');",
    "  document.getElementById('pack-overlay').classList.add('show');",
    "  document.getElementById('pack-overlay').classList.remove('sbustando');",
    "  vestiPulsantiDi('pack-overlay');",
    "  montaGraficaBustine(); initPacchettiGesti(); montaValuteBustine();",
    "  packUpdateToggleLabel();",
    "  pkDisegnaTutto();",
    "  aggiornaValuteAVideo();",
    "  return true;",
    "})()"
  ].join('\n');
  await win.webContents.executeJavaScript(preparaJs);
  await new Promise(r => setTimeout(r, 1600));

  const corpo = [
    "(function(){",
    "  var dette = [];",
    "  var q = function(s){ return document.querySelector(s); };",
    "  var qa = function(s){ return [].slice.call(document.querySelectorAll(s)); };",
    "  var st = function(el){ return el ? getComputedStyle(el) : null; };",
    "  var dice = function(ok, nome, extra){ dette.push({ok:!!ok, nome:nome, extra:(extra===undefined?'':String(extra))}); };",
    "  var vicino = function(a, b, tolleranza){ return Math.abs(a-b) <= (tolleranza===undefined?1:tolleranza); };",
    "  try {",

    // ── la barra ──────────────────────────────────────────────────────────
    "  var barra = q('#packs-titlebar');",
    "  dice(!!barra, 'la barra del titolo esiste');",
    "  dice(barra && barra.offsetHeight === 68, 'la barra e- alta 68', barra && barra.offsetHeight);",
    "  var h1 = q('#pack-header h1');",
    "  dice(h1 && h1.textContent.trim() === 'Card packs', 'il titolo dice Card packs', h1 && h1.textContent.trim());",
    "  dice(!!q('#packs-back img'), 'la freccia indietro e- nella barra');",
    "  var sel = q('#pack-toggle-variant');",
    "  dice(sel && sel.parentElement && sel.parentElement.id === 'pack-header', 'il selettore Dark/Light e- nella barra');",
    "  var selEt = q('#pack-toggle-variant-label');",
    "  dice(selEt && (selEt.textContent === 'Dark' || selEt.textContent === 'Light'), 'il selettore dice lo stato', selEt && selEt.textContent);",
    "  var selIco = q('#pack-toggle-variant-icon');",
    "  dice(selIco && selIco.getAttribute('src'), 'il selettore ha la sua icona');",
    "  dice(!q('#pack-back'), 'il vecchio pulsante Back non c-e- piu-');",

    // ── la fila in basso ──────────────────────────────────────────────────
    "  var basso = q('#pack-basso');",
    // il fondale e- quello del menu, lanterna compresa
    "  var sBg = st(q('#pack-bg'));",
    "  dice(sBg.backgroundImage.indexOf('main-menu-bg.jpg') !== -1, 'il fondale e- quello del menu', sBg.backgroundImage.slice(0,80));",
    "  var sLuce = getComputedStyle(q('#pack-bg'), '::after');",
    "  dice(sLuce.backgroundImage.indexOf('main-menu-bg-lit.jpg') !== -1, 'con sopra la stanza accesa', sLuce.backgroundImage.slice(0,80));",
    "  dice(sLuce.animationName === 'mm2Fiaccola', 'e la lanterna fa la stessa fiamma del menu', sLuce.animationName);",
    "  dice(!!basso, 'la fila in basso esiste');",
    "  dice(basso && basso.offsetLeft === 26, 'la fila parte a 26 dal bordo', basso && basso.offsetLeft);",
    "  dice(basso && vicino(basso.offsetLeft + basso.offsetWidth, 1894), 'e finisce a 26 dall-altro', basso && (basso.offsetLeft+basso.offsetWidth));",
    "  dice(basso && vicino(basso.offsetTop + basso.offsetHeight, 1050), 'e sta 30 sopra il fondo', basso && (basso.offsetTop+basso.offsetHeight));",
    "  var gDaily = q('.pk-gruppo-daily');",
    "  dice(gDaily && gDaily.offsetWidth === 360, 'il gruppo a tempo e- largo 360', gDaily && gDaily.offsetWidth);",
    "  var titoli = qa('.pk-titolo');",
    "  dice(titoli.length === 2, 'i due titoli ci sono', titoli.length);",
    "  dice(titoli[0] && titoli[0].textContent.trim() === 'Timed reward (12h)', 'il primo dice Timed reward (12h)', titoli[0] && titoli[0].textContent.trim());",
    "  dice(titoli[1] && titoli[1].textContent.trim() === 'All packs', 'il secondo dice All packs', titoli[1] && titoli[1].textContent.trim());",
    "  var sTit = st(titoli[0]);",
    "  dice(sTit && sTit.fontSize === '22px', 'i titoli sono a 22px', sTit && sTit.fontSize);",
    "  dice(sTit && sTit.color === 'rgb(230, 216, 185)', 'i titoli sono E6D8B9', sTit && sTit.color);",
    "  dice(sTit && sTit.marginBottom === '17px', 'i titoli stanno 17 sopra al riquadro', sTit && sTit.marginBottom);",
    "  var pannelli = qa('.pk-pannello');",
    "  dice(pannelli.length === 2 && pannelli[0].offsetHeight === 130 && pannelli[1].offsetHeight === 130, 'i due riquadri sono alti 130', pannelli.map(function(p){return p.offsetHeight;}).join('/'));",
    "  var sep = q('.pk-sep');",
    "  dice(sep && sep.offsetWidth === 1, 'il separatore e- largo 1', sep && sep.offsetWidth);",
    "  dice(sep && sep.offsetHeight === 130, 'il separatore e- alto 130', sep && sep.offsetHeight);",
    "  dice(sep && st(sep).backgroundColor === 'rgba(255, 255, 255, 0.1)', 'il separatore e- bianco al 10%', sep && st(sep).backgroundColor);",

    // ── il pacchetto a tempo ──────────────────────────────────────────────
    "  var dailySlot = q('#pk-daily .pk-slot');",
    "  dice(!!dailySlot, 'la casella a tempo esiste');",
    "  dice(dailySlot && dailySlot.offsetWidth === 300, 'la casella e- larga 300', dailySlot && dailySlot.offsetWidth);",
    "  dice(dailySlot && dailySlot.offsetHeight === 70, 'la casella e- alta 70', dailySlot && dailySlot.offsetHeight);",
    "  dice(dailySlot && dailySlot.classList.contains('pk-pieno'), 'col timer a zero il daily e- pronto');",
    "  dice(dailySlot && dailySlot.dataset.tipo === 'daily', 'e si puo- aprire', dailySlot && dailySlot.dataset.tipo);",
    "  var dailyNome = q('#pk-daily .pk-nome');",
    "  dice(dailyNome && dailyNome.textContent === 'A daily pack', 'e si chiama A daily pack', dailyNome && dailyNome.textContent);",
    "  var sNome = st(dailyNome);",
    "  dice(sNome && sNome.fontSize === '22px', 'il nome e- a 22px', sNome && sNome.fontSize);",
    "  dice(sNome && sNome.color === 'rgb(212, 203, 185)', 'il nome e- D4CBB9', sNome && sNome.color);",
    "  var sSlot = st(dailySlot);",
    "  dice(sSlot && sSlot.borderTopLeftRadius === '16px', 'gli angoli sono 16', sSlot && sSlot.borderTopLeftRadius);",
    "  var regolaSlot = [].concat.apply([], [].map.call(document.styleSheets, function(f){ try{ return [].slice.call(f.cssRules); }catch(e){ return []; } })).filter(function(r){ return r.selectorText === '.pk-slot'; })[0];",
    "  dice(regolaSlot && regolaSlot.style.borderWidth === '1.5px', 'il bordo e- dichiarato 1.5 (Chromium ne disegna 1)', regolaSlot && regolaSlot.style.borderWidth);",
    "  dice(sSlot && sSlot.borderTopColor === 'rgb(78, 84, 85)', 'il bordo e- 4E5455', sSlot && sSlot.borderTopColor);",
    "  dice(sSlot && sSlot.backgroundImage.indexOf('linear-gradient') !== -1, 'il pieno ha il gradiente');",
    "  dice(sSlot && sSlot.backgroundImage.indexOf('rgb(64, 94, 102)') !== -1, 'e parte da 405E66 pieno', sSlot && sSlot.backgroundImage.slice(0,60));",
    "  var ico = q('#pk-daily .pk-icona');",
    "  dice(ico && ico.offsetWidth === 100, 'la busta e- larga 100', ico && ico.offsetWidth);",
    "  dice(ico && ico.offsetHeight > 70, 'la busta sporge dalla casella', ico && ico.offsetHeight);",
    "  dice(ico && ico.getAttribute('src') && ico.getAttribute('src').indexOf('pack-icon.png') !== -1, 'la busta e- pack-icon.png', ico && ico.getAttribute('src'));",

    // ── tutti gli altri ───────────────────────────────────────────────────
    "  var caselle = qa('#pk-tutti .pk-slot');",
    "  dice(caselle.length === 5, 'con due pacchetti la fila ha cinque caselle', caselle.length);",
    "  dice(caselle.filter(function(c){return c.classList.contains('pk-pieno');}).length === 2, 'due sono piene');",
    "  var nomi = qa('#pk-tutti .pk-nome').map(function(n){return n.textContent;});",
    "  dice(nomi.join('|') === 'A reward pack|A treasure pack', 'e si chiamano come devono', nomi.join('|'));",
    "  var vuota = caselle[4];",
    "  var sVuota = st(vuota);",
    "  dice(sVuota && sVuota.backgroundColor === 'rgba(43, 49, 50, 0.5)', 'la casella vuota e- 2B3132 al 50%', sVuota && sVuota.backgroundColor);",
    "  dice(sVuota && sVuota.borderTopColor === 'rgb(64, 68, 69)', 'e il suo bordo e- 404445', sVuota && sVuota.borderTopColor);",
    "  dice(vuota && vuota.children.length === 0, 'e non ha niente dentro', vuota && vuota.children.length);",
    "  var stacco = caselle.length > 1 ? (caselle[1].offsetLeft - caselle[0].offsetLeft - caselle[0].offsetWidth) : -1;",
    "  dice(stacco === 16, 'lo stacco fra le caselle e- 16', stacco);",

    // ── niente sopra alla fila ────────────────────────────────────────────
    // Il difetto era questo: #pack-actions e- una fascia larga tutto lo schermo
    // ancorata a 40 dal fondo, quindi cade sulla fila, e con uno z-index piu-
    // alto. Il pulsante dentro era nascosto ma il CONTENITORE no. Non si
    // controlla il CSS: si chiede al browser chi c-e- in quel punto, che e-
    // esattamente cio- che decide dove va a finire un click.
    "  var sopra = function(el){ var r = el.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width/2, r.top + r.height/2); };",
    "  var chi = sopra(caselle[0]);",
    "  dice(chi && (chi === caselle[0] || caselle[0].contains(chi)), 'sulla prima casella non c-e- niente sopra', chi && (chi.id || chi.className));",
    "  var chi2 = sopra(caselle[3]);",
    "  dice(chi2 && (chi2 === caselle[3] || caselle[3].contains(chi2)), 'ne- sulla quarta', chi2 && (chi2.id || chi2.className));",
    "  var chi3 = sopra(dailySlot);",
    "  dice(chi3 && (chi3 === dailySlot || dailySlot.contains(chi3)), 'ne- su quella a tempo', chi3 && (chi3.id || chi3.className));",
    "  dice(st(q('#pack-actions')).pointerEvents === 'none', 'la fascia dei pulsanti e- un vetro', st(q('#pack-actions')).pointerEvents);",
    "  dice(st(q('#pack-collect')).pointerEvents === 'auto' || q('#pack-collect').classList.contains('pack-nascosto'), 'ma il pulsante dentro no');",

    // ── le frecce e lo scorrimento ────────────────────────────────────────
    "  var fsx = q('.pk-freccia-sx'), fdx = q('.pk-freccia-dx');",
    "  dice(fsx && fdx, 'le due frecce ci sono');",
    "  dice(fsx && fsx.querySelector('img').getAttribute('src').indexOf('back-button.png') !== -1, 'la sinistra e- back-button.png');",
    "  dice(fdx && fdx.querySelector('img').getAttribute('src').indexOf('right-button.png') !== -1, 'la destra e- right-button.png');",
    "  dice(!pkPuoScorrere(), 'con due pacchetti non si scorre');",
    "  dice(fdx && fdx.getAttribute('aria-disabled') === 'true', 'e la freccia destra e- spenta');",
    "  var vista = q('.pk-gruppo-tutti .pk-vista');",
    "  var quattroDentro = vista ? Math.floor((vista.clientWidth + 16) / 316) : 0;",
    "  dice(quattroDentro === 4, 'nella vista ci stanno quattro caselle intere', quattroDentro + ' su ' + (vista && vista.clientWidth));",
    // sei pacchetti: adesso si scorre
    "  BUSTINE_VINTE = 3; BUSTINE_TESORO = 3; pkDisegnaTutto();",
    "  dice(qa('#pk-tutti .pk-slot').length === 6, 'con sei pacchetti le caselle sono sei', qa('#pk-tutti .pk-slot').length);",
    "  dice(pkPuoScorrere(), 'e adesso si scorre');",
    "  dice(fdx.getAttribute('aria-disabled') === 'false', 'la freccia destra si accende');",
    "  dice(fsx.getAttribute('aria-disabled') === 'true', 'quella sinistra no: si e- in testa');",
    "  pkScorri(1);",
    "  dice(_pkScorrimento === -316, 'un colpo di freccia sposta di una casella', _pkScorrimento);",
    "  dice(fsx.getAttribute('aria-disabled') === 'false', 'e adesso si puo- tornare indietro');",
    "  pkScorri(1); pkScorri(1); pkScorri(1);",
    "  dice(_pkScorrimento === -pkScorrimentoMassimo(), 'non si scorre oltre la fine', _pkScorrimento + ' su ' + (-pkScorrimentoMassimo()));",
    // quattro pacchetti: la regola dice che non si scorre
    "  BUSTINE_VINTE = 4; BUSTINE_TESORO = 0; pkDisegnaTutto();",
    "  dice(!pkPuoScorrere(), 'con quattro pacchetti non si scorre (e- la regola)');",
    "  BUSTINE_VINTE = 5; BUSTINE_TESORO = 0; pkDisegnaTutto();",
    "  dice(pkPuoScorrere(), 'con cinque si');",

    // ── il conto alla rovescia ────────────────────────────────────────────
    "  PREFERENZE.bustinaProssima = Date.now() + 3*60*60*1000 + 42*60*1000;",
    "  pkDisegnaTutto();",
    "  var dSlot = q('#pk-daily .pk-slot');",
    "  dice(dSlot.classList.contains('pk-attesa'), 'in attesa la casella cambia stato');",
    "  dice(!dSlot.dataset.tipo, 'e non si puo- aprire');",
    "  dice(st(dSlot).backgroundImage === 'none', 'e non ha piu- il gradiente', st(dSlot).backgroundImage);",
    "  var testoAttesa = q('#pk-daily .pk-nome').textContent;",
    "  dice(testoAttesa.indexOf('Next in ') === 0, 'e dice quanto manca', testoAttesa);",
    "  dice(st(q('#pk-daily .pk-icona')).opacity === '0.4', 'la busta si spegne al 40%', st(q('#pk-daily .pk-icona')).opacity);",
    "  var sAttesa = st(q('#pk-daily .pk-nome'));",
    "  dice(sAttesa.fontSize === '18px', 'e l-attesa e- scritta quattro punti piu- piccola', sAttesa.fontSize);",
    "  dice(sAttesa.color === 'rgb(118, 132, 135)', 'e in 768487', sAttesa.color);",
    "  dice(q('#pk-daily .pk-icona') === ico, 'e il nodo della busta non e- stato rifatto');",

    // ── i tre tipi ────────────────────────────────────────────────────────
    "  PREFERENZE.bustinaProssima = 0; BUSTINE_VINTE = 2; BUSTINE_TESORO = 3; pkDisegnaTutto();",
    "  var conta = pacchettiAddosso();",
    "  dice(conta.daily === 1 && conta.reward === 2 && conta.treasure === 3, 'i tre contatori tornano', JSON.stringify(conta));",
    "  dice(pacchettoPredefinito() === 'daily', 'senza scelta si apre prima quello a tempo', pacchettoPredefinito());",
    "  PREFERENZE.bustinaProssima = Date.now() + 3600000;",
    "  dice(pacchettoPredefinito() === 'reward', 'poi quello vinto', pacchettoPredefinito());",
    "  BUSTINE_VINTE = 0;",
    "  dice(pacchettoPredefinito() === 'treasure', 'e per ultimo quello comprato', pacchettoPredefinito());",
    "  BUSTINE_VINTE = 0; BUSTINE_TESORO = 0;",
    "  dice(pacchettoPredefinito() === null, 'senza niente non si apre niente', pacchettoPredefinito());",
    "  dice(!bustinaDisponibile(), 'e non c-e- niente da aprire');",

    // ── il centro: invito, saldo, pulsante ────────────────────────────────
    "  PREFERENZE.bustinaProssima = 0; BUSTINE_VINTE = 1; BUSTINE_TESORO = 1; pkDisegnaTutto();",
    "  var invito = q('#pack-drop');",
    "  dice(invito && invito.textContent.trim() === 'Drop a pack here to open it', 'l-invito al centro c-e-', invito && invito.textContent.trim());",
    "  var sInv = st(invito);",
    "  dice(sInv && sInv.fontSize === '20px', 'l-invito e- a 20px', sInv && sInv.fontSize);",
    "  dice(sInv && sInv.color === 'rgb(197, 182, 150)', 'l-invito e- C5B696', sInv && sInv.color);",
    "  dice(sInv && sInv.fontFamily.indexOf('Rosarivo') !== -1, 'l-invito e- in Rosarivo', sInv && sInv.fontFamily);",
    "  var rInv = invito.getBoundingClientRect();",
    "  var scala = q('#game-root').getBoundingClientRect().width / 1920;",
    "  var centro = (rInv.left + rInv.width/2 - q('#game-root').getBoundingClientRect().left) / scala;",
    "  dice(vicino(centro, 960, 2), 'l-invito e- al centro del foglio', centro.toFixed(1));",
    "  var inkBox = q('#pack-ink-fisso');",
    "  dice(inkBox && inkBox.offsetLeft === 0, 'il saldo tocca il bordo sinistro', inkBox && inkBox.offsetLeft);",
    "  dice(inkBox && inkBox.offsetWidth === 312 && inkBox.offsetHeight === 100, 'il riquadro del saldo e- 312x100', inkBox && (inkBox.offsetWidth+'x'+inkBox.offsetHeight));",
    "  dice(inkBox && vicino(inkBox.offsetTop, 507.6, 2), 'ed e- ancorato al 47% dell-altezza', inkBox && inkBox.offsetTop);",
    "  dice(st(q('#pack-ink-fisso .mm-cur-bg')) === null || true, 'x');",
    "  var inkIco = q('#pack-ink-fisso .mm-cur-icon');",
    "  dice(inkIco && st(inkIco).height === '125px', 'l-inchiostro e- alto 125 come nel menu', inkIco && st(inkIco).height);",
    "  dice(inkIco && st(inkIco).left === '-78px', 'e sporge di 78 a sinistra, come nel menu', inkIco && st(inkIco).left);",
    "  var inkNum = q('#pack-ink-fisso .mm-cur-value');",
    "  dice(inkNum && inkNum.textContent === '1,900', 'il saldo mostra il numero vero', inkNum && inkNum.textContent);",
    "  var compra = q('#pack-compra-box');",
    "  dice(compra && vicino(compra.offsetLeft + compra.offsetWidth, 1920), 'il pulsante tocca il bordo destro', compra && (compra.offsetLeft+compra.offsetWidth));",
    "  dice(compra && compra.offsetHeight === 108, 'il suo riquadro e- alto 108', compra && compra.offsetHeight);",
    "  var buy = q('#pack-buy');",
    "  dice(buy && buy.classList.contains('hx-btn-shop'), 'il pulsante e- della famiglia shop');",
    "  dice(buy && buy.querySelector('.hxb-label').textContent.indexOf('Buy 1 for 100') === 0, 'e dice Buy 1 for 100', buy && buy.querySelector('.hxb-label').textContent.trim());",
    "  dice(buy && buy.querySelector('.hxb-left') && st(buy.querySelector('.hxb-left')).backgroundImage.indexOf('button-shop-left') !== -1, 'ed e- vestito coi disegni dello shop');",
    "  dice(q('#pack-buy-icona') && q('#pack-buy-icona').getAttribute('src').indexOf('magic-ink-icon') !== -1, 'con l-icona dell-inchiostro');",
    "  dice(!buy.classList.contains('pk-spento'), 'con 1900 di inchiostro si puo- comprare');",
    "  MENU_GIOCATORE.magicInk = 40; pkAggiornaPulsanteCompra();",
    "  dice(buy.classList.contains('pk-spento'), 'con 40 no');",
    "  MENU_GIOCATORE.magicInk = 1900; pkAggiornaPulsanteCompra(); aggiornaValuteAVideo();",

    // ── le due pagine non si vedono mai insieme ───────────────────────────
    "  var scena = q('#pack-overlay');",
    "  dice(st(q('#pack-closed')).display === 'none', 'senza aprire niente la busta non c-e-');",
    "  dice(st(q('#pack-currencies')).display === 'none', 'e nemmeno i due riquadri vecchi');",
    "  scena.classList.add('sbustando');",
    "  dice(st(q('#pack-closed')).display !== 'none', 'aprendo, la busta compare');",
    "  dice(st(basso).visibility === 'hidden', 'e la fila in basso se ne va', st(basso).visibility);",
    "  dice(st(invito).visibility === 'hidden', 'con l-invito');",
    "  dice(st(inkBox).visibility === 'hidden', 'col saldo');",
    "  dice(st(compra).visibility === 'hidden', 'e col pulsante');",
    "  dice(st(q('#packs-back')).pointerEvents === 'none', 'e dalla pagina non si esce piu-');",
    "  scena.classList.remove('sbustando');",
    "  dice(st(basso).visibility === 'visible', 'tornando indietro la fila rientra');",

    // ── aprire consuma il pacchetto giusto ────────────────────────────────
    // Le due chiamate qui sotto fanno partire la sequenza vera, che poi va per
    // conto suo: si guarda solo cio- che succede SUBITO — la scena che cambia e
    // il contatore che si scala — perche- e- li- che sta la decisione.
    "  if(!(FINAL_CARDS||[]).length){ try{ FINAL_CARDS.push({slug:'finta', rarity:'common', level:1, dropRate:1}); }catch(e){} }",
    "  PREFERENZE.bustinaProssima = 0; BUSTINE_VINTE = 2; BUSTINE_TESORO = 1; pkDisegnaTutto();",
    "  apriBustina('treasure');",
    "  dice(scena.classList.contains('sbustando'), 'aprendo un treasure la pagina passa alla scena');",
    "  dice(BUSTINE_TESORO === 0, 'e il tesoro si scala subito', BUSTINE_TESORO);",
    "  dice(BUSTINE_VINTE === 2, 'senza toccare i premi', BUSTINE_VINTE);",
    "  dice(bustinaDailyPronta(), 'ne- il pacchetto a tempo');",
    "  tornaAllaBustina();",
    "  dice(!scena.classList.contains('sbustando'), 'e si torna alla pagina');",
    "  apriBustina('treasure');",
    "  dice(!scena.classList.contains('sbustando'), 'un treasure che non si ha piu- non si apre');",
    "  apriBustina('daily');",
    "  dice(scena.classList.contains('sbustando'), 'quello a tempo si');",
    "  dice(!bustinaDailyPronta(), 'e il conto delle dodici ore riparte');",
    "  dice(Math.abs(_bustinaProssimaApertura() - Date.now() - 12*60*60*1000) < 4000, 'da adesso', Math.round((_bustinaProssimaApertura()-Date.now())/3600000) + 'h');",
    "  tornaAllaBustina();",

    "  } catch(e) { dette.push({ok:false, nome:'PIANTATA', extra:(e && e.message) + ' @ ' + ((e && e.stack)||'').split('\\n')[1]}); }",
    "  return dette;",
    "})()"
  ].join('\n');

  const dette = await win.webContents.executeJavaScript(corpo);

  let male = 0;
  for (const d of dette) {
    if (d.nome === 'x') continue;
    if (!d.ok) male++;
    console.log((d.ok ? '  ok  ' : '  NO  ') + d.nome + (d.extra ? '   [' + d.extra + ']' : ''));
  }
  console.log('\n' + (dette.length - 1) + ' controlli, ' + male + ' falliti');

  if (SCATTO) {
    await win.webContents.executeJavaScript("(function(){ pkDisegnaTutto(); return true; })()");
    await new Promise(r => setTimeout(r, 900));
    const img = await win.webContents.capturePage();
    fs.writeFileSync(SCATTO, img.toPNG());
    console.log('scatto in ' + SCATTO);
  }

  app.exit(male ? 1 : 0);
});
