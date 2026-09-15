// IL GUSCIO DELL'APP DESKTOP, DAVVERO (app 1.0.1).
//
//   node desktop/prepara-gioco.js --copia-di-lavoro
//   desktop/node_modules/electron/dist/electron.exe desktop/prova-guscio.js
//
// (--copia-di-lavoro: il banco prova il gioco com'e' sul disco, modifiche in corso comprese.)
//
// Parte il guscio vero (main.js) con la copia del gioco di desktop/gioco-pronto,
// una cartella dati temporanea e un deposito finto al posto di R2 (un server
// locale). hextalegame.com va al servitore locale del guscio — e' il guscio a
// deciderlo, come per i giocatori — e api.hextalegame.com non si risolve: il
// server vero non si tocca. Serve openssl (c'e' con Git per Windows).
//   1. all'avvio c'e' un aggiornamento: finestrella, si scarica solo il file cambiato;
//   2. il gioco si apre dall'indirizzo del sito col suo numero; immagini (indirizzo
//      intero e relativo) e note nuove dal disco; 404 per cio' che non c'e'; Range per l'audio;
//   3. le richieste agli altri siti le fa il browser, non il guscio: arrivano con
//      Origin, corpo e intestazioni (senza Origin Google rifiutava l'accesso, errore 400);
//   4. il nome del browser non dice Electron, e il gioco sa di essere nell'app;
//   5. niente da browser: menu solo File e Window, strumenti da sviluppatore che
//      non si aprono, la finestra del gioco che non naviga altrove;
//   6. Donate: il modulo di PayPal va al browser vero coi suoi campi nell'indirizzo;
//   7. a gioco aperto esce una versione nuova: scaricata in silenzio, il gioco
//      avvisa, ricaricando si apre la nuova;
//   8. esce un'app nuova: il suo installatore si scarica e si verifica;
//   9. Login with Google apre il browser vero su hextalegame.com/app-login/; la
//      pagina (quella vera del sito, con un Google finto) riporta il codice al
//      gioco dall'indirizzo locale, che non accetta stati sbagliati e vale una volta;
//  10. Exit game chiude l'app, e alla chiusura l'installatore parte muto (--updated /S).
'use strict';
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

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

if (!fs.existsSync(path.join(PRONTO, 'manifesto.json'))) { console.log('prima: node desktop/prepara-gioco.js --copia-di-lavoro'); process.exit(2); }
require('./crea-certificato').assicura();
const DATI = fs.mkdtempSync(path.join(os.tmpdir(), 'hextale-guscio-'));
const incluso = JSON.parse(fs.readFileSync(path.join(PRONTO, 'manifesto.json'), 'utf8'));

// ── il deposito finto: all'avvio la versione 1 (note cambiate), a gioco aperto la 2, e un'app 9.9.9 ──
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
const EXE = Buffer.from('installatore finto dell-app 9.9.9');
const ULTIMO = { versione: '9.9.9', file: 'installatore/Hextale-Setup-9.9.9.exe', sha256: sha(EXE), dimensione: EXE.length };
const deposito = { manifesto: remoto1, file: {} };
for (const t of [NOTE_1, NOTE_2, GIOCO_2]) deposito.file[sha(t)] = t;
const chieste = [];

const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  chieste.push(u);
  if (u === '/gioco/manifesto.json') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(deposito.manifesto)); }
  if (u === '/installatore/ultimo.json') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(ULTIMO)); }
  if (u === '/' + ULTIMO.file) { res.writeHead(200); return res.end(EXE); }
  const m = u.match(/^\/gioco\/file\/([0-9a-f]{64})$/);
  if (m && deposito.file[m[1]] !== undefined) { res.writeHead(200); return res.end(deposito.file[m[1]]); }
  res.writeHead(404); res.end();
});
const PORTA = 38000 + (process.pid % 2000);
server.on('error', (e) => { console.log('il deposito finto non parte sulla porta ' + PORTA + ': ' + e.message); app.exit(2); });
server.listen(PORTA, '127.0.0.1');

// ── il server https che fa eco (al posto di un sito esterno qualunque) ──
const ECO = PORTA + 1;
let eco = null;
try {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(DATI, 'eco-k.pem'), '-out', path.join(DATI, 'eco-c.pem'),
    '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' });
  eco = https.createServer({ key: fs.readFileSync(path.join(DATI, 'eco-k.pem')), cert: fs.readFileSync(path.join(DATI, 'eco-c.pem')) }, (req, res) => {
    const intesta = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization', 'Access-Control-Allow-Methods': 'POST' };
    if (req.method === 'OPTIONS') { res.writeHead(204, intesta); return res.end(); }
    let corpo = '';
    req.on('data', (d) => { corpo += d; });
    req.on('end', () => {
      res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, intesta));
      res.end(JSON.stringify({ metodo: req.method, auth: req.headers.authorization || null, origin: req.headers.origin || null, sito: req.headers['sec-fetch-site'] || null, corpo: corpo }));
    });
  });
  eco.listen(ECO, '127.0.0.1');
} catch (e) {
  eco = null;
  console.log('(openssl non disponibile: il controllo 3 si salta)');
}

let concluso = false;
function concludi(codice) {
  if (concluso) return;
  concluso = true;
  let male = 0;
  for (const d of esito) { if (!d.ok) male++; console.log((d.ok ? '  ok   ' : '  NO   ') + d.che); if (!d.ok && d.perche) console.log('        ' + d.perche); }
  console.log(male ? '\n' + male + ' cose non tornano' : '\ntutto a posto (' + esito.length + ' controlli)');
  try { server.close(); if (eco) eco.close(); } catch (_) { }
  try { fs.rmSync(DATI, { recursive: true, force: true }); } catch (_) { }
  process.exitCode = codice !== undefined ? codice : (male ? 1 : 0);
}
setTimeout(() => { dice(false, 'il banco ha finito in tempo'); concludi(2); app.exit(2); }, 240000);
const create = [];
app.on('browser-window-created', (_, w) => create.push(w));

process.env.HEXTALE_PROVA = '1';
process.env.HEXTALE_PROVA_DATI = DATI;
process.env.HEXTALE_AGGIORNAMENTI = 'http://127.0.0.1:' + PORTA + '/';
process.env.HEXTALE_CONTROLLO_MS = '1000';
process.env.HEXTALE_GUSCIO_MS = '1500';
process.env.HEXTALE_PROVA_REGOLE = 'MAP api.hextalegame.com ~NOTFOUND, MAP accounts.google.com ~NOTFOUND';
process.env.HEXTALE_PROVA_FIDATO = '127.0.0.1';
require('./main.js');
const leggiJson = (nome) => { try { return JSON.parse(fs.readFileSync(path.join(DATI, nome), 'utf8')); } catch (_) { return null; } };

app.whenReady().then(async () => {
  const trova = () => BrowserWindow.getAllWindows().find((w) => /^https:\/\/hextalegame\.com\/play\//.test(w.webContents.getURL()));
  const gioco = await aspetta(() => { const w = trova(); return w && !w.webContents.isLoading() ? w : null; }, 90000, 500);
  if (!gioco) { dice(false, 'il gioco si apre'); concludi(2); return app.exit(2); }
  const js = (codice, gesto) => gioco.webContents.executeJavaScript(codice, !!gesto);
  const viva = path.join(DATI, 'gioco');
  const manifestoVivo = () => { try { return JSON.parse(fs.readFileSync(path.join(viva, 'manifesto.json'), 'utf8')); } catch (_) { return {}; } };
  try {
    // ── 1. l'aggiornamento all'avvio ──
    const filePresi = chieste.filter((u) => u.indexOf('/gioco/file/') === 0);
    dice(filePresi.length === 1 && filePresi[0] === '/gioco/file/' + sha(NOTE_1), 'all-avvio si scarica solo il file cambiato', JSON.stringify(filePresi));
    dice(create.length >= 2, 'compare la finestrella dell-aggiornamento prima del gioco', create.length + ' finestre');
    dice(fs.existsSync(path.join(viva, 'patch-notes.txt')) && !fs.existsSync(path.join(viva, 'ui')) && manifestoVivo().generato === remoto1.generato,
      'nella cartella viva c-e- solo il file cambiato, e il manifesto nuovo', fs.existsSync(viva) ? fs.readdirSync(viva).join(', ') : 'nessuna cartella');

    // ── 2-4. il gioco ──
    await dorme(3000);
    const audio = Object.keys(incluso.file).find((p) => /\.mp3$/.test(p) && incluso.file[p].dimensione > 1000);
    const r = await js(`(async function(){
      const carica = (src) => new Promise(ok => { const i = new Image(); i.onload = () => ok(i.naturalWidth); i.onerror = () => ok(-1); i.src = src; });
      const badge = document.getElementById('build-version-badge');
      const note = await fetch('../patch-notes.txt?t=' + Date.now()).then(x => x.text()).catch(e => 'ERRORE ' + e.message);
      const manca = await fetch('https://hextalegame.com/stats/index.html').then(x => x.status).catch(e => 'ERRORE ' + e.message);
      const pezzo = await fetch('../' + encodeURI(${JSON.stringify(audio)}), { headers: { Range: 'bytes=0-99' } })
        .then(async x => ({ stato: x.status, byte: (await x.arrayBuffer()).byteLength, tipo: x.headers.get('content-type') })).catch(e => ({ errore: e.message }));
      const eco = ${eco ? 1 : 0} ? await fetch('https://127.0.0.1:${ECO}/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic eDp5' }, body: JSON.stringify({ ciao: 'corpo' }) })
        .then(x => x.json()).catch(e => ({ errore: e.message })) : null;
      return { url: location.href, badge: badge && badge.textContent, assoluta: await carica('https://hextalegame.com/ui/exe-icon.png'), relativa: await carica('../ui/check-icon.png'),
        note: note, manca: manca, pezzo: pezzo, eco: eco, ua: navigator.userAgent, desktop: !!window.hextaleDesktop };
    })()`);
    dice(r.url === 'https://hextalegame.com/play/index.html' && r.badge === incluso.versione, 'il gioco si apre dall-indirizzo del sito, col suo numero di versione', r.url + ' ' + r.badge);
    dice(r.assoluta === 1024 && r.relativa > 0, 'le immagini arrivano dal disco, con l-indirizzo scritto per intero e con quello relativo', r.assoluta + ' / ' + r.relativa);
    dice(r.note === NOTE_1, 'il gioco legge le note di rilascio nuove', JSON.stringify(r.note).slice(0, 80));
    dice(r.manca === 404, 'un file che il gioco non ha risponde 404', r.manca);
    dice(r.pezzo && r.pezzo.stato === 206 && r.pezzo.byte === 100 && r.pezzo.tipo === 'audio/mpeg', 'l-audio si serve anche a pezzi (Range), col suo tipo', JSON.stringify(r.pezzo) + ' ' + audio);
    if (eco) {
      dice(r.eco && r.eco.metodo === 'POST' && r.eco.auth === 'Basic eDp5' && r.eco.corpo === '{"ciao":"corpo"}' && r.eco.origin === 'https://hextalegame.com' && r.eco.sito === 'cross-site',
        'le richieste agli altri siti partono dal browser: con Origin, corpo e intestazioni (quello che Google controlla)', JSON.stringify(r.eco));
    }
    dice(/Chrome\//.test(r.ua) && !/electron|hextale/i.test(r.ua), 'il nome del browser e- quello di Chrome, senza Electron', r.ua);
    dice(r.desktop, 'il gioco sa di girare dentro all-app (window.hextaleDesktop)');

    // ── 5. niente da browser ──
    const menu = Menu.getApplicationMenu();
    const voci = [];
    const giro = (m) => { for (const i of m.items) { voci.push(String(i.role || i.label || '').toLowerCase()); if (i.submenu) giro(i.submenu); } };
    if (menu) giro(menu);
    dice(menu && menu.items.map((i) => i.label).join(',') === 'File,Window' && !voci.some((x) => /reload|devtools|zoom|paste|copy|cut|undo|redo|fullscreen|selectall/.test(x)),
      'il menu ha solo File e Window, senza nessuna voce da browser', voci.join(', '));
    gioco.webContents.openDevTools();
    await dorme(1000);
    dice(!gioco.webContents.isDevToolsOpened(), 'gli strumenti da sviluppatore non si aprono');
    await js("location.href = 'https://hextalegame.com/stats/index.html'; true");
    await dorme(1500);
    dice(gioco.webContents.getURL() === 'https://hextalegame.com/play/index.html' && (await js("!!document.getElementById('build-version-badge')")),
      'la finestra del gioco non naviga altrove', gioco.webContents.getURL());

    // ── 6. Donate ──
    const invio = await js(`(function(){
      const moduli = document.querySelectorAll('form.donate-form');
      if (!moduli.length) return 'nessun modulo Donate';
      try { moduli[0].requestSubmit(); return 'inviato'; } catch (e) { return 'requestSubmit: ' + e.message; }
    })()`, true);
    const esterni = await aspetta(() => leggiJson('esterni.json'), 5000);
    if (invio !== 'inviato') console.log('(Donate: ' + invio + ')');
    const paypal = (esterni || []).find((x) => /^https:\/\/www\.paypal\.com\/donate/.test(x));
    let pp = null;
    try { pp = new URL(paypal); } catch (_) { pp = null; }
    dice(pp && pp.searchParams.get('business') === '4HZY4JGJ2A358' && pp.searchParams.get('currency_code') === 'EUR' && pp.searchParams.get('no_recurring') === '0',
      'Donate apre PayPal nel browser vero, coi campi del modulo nell-indirizzo', JSON.stringify(esterni));

    // ── 7. una versione nuova a gioco aperto ──
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

    // ── 8. un'app nuova, e l'uscita ──
    const exeFile = path.join(DATI, 'installatore', 'Hextale-Setup-9.9.9.exe');
    const scaricato = await aspetta(() => fs.existsSync(exeFile) && fs.readFileSync(exeFile).equals(EXE), 20000, 300);
    dice(scaricato, 'esce un-app nuova: il suo installatore si scarica e si verifica, in silenzio');
    // ── 9. Google, nel browser vero ──
    const esterniPrima = (leggiJson('esterni.json') || []).length;
    await js('window.__codiceGoogle = null; window.accessoGoogleCodice = function(r){ window.__codiceGoogle = r && r.code; }; accessoConGoogle(); true', true);
    const aperta = await aspetta(() => (leggiJson('esterni.json') || []).slice(esterniPrima).find((x) => x.indexOf('https://hextalegame.com/app-login/?') === 0), 5000, 200);
    let qg = null;
    try { qg = new URL(aperta).searchParams; } catch (_) { qg = null; }
    dice(qg && /^\d+$/.test(qg.get('porta')) && /^[0-9a-f]{32}$/.test(qg.get('stato')), 'Login with Google apre nel browser vero la pagina di accesso, con porta e stato', aperta);
    if (qg) {
      const sbagliato = await new Promise((ok) => http.get('http://127.0.0.1:' + qg.get('porta') + '/google?stato=' + '0'.repeat(32) + '&code=4/codice-falso-123',
        (res) => { res.resume(); ok(res.statusCode); }).on('error', (e) => ok(e.message)));
      dice(sbagliato === 404 && !(await js('window.__codiceGoogle')), 'un codice con lo stato sbagliato non arriva al gioco', sbagliato);
      // La pagina vera del sito (dal disco) in un "browser" a parte, con un Google finto.
      const browser = new BrowserWindow({ show: false, webPreferences: { partition: 'browser-finto' } });
      await browser.loadFile(path.join(__dirname, '..', 'app-login', 'index.html'), { search: 'porta=' + qg.get('porta') + '&stato=' + qg.get('stato') });
      await browser.webContents.executeJavaScript("window.google = { accounts: { oauth2: { initCodeClient: (o) => ({ requestCode: () => o.callback({ code: '4/0Codice-di-prova_123' }) }) } } }; document.getElementById('google').click(); true", true);
      const codiceG = await aspetta(() => js('window.__codiceGoogle'), 8000, 200);
      const finale = await aspetta(async () => /signed in/i.test(await browser.webContents.executeJavaScript('document.body.innerText')), 5000, 200);
      dice(codiceG === '4/0Codice-di-prova_123' && finale, 'dalla pagina il codice torna al gioco, e nel browser si legge che si puo- tornare al gioco', codiceG + ' / ' + finale);
      const ancora = await new Promise((ok) => http.get('http://127.0.0.1:' + qg.get('porta') + '/google?stato=' + qg.get('stato') + '&code=4/0Di-nuovo_12345',
        (res) => { res.resume(); ok(res.statusCode); }).on('error', () => ok('chiuso')));
      dice(ancora !== 200, 'l-indirizzo locale vale una volta sola', ancora);
      browser.destroy();
    }

    app.once('will-quit', () => {
      const lanciato = leggiJson('installatore-lanciato.json');
      dice(lanciato && lanciato.length === 1 && lanciato[0].file === exeFile && JSON.stringify(lanciato[0].argomenti) === '["--updated","/S"]',
        'Exit game chiude l-app, e alla chiusura l-installatore dell-app nuova parte muto', JSON.stringify(lanciato));
      concludi();
    });
    await js('setTimeout(esciDalGioco, 50); true');
    await dorme(10000);
    dice(false, 'Exit game chiude l-app', 'dopo 10 secondi la finestra e- ancora aperta');
  } catch (e) {
    dice(false, 'il banco e- arrivato in fondo', e.stack);
  }
  concludi();
  app.exit(process.exitCode || 1);
});
