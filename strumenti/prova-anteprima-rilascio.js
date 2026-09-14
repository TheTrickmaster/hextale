// L'ANTEPRIMA, L'AGGIORNAMENTO CHE ASPETTA LA FINE DELLA PARTITA, IL MODULO DEI COMMENTI.
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-anteprima-rilascio.js
//
// Richiesta di Lorenzo (v0.80.15): "ci sono dei giocatori online e non voglio
// che vengano disconnessi al push di una nuova versione". Due cose nel client:
//   1. le versioni da provare vanno in /anteprima/: la stessa pagina, che la'
//      dice "preview" sulla targhetta e non cerca avversari in rete (si
//      incontrerebbero giocatori con un'altra versione); contro il bot si gioca;
//   2. la finestra "nuova versione", che blocca e ricarica in dieci secondi,
//      a partita in corso non si apre: aspetta il ritorno al menu.
// E il pulsante "Give us feedback" (menu e impostazioni) apre il modulo Google.
//
// Per la prima parte serve la pagina sotto un percorso /anteprima/: il banco ne
// fa una copia in una cartella temporanea e la apre da li'.
const { app, BrowserWindow } = require('electron');
require('./dal-disco');   // v0.80.22 — gli asset di hextalegame.com dal disco, non dal sito
const path = require('path');
const fs = require('fs');
const os = require('os');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
setTimeout(() => { console.error('PIANTATA: nessuna risposta in 150s'); app.exit(2); }, 150000);

const RADICE = path.resolve(__dirname, '..');
const url = p => 'file:///' + p.split(path.sep).join('/');
const dette = [];
const dice = (ok, che, perche) => dette.push((ok ? '  ok  ' : '  NO  ') + che + (perche !== undefined ? '   [' + perche + ']' : ''));

async function apri(win, indirizzo){
  await win.loadURL(indirizzo);
  await new Promise(r => setTimeout(r, 12000));
  await win.webContents.insertCSS('#splash{display:none!important} #tutorial-overlay{display:none!important}');
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show:false, width:1920, height:1080, frame:false, useContentSize:true,
    webPreferences:{ contextIsolation:false, webSecurity:false, backgroundThrottling:false } });
  win.setPosition(-3200, 0); win.showInactive();
  const js = s => win.webContents.executeJavaScript(s);

  // ── A. LA PAGINA DI SEMPRE (/play/) ──────────────────────────────────────
  await apri(win, url(path.join(RADICE, 'play', 'index.html')));
  const a = JSON.parse(await js(`(async function(){
    const r = {};
    r.anteprima = ANTEPRIMA;
    r.targhetta = document.getElementById('build-version-badge').textContent;
    try{ apriMenuPrincipale(); }catch(e){ showPage('mainmenu'); }
    await new Promise(z => setTimeout(z, 2500));
    // Il modulo dei commenti: si intercetta window.open.
    const aperti = []; const vero = window.open;
    window.open = (u, t, f) => { aperti.push([u, t, f]); return null; };
    document.getElementById('mm2-feedback-btn').click();
    r.menuFeedback = aperti.slice();
    openSettingsModal('menu');
    await new Promise(z => setTimeout(z, 600));
    const inImp = document.querySelector('#settings-modal .hx-feedback-btn');
    r.impFeedbackVestito = !!(inImp && inImp.querySelector('.hxb-left') && getComputedStyle(inImp.querySelector('.hxb-left')).backgroundImage !== 'none');
    const donImp = document.querySelector('#settings-modal .hx-donate-btn');
    r.impSottoAlDonate = !!(inImp && donImp && inImp.getBoundingClientRect().top >= donImp.getBoundingClientRect().bottom - 1);
    aperti.length = 0;
    if(inImp) inImp.click();
    r.impFeedback = aperti.slice();
    window.open = vero;
    closeSettingsModal();

    // L'aggiornamento: in partita aspetta, nel menu blocca.
    _giocatoreDentro = true;
    const ov = document.getElementById('aggiorna-overlay');
    showPage('game');
    await new Promise(z => setTimeout(z, 800));
    controllaVersioneDaNote([{ versione:'v9.9.9', voci:[] }]);
    r.inPartitaAperta = ov.classList.contains('show');
    r.inPartitaInAttesa = _aggiornamentoInAttesa;
    showPage('mainmenu');
    await new Promise(z => setTimeout(z, 800));
    controllaVersioneDaNote([{ versione:'v9.9.9', voci:[] }]);
    r.nelMenuAperta = ov.classList.contains('show');
    // Si spegne il conto alla rovescia prima che ricarichi la pagina del banco.
    if(_aggiornaConto){ clearInterval(_aggiornaConto); _aggiornaConto = null; }
    ov.classList.remove('show');
    return JSON.stringify(r);
  })()`));
  dice(a.anteprima === false, 'in /play/ non e- l-anteprima', a.anteprima);
  dice(!/preview/i.test(a.targhetta), 'e la targhetta non dice preview', a.targhetta);
  dice(a.menuFeedback.length === 1 && a.menuFeedback[0][0] === 'https://forms.gle/54LgVmaoXKpnVpwh9' && a.menuFeedback[0][1] === '_blank',
    'Give us feedback nel menu apre il modulo in una scheda nuova', JSON.stringify(a.menuFeedback));
  dice(a.impFeedbackVestito && a.impSottoAlDonate, 'nelle impostazioni c-e- anche li-, vestito, sotto al Donate');
  dice(a.impFeedback.length === 1 && a.impFeedback[0][0] === 'https://forms.gle/54LgVmaoXKpnVpwh9', 'e apre lo stesso modulo', JSON.stringify(a.impFeedback));
  dice(a.inPartitaAperta === false && a.inPartitaInAttesa === true, 'a partita in corso la versione nuova non blocca: aspetta',
    'finestra ' + a.inPartitaAperta + ', in attesa ' + a.inPartitaInAttesa);
  dice(a.nelMenuAperta === true, 'e nel menu la finestra si apre come prima');

  // ── B. LA STESSA PAGINA IN /anteprima/ ───────────────────────────────────
  const cartella = path.join(os.tmpdir(), 'hextale-banco', 'anteprima');
  fs.mkdirSync(cartella, { recursive: true });
  fs.copyFileSync(path.join(RADICE, 'play', 'index.html'), path.join(cartella, 'index.html'));
  await apri(win, url(path.join(cartella, 'index.html')));
  const b = JSON.parse(await js(`(async function(){
    const r = {};
    r.anteprima = ANTEPRIMA;
    r.targhetta = document.getElementById('build-version-badge').textContent;
    try{ apriMenuPrincipale(); }catch(e){ showPage('mainmenu'); }
    await new Promise(z => setTimeout(z, 2500));
    const avvisi = []; const vero = window.apriAvviso;
    window.apriAvviso = (t, c) => avvisi.push(t);
    const cercava = () => (typeof _mm2Cercando !== 'undefined') && _mm2Cercando;
    mm2Vista('matchmaking');
    await mm2CercaAvversario();
    r.avvisoRete = avvisi.slice();
    r.cercaInRete = cercava();
    // Contro il bot si parte: basta vedere che si chiede una partita.
    const veraRichiesta = window.requestNewGame; let chiesta = false;
    window.requestNewGame = () => { chiesta = true; };
    mm2Vista('ai');
    await mm2CercaAvversario();
    r.botParte = chiesta;
    window.requestNewGame = veraRichiesta; window.apriAvviso = vero;
    return JSON.stringify(r);
  })()`));
  dice(b.anteprima === true, 'in /anteprima/ la pagina sa di esserlo', b.anteprima);
  dice(/v\d+\.\d+\.\d+ preview$/.test(b.targhetta), 'e la targhetta dice preview', b.targhetta);
  dice(b.avvisoRete.join() === 'Preview build' && !b.cercaInRete, 'Find opponent non cerca in rete: lo spiega', JSON.stringify(b.avvisoRete));
  dice(b.botParte === true, 'contro il bot invece si gioca');

  console.log('\n' + dette.join('\n') + '\n');
  app.exit(dette.some(d => d.indexOf('  NO  ') === 0) ? 1 : 0);
});
