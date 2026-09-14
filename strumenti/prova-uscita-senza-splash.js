// DISCONNECT: SI TORNA AL MODULO D'ACCESSO SENZA RIVEDERE LO SPLASH.
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-uscita-senza-splash.js
//
// Richiesta di Lorenzo (v0.80.6): "quando si clicca su Disconnect, skippa
// l'animazione Big Fennel e rimanda subito l'utente al login form."
// Uscire ricarica la pagina (vedi _fuoriDalGioco), e la ricarica rigiocava
// l'avvio intero: logo di Big Fennel, tre secondi di sfondo dal nero, e solo
// dopo il modulo. Il segno per saltarlo viaggia nell'indirizzo (#uscito), non
// nel browser.
//
// Qui:
//   1. un avvio normale mostra lo splash;
//   2. Disconnect ricarica SENZA splash, e l'indirizzo torna pulito;
//   3. il modulo d'accesso arriva molto prima che in un avvio normale;
//   4. un aggiornamento fatto a mano dopo rigioca lo splash come sempre.
const { app, BrowserWindow } = require('electron');
require('./dal-disco');   // v0.80.22 — gli asset di hextalegame.com dal disco, non dal sito
const path = require('path');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
setTimeout(() => { console.error('PIANTATA: nessuna risposta in 150s'); app.exit(2); }, 150000);

const PAGINA = 'file:///' + path.resolve(__dirname, '..').split(path.sep).join('/') + '/play/index.html';
const dette = [];
const dice = (ok, che, perche) => dette.push((ok ? '  ok  ' : '  NO  ') + che + (perche !== undefined ? '   [' + perche + ']' : ''));
const respira = ms => new Promise(r => setTimeout(r, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, frame: false,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  win.setPosition(-3200, 0); win.showInactive();
  const js = s => win.webContents.executeJavaScript(s);
  const caricata = () => new Promise(r => win.webContents.once('did-finish-load', r));
  // Quanto ci mette il modulo d'accesso ad accendersi, da adesso.
  const attendiModulo = async (da) => {
    for (let i = 0; i < 300; i++) {
      if (await js(`!!(document.getElementById('start-accesso') && document.getElementById('start-accesso').classList.contains('show'))`)) return Date.now() - da;
      await respira(100);
    }
    return -1;
  };

  // ── 1. avvio normale ────────────────────────────────────────────────────
  let t0 = Date.now();
  await win.loadURL(PAGINA);
  dice(await js(`!!document.getElementById('splash')`), 'un avvio normale mostra lo splash');
  const normale = await attendiModulo(t0);
  dice(normale > 0, 'e il modulo d-accesso arriva', normale + ' ms');

  // ── 2. Disconnect ───────────────────────────────────────────────────────
  // La sedia si finge: fuori dal server non c'e' nessuno a cui restituirla.
  const dopo = caricata();
  t0 = Date.now();
  await js(`window.lasciaLaSedia = async function(){}; disconnetti(); 1`);
  await dopo;
  dice(!(await js(`!!document.getElementById('splash')`)), 'dopo Disconnect lo splash non c-e-');
  dice((await js(`location.hash`)) === '', 'e l-indirizzo torna pulito', await js(`location.href`));
  const uscita = await attendiModulo(t0);
  dice(uscita > 0 && uscita < normale - 5000, 'il modulo d-accesso arriva subito, non dopo lo splash e lo sfondo',
    'uscita ' + uscita + ' ms, avvio normale ' + normale + ' ms');
  dice(await js(`!!document.querySelector('#modulo-login.mostra')`), 'ed e- il modulo di login');

  // ── 3. aggiornamento a mano ─────────────────────────────────────────────
  const ancora = caricata();
  await js(`location.reload(); 1`);
  await ancora;
  dice(await js(`!!document.getElementById('splash')`), 'un aggiornamento a mano dopo rigioca lo splash');

  console.log('\n' + dette.join('\n') + '\n');
  app.exit(dette.some(d => d.indexOf('  NO  ') === 0) ? 1 : 0);
});
