// L'APP COSTRUITA, NON IL SORGENTE (v0.80.30).
//
//     cd desktop && npm run build
//     node desktop/prova-pacchetto.js
//
// Apre desktop/dist/win-unpacked/Hextale.exe — lo stesso programma che
// l'installatore mette sul disco — e ci guarda dentro dalla porta di debug di
// Chromium, senza installare niente. hextalegame.com e api.hextalegame.com non
// si risolvono e il deposito degli aggiornamenti non risponde: tutto deve
// arrivare dalla copia del gioco inclusa nel pacchetto. Dati in una cartella
// temporanea (HEXTALE_PROVA_DATI), finestra nascosta (HEXTALE_PROVA).
//   1. nel pacchetto c'e' la copia del gioco, dall'ultimo commit, col suo manifesto;
//   2. c'e' l'installatore;
//   3. il programma parte e apre il gioco dall'indirizzo del sito, col numero giusto;
//   4. immagini e note di rilascio arrivano dal disco (il sito non si risolve);
//   5. il nome del browser non dice Electron, e il gioco sa di essere nell'app;
//   6. senza deposito raggiungibile non si scrive nessuna copia viva.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn, execFileSync } = require('child_process');

let male = 0;
const dice = (ok, che, perche) => {
  if (!ok) male++;
  console.log((ok ? '  ok   ' : '  NO   ') + che);
  if (!ok && perche !== undefined) console.log('        ' + perche);
};
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
const chiediJson = (url) => new Promise((ok, ko) => {
  http.get(url, (res) => { let t = ''; res.on('data', (d) => { t += d; }); res.on('end', () => { try { ok(JSON.parse(t)); } catch (e) { ko(e); } }); }).on('error', ko);
});

const PACCHETTO = path.join(__dirname, 'dist', 'win-unpacked');
const EXE = path.join(PACCHETTO, 'Hextale.exe');
const GUSCIO = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const INSTALLATORE = path.join(__dirname, 'dist', 'Hextale-Setup-' + GUSCIO.version + '.exe');

(async () => {
  if (!fs.existsSync(EXE)) { console.log('prima: cd desktop && npm run build'); process.exitCode = 2; return; }
  const DATI = fs.mkdtempSync(path.join(os.tmpdir(), 'hextale-pacchetto-'));
  const PORTA = 39500 + (process.pid % 400);
  let app = null;
  try {
    // ── 1-2. i file ──
    let incluso = null;
    try { incluso = JSON.parse(fs.readFileSync(path.join(PACCHETTO, 'resources', 'gioco', 'manifesto.json'), 'utf8')); } catch (_) { incluso = null; }
    const head = execFileSync('git', ['show', 'HEAD:play/index.html'], { cwd: path.resolve(__dirname, '..'), maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
    const versioneHead = (head.match(/id="build-version-badge"[^>]*>(v[0-9.]+)</) || [])[1];
    const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: __dirname }).toString('utf8').trim();
    dice(incluso && incluso.versione === versioneHead && incluso.origine === 'commit ' + commit && Object.keys(incluso.file).length > 500
      && fs.existsSync(path.join(PACCHETTO, 'resources', 'gioco', 'play', 'index.html')),
      'nel pacchetto c-e- il gioco dell-ultimo commit, col suo manifesto', incluso ? incluso.versione + ' / ' + incluso.origine + ' / ' + Object.keys(incluso.file).length + ' file' : 'manca');
    dice(fs.existsSync(INSTALLATORE), 'c-e- l-installatore ' + path.basename(INSTALLATORE)
      + (fs.existsSync(INSTALLATORE) ? ' (' + (fs.statSync(INSTALLATORE).size / 1048576).toFixed(0) + ' MB)' : ''));

    // ── 3-6. il programma ──
    app = spawn(EXE, [
      '--remote-debugging-port=' + PORTA,
      '--host-resolver-rules=MAP hextalegame.com ~NOTFOUND, MAP www.hextalegame.com ~NOTFOUND, MAP api.hextalegame.com ~NOTFOUND',
    ], { env: Object.assign({}, process.env, { HEXTALE_PROVA: '1', HEXTALE_PROVA_DATI: DATI, HEXTALE_AGGIORNAMENTI: 'http://127.0.0.1:9/' }), stdio: 'ignore' });
    let pagina = null;
    const inizio = Date.now();
    while (!pagina && Date.now() - inizio < 60000) {
      await dorme(500);
      try { pagina = (await chiediJson('http://127.0.0.1:' + PORTA + '/json/list')).find((t) => t.type === 'page' && /^https:\/\/hextalegame\.com\/play\//.test(t.url)); } catch (_) { pagina = null; }
    }
    dice(!!pagina, 'il programma parte e apre il gioco dall-indirizzo del sito', pagina ? pagina.url : 'nessuna pagina in 60 secondi');
    if (!pagina) return;
    await dorme(4000);

    const ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = () => ko(new Error('websocket di debug')); });
    const r = await new Promise((ok) => {
      ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id === 1) ok(d.result && d.result.result ? d.result.result.value : d); };
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { awaitPromise: true, returnByValue: true, expression: `(async function(){
        const carica = (src) => new Promise(ok => { const i = new Image(); i.onload = () => ok(i.naturalWidth); i.onerror = () => ok(-1); i.src = src; });
        const badge = document.getElementById('build-version-badge');
        const note = await fetch('../patch-notes.txt?t=' + Date.now()).then(x => x.text()).catch(e => 'ERRORE ' + e.message);
        return { url: location.href, stato: document.readyState, badge: badge && badge.textContent, icona: await carica('https://hextalegame.com/ui/exe-icon.png'),
          note: note.slice(0, 40), ua: navigator.userAgent, desktop: !!window.hextaleDesktop };
      })()` } }));
    });
    ws.close();
    dice(r && r.stato === 'complete' && r.badge === versioneHead, 'il gioco e- caricato, col numero dell-ultimo commit', JSON.stringify(r));
    dice(r && r.icona === 1024 && /^## v/.test(r.note), 'immagini e note di rilascio arrivano dal disco (il sito non si risolve)', r && (r.icona + ' / ' + JSON.stringify(r.note)));
    dice(r && /Chrome\//.test(r.ua) && !/electron|hextale/i.test(r.ua) && r.desktop, 'il nome del browser e- Chrome senza Electron, e il gioco sa di essere nell-app', r && r.ua);
    dice(!fs.existsSync(path.join(DATI, 'gioco')), 'senza deposito raggiungibile non si scrive nessuna copia viva');
  } catch (e) {
    dice(false, 'il banco e- arrivato in fondo', e.stack);
  } finally {
    if (app && app.pid) { try { execFileSync('taskkill', ['/PID', String(app.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (_) { } }
    await dorme(1500);
    try { fs.rmSync(DATI, { recursive: true, force: true }); } catch (_) { }
    console.log(String.fromCharCode(10) + (male ? male + ' NO' : 'tutto a posto'));
    process.exitCode = process.exitCode || (male ? 1 : 0);
  }
})();
