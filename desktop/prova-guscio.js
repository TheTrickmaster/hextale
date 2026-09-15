// IL GUSCIO DELL'APP DESKTOP, DAVVERO (v0.80.30).
//
//   node desktop/prepara-gioco.js --copia-di-lavoro
//   desktop/node_modules/electron/dist/electron.exe desktop/prova-guscio.js
//
// (--copia-di-lavoro: il banco prova il gioco com'e' sul disco, modifiche in corso comprese.)
//
// Parte il guscio vero (main.js) con la copia del gioco di desktop/gioco-pronto,
// una cartella dati temporanea e un deposito finto al posto di R2 (un server
// locale). hextalegame.com e api.hextalegame.com NON si risolvono: se anche una
// sola richiesta al sito uscisse in rete fallirebbe, quindi tutto cio' che il
// gioco carica arriva dal disco, e il server vero non si tocca.
//   1. all'avvio c'e' un aggiornamento (le note di rilascio cambiate nel deposito):
//      compare la finestrella, si scarica SOLO quel file e finisce nella cartella viva;
//   2. il gioco si apre dall'indirizzo del sito, col suo numero di versione;
//   3. immagini con l'indirizzo relativo e con quello scritto per intero arrivano dal disco;
//   4. il gioco legge le note di rilascio NUOVE;
//   5. un file che il gioco non ha risponde 404;
//   6. le richieste agli altri indirizzi passano com'erano, CORPO E INTESTAZIONI
//      COMPRESI: e' cosi' che il gioco parla col server (un POST JSON con
//      l'autorizzazione). Qui verso un server https locale (serve openssl);
//   7. il nome del browser non dice "Electron" (Google rifiuterebbe l'accesso);
//   8. A GIOCO APERTO esce una versione nuova: il guscio la scarica in silenzio e
//      ne serve le note; finche' il gioco non ricarica non si posa niente; il
//      gioco se ne accorge col suo controllo e avvisa; ricaricando si apre la nuova.
const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

app.commandLine.appendSwitch('host-resolver-rules', 'MAP hextalegame.com ~NOTFOUND, MAP www.hextalegame.com ~NOTFOUND, MAP api.hextalegame.com ~NOTFOUND');
app.commandLine.appendSwitch('disable-gpu');

const PRONTO = path.join(__dirname, 'gioco-pronto');
const esito = [];
const dice = (ok, che, perche) => esito.push({ ok: !!ok, che: che, perche: perche === undefined ? '' : String(perche) });
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
const aspetta = async (prova, ms, passo) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    let v = null;
    try { v = await prova(); } catch (_) { v = null; }
    if (v) return v;
    await dorme(passo || 300);
  }
  return null;
};

if (!fs.existsSync(path.join(PRONTO, 'manifesto.json'))) { console.log('prima: node desktop/prepara-gioco.js'); process.exit(2); }
const DATI = fs.mkdtempSync(path.join(os.tmpdir(), 'hextale-guscio-'));
const incluso = JSON.parse(fs.readFileSync(path.join(PRONTO, 'manifesto.json'), 'utf8'));

// ── il deposito finto: all'avvio la versione 1 (note cambiate), a gioco aperto la 2 ──
const V2 = 'v0.80.99';
const NOTE_1 = '## ' + incluso.versione + '\n- Nota di prova dal deposito finto.\n';
const NOTE_2 = '## ' + V2 + '\n- Seconda nota di prova.\n\n' + NOTE_1;
const GIOCO_2 = fs.readFileSync(path.join(PRONTO, 'play', 'index.html'), 'utf8').replace('>' + incluso.versione + '<', '>' + V2 + '<');
const remoto1 = JSON.parse(JSON.stringify(incluso));
remoto1.generato = new Date(Date.now() + 1000).toISOString();
remoto1.file['patch-notes.txt'] = { sha256: sha(NOTE_1), dimensione: Buffer.byteLength(NOTE_1) };
const remoto2 = JSON.parse(JSON.stringify(remoto1));
remoto2.versione = V2;
remoto2.generato = new Date(Date.now() + 2000).toISOString();
remoto2.file['patch-notes.txt'] = { sha256: sha(NOTE_2), dimensione: Buffer.byteLength(NOTE_2) };
remoto2.file['play/index.html'] = { sha256: sha(GIOCO_2), dimensione: Buffer.byteLength(GIOCO_2) };
const deposito = { manifesto: remoto1, file: {} };
for (const t of [NOTE_1, NOTE_2, GIOCO_2]) deposito.file[sha(t)] = t;
const chieste = [];

const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  chieste.push(u);
  if (u === '/gioco/manifesto.json') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(deposito.manifesto)); }
  const m = u.match(/^\/gioco\/file\/([0-9a-f]{64})$/);
  if (m && deposito.file[m[1]] !== undefined) { res.writeHead(200); return res.end(deposito.file[m[1]]); }
  res.writeHead(404); res.end();
});

// Il guscio va caricato SUBITO (la cartella dati si sceglie prima che Electron sia
// pronto), quindi le porte si decidono qui e non le sceglie il sistema.
const PORTA = 38000 + (process.pid % 2000);
server.on('error', (e) => { console.log('il deposito finto non parte sulla porta ' + PORTA + ': ' + e.message); app.exit(2); });
server.listen(PORTA, '127.0.0.1');

// ── il server https che fa eco (al posto di api.hextalegame.com) ──
let eco = null;
try {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(DATI, 'k.pem'), '-out', path.join(DATI, 'c.pem'),
    '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' });
  eco = https.createServer({ key: fs.readFileSync(path.join(DATI, 'k.pem')), cert: fs.readFileSync(path.join(DATI, 'c.pem')) }, (req, res) => {
    const intesta = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization', 'Access-Control-Allow-Methods': 'POST' };
    if (req.method === 'OPTIONS') { res.writeHead(204, intesta); return res.end(); }
    let corpo = '';
    req.on('data', (d) => { corpo += d; });
    req.on('end', () => { res.writeHead(200, Object.assign({ 'Content-Type': 'text/plain' }, intesta)); res.end(req.method + ' ' + (req.headers.authorization || '-') + ' ' + corpo); });
  });
  eco.listen(PORTA + 1, '127.0.0.1');
} catch (e) {
  eco = null;
  console.log('(openssl non disponibile: il controllo 6 si salta)');
}

const fine = (codice) => {
  let male = 0;
  for (const d of esito) { if (!d.ok) male++; console.log((d.ok ? '  ok   ' : '  NO   ') + d.che); if (!d.ok && d.perche) console.log('        ' + d.perche); }
  console.log(male ? '\n' + male + ' cose non tornano' : '\ntutto a posto (' + esito.length + ' controlli)');
  try { server.close(); if (eco) eco.close(); } catch (_) { }
  try { fs.rmSync(DATI, { recursive: true, force: true }); } catch (_) { }
  app.exit(codice !== undefined ? codice : (male ? 1 : 0));
};
setTimeout(() => { dice(false, 'il banco ha finito in tempo'); fine(2); }, 180000);
const create = [];
app.on('browser-window-created', (_, w) => create.push(w));

app.whenReady().then(() => {
  session.defaultSession.setCertificateVerifyProc((r, cb) => cb(r.hostname === '127.0.0.1' ? 0 : -3));
});

process.env.HEXTALE_PROVA = '1';
process.env.HEXTALE_PROVA_DATI = DATI;
process.env.HEXTALE_AGGIORNAMENTI = 'http://127.0.0.1:' + PORTA + '/';
process.env.HEXTALE_CONTROLLO_MS = '1000';
require('./main.js');

app.whenReady().then(async () => {
  const trova = () => BrowserWindow.getAllWindows().find((w) => /^https:\/\/hextalegame\.com\/play\//.test(w.webContents.getURL()));
  const gioco = await aspetta(() => { const w = trova(); return w && !w.webContents.isLoading() ? w : null; }, 90000, 500);
  if (!gioco) { dice(false, 'il gioco si apre'); return fine(2); }
  const js = (codice) => gioco.webContents.executeJavaScript(codice);
  const viva = path.join(DATI, 'gioco');
  const manifestoVivo = () => { try { return JSON.parse(fs.readFileSync(path.join(viva, 'manifesto.json'), 'utf8')); } catch (_) { return {}; } };
  try {
    // ── 1. l'aggiornamento all'avvio ──
    const filePresi = chieste.filter((u) => u.indexOf('/gioco/file/') === 0);
    dice(filePresi.length === 1 && filePresi[0] === '/gioco/file/' + sha(NOTE_1), 'all-avvio si scarica solo il file cambiato', JSON.stringify(filePresi));
    dice(create.length >= 2, 'compare la finestrella dell-aggiornamento prima del gioco', create.length + ' finestre');
    dice(fs.existsSync(path.join(viva, 'patch-notes.txt')) && !fs.existsSync(path.join(viva, 'ui')) && manifestoVivo().generato === remoto1.generato,
      'nella cartella viva c-e- solo il file cambiato, e il manifesto nuovo', fs.existsSync(viva) ? fs.readdirSync(viva).join(', ') : 'nessuna cartella');

    // ── 2-7. il gioco ──
    await dorme(3000);
    const r = await js(`(async function(){
      const carica = (src) => new Promise(ok => { const i = new Image(); i.onload = () => ok(i.naturalWidth); i.onerror = () => ok(-1); i.src = src; });
      const badge = document.getElementById('build-version-badge');
      const note = await fetch('../patch-notes.txt?t=' + Date.now()).then(x => x.text()).catch(e => 'ERRORE ' + e.message);
      const manca = await fetch('https://hextalegame.com/stats/index.html').then(x => x.status).catch(e => 'ERRORE ' + e.message);
      const corpo = ${eco ? PORTA + 1 : 0} ? await fetch('https://127.0.0.1:${PORTA + 1}/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic eDp5' }, body: JSON.stringify({ ciao: 'corpo' }) }).then(x => x.text()).catch(e => 'ERRORE ' + e.message) : null;
      return { url: location.href, badge: badge && badge.textContent, assoluta: await carica('https://hextalegame.com/ui/exe-icon.png'), relativa: await carica('../ui/check-icon.png'),
        note: note, manca: manca, corpo: corpo, ua: navigator.userAgent, desktop: !!window.hextaleDesktop };
    })()`);
    dice(r.url === 'https://hextalegame.com/play/index.html' && r.badge === incluso.versione, 'il gioco si apre dall-indirizzo del sito, col suo numero di versione', r.url + ' ' + r.badge);
    dice(r.assoluta === 1024 && r.relativa > 0, 'le immagini arrivano dal disco, con l-indirizzo scritto per intero e con quello relativo (il sito non si risolve)', r.assoluta + ' / ' + r.relativa);
    dice(r.note === NOTE_1, 'il gioco legge le note di rilascio nuove', JSON.stringify(r.note).slice(0, 80));
    dice(r.manca === 404, 'un file che il gioco non ha risponde 404', r.manca);
    if (eco) dice(r.corpo === 'POST Basic eDp5 {"ciao":"corpo"}', 'le richieste agli altri indirizzi passano col loro corpo e le intestazioni (come quelle al server di gioco)', r.corpo);
    dice(/Chrome\//.test(r.ua) && !/electron|hextale/i.test(r.ua), 'il nome del browser e- quello di Chrome, senza Electron', r.ua);
    dice(r.desktop, 'il gioco sa di girare dentro all-app (window.hextaleDesktop)');

    // ── 8. una versione nuova a gioco aperto ──
    dice(GIOCO_2.indexOf('>' + V2 + '<') > 0, '(il banco ha preparato un gioco col numero ' + V2 + ')');
    deposito.manifesto = remoto2;
    const note2 = await aspetta(async () => (await js("fetch('../patch-notes.txt?t=' + Date.now()).then(x => x.text())")).indexOf('## ' + V2) === 0, 30000, 500);
    dice(note2, 'a gioco aperto il guscio scarica la versione nuova in silenzio, e serve le sue note');
    const badgePrima = await js("document.getElementById('build-version-badge').textContent");
    dice(manifestoVivo().versione === incluso.versione && badgePrima === incluso.versione && !fs.existsSync(path.join(viva, 'play', 'index.html')),
      'ma finche- il gioco non ricarica non si posa niente', manifestoVivo().versione + ' / ' + badgePrima);
    await js('_giocatoreDentro = true; caricaPatchNotes({ soloVersione: true }); true');
    const avviso = await aspetta(() => js("document.getElementById('aggiorna-overlay').classList.contains('show')"), 10000, 300);
    dice(avviso, 'il gioco se ne accorge col suo controllo e mostra l-avviso');
    await js('setTimeout(aggiornaERiavvia, 50); true');
    const badgeDopo = await aspetta(async () => {
      if (!/[?&]v=/.test(gioco.webContents.getURL()) || gioco.webContents.isLoading()) return null;
      return js("(document.getElementById('build-version-badge') || {}).textContent");
    }, 30000, 300);
    dice(badgeDopo === V2 && manifestoVivo().versione === V2 && fs.existsSync(path.join(viva, 'play', 'index.html')) && !fs.existsSync(path.join(viva, '.cantiere')),
      'ricaricando si apre la versione nuova, posata nella cartella viva', badgeDopo + ' / ' + manifestoVivo().versione);
  } catch (e) {
    dice(false, 'il banco e- arrivato in fondo', e.stack);
  }
  fine();
});
