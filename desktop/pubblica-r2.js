// PUBBLICA IL GIOCO (e l'installatore) SU CLOUDFLARE R2 (v0.80.30).
//
//   node desktop/prepara-gioco.js
//   node desktop/pubblica-r2.js                   carica i file nuovi, poi il manifesto
//   node desktop/pubblica-r2.js --senza-caricare  dice solo cosa caricherebbe
//   node desktop/pubblica-r2.js --installatore    anche desktop/dist/Hextale-Setup-<versione>.exe
//   node desktop/pubblica-r2.js --forza           anche se su R2 c'e' una versione piu' nuova
//
// LE CHIAVI NON STANNO NEL REPOSITORY. Si leggono da
// %USERPROFILE%\.hextale\r2.json (o dal file indicato in HEXTALE_R2_CHIAVI),
// fatto come desktop/r2.esempio.json:
//   { "account": "<Account ID>", "chiave": "<Access Key ID>", "segreto": "<Secret Access Key>", "bucket": "hextale-download" }
// Lo script non le scrive mai, nemmeno in un errore.
//
// COSA CARICA (vedi aggiornatore.js per com'e' fatto il deposito)
//   gioco/file/<sha256>    solo le impronte che su R2 non ci sono ancora. Non
//                          cambiano mai, quindi la cache puo' tenerle un anno.
//                          Le vecchie non si cancellano: servono a chi aggiorna
//                          partendo da un installatore vecchio, e costano poco;
//   gioco/manifesto.json   PER ULTIMO: finche' non c'e' lui nessuna app vede la
//                          versione nuova, quindi non se ne vede mai meta';
//   installatore/Hextale-Setup-<v>.exe, installatore/Hextale-Setup.exe (il nome
//                          fisso per la pagina di download) e
//                          installatore/ultimo.json (versione e impronta).
// Prima di caricare qualunque cosa si rileggono i file dal disco e se ne
// ricalcola l'impronta: se gioco-pronto e' cambiato dopo il manifesto, ci si ferma.
//
// L'API e' quella S3 di R2, firmata a mano (AWS Signature V4) per non aggiungere
// dipendenze: e' una funzione sola, e il banco la confronta con gli esempi della
// documentazione di AWS (desktop/prova-pubblica-r2.js).
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const A = require('./aggiornatore');

const sha256 = (dati) => crypto.createHash('sha256').update(dati).digest('hex');
const hmac = (chiave, testo) => crypto.createHmac('sha256', chiave).update(testo).digest();
const mb = (byte) => (byte / 1048576).toFixed(1) + ' MB';

const TIPI = {
  '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.exe': 'application/vnd.microsoft.portable-executable',
};
const tipo = (p) => TIPI[path.extname(p).toLowerCase()] || 'application/octet-stream';

// Come vuole S3: tutto codificato tranne lettere, cifre e - . _ ~
function codifica(s) {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

// AWS Signature V4. `intestazioni` sono quelle da firmare, host e x-amz-* compresi;
// `percorso` non codificato; `quando` nella forma 20130524T000000Z.
// Restituisce il valore di Authorization.
function firma(o) {
  const giorno = o.quando.slice(0, 8);
  const valori = {};
  for (const n of Object.keys(o.intestazioni)) valori[n.toLowerCase()] = String(o.intestazioni[n]).trim().replace(/\s+/g, ' ');
  const nomi = Object.keys(valori).sort();
  const percorso = o.percorso.split('/').map(codifica).join('/');
  const q = o.query || {};
  const query = Object.keys(q).map((k) => [codifica(k), codifica(q[k])]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map((x) => x[0] + '=' + x[1]).join('&');
  const canonica = [o.metodo, percorso, query, nomi.map((n) => n + ':' + valori[n] + '\n').join(''), nomi.join(';'), valori['x-amz-content-sha256']].join('\n');
  const ambito = giorno + '/' + o.regione + '/' + o.servizio + '/aws4_request';
  const daFirmare = ['AWS4-HMAC-SHA256', o.quando, ambito, sha256(canonica)].join('\n');
  const k = hmac(hmac(hmac(hmac('AWS4' + o.segreto, giorno), o.regione), o.servizio), 'aws4_request');
  return 'AWS4-HMAC-SHA256 Credential=' + o.chiave + '/' + ambito + ', SignedHeaders=' + nomi.join(';') + ', Signature=' + crypto.createHmac('sha256', k).update(daFirmare).digest('hex');
}

function clienteR2(conf) {
  const base = new URL(conf.endpoint || ('https://' + conf.account + '.r2.cloudflarestorage.com'));
  return function chiedi(metodo, chiave, opzioni) {
    const o = opzioni || {};
    const corpo = o.corpo || Buffer.alloc(0);
    const percorso = '/' + conf.bucket + (chiave ? '/' + chiave : '');
    const query = o.query || {};
    const quando = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const intestazioni = Object.assign({}, o.intestazioni || {}, { host: base.host, 'x-amz-date': quando, 'x-amz-content-sha256': sha256(corpo) });
    const authorization = firma({ metodo, percorso, query, intestazioni, quando, regione: 'auto', servizio: 's3', chiave: conf.chiave, segreto: conf.segreto });
    const qs = Object.keys(query).map((k) => codifica(k) + '=' + codifica(query[k])).join('&');
    const url = base.protocol + '//' + base.host + percorso.split('/').map(codifica).join('/') + (qs ? '?' + qs : '');
    return new Promise((ok, ko) => {
      const modulo = base.protocol === 'http:' ? http : https;
      const req = modulo.request(url, { method: metodo, headers: Object.assign({}, intestazioni, { authorization: authorization, 'content-length': corpo.length }), timeout: 300000 }, (res) => {
        const pezzi = [];
        res.on('data', (d) => pezzi.push(d));
        res.on('end', () => ok({ stato: res.statusCode, corpo: Buffer.concat(pezzi) }));
        res.on('error', ko);
      });
      req.on('timeout', () => req.destroy(new Error('tempo scaduto: ' + metodo + ' ' + chiave)));
      req.on('error', ko);
      req.end(corpo);
    });
  };
}

const daXml = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// Solo codice e messaggio: le risposte d'errore di S3 possono contenere l'Access Key ID.
function errore(risposta, che) {
  const t = risposta.corpo.toString('utf8');
  const codice = (t.match(/<Code>([^<]*)<\/Code>/) || [])[1] || '';
  const messaggio = (t.match(/<Message>([^<]*)<\/Message>/) || [])[1] || '';
  return new Error(che + ': HTTP ' + risposta.stato + (codice ? ' ' + daXml(codice) : '') + (messaggio ? ' - ' + daXml(messaggio) : ''));
}

async function elenca(chiedi, prefisso) {
  const chiavi = new Set();
  let token = null;
  do {
    const query = { 'list-type': '2', prefix: prefisso, 'max-keys': '1000' };
    if (token) query['continuation-token'] = token;
    const r = await chiedi('GET', '', { query });
    if (r.stato !== 200) throw errore(r, 'elenco di ' + prefisso);
    const t = r.corpo.toString('utf8');
    for (const m of t.matchAll(/<Key>([^<]*)<\/Key>/g)) chiavi.add(daXml(m[1]));
    token = /<IsTruncated>true<\/IsTruncated>/.test(t) ? daXml((t.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/) || [])[1] || '') : null;
  } while (token);
  return chiavi;
}

async function aGruppi(lavori, quanti) {
  let i = 0, rotto = null;
  const operaio = async () => {
    while (!rotto && i < lavori.length) {
      const j = i++;
      try { await lavori[j](); } catch (e) { rotto = rotto || e; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(quanti, lavori.length) }, operaio));
  if (rotto) throw rotto;
}

async function carica(chiedi, chiave, dati, intestazioni) {
  const r = await chiedi('PUT', chiave, { corpo: dati, intestazioni });
  if (r.stato !== 200) throw errore(r, 'caricamento di ' + chiave);
}

const DA_NASCONDERE = [];

async function principale() {
  const arg = new Set(process.argv.slice(2));
  const soloDire = arg.has('--senza-caricare');
  const cartella = process.env.HEXTALE_GIOCO_PRONTO || path.join(__dirname, 'gioco-pronto');
  const fileChiavi = process.env.HEXTALE_R2_CHIAVI || path.join(os.homedir(), '.hextale', 'r2.json');
  let conf = null;
  try { conf = JSON.parse(fs.readFileSync(fileChiavi, 'utf8')); } catch (_) { conf = null; }
  if (!conf) throw new Error('non trovo le chiavi di R2 in ' + fileChiavi + ' (si fa copiando desktop/r2.esempio.json)');
  for (const campo of ['account', 'chiave', 'segreto', 'bucket']) {
    if (!conf[campo] || typeof conf[campo] !== 'string' || /^<.*>$/.test(conf[campo])) throw new Error('nel file delle chiavi manca "' + campo + '"');
  }
  DA_NASCONDERE.push(conf.account, conf.chiave, conf.segreto);
  conf.endpoint = process.env.HEXTALE_R2_ENDPOINT || null;
  const chiedi = clienteR2(conf);

  const testoManifesto = (() => { try { return fs.readFileSync(path.join(cartella, A.NOME_MANIFESTO)); } catch (_) { return null; } })();
  const manifesto = testoManifesto ? JSON.parse(testoManifesto.toString('utf8')) : null;
  if (!manifesto || !manifesto.file || !manifesto.versione) throw new Error('manca il manifesto in ' + cartella + ': prima node desktop/prepara-gioco.js');
  // Ai giocatori va solo cio' che e' nel repository: una copia fatta per i banchi
  // (--copia-di-lavoro) puo' contenere modifiche in corso, anche di altre sessioni.
  if (!/^commit [0-9a-f]{7,}$/.test(String(manifesto.origine || ''))) {
    throw new Error('questa copia del gioco non viene da un commit (' + (manifesto.origine || 'origine sconosciuta') + '): rifai node desktop/prepara-gioco.js, senza --copia-di-lavoro');
  }

  // 1. il disco corrisponde al manifesto? Prima di caricare qualunque cosa.
  const perImpronta = new Map();
  for (const p of Object.keys(manifesto.file)) {
    if (!A.percorsoSicuro(p)) throw new Error('percorso non ammesso nel manifesto: ' + p);
    const f = path.join(cartella, ...p.split('/'));
    const h = fs.existsSync(f) ? await A.improntaDi(f) : null;
    if (h !== manifesto.file[p].sha256) throw new Error(p + ' non corrisponde al manifesto: rifai node desktop/prepara-gioco.js');
    if (!perImpronta.has(h)) perImpronta.set(h, { percorso: p, dimensione: Number(manifesto.file[p].dimensione) || 0 });
  }

  // 2. cosa c'e' gia' su R2
  const rm = await chiedi('GET', 'gioco/' + A.NOME_MANIFESTO);
  let remoto = null;
  if (rm.stato === 200) { try { remoto = JSON.parse(rm.corpo.toString('utf8')); } catch (_) { remoto = null; } }
  else if (rm.stato !== 404) throw errore(rm, 'lettura del manifesto su R2');
  if (remoto && A.confronta(manifesto, remoto) < 0 && !arg.has('--forza')) {
    throw new Error('su R2 c-e- gia- la ' + remoto.versione + ' (' + remoto.generato + '), piu- nuova di questa ' + manifesto.versione + ' (' + manifesto.generato + '): con --forza si pubblica lo stesso');
  }
  const presenti = await elenca(chiedi, 'gioco/file/');
  const mancanti = [...perImpronta.keys()].filter((h) => !presenti.has('gioco/file/' + h));
  const byte = mancanti.reduce((s, h) => s + perImpronta.get(h).dimensione, 0);
  const giaQuesto = !!remoto && A.confronta(manifesto, remoto) === 0;
  console.log(manifesto.versione + ': ' + perImpronta.size + ' file diversi, su R2 ne mancano ' + mancanti.length + ' (' + mb(byte) + ')'
    + (remoto ? '; su R2 adesso c-e- la ' + remoto.versione : '; su R2 non c-e- ancora niente'));

  let installatore = null;
  if (arg.has('--installatore')) {
    const guscio = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const nome = 'Hextale-Setup-' + guscio.version + '.exe';
    const f = path.join(process.env.HEXTALE_DIST || path.join(__dirname, 'dist'), nome);
    if (!fs.existsSync(f)) throw new Error('manca ' + f + ': prima npm run build (in desktop/)');
    installatore = { versione: guscio.version, nome: nome, file: f, dimensione: fs.statSync(f).size };
    console.log('installatore ' + nome + ' (' + mb(installatore.dimensione) + ')');
  }
  if (soloDire) { console.log('(senza caricare: fermo qui)'); return; }

  // 3. i file
  let fatti = 0;
  await aGruppi(mancanti.map((h) => async () => {
    const info = perImpronta.get(h);
    const dati = fs.readFileSync(path.join(cartella, ...info.percorso.split('/')));
    if (sha256(dati) !== h) throw new Error(info.percorso + ' e- cambiato mentre si caricava: rifai node desktop/prepara-gioco.js');
    await carica(chiedi, 'gioco/file/' + h, dati, { 'content-type': tipo(info.percorso), 'cache-control': 'public, max-age=31536000, immutable' });
    fatti++;
    if (fatti % 25 === 0 || fatti === mancanti.length) console.log('  ' + fatti + '/' + mancanti.length);
  }), 6);

  // 4. il manifesto per ultimo
  if (giaQuesto && !mancanti.length) {
    console.log('su R2 c-e- gia- questa versione: niente da fare per il gioco');
  } else {
    await carica(chiedi, 'gioco/' + A.NOME_MANIFESTO, testoManifesto, { 'content-type': 'application/json', 'cache-control': 'no-cache' });
    console.log('pubblicata la ' + manifesto.versione + ' (' + mancanti.length + ' file nuovi, ' + mb(byte) + ')');
  }

  // 5. l'installatore
  if (installatore) {
    const dati = fs.readFileSync(installatore.file);
    const exe = { 'content-type': TIPI['.exe'] };
    await carica(chiedi, 'installatore/' + installatore.nome, dati, Object.assign({ 'cache-control': 'public, max-age=31536000, immutable' }, exe));
    await carica(chiedi, 'installatore/Hextale-Setup.exe', dati, Object.assign({ 'cache-control': 'no-cache', 'content-disposition': 'attachment; filename="Hextale-Setup.exe"' }, exe));
    const ultimo = { versione: installatore.versione, file: 'installatore/' + installatore.nome, sha256: sha256(dati), dimensione: dati.length, generato: new Date().toISOString() };
    await carica(chiedi, 'installatore/ultimo.json', Buffer.from(JSON.stringify(ultimo)), { 'content-type': 'application/json', 'cache-control': 'no-cache' });
    console.log('pubblicato l-installatore ' + installatore.versione);
  }
}

if (require.main === module) {
  principale().catch((e) => {
    let msg = String((e && e.message) || e);
    for (const s of DA_NASCONDERE) if (s) msg = msg.split(s).join('***');
    console.error('FERMO: ' + msg);
    process.exitCode = 1;
  });
}

module.exports = { firma, codifica };
