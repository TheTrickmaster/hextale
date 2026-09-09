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
// rientro (vedi tentaAccessoRicordato), e quel tentativo CONSUMA la lettura
// unica. E' voluto — la prova F si appoggia proprio a questo — ma va saputo,
// o si scambia per un difetto il fatto che ricordoLeggiUnaVolta torni nulla.
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

// ── SECONDO GIRO: la finestra si riapre e deve rientrare da sola ──────────
// Gli stub si mettono a dom-ready, cioe' PRIMA che scatti il tentativo — che
// parte quando la colonna d'accesso compare, molti secondi dopo. Metterli
// dopo vorrebbe dire stare a guardare una richiesta vera partire davvero
// verso il server.
const STUB = `(function(){
  window.__rientro = { rinnovi: 0, entrato: null };
  var mettiStub = function(){
    if(typeof nakamaRinnovaSessione !== 'function') return false;
    window.nakamaRinnovaSessione = function(rt){
      window.__rientro.rinnovi++;
      window.__rientro.usato = rt;
      return Promise.resolve({ token:'TOK-NUOVO', refresh_token:'RT-NUOVO' });
    };
    window.nakamaCompletaProfilo = function(){ return Promise.resolve(); };
    window.accessoEntra = function(s){ window.__rientro.entrato = s; return Promise.resolve(); };
    return true;
  };
  var t = setInterval(function(){ if(mettiStub()) clearInterval(t); }, 30);
  return true;
})()`;

const CODA = `(function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var r = window.__rientro || {};
  dice(r.rinnovi === 1, 'il rinnovo e- stato chiesto una volta sola', r.rinnovi);
  dice(r.usato === 'RT-VECCHIO', 'col token che c-era nella casella', r.usato);
  dice(!!r.entrato, 'e si e- entrati senza password');
  dice(!!(r.entrato && r.entrato.refresh === 'RT-NUOVO'), 'con la sessione nuova', r.entrato && r.entrato.refresh);
  var c = document.getElementById('login-ricordami');
  dice(!!(c && c.checked), 'la spunta si ritrova accesa');
  var e = document.getElementById('login-user');
  dice(!!(e && e.value === 'lorenzo@hextale.test'), 'e l-email gia- scritta', e && e.value);
  var scritto = null; try{ scritto = JSON.parse(localStorage.getItem('hextale.ricordami') || 'null'); }catch(_){}
  dice(!!(scritto && scritto.refresh === 'RT-NUOVO'), 'e la casella porta gia- il token nuovo', scritto && scritto.refresh);
  try{ localStorage.removeItem('hextale.ricordami'); }catch(_){}
  return d.join(String.fromCharCode(10));
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1600, height: 1000,
    webPreferences: { contextIsolation: false, webSecurity: false } });
  await win.loadURL('file:///C:/Users/masil/Desktop/Hextale/game-assets/play/index.html');
  // Si aspetta che la colonna d'accesso sia comparsa: e' li' che la pagina fa
  // il suo unico tentativo di rientro, ed e' quello che consuma la lettura.
  await new Promise(r => setTimeout(r, 9000));
  let out;
  try { out = await win.webContents.executeJavaScript(CORPO); }
  catch(e){ out = 'ERRORE NELL\'INIEZIONE: ' + (e && e.message); }
  console.log('\n' + out);

  // Si semina la casella e si riapre la finestra.
  await win.webContents.executeJavaScript(
    "localStorage.setItem('hextale.ricordami', JSON.stringify({refresh:'RT-VECCHIO', email:'lorenzo@hextale.test'})), true");
  win.webContents.once('dom-ready', () => { win.webContents.executeJavaScript(STUB).catch(()=>{}); });
  await win.webContents.reload();
  await new Promise(r => setTimeout(r, 11000));
  let coda;
  try { coda = await win.webContents.executeJavaScript(CODA); }
  catch(e){ coda = '  NO  il secondo giro non e- partito: ' + (e && e.message); }
  console.log(coda + '\n');

  const tutto = out + '\n' + coda;
  app.exit(tutto.indexOf('  NO  ') !== -1 || tutto.indexOf('PIANTATA') === 0 ? 1 : 0);
});
