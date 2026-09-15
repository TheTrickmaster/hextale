// PUBBLICARE SU R2, SENZA R2 (v0.80.30).
//
//     node desktop/prova-pubblica-r2.js
//
// Un server HTTP locale fa la parte dell'API S3 di R2 e RIFA' LA FIRMA di ogni
// richiesta da cio' che riceve; lo script vero (pubblica-r2.js) gira come
// processo a parte, con chiavi finte, un gioco-pronto finto e un dist finto.
//   1. la firma AWS V4 coincide con gli esempi della documentazione di AWS;
//   2. --senza-caricare non carica niente e dice quanto manca;
//   3. la prima volta: ogni impronta una volta sola (due file uguali = un oggetto),
//      il manifesto PER ULTIMO, con le cache giuste;
//   4. ogni richiesta arriva firmata come dice, col corpo dell'impronta dichiarata;
//   5. ripubblicando uguale non si carica niente;
//   6. un file cambiato: si carica solo quello, anche con l'elenco a pagine;
//   7. un file sul disco diverso dal manifesto: ci si ferma prima di caricare;
//      e una copia fatta con --copia-di-lavoro (per i banchi) non si pubblica;
//   8. una versione piu' vecchia di quella su R2: rifiutata; con --forza passa;
//   9. l'installatore: col suo nome, col nome fisso, e ultimo.json con l'impronta;
//  10. senza chiavi, o con chiavi sbagliate: si ferma e lo dice;
//  11. le chiavi non compaiono MAI in cio' che lo script scrive.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { firma } = require('./pubblica-r2');

let male = 0;
const dice = (ok, che, perche) => {
  if (!ok) male++;
  console.log((ok ? '  ok   ' : '  NO   ') + che);
  if (!ok && perche !== undefined) console.log('        ' + perche);
};
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const SCRIPT = path.join(__dirname, 'pubblica-r2.js');
const VERSIONE_GUSCIO = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version;

// ── 1. la firma, contro gli esempi di AWS (Signature Version 4, S3) ──────────
{
  const EX = { chiave: 'AKIAIOSFODNN7EXAMPLE', segreto: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', regione: 'us-east-1', servizio: 's3', quando: '20130524T000000Z' };
  const VUOTO = sha('');
  const firmaDi = (o) => (firma(Object.assign({}, EX, o)).match(/Signature=([0-9a-f]+)/) || [])[1];
  const host = 'examplebucket.s3.amazonaws.com';
  dice(firmaDi({ metodo: 'GET', percorso: '/test.txt', intestazioni: { host, range: 'bytes=0-9', 'x-amz-content-sha256': VUOTO, 'x-amz-date': EX.quando } })
    === 'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41', 'firma AWS: l-esempio GET con Range');
  dice(sha('Welcome to Amazon S3.') === '44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072'
    && firmaDi({ metodo: 'PUT', percorso: '/test$file.text', intestazioni: { date: 'Fri, 24 May 2013 00:00:00 GMT', host, 'x-amz-content-sha256': sha('Welcome to Amazon S3.'), 'x-amz-date': EX.quando, 'x-amz-storage-class': 'REDUCED_REDUNDANCY' } })
    === '98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd', 'firma AWS: l-esempio PUT (col $ nel nome)');
  dice(firmaDi({ metodo: 'GET', percorso: '/', query: { 'max-keys': '2', prefix: 'J' }, intestazioni: { host, 'x-amz-content-sha256': VUOTO, 'x-amz-date': EX.quando } })
    === '34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7', 'firma AWS: l-esempio dell-elenco');
}

// ── il server finto ───────────────────────────────────────────────────────────
const BUCKET = 'hextale-prova';
const CHIAVE = 'AKIAPROVAPROVA0001';
const SEGRETO = 'segreto/di+prova=SOLO-PER-IL-BANCO';
const ACCOUNT = 'accountdiprova0123456789';
const PAGINA = 3;
const oggetti = new Map();
const registro = [];
const server = http.createServer((req, res) => {
  const pezzi = [];
  req.on('data', (d) => pezzi.push(d));
  req.on('end', () => {
    const corpo = Buffer.concat(pezzi);
    const u = new URL(req.url, 'http://x');
    const percorso = decodeURIComponent(u.pathname);
    const auth = req.headers.authorization || '';
    const m = auth.match(/^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/auto\/s3\/aws4_request, SignedHeaders=([^,]+), Signature=[0-9a-f]{64}$/);
    let firmaOk = false;
    if (m) {
      const firmate = m[3].split(';');
      const intestazioni = {};
      for (const n of firmate) intestazioni[n] = req.headers[n];
      const query = {};
      for (const [k, v] of u.searchParams) query[k] = v;
      firmaOk = m[1] === CHIAVE && firmate.indexOf('host') >= 0 && firmate.indexOf('x-amz-content-sha256') >= 0 && firmate.indexOf('x-amz-date') >= 0
        && firma({ metodo: req.method, percorso, query, intestazioni, quando: req.headers['x-amz-date'], regione: 'auto', servizio: 's3', chiave: CHIAVE, segreto: SEGRETO }) === auth;
    }
    const corpoOk = req.headers['x-amz-content-sha256'] === sha(corpo);
    const chiave = percorso.replace(new RegExp('^/' + BUCKET + '/?'), '');
    registro.push({ metodo: req.method, chiave, firmaOk, corpoOk, query: u.search });
    if (!firmaOk || !corpoOk || percorso.indexOf('/' + BUCKET) !== 0) {
      res.writeHead(403);
      return res.end('<Error><Code>SignatureDoesNotMatch</Code><Message>firma sbagliata</Message><AWSAccessKeyId>' + (m ? m[1] : '') + '</AWSAccessKeyId></Error>');
    }
    if (req.method === 'PUT') { oggetti.set(chiave, { corpo, intestazioni: req.headers }); res.writeHead(200); return res.end(); }
    if (req.method === 'GET' && chiave === '' && u.searchParams.get('list-type') === '2') {
      const tutte = [...oggetti.keys()].filter((k) => k.indexOf(u.searchParams.get('prefix') || '') === 0).sort();
      const da = Number(u.searchParams.get('continuation-token') || 0);
      const altre = da + PAGINA < tutte.length;
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      return res.end('<?xml version="1.0" encoding="UTF-8"?><ListBucketResult>' + tutte.slice(da, da + PAGINA).map((k) => '<Contents><Key>' + k + '</Key></Contents>').join('')
        + '<IsTruncated>' + altre + '</IsTruncated>' + (altre ? '<NextContinuationToken>' + (da + PAGINA) + '</NextContinuationToken>' : '') + '</ListBucketResult>');
    }
    if (req.method === 'GET') {
      const o = oggetti.get(chiave);
      if (!o) { res.writeHead(404); return res.end('<Error><Code>NoSuchKey</Code></Error>'); }
      res.writeHead(200);
      return res.end(o.corpo);
    }
    res.writeHead(400);
    res.end();
  });
});

const radice = fs.mkdtempSync(path.join(os.tmpdir(), 'hextale-pubblica-'));
const PRONTO = path.join(radice, 'gioco-pronto');
const DIST = path.join(radice, 'dist');
const CHIAVI = path.join(radice, 'r2.json');
const CHIAVI_SBAGLIATE = path.join(radice, 'r2-sbagliate.json');
fs.writeFileSync(CHIAVI, JSON.stringify({ account: ACCOUNT, chiave: CHIAVE, segreto: SEGRETO, bucket: BUCKET }));
fs.writeFileSync(CHIAVI_SBAGLIATE, JSON.stringify({ account: ACCOUNT, chiave: CHIAVE, segreto: SEGRETO + 'x', bucket: BUCKET }));
const prepara = (versione, contenuti, generato, origine) => {
  fs.rmSync(PRONTO, { recursive: true, force: true });
  const file = {};
  for (const p of Object.keys(contenuti)) {
    const f = path.join(PRONTO, ...p.split('/'));
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, contenuti[p]);
    file[p] = { sha256: sha(contenuti[p]), dimensione: Buffer.byteLength(contenuti[p]) };
  }
  fs.writeFileSync(path.join(PRONTO, 'manifesto.json'), JSON.stringify({ versione, generato, origine: origine || 'commit 1234abc', file }));
};
const uscite = [];
let ENV = null;
const lancia = (args, altro) => new Promise((ok) => {
  registro.length = 0;
  execFile(process.execPath, [SCRIPT].concat(args || []), { env: Object.assign({}, process.env, ENV, altro || {}), encoding: 'utf8', timeout: 60000 }, (err, stdout, stderr) => {
    const uscita = String(stdout) + String(stderr);
    uscite.push(uscita);
    ok({ codice: err ? (typeof err.code === 'number' ? err.code : 1) : 0, uscita });
  });
});
const messi = () => registro.filter((r) => r.metodo === 'PUT').map((r) => r.chiave);

server.listen(0, '127.0.0.1', async () => {
  ENV = { HEXTALE_R2_ENDPOINT: 'http://127.0.0.1:' + server.address().port, HEXTALE_R2_CHIAVI: CHIAVI, HEXTALE_GIOCO_PRONTO: PRONTO, HEXTALE_DIST: DIST };
  try {
    const v1 = { 'play/index.html': 'gioco 1', 'ui/a.png': 'immagine', 'ui/copia-di-a.png': 'immagine', 'audio/b.mp3': 'suono', 'fonts/c.ttf': 'carattere', 'video/d.mp4': 'filmato' };
    prepara('v0.80.40', v1, '2026-09-15T10:00:00.000Z');

    // ── 2. senza caricare ──
    let r = await lancia(['--senza-caricare']);
    dice(r.codice === 0 && messi().length === 0 && /ne mancano 5 /.test(r.uscita), '--senza-caricare non carica niente e dice quanto manca', r.uscita);

    // ── 3-4. la prima volta ──
    r = await lancia([]);
    const primi = messi();
    dice(r.codice === 0 && primi.length === 6 && new Set(primi).size === 6, 'la prima volta: cinque impronte (due file uguali sono un oggetto solo) e il manifesto', r.uscita + ' ' + JSON.stringify(primi));
    dice(primi[primi.length - 1] === 'gioco/manifesto.json', 'il manifesto si carica per ultimo', JSON.stringify(primi));
    const png = oggetti.get('gioco/file/' + sha('immagine'));
    const man = oggetti.get('gioco/manifesto.json');
    dice(png && png.corpo.toString() === 'immagine' && png.intestazioni['content-type'] === 'image/png' && png.intestazioni['cache-control'] === 'public, max-age=31536000, immutable'
      && man && man.intestazioni['cache-control'] === 'no-cache' && JSON.parse(man.corpo.toString()).versione === 'v0.80.40',
      'i file col loro tipo e la cache di un anno, il manifesto senza cache');
    dice(registro.length > 0 && registro.every((x) => x.firmaOk && x.corpoOk), 'ogni richiesta arriva firmata come dice, col corpo dell-impronta dichiarata', JSON.stringify(registro.filter((x) => !x.firmaOk || !x.corpoOk)));

    // ── 5. uguale ──
    r = await lancia([]);
    dice(r.codice === 0 && messi().length === 0 && /niente da fare/.test(r.uscita), 'ripubblicando uguale non si carica niente', r.uscita);

    // ── 6. un file cambiato, elenco a pagine ──
    prepara('v0.80.41', Object.assign({}, v1, { 'play/index.html': 'gioco 2' }), '2026-09-15T11:00:00.000Z');
    r = await lancia([]);
    const pagine = registro.filter((x) => x.metodo === 'GET' && /list-type=2/.test(x.query));
    dice(r.codice === 0 && JSON.stringify(messi()) === JSON.stringify(['gioco/file/' + sha('gioco 2'), 'gioco/manifesto.json']) && pagine.length >= 2,
      'un file cambiato: si carica solo quello, e l-elenco a pagine si legge tutto', pagine.length + ' pagine, ' + JSON.stringify(messi()));

    // ── 7. il disco non corrisponde ──
    prepara('v0.80.42', Object.assign({}, v1, { 'ui/a.png': 'immagine nuova' }), '2026-09-15T12:00:00.000Z');
    fs.writeFileSync(path.join(PRONTO, 'ui', 'a.png'), 'rovinata dopo il manifesto');
    r = await lancia([]);
    dice(r.codice !== 0 && messi().length === 0 && /ui\/a\.png non corrisponde/.test(r.uscita), 'un file diverso dal manifesto: ci si ferma prima di caricare qualunque cosa', r.uscita);

    // ── 7b. una copia fatta per i banchi ──
    prepara('v0.80.42', v1, '2026-09-15T12:30:00.000Z', 'copia di lavoro');
    r = await lancia([]);
    dice(r.codice !== 0 && messi().length === 0 && /non viene da un commit/.test(r.uscita), 'una copia fatta dalla copia di lavoro (per i banchi) non si pubblica', r.uscita);

    // ── 8. piu' vecchia ──
    prepara('v0.80.39', v1, '2026-09-15T13:00:00.000Z');
    r = await lancia([]);
    dice(r.codice !== 0 && messi().length === 0 && /piu- nuova/.test(r.uscita), 'una versione piu- vecchia di quella su R2 si rifiuta', r.uscita);
    r = await lancia(['--forza']);
    dice(r.codice === 0 && JSON.parse(oggetti.get('gioco/manifesto.json').corpo.toString()).versione === 'v0.80.39', 'e con --forza passa', r.uscita);

    // ── 9. l'installatore ──
    r = await lancia(['--installatore']);
    dice(r.codice !== 0 && /npm run build/.test(r.uscita) && messi().length === 0, 'senza l-installatore costruito si ferma prima di caricare', r.uscita);
    fs.mkdirSync(DIST, { recursive: true });
    fs.writeFileSync(path.join(DIST, 'Hextale-Setup-' + VERSIONE_GUSCIO + '.exe'), 'installatore finto');
    r = await lancia(['--installatore']);
    const exe = oggetti.get('installatore/Hextale-Setup-' + VERSIONE_GUSCIO + '.exe');
    const fisso = oggetti.get('installatore/Hextale-Setup.exe');
    let ultimo = null;
    try { ultimo = JSON.parse(oggetti.get('installatore/ultimo.json').corpo.toString()); } catch (_) { ultimo = null; }
    dice(r.codice === 0 && exe && fisso && exe.corpo.toString() === 'installatore finto' && fisso.corpo.toString() === 'installatore finto'
      && fisso.intestazioni['cache-control'] === 'no-cache' && ultimo && ultimo.versione === VERSIONE_GUSCIO && ultimo.sha256 === sha('installatore finto')
      && ultimo.file === 'installatore/Hextale-Setup-' + VERSIONE_GUSCIO + '.exe',
      'l-installatore: col suo nome, col nome fisso (senza cache), e ultimo.json con versione e impronta', r.uscita);

    // ── 10. le chiavi ──
    r = await lancia([], { HEXTALE_R2_CHIAVI: path.join(radice, 'non-ci-sono.json') });
    dice(r.codice !== 0 && /non trovo le chiavi/.test(r.uscita), 'senza il file delle chiavi si ferma e dice dove le cerca', r.uscita);
    r = await lancia([], { HEXTALE_R2_CHIAVI: CHIAVI_SBAGLIATE });
    dice(r.codice !== 0 && /403 SignatureDoesNotMatch/.test(r.uscita), 'con le chiavi sbagliate si ferma e dice perche-', r.uscita);

    // ── 11. mai scritte ──
    const tutto = uscite.join('\n');
    dice(tutto.indexOf(CHIAVE) < 0 && tutto.indexOf(SEGRETO) < 0 && tutto.indexOf(ACCOUNT) < 0, 'le chiavi non compaiono mai in cio- che lo script scrive (' + uscite.length + ' esecuzioni)');
  } catch (e) {
    dice(false, 'il banco e- arrivato in fondo', e.stack);
  } finally {
    server.close();
    fs.rmSync(radice, { recursive: true, force: true });
    console.log(String.fromCharCode(10) + (male ? male + ' NO' : 'tutto a posto'));
    process.exitCode = male ? 1 : 0;
  }
});
