// ═══════════════════════════════════════════════════════════════════════════
// HEXTALE — IL GUSCIO (app desktop 1.0.1)
// ═══════════════════════════════════════════════════════════════════════════
// Lorenzo: "creiamo il guscio Electron che installa tutto su locale al primo
// avvio cosi' non deve piu' richiedere gli asset. Da ora in avanti il gioco si
// puo' giocare solo da desktop Electron."
//
// IL GIOCO GIRA COME SUL SITO, MA DAL DISCO. La finestra apre
// https://hextalegame.com/play/index.html, ma il nome hextalegame.com Chromium
// lo manda a 127.0.0.1, dove risponde servitore.js coi file sul disco. Nessuna
// richiesta al sito, quindi nessun limite per IP; e l'origine resta
// hextalegame.com, che il server di gioco, "Remember me" e l'accesso con Google
// riconoscono come quella del sito. Tutto il resto (api.hextalegame.com,
// Google, PayPal) va in rete com'e': il guscio non lo tocca (1.0.1 — prima lo
// rifaceva lui, e Google rifiutava l'accesso: vedi servitore.js).
// Il certificato di quel servitore lo accetta solo quest'app, solo per quel
// nome, e solo se e' proprio lui (vedi crea-certificato.js).
//
// GLI AGGIORNAMENTI DEL GIOCO arrivano da Cloudflare R2 (download.hextalegame.com,
// vedi aggiornatore.js).
//   ALL'AVVIO si chiede il manifesto (6 secondi al massimo); se qualcosa e'
//   cambiato si scaricano solo quei file, con una finestrella d'avanzamento.
//   Senza rete si gioca con la versione che c'e'.
//   A GIOCO APERTO si guarda di nuovo ogni due minuti. Una versione nuova si
//   scarica in silenzio nel cantiere, e da quel momento le note di rilascio che
//   il guscio serve sono quelle NUOVE: il gioco se ne accorge col suo solito
//   controllo, avvisa, aspetta la fine della partita e ricarica. Ricaricando, il
//   guscio posa i file nuovi PRIMA di servire il gioco.
//
// GLI AGGIORNAMENTI DELL'APP (1.0.1). Un minuto dopo l'avvio, e poi ogni sei ore,
// si guarda installatore/ultimo.json: se c'e' un'app piu' nuova il suo
// installatore si scarica in silenzio (non durante una partita), si verifica, e
// parte muto quando si chiude il gioco. Al giro dopo si apre l'app nuova.
//
// L'ACCESSO CON GOOGLE (1.0.2) si fa nel browser vero: Google rifiuta quello
// dentro alle app ("Questo browser o questa app potrebbero non essere sicuri").
// Il gioco lo chiede al guscio (preload.js); il guscio apre
// hextalegame.com/app-login/ nel browser e aspetta il codice su un indirizzo
// locale che vale una volta sola; il codice torna al gioco, che fa il resto
// come sempre (lo scambio col server, poi Nakama).
//
// NIENTE DA BROWSER (Lorenzo: disabilitare gli strumenti da sviluppatore e i
// menu "Edit" e "View"). Il menu ha solo File e Window; gli strumenti da
// sviluppatore sono spenti in ogni finestra; la finestra del gioco non naviga
// altrove (un link trascinato dentro non la porta via).
//
// UN'APP SOLA ALLA VOLTA: due finestre sarebbero lo stesso account seduto due
// volte, quindi la seconda apertura porta in primo piano la prima.
//
// COL BANCO (desktop/prova-guscio.js, desktop/prova-pacchetto.js; HEXTALE_PROVA=1):
// finestre nascoste e non a tutto schermo, dati in una cartella temporanea
// (HEXTALE_PROVA_DATI), controlli piu' fitti, regole di rete in piu'
// (HEXTALE_PROVA_REGOLE), un nome di cui fidarsi per i server finti
// (HEXTALE_PROVA_FIDATO), e i link esterni e l'installatore scritti su un file
// invece che aperti davvero.
'use strict';
const { app, BrowserWindow, Menu, shell, session, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const A = require('./aggiornatore');
const S = require('./servitore');
const GUSCIO = require('./package.json');

const PROVA = !!process.env.HEXTALE_PROVA;
if (PROVA && process.env.HEXTALE_PROVA_DATI) app.setPath('userData', process.env.HEXTALE_PROVA_DATI);

const BASE = String(process.env.HEXTALE_AGGIORNAMENTI || 'https://download.hextalegame.com/').replace(/\/*$/, '/');
const INIZIO = 'https://hextalegame.com/play/index.html';
const ATTESA_MANIFESTO_MS = 6000;
const CONTROLLO_OGNI_MS = (PROVA && Number(process.env.HEXTALE_CONTROLLO_MS)) || 2 * 60 * 1000;
const GUSCIO_PRIMO_MS = (PROVA && Number(process.env.HEXTALE_GUSCIO_MS)) || 60 * 1000;
const GUSCIO_OGNI_MS = 6 * 60 * 60 * 1000;
const GUSCIO_IN_PARTITA_MS = (PROVA && Number(process.env.HEXTALE_GUSCIO_MS)) || 2 * 60 * 1000;
const PAGINA_GOOGLE = 'https://hextalegame.com/app-login/';
const ATTESA_GOOGLE_MS = (PROVA && Number(process.env.HEXTALE_GOOGLE_MS)) || 5 * 60 * 1000;

// La porta del servitore locale: a caso a ogni avvio. La regola di rete va
// scritta prima che Electron sia pronto, e il sistema la porta la dice solo
// dopo, quindi si sceglie qui; se e' occupata l'app riparte con un'altra.
const PORTA = 20000 + crypto.randomInt(40000);
app.commandLine.appendSwitch('host-resolver-rules', [...S.SITO].map((h) => 'MAP ' + h + ' 127.0.0.1:' + PORTA)
  .concat(PROVA && process.env.HEXTALE_PROVA_REGOLE ? [process.env.HEXTALE_PROVA_REGOLE] : []).join(', '));

// Google rifiuta l'accesso dai browser "incorporati", e li riconosce dal nome
// che si danno: "Electron/43.4.0" e il nome dell'app. Tolti quelli resta il
// Chrome che c'e' davvero sotto.
app.userAgentFallback = app.userAgentFallback.replace(/ (Electron|hextale|Hextale)\/\S+/g, '');

function cartellaInclusa() { return app.isPackaged ? path.join(process.resourcesPath, 'gioco') : path.join(__dirname, 'gioco-pronto'); }
function cartellaViva() { return path.join(app.getPath('userData'), 'gioco'); }
function cartellaInstallatori() { return path.join(app.getPath('userData'), 'installatore'); }

let tls = null;
try {
  tls = {
    chiave: fs.readFileSync(path.join(__dirname, 'certificato', 'chiave.pem')),
    certificato: fs.readFileSync(path.join(__dirname, 'certificato', 'certificato.pem'), 'utf8'),
  };
} catch (_) { tls = null; }
const soloPem = (s) => String(s || '').replace(/\s+/g, '');

let efficace = null;     // il manifesto che vale adesso
let pronto = null;       // una versione nuova gia' scaricata nel cantiere, da posare quando il gioco ricarica
let guscioPronto = null; // { versione, file }: l'installatore di un'app piu' nuova, verificato
let finestra = null;

// ── col banco: cio' che uscirebbe dall'app si scrive su un file ──────────────
function annotaProva(nome, dato) {
  const f = path.join(app.getPath('userData'), nome);
  let elenco = [];
  try { elenco = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { elenco = []; }
  elenco.push(dato);
  fs.writeFileSync(f, JSON.stringify(elenco));
}

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

// Cosa risponde il servitore locale per un percorso del sito.
async function cerca(p) {
  // Un errore qui dentro non deve mai diventare un gioco che non si apre: al
  // peggio si serve la versione che c'e'.
  try {
    if (p === 'play/index.html' && pronto) await posaSePronto();
    if (p === 'patch-notes.txt' && pronto) {
      const nuove = A.fileInCantiere(cartellaViva(), pronto, p);
      if (nuove) return { file: nuove, impronta: pronto.remoto.file[p].sha256 };
    }
  } catch (e) {
    console.warn('[hextale] ' + p + ': ' + e.message);
  }
  const file = A.trovaFile(efficace, cartellaInclusa(), cartellaViva(), p);
  return file ? { file, impronta: efficace.file[p].sha256 } : null;
}

// ── l'app stessa ─────────────────────────────────────────────────────────────
async function inPartita() {
  if (!finestra || finestra.isDestroyed()) return false;
  try { return !!(await finestra.webContents.executeJavaScript("typeof _activePage !== 'undefined' && _activePage === 'game'")); }
  catch (_) { return false; }
}

async function guardaGuscio() {
  let prossimo = GUSCIO_OGNI_MS;
  try {
    await A.pulisciGuscio(cartellaInstallatori(), GUSCIO.version);
    const ultimo = await A.controllaGuscio(BASE, GUSCIO.version, { timeoutMs: ATTESA_MANIFESTO_MS });
    if (ultimo && !(guscioPronto && guscioPronto.versione === ultimo.versione)) {
      // Duecento mega mentre si gioca in rete sono una partita che scatta: si aspetta il menu.
      if (await inPartita()) prossimo = GUSCIO_IN_PARTITA_MS;
      else {
        const file = await A.scaricaGuscio(BASE, cartellaInstallatori(), ultimo);
        guscioPronto = { versione: ultimo.versione, file };
        console.info('[hextale] pronta l-app ' + ultimo.versione + ': si installa alla chiusura');
      }
    }
  } catch (e) {
    console.info('[hextale] controllo dell-app non riuscito: ' + e.message);
  }
  setTimeout(guardaGuscio, prossimo);
}

// Alla chiusura, se c'e' un'app piu' nuova pronta, parte il suo installatore
// muto. Non la riapre: chi ha chiuso il gioco voleva chiuderlo.
app.on('will-quit', () => {
  if (!guscioPronto) return;
  const argomenti = ['--updated', '/S'];
  if (PROVA) { annotaProva('installatore-lanciato.json', { file: guscioPronto.file, argomenti }); return; }
  try { spawn(guscioPronto.file, argomenti, { detached: true, stdio: 'ignore' }).unref(); }
  catch (e) { console.warn('[hextale] installatore non partito: ' + e.message); }
});

// ── le finestre ──────────────────────────────────────────────────────────────
// ── l'accesso con Google, nel browser vero ───────────────────────────────────
// Un indirizzo locale (127.0.0.1, porta del sistema) che accetta UNA richiesta
// con lo stato giusto: /google?stato=<stato>&code=<codice> (o &errore=...). La
// pagina hextalegame.com/app-login/ ci torna dopo aver parlato con Google. Un
// secondo clic annulla il primo; dopo cinque minuti senza risposta si lascia stare.
let googleInCorso = null;

function paginaDiRitorno(riuscito) {
  const titolo = riuscito ? 'You are signed in' : 'Sign-in did not complete';
  const testo = riuscito ? 'You can close this tab and go back to Hextale.' : 'Go back to Hextale and try again.';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Hextale</title></head>'
    + '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#101617;color:#EDE0C6;font:18px Georgia,serif;text-align:center">'
    + '<div><h1 style="font-weight:400;font-size:30px;margin:0 0 12px">' + titolo + '</h1><p>' + testo + '</p></div></body></html>';
}

function accessoGoogle() {
  if (googleInCorso) googleInCorso.chiudi({ errore: 'annullato' });
  return new Promise((risolvi) => {
    const stato = crypto.randomBytes(16).toString('hex');
    let finito = false;
    let tempo = null;
    const server = http.createServer((req, res) => {
      let u = null;
      try { u = new URL(req.url, 'http://127.0.0.1'); } catch (_) { u = null; }
      if (!u || req.method !== 'GET' || u.pathname !== '/google' || u.searchParams.get('stato') !== stato || finito) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not found');
      }
      const codice = u.searchParams.get('code') || '';
      const riuscito = /^[A-Za-z0-9\/_\-.~]{10,2048}$/.test(codice);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
      res.end(paginaDiRitorno(riuscito));
      chiudi(riuscito ? { code: codice } : { errore: String(u.searchParams.get('errore') || 'nessun codice').slice(0, 80) });
    });
    const chiudi = (esito) => {
      if (finito) return;
      finito = true;
      clearTimeout(tempo);
      if (googleInCorso && googleInCorso.chiudi === chiudi) googleInCorso = null;
      setTimeout(() => { try { server.close(); server.closeAllConnections(); } catch (_) { } }, 1000);
      if (esito.code && finestra && !finestra.isDestroyed()) { if (finestra.isMinimized()) finestra.restore(); finestra.focus(); }
      risolvi(esito);
    };
    googleInCorso = { chiudi };
    server.on('error', (e) => chiudi({ errore: 'indirizzo locale: ' + e.code }));
    server.listen(0, '127.0.0.1', () => {
      apriFuori(PAGINA_GOOGLE + '?porta=' + server.address().port + '&stato=' + stato);
      tempo = setTimeout(() => chiudi({ errore: 'scaduto' }), ATTESA_GOOGLE_MS);
    });
  });
}

// Solo la finestra del gioco puo' chiederlo.
ipcMain.handle('hextale:google', (evento) => {
  if (!finestra || finestra.isDestroyed() || evento.sender !== finestra.webContents) return { errore: 'non ammesso' };
  return accessoGoogle();
});

function preparaMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [{ role: 'quit', label: 'Exit' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'close' }] },
  ]));
}

// PayPal: il pulsante Donate e' un modulo POST che si apre in una finestra
// nuova. Il browser vero riceve solo un indirizzo, quindi i campi del modulo
// vanno nell'indirizzo — senza, PayPal non sa a chi si dona ("C'e' un problema
// con la pagina di questa organizzazione").
function indirizzoColModulo(url, corpo) {
  if (!corpo || !/application\/x-www-form-urlencoded/i.test(String(corpo.contentType || ''))) return url;
  const testo = (corpo.data || []).filter((d) => d && d.type === 'rawData' && d.bytes).map((d) => Buffer.from(d.bytes).toString('utf8')).join('');
  if (!testo) return url;
  const u = new URL(url);
  for (const [k, v] of new URLSearchParams(testo)) u.searchParams.append(k, v);
  return u.toString();
}

function apriFuori(url) {
  if (!/^https?:\/\//i.test(url)) return;
  if (PROVA) return annotaProva('esterni.json', url);
  shell.openExternal(url);
}

function finestraAvanzamento() {
  const w = new BrowserWindow({ width: 420, height: 150, frame: false, resizable: false, show: false, backgroundColor: '#1B2325',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: false } });
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
      devTools: false,
      spellcheck: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  finestra.once('ready-to-show', () => { if (!PROVA) finestra.show(); });
  const wc = finestra.webContents;
  // Nessuna finestra dentro all'app: ogni link si apre nel browser vero.
  wc.setWindowOpenHandler((dettagli) => {
    apriFuori(indirizzoColModulo(dettagli.url, dettagli.postBody));
    return { action: 'deny' };
  });
  // La finestra del gioco resta sul gioco: ricaricarlo si puo' (?v=... dopo un
  // aggiornamento), andare altrove no.
  wc.on('will-navigate', (e, url) => { if (String(url).split(/[?#]/)[0] !== INIZIO) e.preventDefault(); });
  wc.on('will-attach-webview', (e) => e.preventDefault());
  finestra.loadURL(INIZIO);
}

async function avvia() {
  preparaMenu();
  if (!tls) {
    dialog.showErrorBox('Hextale', 'Some game files are missing. Please reinstall Hextale.');
    app.quit();
    return;
  }
  const fidato = PROVA ? String(process.env.HEXTALE_PROVA_FIDATO || '') : '';
  session.defaultSession.setCertificateVerifyProc((richiesta, esito) => {
    if (S.SITO.has(richiesta.hostname)) return esito(soloPem(richiesta.certificate && richiesta.certificate.data) === soloPem(tls.certificato) ? 0 : -2);
    if (fidato && richiesta.hostname === fidato) return esito(0);
    esito(-3);
  });

  try { efficace = await A.manifestoEfficace(cartellaInclusa(), cartellaViva()); }
  catch (e) { console.warn('[hextale] manifesto non letto: ' + e.message); }

  try {
    await S.avviaServitore({ chiave: tls.chiave, certificato: tls.certificato, porta: PORTA, cerca });
  } catch (e) {
    // Porta occupata (o riservata dal sistema): si riparte, e se ne sceglie un'altra.
    const tentativi = Number(process.env.HEXTALE_TENTATIVI_PORTA || 0);
    console.warn('[hextale] porta ' + PORTA + ' non disponibile (' + e.code + '), tentativo ' + (tentativi + 1));
    if (tentativi < 5) {
      process.env.HEXTALE_TENTATIVI_PORTA = String(tentativi + 1);
      app.relaunch();
      app.exit(0);
      return;
    }
    dialog.showErrorBox('Hextale', 'Hextale could not start. Please restart your computer and try again.');
    app.quit();
    return;
  }

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
  if (app.isPackaged || PROVA) setTimeout(guardaGuscio, GUSCIO_PRIMO_MS);
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
