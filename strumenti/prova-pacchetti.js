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
    // Tutte le regole del foglio, una volta sola: servono a chi deve
    // controllare un valore DICHIARATO invece di uno calcolato — un :hover che
    // non si puo' forzare, un bordo che Chromium arrotonda, un'animazione che
    // il banco stesso ha appena spento.
    "  var regole = [].concat.apply([], [].map.call(document.styleSheets, function(f){ try{ return [].slice.call(f.cssRules); }catch(e){ return []; } }));",
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
    // Niente alone bianco sui pacchetti: il riquadro che li contiene ha
    // overflow:hidden e lo taglierebbe di netto sul proprio bordo.
    "  var rPieno = regole.filter(function(r){ return r.selectorText === '.pk-slot.pk-pieno:hover'; })[0];",
    "  dice(rPieno && !rPieno.style.boxShadow, 'i pacchetti non hanno piu- l-alone bianco', rPieno && rPieno.style.boxShadow);",
    "  dice(rPieno && rPieno.style.borderColor === 'rgb(230, 202, 142)', 'ma il bordo d-oro resta', rPieno && rPieno.style.borderColor);",
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
    "  dice(st(q('#pack-busta-sotto')).visibility === 'hidden', 'senza aprire niente la busta non c-e-');",
    // v0.79.40 — il secondo riquadro dell'inchiostro non esiste piu': ce n'e'
    // uno solo, quello a filo del bordo sinistro, e porta lui l'id che
    // lampeggiaValuta va a cercare.
    "  dice(!q('#pack-currencies'), 'il riquadro vecchio dell-inchiostro non c-e- piu-');",
    "  dice(qa('#pack-overlay .mm-cur-ink').length === 1, 'e di riquadri dell-inchiostro ce n-e- uno solo', qa('#pack-overlay .mm-cur-ink').length);",
    "  dice(q('#pack-ink') && q('#pack-ink').closest('#pack-ink-fisso'), 'ed e- lui a portare l-id che fa lampeggiare la valuta');",
    "  scena.classList.add('sbustando');",
    "  dice(st(basso).visibility === 'hidden', 'e la fila in basso se ne va', st(basso).visibility);",
    "  dice(st(invito).visibility === 'hidden', 'con l-invito');",
    "  dice(st(inkBox).visibility === 'hidden', 'col saldo');",
    "  dice(st(compra).visibility === 'hidden', 'e col pulsante');",
    "  dice(st(q('#packs-back')).pointerEvents === 'none', 'e dalla pagina non si esce piu-');",
    "  scena.classList.remove('sbustando');",
    "  dice(st(basso).visibility === 'visible', 'tornando indietro la fila rientra');",

    // ══ LA BUSTA ════════════════════════════════════════════════════════
    // Prima le misure, che vengono dal disegno: 640 di larghezza e ogni pezzo
    // con la PROPRIA proporzione. Poi il gesto vero — un pointerdown su una
    // casella, un movimento in su, un rilascio al centro — perche' "il
    // trascinamento funziona" non si dimostra leggendo il codice.
    "  scena.classList.remove('sbustando');",
    "  var sotto = q('#pack-busta-sotto'), sopra = q('#pack-busta-sopra');",
    "  dice(sotto && sopra, 'la busta e- in due meta-');",
    "  dice(sotto && sotto.offsetWidth === 640 && sotto.offsetHeight === 459, 'ed e- larga 640', sotto && (sotto.offsetWidth+'x'+sotto.offsetHeight));",
    "  dice(sopra && sopra.offsetWidth === sotto.offsetWidth && sopra.offsetTop === sotto.offsetTop && sopra.offsetLeft === sotto.offsetLeft, 'e le due meta- stanno esattamente una sull-altra');",
    "  dice(sotto && vicino(sotto.offsetLeft + sotto.offsetWidth/2, 960), 'centrata sul foglio, in orizzontale', sotto && (sotto.offsetLeft+sotto.offsetWidth/2));",
    "  dice(sotto && vicino(sotto.offsetTop + sotto.offsetHeight/2, 540), 'e in verticale', sotto && (sotto.offsetTop+sotto.offsetHeight/2));",
    "  dice(q('#pack-reveal').parentElement.id === 'pack-stage', 'le carte escono dal palcoscenico');",
    "  var zSotto = +st(sotto).zIndex, zCarte = +st(q('#pack-reveal')).zIndex, zSopra = +st(sopra).zIndex;",
    "  dice(zSotto < zCarte && zCarte < zSopra, 'e passano FRA le due meta-', zSotto+' < '+zCarte+' < '+zSopra);",
    // le proporzioni dei quattro disegni
    "  var prop = function(sel, largo, alto){ var el = q(sel); if(!el) return '?'; return el.offsetWidth+'x'+el.offsetHeight; };",
    "  dice(prop('.pb-letter') === '640x458' || prop('.pb-letter') === '640x457', 'letter tiene la sua proporzione', prop('.pb-letter'));",
    "  dice(prop('.pb-top') === '640x459' || prop('.pb-top') === '640x458', 'letter-top pure', prop('.pb-top'));",
    "  dice(prop('.pb-opening') === '639x288', 'e la patella pure', prop('.pb-opening'));",
    "  var cera = q('.pb-ceralacca');",
    "  dice(cera && vicino(cera.offsetWidth, 255.6, 1) && vicino(cera.offsetHeight, 260.6, 1), 'la ceralacca tiene la sua', cera && (cera.offsetWidth+'x'+cera.offsetHeight));",
    "  dice(cera && vicino(cera.offsetLeft + cera.offsetWidth/2, 320, 1) && vicino(cera.offsetTop + cera.offsetHeight/2, 229.5, 1), 'ed e- al centro della busta');",
    "  dice(q('.pb-opening') && st(q('.pb-opening')).transformOrigin.indexOf('0px') !== -1, 'la patella ha il cardine in alto', st(q('.pb-opening')).transformOrigin);",
    "  var sOmbra = st(q('.pb-letter'));",
    "  dice(sOmbra.filter.indexOf('drop-shadow') !== -1 && sOmbra.filter.indexOf('50px') !== -1, 'e la busta ha la sua ombra', sOmbra.filter);",
    // Il lampo tiene la proporzione del proprio disegno: 1683x1974 fa 1.173, e
    // le due misure vanno cambiate insieme o la raggiera si deforma.
    // Il lampo e' display:none finche' non scocca, quindi offsetWidth risponde
    // zero: le misure si leggono dal calcolato, che su un elemento non
    // impaginato riporta comunque il valore dichiarato.
    "  var lampo = q('#pack-beam');",
    "  var lw = parseFloat(st(lampo).width), lh = parseFloat(st(lampo).height);",
    "  dice(lw === 1176 && lh === 1380, 'il lampo e- 1176x1380', lw + 'x' + lh);",
    "  dice(Math.abs(lh/lw - 1974/1683) < 0.01, 'e tiene la proporzione del disegno', (lh/lw).toFixed(3) + ' contro ' + (1974/1683).toFixed(3));",
    // Il lampo e le scintille stanno SOPRA alla busta: sotto, la luce nasceva
    // dentro e ci restava.
    "  dice(+st(q('#pack-beam')).zIndex > +st(sopra).zIndex, 'il lampo sta sopra alla busta', st(q('#pack-beam')).zIndex + ' contro ' + st(sopra).zIndex);",
    "  dice(+st(q('#pack-sparks')).zIndex > +st(q('#pack-beam')).zIndex, 'e le scintille sopra al lampo', st(q('#pack-sparks')).zIndex);",
    // L-inclinazione: la prospettiva deve stare sul PADRE di chi ruota, non
    // sul nonno. Senza, la rotazione e- una proiezione ortogonale — cioe- uno
    // schiacciamento uguale a destra e a sinistra, che e- come si vedeva.
    "  dice(st(sotto).perspective === '1400px', 'la prospettiva sta sul padre di chi ruota', st(sotto).perspective);",
    "  dice(st(q('#pack-busta-sopra .pb-dentro')).perspective === '1400px', 'e .pb-dentro ne ha una sua per la patella', st(q('#pack-busta-sopra .pb-dentro')).perspective);",
    // L-istruzione
    "  var istr = q('#pack-istruzione');",
    "  var sIstr = st(istr);",
    "  dice(sIstr.marginTop === '160px', 'l-istruzione sta 160 sotto al centro', sIstr.marginTop);",
    "  dice(sIstr.backdropFilter === 'blur(20px)' || sIstr.webkitBackdropFilter === 'blur(20px)', 'col fondale sfocato dietro', sIstr.backdropFilter);",
    "  dice(sIstr.backgroundImage.indexOf('0.5') !== -1, 'e il fondo mezzo trasparente', sIstr.backgroundImage.slice(0,70));",
    "  dice(getComputedStyle(istr, '::after').animationName === 'istruzioneLamina', 'con la lamina che scorre', getComputedStyle(istr, '::after').animationName);",
    "  dice(getComputedStyle(istr, '::after').animationDuration === '2s', 'ogni due secondi', getComputedStyle(istr, '::after').animationDuration);",
    // Il banco spegne ogni animation su *, quindi la freccia si controlla
    // sulla REGOLA e non sul calcolato: il calcolato direbbe sempre "none".
    // Il ::after della lamina invece non lo prende, perche' * non riguarda gli
    // pseudo-elementi.
    "  var rFreccia = regole.filter(function(r){ return r.selectorText === '#pack-istruzione-freccia'; })[0];",
    "  dice(rFreccia && rFreccia.style.animationName === 'istruzioneFreccia', 'e la freccia pulsa verso l-alto', rFreccia && rFreccia.style.animationName);",
    // La ceralacca si accende: :hover non si puo- forzare, si legge la regola.
    "  var rHover = regole.filter(function(r){ return r.selectorText === '.pb-sigillo:hover'; })[0];",
    "  dice(rHover && rHover.style.filter.indexOf('brightness') !== -1, 'la ceralacca si accende al passaggio', rHover && rHover.style.filter);",

    // il gesto: si solleva e si posa
    "  var manda = function(el, tipo, x, y){ el.dispatchEvent(new PointerEvent(tipo, {clientX:x, clientY:y, pointerId:7, button:0, bubbles:true, cancelable:true})); };",
    "  var rSlot = q('#pk-daily .pk-slot').getBoundingClientRect();",
    "  var sx = rSlot.left + rSlot.width/2, sy = rSlot.top + rSlot.height/2;",
    "  manda(q('#pk-daily .pk-slot'), 'pointerdown', sx, sy);",
    "  manda(window, 'pointermove', sx, sy - 60);",
    "  dice(scena.classList.contains('busta-in-mano'), 'trascinando in su la busta si solleva');",
    "  dice(scena.classList.contains('busta-viva'), 'e si vede');",
    "  dice(!scena.classList.contains('sbustando'), 'ma la fila resta li-: si sta ancora scegliendo');",
    "  dice(st(q('#pack-drop')).visibility === 'hidden', 'e l-invito si toglie di mezzo');",
    // lasciandola in basso torna indietro e non si consuma niente
    "  manda(window, 'pointerup', sx, sy);",
    "  dice(!scena.classList.contains('busta-in-mano'), 'lasciandola in basso torna indietro');",
    "  dice(bustinaDailyPronta(), 'e il pacchetto a tempo e- ancora li-');",
    "  dice(!scena.classList.contains('sbustando'), 'e non si e- aperto niente');",

    // e adesso al centro: si posa e si consuma
    "  manda(q('#pk-daily .pk-slot'), 'pointerdown', sx, sy);",
    "  manda(window, 'pointermove', sx, sy - 60);",
    "  manda(window, 'pointerup', sx, 200);",
    "  dice(scena.classList.contains('sbustando'), 'lasciandola al centro si apre');",
    "  dice(!bustinaDailyPronta(), 'e il pacchetto a tempo si consuma');",
    "  dice(_bustinaInCorso, 'da qui in poi la pagina e- occupata');",

    // i cinque colpi
    "  var sig = q('#pack-wax');",
    "  var visti = [sig.getAttribute('src')];",
    "  for(var k=0;k<4;k++){ bustaColpo(); visti.push(sig.getAttribute('src')); }",
    "  dice(_bustaColpi === 4, 'quattro colpi contati', _bustaColpi);",
    "  var tuttiDiversi = true; for(var k2=1;k2<visti.length;k2++){ if(visti[k2] === visti[k2-1]) tuttiDiversi = false; }",
    "  dice(tuttiDiversi, 'e a ogni colpo il sigillo cambia disegno', visti.map(function(u){return (u||'').split('/').pop();}).join(' > '));",
    "  dice(q('#pack-briciole').children.length > 0, 'e ne saltano via delle briciole', q('#pack-briciole').children.length);",
    "  var b0 = q('.pb-briciola');",
    "  dice(b0 && st(b0).backgroundColor === 'rgb(53, 105, 119)', 'del colore della ceralacca', b0 && st(b0).backgroundColor);",
    "  dice(b0 && st(b0).boxShadow.indexOf('inset') !== -1, 'con la luce sullo spigolo', b0 && st(b0).boxShadow.slice(0,60));",
    "  dice(st(b0).animationName === 'none', 'e non le muove un @keyframes: hanno una fisica', st(b0).animationName);",
    // Le scintille dello scoppio: calde, fuse in plus-lighter e piu' sfocate.
    "  var rScint = regole.filter(function(r){ return r.selectorText === '.pack-spark-dot'; })[0];",
    "  dice(rScint && rScint.style.backgroundColor === 'rgb(255, 242, 213)', 'le scintille sono FFF2D5', rScint && rScint.style.backgroundColor);",
    "  dice(rScint && rScint.style.mixBlendMode === 'plus-lighter', 'e si sommano alla luce', rScint && rScint.style.mixBlendMode);",
    "  accendiScintille();",
    "  var sfocature = qa('.pack-spark-dot').map(function(e){ return parseFloat(e.style.getPropertyValue('--sfoca')) || 0; });",
    "  dice(sfocature.length && Math.max.apply(null, sfocature) > 5, 'e sono sfocate piu- di prima', Math.max.apply(null, sfocature).toFixed(2) + ' contro il 5 di prima');",
    "  spegniScintille();",
    "  dice(_briciole.length > 0, 'il giro di animazione le sta seguendo', _briciole.length);",
    "  var conVy = _briciole.filter(function(x){ return x.vy < 0; }).length;",
    "  dice(conVy === _briciole.length, 'e partono TUTTE verso l-alto, prima di cadere', conVy + ' su ' + _briciole.length);",
    "  var lati = _briciole.map(function(x){ return x.vx > 0 ? 1 : -1; });",
    "  dice(lati.indexOf(1) !== -1 && lati.indexOf(-1) !== -1, 'e si spargono da tutte e due le parti');",
    "  var misure = _briciole.map(function(x){ return x.el.style.width; });",
    "  dice(new Set(misure).size > 5, 'di misure tutte diverse', new Set(misure).size + ' misure su ' + misure.length);",
    "  var spigolose = _briciole.filter(function(x){ return (x.el.style.clipPath||'').indexOf('polygon') === 0; }).length;",
    "  dice(spigolose > 0 && spigolose < _briciole.length, 'e di due famiglie di forme', spigolose + ' spigolose su ' + _briciole.length);",
    "  dice(!scena.classList.contains('busta-istruzione'), 'al primo colpo l-istruzione si ritira');",
    "  dice(!scena.classList.contains('busta-rotta'), 'al quarto colpo il sigillo regge ancora');",
    "  bustaColpo();",
    "  dice(scena.classList.contains('busta-rotta'), 'al quinto si spacca');",
    "  dice(scena.classList.contains('busta-monta'), 'e la busta comincia a tremare');",
    "  dice(st(q('.pb-sigillo')).opacity === '0', 'il sigillo intero se ne va', st(q('.pb-sigillo')).opacity);",
    "  var pezzi = qa('.pb-pezzo');",
    "  dice(pezzi.length === 3, 'e restano i suoi tre pezzi', pezzi.length);",
    "  dice(pezzi[0].offsetLeft === 5 && pezzi[0].offsetTop === 0, 'che partono dove stavano', pezzi.map(function(p){return p.offsetLeft+','+p.offsetTop;}).join(' | '));",
    "  bustaColpo();",
    "  dice(_bustaColpi === 5, 'e un sesto colpo non conta', _bustaColpi);",

    // si apre
    // Il server non c-e- (si sta girando da file://), quindi le tre carte le
    // si mette a mano: quello che si sta provando qui e- la SCENA, non il
    // sorteggio — di quello risponde il server.
    "  _bustaCarte = (FINAL_CARDS||[]).slice(0,3);",
    "  dice(_bustaCarte.length === 3, 'il foglio ha almeno tre carte da mostrare', _bustaCarte.length);",
    "  bustaApri();",
    "  dice(scena.classList.contains('busta-apre'), 'la patella si apre');",
    "  dice(!scena.classList.contains('busta-monta'), 'e il tremore finisce li-');",
    "  var uscite = qa('#pack-reveal .pack-card');",
    "  dice(uscite.length === 3, 'ed escono TRE carte', uscite.length);",
    "  dice(uscite.length === 3 && uscite.map(function(c){return c.style.getPropertyValue('--dir');}).join(',') === '-1,0,1', 'una a sinistra, una dritta, una a destra', uscite.map(function(c){return c.style.getPropertyValue('--dir');}).join(','));",
    "  dice(uscite.length === 3 && uscite[2].dataset.indice === '2', 'e ognuna si ricorda il proprio posto', uscite.length===3 ? uscite[2].dataset.indice : '?');",

    // il prezzo: una gratis, la seconda in inchiostro, la terza mai
    "  uscite.forEach(function(c){ c.classList.remove('emerging'); });",
    "  aggiornaSceltaBustina();",
    "  var etichetta = function(c){ var b=c.__sceltaBtn; var e=b&&b.querySelector('.hxb-label'); return e ? e.textContent.trim() : ''; };",
    "  mostraSceltaBustina();",
    "  var b1 = uscite[0].__sceltaBtn;",
    "  dice(b1 && b1.offsetWidth === 300, 'i pulsanti sotto alle carte sono larghi 300', b1 && b1.offsetWidth);",
    // E non si toccano: le carte stanno a PACK_RIPOSO_X l'una dall'altra, e se
    // quel numero scendesse sotto la larghezza del pulsante due pulsanti vicini
    // si sovrapporrebbero. E' successo: 300 di pulsante contro 280 di passo.
    "  dice(PACK_RIPOSO_X >= 300 + 20, 'e fra un pulsante e l-altro resta dell-aria', PACK_RIPOSO_X - 300);",
    // il balzo: :active non si puo- forzare, si legge la regola. Quello che
    // conta e- che la lista contenga ANCORA la traslazione che centra.
    "  var rAttivo = regole.filter(function(r){ return r.selectorText === '.pack-card .pack-scelta-btn:active'; })[0];",
    "  dice(rAttivo && rAttivo.style.transform.indexOf('translateX(-50%)') !== -1, 'e premendoli non perdono la centratura', rAttivo && rAttivo.style.transform);",
    // il cartellino sopra la carta
    "  var cart = uscite[0].querySelector('.pack-etichetta');",
    "  dice(!!cart, 'sopra a ogni carta c-e- il cartellino');",
    "  dice(cart && (cart.textContent === 'New!' || cart.textContent === 'Owned'), 'che dice New! o Owned', cart && cart.textContent);",
    "  var sCart = st(cart);",
    "  dice(sCart.borderTopLeftRadius === '16px', 'con gli angoli a 16', sCart.borderTopLeftRadius);",
    "  dice(sCart.paddingTop === '20px' && sCart.paddingLeft === '12px', 'e il padding 20/12', sCart.paddingTop + '/' + sCart.paddingLeft);",
    "  dice(sCart.fontSize === '22px' && sCart.color === 'rgb(237, 224, 198)', 'a 22px in EDE0C6', sCart.fontSize + ' ' + sCart.color);",
    "  dice(!qa('.pack-card .nuova-nastro').length, 'e il vecchio nastro non c-e- piu-');",
    "  var perForza = uscite[0].querySelector('.pack-etichetta'); perForza.classList.add('pk-nuova');",
    "  dice(st(perForza).backgroundColor === 'rgb(125, 19, 19)', 'le nuove hanno il fondo 7D1313', st(perForza).backgroundColor);",
    "  perForza.classList.toggle('pk-nuova', perForza.textContent === 'New!');",
    "  dice(etichetta(uscite[0]).indexOf('Keep (Free)') === 0, 'la prima e- gratis', etichetta(uscite[0]));",
    "  scegliCartaBustina(uscite[0]);",
    "  dice(etichetta(uscite[0]) === 'Cancel', 'presa, si puo- disfare', etichetta(uscite[0]));",
    "  dice(etichetta(uscite[1]).indexOf('Keep for') === 0, 'la seconda si paga', etichetta(uscite[1]));",
    "  var iconaPrezzo = uscite[1].__sceltaBtn.querySelector('.hxb-label img');",
    "  dice(iconaPrezzo && iconaPrezzo.getAttribute('src').indexOf('magic-ink') !== -1, 'e si paga in inchiostro', iconaPrezzo && iconaPrezzo.getAttribute('src').split('/').pop());",
    "  var prezzoMio = costoDiCarta(uscite[1]);",
    "  dice(etichetta(uscite[1]).indexOf(String(prezzoMio)) !== -1, 'al prezzo della SUA rarita-', etichetta(uscite[1]) + ' (' + (uscite[1].__entry && uscite[1].__entry.rarity) + ')');",
    "  scegliCartaBustina(uscite[1]);",
    "  dice(etichetta(uscite[2]) === 'Discarded', 'e la terza si scarta sempre', etichetta(uscite[2]));",
    "  scegliCartaBustina(uscite[2]);",
    "  dice(_carteTenute().length === 2, 'e non si puo- prenderla lo stesso', _carteTenute().length);",
    "  var etCollect = q('#pack-collect .hxb-label').textContent;",
    "  dice(etCollect.indexOf('Pay') === 0 && etCollect.indexOf(String(costoDiCarta(uscite[1]))) !== -1, 'e il Collect dice quanto si paga', etCollect);",

    // e si torna indietro
    // L-uscita: la scartata svanisce e basta, niente piu- fuoco.
    "  dice(typeof window.incenerisciCarta === 'undefined', 'l-incenerimento non esiste piu-');",
    // Le tenute si leggono PRIMA: _preparaUscita toglie la classe .tenuta —
    // e' un'animazione infinita che va tolta di mezzo — quindi dopo la
    // chiamata _carteTenute() risponde "nessuna".
    "  var primaTenute = _carteTenute();",
    "  var primaScartate = uscite.filter(function(c){ return primaTenute.indexOf(c) === -1; });",
    "  uscitaDopoLaScelta(primaTenute, primaScartate);",
    "  dice(primaScartate[0] && primaScartate[0].classList.contains('svanisce'), 'la scartata si dissolve');",
    "  dice(primaTenute[0].style.getPropertyValue('--fin-x') === '-165.0px', 'e le due tenute si dispongono al centro', primaTenute.map(function(c){ return c.style.getPropertyValue('--fin-x'); }).join(' | '));",
    // Il cartellino se ne va da TUTTE le carte appena si preme Collect.
    "  dice(primaTenute[0].classList.contains('senza-etichetta'), 'e i cartellini se ne vanno dalle tenute');",
    "  dice(primaScartate[0].classList.contains('senza-etichetta'), 'e anche dalle scartate');",
    "  dice(st(primaTenute[0].querySelector('.pack-etichetta')).opacity === '0', 'in dissolvenza', st(primaTenute[0].querySelector('.pack-etichetta')).opacity);",
    // L'uscita: il doppio piu' svelta, e prima scende.
    "  var rVola = regole.filter(function(r){ return r.selectorText === '.pack-card.vola-su'; })[0];",
    "  dice(rVola && rVola.style.animationDuration === '0.32s', 'e il volo dura 320', rVola && rVola.style.animationDuration);",
    "  dice(USCITA_VOLO_MS === 320, 'e il codice lo sa', USCITA_VOLO_MS);",
    "  var kVola = [].concat.apply([], [].map.call(document.styleSheets, function(f){ try{ return [].slice.call(f.cssRules); }catch(e){ return []; } })).filter(function(r){ return r.type === 7 && r.name === 'packVolaSu'; })[0];",
    "  var tuffo = kVola && [].slice.call(kVola.cssRules).filter(function(k){ return k.keyText === '26.9%'; })[0];",
    "  dice(tuffo && tuffo.style.transform.indexOf('+ 52px') !== -1, 'e prima di salire la carta scende', tuffo && tuffo.style.transform);",
    "  dice(USCITA_SLANCIO_MS > 0 && USCITA_SLANCIO_MS < USCITA_VOLO_MS/2, 'e il suono aspetta lo slancio', USCITA_SLANCIO_MS + 'ms su ' + USCITA_VOLO_MS);",
    // Il suono e il fotogramma del tuffo sono lo stesso istante visto da due
    // parti: se uno dei due cambia senza l'altro, si sente prima o dopo di
    // quando la carta inverte davvero.
    "  var quandoInverte = parseFloat((tuffo && tuffo.keyText) || '0') / 100 * USCITA_VOLO_MS;",
    "  dice(Math.abs(quandoInverte - USCITA_SLANCIO_MS) < 3, 'e cade esattamente sul fotogramma del tuffo', quandoInverte.toFixed(1) + 'ms contro ' + USCITA_SLANCIO_MS);",
    "  tornaAllaBustina();",
    "  dice(!scena.classList.contains('sbustando') && !scena.classList.contains('busta-viva'), 'tornando indietro la busta se ne va');",
    "  dice(!scena.classList.contains('busta-rotta') && !scena.classList.contains('busta-apre'), 'con tutto quello che le era successo addosso');",
    "  dice(_bustaColpi === 0, 'e il conto dei colpi riparte da zero', _bustaColpi);",
    "  dice(q('#pack-briciole').children.length === 0, 'e le briciole sono state spazzate', q('#pack-briciole').children.length);",
    "  dice(qa('#pack-reveal .pack-card').length === 0, 'e non restano carte in scena');",

    // ── si consuma il pacchetto che si e- preso in mano, e nessun altro ───
    // Non si passa piu- da un click: si chiama bustaSolleva, che e- quello che
    // il gesto chiama, e poi bustaPosa, che e- quello che il rilascio chiama.
    "  PREFERENZE.bustinaProssima = 0; BUSTINE_VINTE = 2; BUSTINE_TESORO = 1; pkDisegnaTutto();",
    "  dice(bustaSolleva('treasure', 900, 500), 'si prende in mano un treasure');",
    "  bustaPosa();",
    "  dice(scena.classList.contains('sbustando'), 'posandolo la pagina passa alla scena');",
    "  dice(BUSTINE_TESORO === 0, 'e il tesoro si scala subito', BUSTINE_TESORO);",
    "  dice(BUSTINE_VINTE === 2, 'senza toccare i premi', BUSTINE_VINTE);",
    "  dice(bustinaDailyPronta(), 'ne- il pacchetto a tempo');",
    "  tornaAllaBustina();",
    "  dice(!scena.classList.contains('sbustando'), 'e si torna alla pagina');",
    "  dice(!bustaSolleva('treasure', 900, 500), 'un treasure che non si ha piu- non si prende');",
    "  dice(bustaSolleva('daily', 900, 500), 'quello a tempo si');",
    "  bustaPosa();",
    "  dice(!bustinaDailyPronta(), 'e il conto delle dodici ore riparte');",
    "  dice(Math.abs(_bustinaProssimaApertura() - Date.now() - 12*60*60*1000) < 4000, 'da adesso', Math.round((_bustinaProssimaApertura()-Date.now())/3600000) + 'h');",
    "  tornaAllaBustina();",
    "  dice(!bustaSolleva('zuppa', 900, 500), 'e un tipo che non esiste non si prende affatto');",

    // ── i tre pulsanti nel menu di debug ─────────────────────────────────
    "  var etichette = qa('#debug-modal-overlay .hxb-label').map(function(e){ return e.textContent.trim(); });",
    "  dice(etichette.indexOf('Add 100 magic ink') !== -1, 'c-e- il pulsante dell-inchiostro');",
    "  dice(etichette.indexOf('Spawn Treasure pack') !== -1, 'quello del treasure');",
    "  dice(etichette.indexOf('Spawn Reward pack') !== -1, 'e quello del reward');",
    "  dice(typeof debugRegala === 'function', 'e chiedono al server, non al browser');",

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
