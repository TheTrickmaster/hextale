// ═══════════════════════════════════════════════════════════════════════════
// HEXTALE — IL GUSCIO (app desktop, v0.80.30)
// ═══════════════════════════════════════════════════════════════════════════
// Lorenzo: "creiamo il guscio Electron che installa tutto su locale al primo
// avvio cosi' non deve piu' richiedere gli asset. Da ora in avanti il gioco si
// puo' giocare solo da desktop Electron."
//
// IL GIOCO GIRA COME SUL SITO, MA DAL DISCO. La finestra apre
// https://hextalegame.com/play/index.html e OGNI richiesta a hextalegame.com
// (l'HTML, le immagini, l'audio, le note di rilascio, gli indirizzi scritti per
// intero e quelli relativi) si serve dai file sul disco: nessuna richiesta al
// sito, quindi nessun limite per IP. E' la stessa strada dei banchi
// (strumenti/dal-disco.js), e l'origine resta hextalegame.com: il server di
// gioco, "Remember me" e l'accesso con Google la riconoscono come quella del
// sito. Tutto il resto (api.hextalegame.com, Google) passa com'e'.
//
// GLI AGGIORNAMENTI arrivano da Cloudflare R2 (download.hextalegame.com, vedi
// aggiornatore.js).
//   ALL'AVVIO si chiede il manifesto (6 secondi al massimo); se qualcosa e'
//   cambiato si scaricano solo quei file, con una finestrella d'avanzamento, e
//   si apre il gioco nuovo. Senza rete, o se l'aggiornamento non riesce, si gioca
//   con la versione che c'e': un avvio che non arriva e' un guasto.
//   A GIOCO APERTO si guarda di nuovo ogni due minuti. Una versione nuova si
//   scarica in silenzio nel cantiere, e da quel momento le note di rilascio che
//   il guscio serve sono quelle NUOVE: il gioco se ne accorge col suo solito
//   controllo (sorvegliaLaVersione), avvisa, aspetta la fine della partita e
//   ricarica. Ricaricando, il guscio posa i file nuovi PRIMA di servire il gioco.
//   Il gioco di R2 non sa niente.
//
// UN'APP SOLA ALLA VOLTA: due finestre sarebbero lo stesso account seduto due
// volte (la sedia del server rifiuterebbe la seconda), quindi la seconda apertura
// porta in primo piano la prima.
//
// COL BANCO (desktop/prova-guscio.js, HEXTALE_PROVA=1): finestre nascoste e non a
// tutto schermo, dati in una cartella temporanea (HEXTALE_PROVA_DATI), controllo
// a gioco aperto piu' fitto (HEXTALE_CONTROLLO_MS).
'use strict';
const { app, BrowserWindow, shell, net, session, dialog } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const A = require('./aggiornatore');

const PROVA = !!process.env.HEXTALE_PROVA;
if (PROVA && process.env.HEXTALE_PROVA_DATI) app.setPath('userData', process.env.HEXTALE_PROVA_DATI);

const BASE = String(process.env.HEXTALE_AGGIORNAMENTI || 'https://download.hextalegame.com/').replace(/\/*$/, '/');
const SITO = new Set(['hextalegame.com', 'www.hextalegame.com']);
const INIZIO = 'https://hextalegame.com/play/index.html';
const ATTESA_MANIFESTO_MS = 6000;
const CONTROLLO_OGNI_MS = (PROVA && Number(process.env.HEXTALE_CONTROLLO_MS)) || 2 * 60 * 1000;
// Le finestre che il gioco puo' aprire DENTRO all'app (l'accesso con Google usa
// un popup su accounts.google.com): ogni altro link si apre nel browser vero.
const FINESTRE_AMMESSE = new Set(['accounts.google.com']);

// Google rifiuta l'accesso dai browser "incorporati", e li riconosce dal nome
// che si danno: "Electron/43.4.0" e il nome dell'app. Tolti quelli resta il
// Chrome che c'e' davvero sotto.
app.userAgentFallback = app.userAgentFallback.replace(/ (Electron|hextale|Hextale)\/\S+/g, '');

function cartellaInclusa() { return app.isPackaged ? path.join(process.resourcesPath, 'gioco') : path.join(__dirname, 'gioco-pronto'); }
function cartellaViva() { return path.join(app.getPath('userData'), 'gioco'); }

let efficace = null;   // il manifesto che vale adesso
let pronto = null;     // una versione nuova gia' scaricata nel cantiere, da posare quando il gioco ricarica
let finestra = null;

// Un lavoro sui file alla volta: il controllo a gioco aperto e la posa al
// ricaricamento non devono mai scrivere nel cantiere insieme.
let coda = Promise.resolve();
function inFila(lavoro) {
  const p = coda.then(lavoro, lavoro);
  coda = p.catch(() => {});
  return p;
}

function guardaDiNuovo() {
  return inFila(async () => {
    if (!efficace) return;
    try {
      const piano = await A.controlla(BASE, efficace, { timeoutMs: ATTESA_MANIFESTO_MS });
      if (!piano.nuovo) { pronto = null; return; }
      if (pronto && A.confronta(pronto.remoto, piano.remoto) === 0) return;
      await A.prescarica(BASE, cartellaViva(), piano);
      pronto = piano;
      console.info('[hextale] pronta la ' + piano.remoto.versione + ': si posa quando il gioco ricarica');
    } catch (e) {
      console.info('[hextale] controllo a gioco aperto non riuscito: ' + e.message);
    }
  });
}

function posaSePronto() {
  return inFila(async () => {
    if (!pronto) return;
    const piano = pronto;
    pronto = null;
    try {
      efficace = await A.applica(BASE, cartellaViva(), piano);
      console.info('[hextale] aggiornato a ' + efficace.versione);
    } catch (e) {
      console.warn('[hextale] aggiornamento non posato, si resta sulla versione che c-e-: ' + e.message);
    }
  });
}

function serviDalDisco() {
  session.defaultSession.protocol.handle('https', async (richiesta) => {
    let u = null;
    try { u = new URL(richiesta.url); } catch (_) { u = null; }
    if (!u || !SITO.has(u.host)) return net.fetch(richiesta, { bypassCustomProtocolHandlers: true });
    let p = '';
    try { p = decodeURIComponent(u.pathname).replace(/^\/+/, ''); } catch (_) { p = ''; }
    if (p === '') p = 'play/index.html';
    else if (p.endsWith('/')) p += 'index.html';
    // Un errore qui dentro non deve mai diventare un gioco che non si apre: al
    // peggio si serve la versione che c'e'.
    let file = null;
    try {
      if (p === 'play/index.html' && pronto) await posaSePronto();
      file = (p === 'patch-notes.txt' && A.fileInCantiere(cartellaViva(), pronto, p))
        || A.trovaFile(efficace, cartellaInclusa(), cartellaViva(), p);
    } catch (e) {
      console.warn('[hextale] ' + p + ': ' + e.message);
      try { file = A.trovaFile(efficace, cartellaInclusa(), cartellaViva(), p); } catch (_) { file = null; }
    }
    if (!file) return new Response('', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function finestraAvanzamento() {
  const w = new BrowserWindow({ width: 420, height: 150, frame: false, resizable: false, show: false, backgroundColor: '#1B2325',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  const html = '<!doctype html><meta charset="utf-8"><title>Updating Hextale</title><body style="margin:0;height:100vh;display:flex;flex-direction:column;'
    + 'justify-content:center;align-items:center;gap:14px;background:#1B2325;color:#EDE0C6;font:15px Georgia,serif">'
    + '<div>Updating Hextale...</div><div style="width:320px;height:8px;background:#2A3538;border-radius:4px;overflow:hidden">'
    + '<div id="b" style="width:0;height:100%;background:#D37B00"></div></div><div id="t">0%</div></body>';
  w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  w.once('ready-to-show', () => { if (!PROVA) w.show(); });
  return w;
}

function creaFinestra() {
  finestra = new BrowserWindow({
    show: false,
    fullscreen: !PROVA,
    width: 1280,
    height: 720,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  finestra.once('ready-to-show', () => { if (!PROVA) finestra.show(); });
  finestra.webContents.setWindowOpenHandler(({ url }) => {
    let host = '';
    try { host = new URL(url).host; } catch (_) { host = ''; }
    if (FINESTRE_AMMESSE.has(host)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  finestra.loadURL(INIZIO);
}

async function avvia() {
  try { efficace = await A.manifestoEfficace(cartellaInclusa(), cartellaViva()); }
  catch (e) { console.warn('[hextale] manifesto non letto: ' + e.message); }
  serviDalDisco();

  let piano = null;
  try { piano = await A.controlla(BASE, efficace, { timeoutMs: ATTESA_MANIFESTO_MS }); }
  catch (e) { console.info('[hextale] nessun aggiornamento: ' + e.message); }
  if (piano && piano.nuovo) {
    const w = finestraAvanzamento();
    try {
      efficace = await A.applica(BASE, cartellaViva(), piano, {
        suAvanzamento: (f) => {
          const pct = Math.round(f * 100);
          if (!w.isDestroyed()) w.webContents.executeJavaScript("document.getElementById('b').style.width='" + pct + "%';document.getElementById('t').textContent='" + pct + "%'").catch(() => {});
        },
      });
      console.info('[hextale] aggiornato a ' + efficace.versione);
    } catch (e) {
      console.warn('[hextale] aggiornamento non riuscito, si gioca con la versione che c-e-: ' + e.message);
    }
    if (!w.isDestroyed()) w.close();
  }

  if (!efficace) {
    dialog.showErrorBox('Hextale', 'The game files are missing. Please reinstall Hextale.');
    app.quit();
    return;
  }
  creaFinestra();
  setInterval(guardaDiNuovo, CONTROLLO_OGNI_MS);
}

app.setAppUserModelId('com.thetrickmaster.hextale');
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!finestra || finestra.isDestroyed()) return;
    if (finestra.isMinimized()) finestra.restore();
    finestra.focus();
  });
  app.whenReady().then(avvia);
  app.on('window-all-closed', () => app.quit());
}
