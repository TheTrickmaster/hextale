// L'AGGIORNATORE DELL'APP DESKTOP, SENZA R2 (v0.80.30).
//
//     node desktop/prova-aggiornatore.js
//
// Un server HTTP locale fa la parte di Cloudflare R2 (gioco/manifesto.json e
// gioco/file/<sha256>), due cartelle temporanee fanno la copia inclusa
// nell'installazione e quella viva. Qui:
//   1. la prima volta: l'inclusa vale, e se il deposito e' uguale non si scarica niente;
//   2. un file cambiato: si scarica solo quello, va nella viva, il manifesto dopo;
//      il gioco lo trova nella viva e gli altri nell'inclusa;
//   3. un file tolto: non si serve piu', anche se l'inclusa ce l'ha;
//   4. un download corrotto: errore, e niente cambia (ne' file ne' manifesto);
//   5. un manifesto con un percorso fuori dalla cartella: rifiutato;
//   6. senza rete: errore in fretta (l'app parte con quello che ha);
//   7. un installatore piu' nuovo della viva: la viva si butta;
//   8. le versioni si confrontano pezzo per pezzo;
//   9. a gioco aperto: si prescarica nel cantiere senza posare, e posando non si riscarica.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const A = require('./aggiornatore');

let male = 0;
const dice = (ok, che, perche) => {
  if (!ok) male++;
  console.log((ok ? '  ok   ' : '  NO   ') + che);
  if (!ok && perche !== undefined) console.log('        ' + perche);
};
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

const radice = fs.mkdtempSync(path.join(os.tmpdir(), 'hextale-aggiornatore-'));
const INCLUSA = path.join(radice, 'inclusa'), VIVA = path.join(radice, 'viva');
const deposito = { manifesto: null, file: {}, guasto: null };
const scritto = (cartella, p, testo) => { const f = path.join(cartella, ...p.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, testo); };
const manifesto = (versione, contenuti, generato) => {
  const file = {};
  for (const p of Object.keys(contenuti)) file[p] = { sha256: sha(contenuti[p]), dimensione: Buffer.byteLength(contenuti[p]) };
  return { versione: versione, generato: generato || '2026-09-15T12:00:00.000Z', file: file };
};
const pubblica = (versione, contenuti, generato) => {
  deposito.manifesto = manifesto(versione, contenuti, generato);
  for (const p of Object.keys(contenuti)) deposito.file[sha(contenuti[p])] = contenuti[p];
};
let richiesteFile = 0;
const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/gioco/manifesto.json') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(deposito.manifesto)); }
  const m = u.match(/^\/gioco\/file\/([0-9a-f]{64})$/);
  if (m && deposito.file[m[1]] !== undefined) {
    richiesteFile++;
    res.writeHead(200);
    return res.end(deposito.guasto === m[1] ? 'contenuto rovinato' : deposito.file[m[1]]);
  }
  res.writeHead(404); res.end();
});

server.listen(0, '127.0.0.1', async () => {
  const BASE = 'http://127.0.0.1:' + server.address().port + '/';
  try {
    // ── 1. la prima volta ─────────────────────────────────────────────────
    const v1 = { 'play/index.html': 'gioco v1', 'ui/a.png': 'immagine a', 'audio/b.mp3': 'suono b' };
    for (const p of Object.keys(v1)) scritto(INCLUSA, p, v1[p]);
    fs.writeFileSync(path.join(INCLUSA, 'manifesto.json'), JSON.stringify(manifesto('v0.80.30', v1)));
    pubblica('v0.80.30', v1);
    let efficace = await A.manifestoEfficace(INCLUSA, VIVA);
    dice(efficace && efficace.versione === 'v0.80.30', 'la prima volta vale il manifesto dell-installazione');
    let piano = await A.controlla(BASE, efficace);
    dice(!piano.nuovo && piano.daScaricare.length === 0, 'deposito uguale: niente da scaricare', JSON.stringify(piano.daScaricare));
    dice(A.trovaFile(efficace, INCLUSA, VIVA, 'ui/a.png') === path.join(INCLUSA, 'ui', 'a.png'), 'i file si trovano nell-installazione');
    dice(A.trovaFile(efficace, INCLUSA, VIVA, 'stats/index.html') === null, 'un file che il gioco non ha: niente (404)');

    // ── 2. un file cambiato ───────────────────────────────────────────────
    const v2 = Object.assign({}, v1, { 'play/index.html': 'gioco v2' });
    pubblica('v0.80.31', v2);
    piano = await A.controlla(BASE, efficace);
    dice(piano.nuovo && piano.daScaricare.length === 1 && piano.daScaricare[0].percorso === 'play/index.html', 'un file cambiato: si scarica solo quello', JSON.stringify(piano.daScaricare));
    richiesteFile = 0;
    let avanzamenti = [];
    efficace = await A.applica(BASE, VIVA, piano, { suAvanzamento: (f) => avanzamenti.push(f) });
    dice(richiesteFile === 1 && avanzamenti[avanzamenti.length - 1] === 1, 'una sola richiesta di file, e l-avanzamento arriva a 1', richiesteFile + ' / ' + JSON.stringify(avanzamenti));
    dice(fs.readFileSync(path.join(VIVA, 'play', 'index.html'), 'utf8') === 'gioco v2' && !fs.existsSync(path.join(VIVA, 'ui', 'a.png')), 'nella viva c-e- solo il file cambiato');
    dice((await A.leggiManifesto(VIVA)).versione === 'v0.80.31' && !fs.existsSync(path.join(VIVA, '.cantiere')), 'il manifesto nuovo e- scritto, il cantiere e- sparito');
    efficace = await A.manifestoEfficace(INCLUSA, VIVA);
    dice(A.trovaFile(efficace, INCLUSA, VIVA, 'play/index.html') === path.join(VIVA, 'play', 'index.html')
      && A.trovaFile(efficace, INCLUSA, VIVA, 'ui/a.png') === path.join(INCLUSA, 'ui', 'a.png'), 'il gioco trova il nuovo nella viva e gli altri nell-installazione');
    piano = await A.controlla(BASE, efficace);
    dice(!piano.nuovo, 'e al controllo dopo non c-e- piu- niente da fare');

    // ── 3. un file tolto ──────────────────────────────────────────────────
    const v3 = { 'play/index.html': 'gioco v2', 'ui/a.png': 'immagine a' };
    pubblica('v0.80.32', v3);
    piano = await A.controlla(BASE, efficace);
    dice(piano.daTogliere.join() === 'audio/b.mp3' && piano.daScaricare.length === 0, 'un file tolto dal deposito: da togliere, niente da scaricare', JSON.stringify(piano));
    efficace = await A.applica(BASE, VIVA, piano);
    dice(A.trovaFile(efficace, INCLUSA, VIVA, 'audio/b.mp3') === null && fs.existsSync(path.join(INCLUSA, 'audio', 'b.mp3')), 'non si serve piu-, anche se l-installazione ce l-ha ancora');

    // ── 4. un download corrotto ───────────────────────────────────────────
    const v4 = Object.assign({}, v3, { 'ui/a.png': 'immagine a nuova', 'fonts/c.ttf': 'carattere' });
    pubblica('v0.80.33', v4);
    deposito.guasto = sha('carattere');
    piano = await A.controlla(BASE, efficace);
    let errore = '';
    try { await A.applica(BASE, VIVA, piano); } catch (e) { errore = e.message; }
    dice(/impronta sbagliata per fonts\/c\.ttf/.test(errore), 'un download corrotto si ferma, e dice quale file', errore);
    dice((await A.leggiManifesto(VIVA)).versione === 'v0.80.32' && !fs.existsSync(path.join(VIVA, 'ui', 'a.png')) && !fs.existsSync(path.join(VIVA, 'fonts', 'c.ttf')),
      'e niente cambia: ne- i file al loro posto ne- il manifesto');
    deposito.guasto = null;
    richiesteFile = 0;
    efficace = await A.applica(BASE, VIVA, await A.controlla(BASE, await A.manifestoEfficace(INCLUSA, VIVA)));
    dice(efficace.versione === 'v0.80.33' && fs.readFileSync(path.join(VIVA, 'fonts', 'c.ttf'), 'utf8') === 'carattere' && richiesteFile === 1,
      'riprovando riesce, e il file gia- scaricato bene nel cantiere non si riscarica', 'richieste: ' + richiesteFile);

    // ── 5. un percorso fuori dalla cartella ───────────────────────────────
    deposito.manifesto = { versione: 'v0.80.34', file: { '../../fuori.txt': { sha256: sha('x'), dimensione: 1 } } };
    errore = '';
    try { await A.controlla(BASE, efficace); } catch (e) { errore = e.message; }
    dice(/percorso non ammesso/.test(errore), 'un manifesto con un percorso fuori dalla cartella si rifiuta', errore);
    dice(!A.percorsoSicuro('C:/x') && !A.percorsoSicuro('a\\b') && !A.percorsoSicuro('/a') && !A.percorsoSicuro('a//b') && A.percorsoSicuro('cards/art/baba yaga/x.jpg'), 'e i percorsi si controllano uno per uno');

    // ── 6. senza rete ─────────────────────────────────────────────────────
    const t0 = Date.now();
    errore = '';
    try { await A.controlla('http://127.0.0.1:9/', efficace, { timeoutMs: 1500 }); } catch (e) { errore = e.message || String(e); }
    dice(errore && Date.now() - t0 < 3000, 'senza rete: errore in fretta, e l-app parte con quello che ha', (Date.now() - t0) + ' ms');

    // ── 7. un installatore piu' nuovo ─────────────────────────────────────
    fs.writeFileSync(path.join(INCLUSA, 'manifesto.json'), JSON.stringify(manifesto('v0.80.40', v1)));
    efficace = await A.manifestoEfficace(INCLUSA, VIVA);
    dice(efficace.versione === 'v0.80.40' && !fs.existsSync(VIVA), 'un installatore piu- nuovo della viva: la viva si butta');

    // ── 8. le versioni ────────────────────────────────────────────────────
    dice(A.confronta({ versione: 'v0.80.10' }, { versione: 'v0.80.9' }) > 0 && A.confronta({ versione: 'v0.80.9', generato: 'b' }, { versione: 'v0.80.9', generato: 'a' }) > 0
      && A.confronta({ versione: 'v0.80.9', generato: 'a' }, { versione: 'v0.80.9', generato: 'a' }) === 0, 'le versioni si confrontano pezzo per pezzo, poi la data');

    // ── 9. a gioco aperto: prima si scarica, si posa dopo ─────────────────
    pubblica('v0.80.41', Object.assign({}, v1, { 'patch-notes.txt': 'note nuove' }));
    piano = await A.controlla(BASE, efficace);
    richiesteFile = 0;
    await A.prescarica(BASE, VIVA, piano);
    const nelCantiere = A.fileInCantiere(VIVA, piano, 'patch-notes.txt');
    dice(nelCantiere && fs.readFileSync(nelCantiere, 'utf8') === 'note nuove' && richiesteFile === 1, 'prescaricato: il file nuovo e- nel cantiere');
    dice(A.fileInCantiere(VIVA, piano, 'ui/a.png') === null && A.fileInCantiere(VIVA, null, 'patch-notes.txt') === null, 'e solo i file che cambiano ci sono');
    dice(!(await A.leggiManifesto(VIVA)) && A.trovaFile(efficace, INCLUSA, VIVA, 'patch-notes.txt') === null, 'ma non e- ancora posato: il manifesto che vale e- quello di prima');
    richiesteFile = 0;
    efficace = await A.applica(BASE, VIVA, piano);
    dice(efficace.versione === 'v0.80.41' && richiesteFile === 0 && A.trovaFile(efficace, INCLUSA, VIVA, 'patch-notes.txt') === path.join(VIVA, 'patch-notes.txt')
      && !fs.existsSync(path.join(VIVA, '.cantiere')), 'posandolo non si riscarica niente, e dopo vale la versione nuova', 'richieste: ' + richiesteFile);
  } catch (e) {
    dice(false, 'il banco e- arrivato in fondo', e.stack);
  } finally {
    server.close();
    fs.rmSync(radice, { recursive: true, force: true });
    console.log(String.fromCharCode(10) + (male ? male + ' NO' : 'tutto a posto'));
    process.exitCode = male ? 1 : 0;
  }
});
