// Il banco di "Remember me".
//
//   npx electron strumenti/prova-ricordami.js
//
// PERCHE' ESISTE. Questa e' l'unica riga di codice del gioco che ha il permesso
// di scrivere nel browser, e il permesso e' stretto: SOLO se la spunta e'
// accesa, SOLO il token di rinnovo, e la casella si RILEGGE una volta sola.
// Ognuna di quelle tre cose, se salta, non si vede giocando — si vede fra sei
// mesi, quando due account si mescolano di nuovo. Quindi si prova qui.
//
// LA TRAPPOLA DI QUESTO BANCO: la pagina, all'avvio, prova gia' da sola il
// rientro (vedi avviaRicordo, chiamata dentro runPreload), e quel tentativo
// CONSUMA la lettura unica. E' voluto — la prova F si appoggia proprio a
// questo — ma va saputo, o si scambia per un difetto il fatto che
// ricordoLeggiUnaVolta torni nulla.
//
// Le variabili di modulo (_ricordoAttivo, CHIAVE_RICORDO) NON stanno su window:
// let e const in cima a uno script non ci finiscono. Da qui si arriva solo alle
// funzioni dichiarate, ed e' il motivo per cui l'interruttore si accende
// passando dalla porta vera — accediConPassword — invece che a mano.
const { app, BrowserWindow } = require('electron');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var CHIAVE = 'hextale.ricordami';
  var leggi = function(){ try{ return localStorage.getItem(CHIAVE); }catch(_){ return null; } };
  try {
    var sp = document.getElementById('splash'); if(sp) sp.remove();

    // ── A. la riga c'e', ed e' spenta ───────────────────────────────────
    var cb = document.getElementById('login-ricordami');
    dice(!!cb, 'la casella Remember me esiste');
    dice(cb && cb.type === 'checkbox', 'ed e- una casella di spunta', cb && cb.type);
    dice(cb && !cb.checked, 'spenta di partenza');
    var riga = cb && cb.closest('.filters-opt');
    dice(!!riga, 'sta in una riga .filters-opt');
    dice(!!(riga && riga.classList.contains('hx-ricorda')), 'con la misura sua (.hx-ricorda)');
    dice(!!(riga && riga.querySelector('.filters-casella')), 'e la casella disegnata');
    dice(!!(riga && /Remember me/.test(riga.textContent)), 'e dice Remember me');
    dice(!!(riga && riga.closest('#modulo-login')), 'dentro al modulo di accesso');
    var pan = riga && riga.closest('.hx-pannello');
    var off = pan ? getComputedStyle(pan).getPropertyValue('--hx-casella-off') : '';
    var on  = pan ? getComputedStyle(pan).getPropertyValue('--hx-casella-on') : '';
    dice(/checkbox-square-unchecked/.test(off), 'la faccia spenta e- vestita', off.trim().slice(0, 60));
    dice(/checkbox-square-checked/.test(on),   'e quella accesa pure',        on.trim().slice(0, 60));

    // ── A2. l'ordine del pannello, e cosa sta fuori ─────────────────────
    // Si legge il DOM in fila e si confronta con l'ordine chiesto. Un elenco
    // di controlli "questo c-e-" non se ne accorgerebbe: l-ordine e- la
    // richiesta, non la presenza.
    var sigla = function(el){
      if(el.id) return '#' + el.id;
      if(el.classList.contains('hx-riga-oppure')) return 'or';
      if(el.classList.contains('hx-riga-corta')) return 'tratto';
      if(el.classList.contains('hx-riga-scelte')) return 'scelte';
      if(el.classList.contains('hx-campo-pwd')) return 'password';
      if(el.classList.contains('hx-link')) return 'forgot';
      if(el.classList.contains('hx-ricorda')) return 'ricordami';
      if(el.classList.contains('hx-btn')) return 'btn:' + (el.textContent || '').trim();
      return el.tagName.toLowerCase();
    };
    var fila = function(dentro){
      return [].slice.call(dentro.children).map(sigla).join(' | ');
    };
    var pannello = document.querySelector('#modulo-login .hx-pannello');
    var atteso = ['#login-user', 'password', 'scelte', '#login-messaggio',
                  'btn:Login', 'or', '#login-google-btn',
                  '#accesso-offline'].join(' | ');
    dice(pannello && fila(pannello) === atteso, 'il pannello e- nell-ordine chiesto',
      pannello ? fila(pannello) : '(manca)');
    var colonna = document.getElementById('start-accesso');
    var fuori = colonna ? fila(colonna) : '';
    dice(/#accesso-crea \\| tratto \\| btn:Exit game$/.test(fuori),
      'e fuori: crea account, tratto, esci', fuori);
    dice(!!(colonna && !colonna.querySelector('#modulo-registrazione #login-google-btn')),
      'Google non e- rimasto anche sulla registrazione');
    // La riga a due: la spunta a sinistra, il collegamento a destra. Non si
    // guarda l-ordine nel DOM — quello lo direbbe anche una riga incolonnata —
    // ma DOVE finiscono davvero i due riquadri.
    var scelte = pannello && pannello.querySelector('.hx-riga-scelte');
    if(scelte){
      var rr = scelte.getBoundingClientRect();
      var rSpunta = scelte.querySelector('.hx-ricorda').getBoundingClientRect();
      var rLink = scelte.querySelector('.hx-link').getBoundingClientRect();
      dice(Math.abs(rSpunta.left - rr.left) < 2, 'Remember me e- allineato a sinistra',
        Math.round(rSpunta.left - rr.left) + 'px dal bordo');
      dice(Math.abs(rr.right - rLink.right) < 2, 'e Forgot password a destra',
        Math.round(rr.right - rLink.right) + 'px dal bordo');
      dice(rSpunta.right <= rLink.left + 1, 'e non si sovrappongono');
    } else dice(false, 'la riga a due non si trova');
    // Il pulsante di Google e- NOSTRO: nessun iframe, e il clic va a noi.
    var goog = document.getElementById('login-google-btn');
    dice(!!goog && getComputedStyle(goog).display !== 'none', 'il pulsante di Google e- visibile',
      goog && getComputedStyle(goog).display);
    dice(!!goog && /accessoConGoogle/.test(goog.getAttribute('onclick') || ''),
      'e il clic lo prende il gioco', goog && goog.getAttribute('onclick'));
    dice(!document.querySelector('#modulo-login iframe'), 'e non c-e- nessun iframe nel pannello');

    // ── A3. le misure chieste ───────────────────────────────────────────
    var campo = document.getElementById('login-user');
    dice(campo && getComputedStyle(campo).fontSize === '16px', 'i campi scrivono a 16px',
      campo && getComputedStyle(campo).fontSize);
    dice(riga && getComputedStyle(riga).fontSize === '14px', '"Remember me" a 14px',
      riga && getComputedStyle(riga).fontSize);

    // ── A4. la casella spuntata e- dieci pixel piu- grande, e non sposta ─
    var quadro = riga.querySelector('.filters-casella');
    var primaL = quadro.offsetWidth, primaH = quadro.offsetHeight;
    var primaRiga = Math.round(riga.getBoundingClientRect().width);
    cb.checked = true;
    var dopoL = quadro.offsetWidth, dopoH = quadro.offsetHeight;
    var dopoRiga = Math.round(riga.getBoundingClientRect().width);
    cb.checked = false;
    dice(dopoL - primaL === 10, 'spuntata e- 10px piu- larga', primaL + ' -> ' + dopoL);
    dice(dopoH - primaH === 10, 'e 10px piu- alta', primaH + ' -> ' + dopoH);
    dice(primaRiga === dopoRiga, 'e la riga intorno non si muove', primaRiga + ' -> ' + dopoRiga);
    // Vale anche per le caselle grandi, quelle dei filtri: la regola e- una.
    var grande = document.querySelector('#settings-pannello .settings-opzione .filters-casella');
    if(grande){
      var g1 = grande.offsetWidth;
      var suo = grande.parentNode.querySelector('input[type="checkbox"]');
      suo.checked = true; var g2 = grande.offsetWidth; suo.checked = false;
      dice(g2 - g1 === 10, 'e la stessa regola vale per le altre caselle', g1 + ' -> ' + g2);
    } else dice(false, 'la casella delle impostazioni non si trova');

    // ── B. spenta, non si scrive niente ─────────────────────────────────
    try{ localStorage.removeItem(CHIAVE); }catch(_){}
    sessioneAccount = { token:'T', refresh:'RT-DI-PROVA', scadenza:0, email:'a@b.c', username:'', userId:'' };
    nakamaRiscriviSessione();
    dice(leggi() === null, 'spenta: nakamaRiscriviSessione non scrive niente', String(leggi()));

    // ── C. accesa, si entra e si scrive ─────────────────────────────────
    var entrato = null;
    var veroEntra = accessoEntra, veroProfilo = nakamaCompletaProfilo, veroAuth = nakamaAutenticaEmail;
    window.accessoEntra = function(s){ entrato = s; return Promise.resolve(); };
    window.nakamaCompletaProfilo = function(){ return Promise.resolve(); };
    window.nakamaAutenticaEmail = function(){ return Promise.resolve({ token:'TOK-1', refresh_token:'RT-1' }); };
    document.getElementById('login-user').value = 'lorenzo@hextale.test';
    document.getElementById('login-pwd').value = 'unapassword';
    cb.checked = true;
    await accediConPassword(document.querySelector('#modulo-login .hx-azione'));
    await respira(50);
    var scritto = null; try{ scritto = JSON.parse(leggi() || 'null'); }catch(_){}
    dice(!!entrato, 'accesa: si entra lo stesso');
    dice(!!scritto, 'accesa: la casella e- stata scritta');
    dice(!!(scritto && scritto.refresh === 'RT-1'), 'e dentro c-e- il token di rinnovo', scritto && scritto.refresh);
    dice(!!(scritto && scritto.email === 'lorenzo@hextale.test'), 'e l-email a cui appartiene', scritto && scritto.email);
    var chiaviScritte = scritto ? Object.keys(scritto).sort().join(',') : '';
    dice(chiaviScritte === 'email,refresh', 'e NIENT-ALTRO', chiaviScritte);
    dice(String(leggi()).indexOf('TOK-1') === -1, 'il token di sessione NON si scrive');

    // ── D. il rinnovo riscrive il token nuovo ───────────────────────────
    nakamaSalvaSessione({ token:'TOK-2', refresh_token:'RT-2' }, 'lorenzo@hextale.test');
    var dopo = null; try{ dopo = JSON.parse(leggi() || 'null'); }catch(_){}
    dice(!!(dopo && dopo.refresh === 'RT-2'), 'al rinnovo si riscrive il token nuovo', dopo && dopo.refresh);

    // ── E. spegnerla e rientrare cancella il ricordo ────────────────────
    cb.checked = false;
    document.getElementById('login-pwd').value = 'unapassword';
    await accediConPassword(document.querySelector('#modulo-login .hx-azione'));
    await respira(50);
    dice(leggi() === null, 'spenta al rientro: il ricordo si cancella', String(leggi()));

    // Il ricordo NON e' fra le chiavi che l-avvio spazza via, o si
    // cancellerebbe da solo alla prima apertura.
    try{ localStorage.setItem(CHIAVE, '{"refresh":"RT-3"}'); }catch(_){}
    _localeRipulito = false;
    _ripuliscilLocaleVecchio();
    dice(leggi() !== null, 'la pulizia dell-avvio non lo tocca');

    // ── F. si legge UNA volta sola ──────────────────────────────────────
    // La pagina ha gia- letto all-avvio (colonna d-accesso, tentaAccessoRicordato):
    // qui dentro c-e- RT-3 da un istante fa, e deve NON vederlo.
    var riletto = ricordoLeggiUnaVolta();
    dice(riletto === null, 'ricordoLeggiUnaVolta non rilegge la casella',
      riletto ? JSON.stringify(riletto) : 'nulla');

    // ── G. dimenticare dimentica ────────────────────────────────────────
    ricordoDimentica();
    dice(leggi() === null, 'ricordoDimentica svuota la casella');
    dice(ricordoRichiesto() === false, 'ricordoRichiesto legge la spunta (spenta)');
    cb.checked = true;
    dice(ricordoRichiesto() === true, 'ricordoRichiesto legge la spunta (accesa)');
    cb.checked = false;

    window.accessoEntra = veroEntra;
    window.nakamaCompletaProfilo = veroProfilo;
    window.nakamaAutenticaEmail = veroAuth;
    try{ localStorage.removeItem(CHIAVE); }catch(_){}
    return d.join(String.fromCharCode(10));
  } catch(e) {
    return 'PIANTATA: ' + (e && e.message) + ' @ ' + ((e && e.stack) || '').split(String.fromCharCode(10))[1]
      + String.fromCharCode(10) + d.join(String.fromCharCode(10));
  }
})()`;

// ── SECONDO GIRO: la finestra si riapre e non si vede NIENTE ──────────────
// Dalla v0.79.49 il rientro parte dentro runPreload(), al DOMContentLoaded:
// non c'e' nessun momento, dopo il caricamento, in cui si faccia in tempo a
// mettere uno stub. Quindi non se ne mettono — si sostituisce `fetch` in un
// preload (vedi prova-ricordami-preload.js), e la strada che il banco prova e'
// quella VERA: rinnovo, sessione, sedia, accordo, menu.
const PRELOAD = require('path').join(__dirname, 'prova-ricordami-preload.js');

const CODA = `(function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var b = window.__banco || {};
  var acceso = b.acceso || {};
  dice(b.rinnovi >= 1, 'il rinnovo e- stato chiesto', b.rinnovi);
  dice(b.usato === 'RT-VECCHIO', 'col token che c-era nella casella', b.usato);
  // Il segno che si e- entrati davvero: il menu e- montato nel documento, e la
  // schermata iniziale non c-e- piu- (le pagine sono ermetiche).
  dice(!!document.getElementById('main-menu'), 'si e- entrati nel menu senza password');
  dice(!document.getElementById('start-screen'), 'e la schermata iniziale e- smontata');
  // E il punto della richiesta: logo e colonna d-accesso non si sono MAI accesi.
  dice(!acceso['start-logo-wrap'], 'il logo non si e- mai acceso');
  dice(!acceso['start-accesso'], 'e nemmeno la colonna d-accesso');
  dice(!!acceso['start-bg-img'], 'lo sfondo invece si- (l-osservatore guarda davvero)');
  var scritto = null; try{ scritto = JSON.parse(localStorage.getItem('hextale.ricordami') || 'null'); }catch(_){}
  dice(!!(scritto && scritto.refresh === 'RT-NUOVO'), 'e la casella porta gia- il token nuovo', scritto && scritto.refresh);
  try{ localStorage.removeItem('hextale.ricordami'); }catch(_){}
  return d.join(String.fromCharCode(10));
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1600, height: 1000,
    webPreferences: { contextIsolation: false, webSecurity: false, preload: PRELOAD } });
  await win.loadURL('file:///C:/Users/masil/Desktop/Hextale/game-assets/play/index.html');
  // Si aspetta che la colonna d'accesso sia comparsa: e' li' che si vede se la
  // cascata e' andata fino in fondo, ed e' dopo che la lettura unica e' stata
  // consumata da avviaRicordo().
  await new Promise(r => setTimeout(r, 9000));
  let out;
  try { out = await win.webContents.executeJavaScript(CORPO); }
  catch(e){ out = 'ERRORE NELL\'INIEZIONE: ' + (e && e.message); }
  console.log('\n' + out);

  // Si semina la casella e si riapre la finestra.
  await win.webContents.executeJavaScript(
    "localStorage.setItem('hextale.ricordami', JSON.stringify({refresh:'RT-VECCHIO', email:'lorenzo@hextale.test'})), true");
  await win.webContents.reload();
  await new Promise(r => setTimeout(r, 13000));
  let coda;
  try { coda = await win.webContents.executeJavaScript(CODA); }
  catch(e){ coda = '  NO  il secondo giro non e- partito: ' + (e && e.message); }
  console.log(coda + '\n');

  const tutto = out + '\n' + coda;
  app.exit(tutto.indexOf('  NO  ') !== -1 || tutto.indexOf('PIANTATA') === 0 ? 1 : 0);
});
