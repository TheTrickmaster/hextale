// APRE IL GIOCO E GUARDA COSA NON ARRIVA.
//
//     $ELECTRON strumenti/prova-asset-vivi.js
//
// Carica play/index.html da rete vera e conta le richieste FALLITE: un asset
// spostato e non ricollegato non da' nessun errore in pagina — l'immagine
// semplicemente non c'e', e ci si accorge del buco guardando lo schermo giorni
// dopo. Qui invece si vede subito, con il suo indirizzo.
//
// Nota: aperto da disco, ogni asset viene prima cercato accanto al file (vedi
// _candidati) e quel primo tentativo fallisce sempre. Sono 404 attesi e
// vengono messi da parte: quelli che contano sono quelli su hextalegame.com.
const { app, BrowserWindow, session } = require('electron');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';
const ATTESA_MS = Number(process.argv[2] || 12000);

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080,
    webPreferences: { contextIsolation: false, webSecurity: false } });

  const falliti = new Map();   // url -> codice
  const chieste = new Set();
  win.webContents.session.webRequest.onCompleted({ urls: ['*://*/*'] }, (d) => {
    chieste.add(d.url);
    if (d.statusCode >= 400) falliti.set(d.url, d.statusCode);
  });
  win.webContents.session.webRequest.onErrorOccurred({ urls: ['*://*/*'] }, (d) => {
    if (!/ABORTED/.test(d.error || '')) falliti.set(d.url, d.error);
  });

  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, ATTESA_MS));
  // Un giro anche dentro al menu e alla partita, dove vive meta' degli asset.
  try {
    await win.webContents.executeJavaScript(`(function(){
      try{ montaGraficaPartita(); }catch(_){ }
      try{ montaMenuPrincipale && montaMenuPrincipale(); }catch(_){ }
      try{ apriMenuPrincipale(); }catch(_){ }
      return true;
    })()`);
  } catch (_) { }
  await new Promise(r => setTimeout(r, 6000));

  const remoti = [...falliti.entries()].filter(([u]) => /hextalegame\.com/.test(u));
  console.log('richieste viste: ' + chieste.size);
  console.log('fallite su hextalegame.com: ' + remoti.length);
  for (const [u, c] of remoti) console.log('  ' + c + '  ' + u.replace('https://hextalegame.com/', ''));
  if (!remoti.length) console.log('\n  nessun asset mancante.');
  app.exit(remoti.length ? 1 : 0);
}).catch(e => { console.error(e); app.exit(1); });
