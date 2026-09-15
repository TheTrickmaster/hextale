// IL BATTITO ONLINE, UN RECORD PER GIOCATORE (v0.80.30).
//
//     node strumenti/prova-v08030-server.js
//     node strumenti/prova-v08030-server.js /percorso/index.js   (la copia schierata)
//
// Lorenzo: "Rifai il battito online come hai proposto". Il record unico delle
// presenze, riletto e riscritto intero da ogni battito, diventa un record per
// giocatore piu' un conto piccolo. Qui, con un orologio finto e uno storage
// finto con le versioni:
//   1. un battito scrive solo il proprio record e il conto, e il conto resta
//      piccolo con duemila giocatori;
//   2. i numeri seguono chi entra, cerca, gioca, smette ed esce; il conto rifatto
//      ogni CONTO_PRESENZE_OGNI_MS corregge una differenza persa e chi e' sparito
//      senza dirlo;
//   3. i record di chi non batte da dieci minuti si buttano, ma non quello di chi
//      e' tornato nel frattempo;
//   4. la sedia: un secondo accesso con un'altra sessione viva e' rifiutato, il
//      battito non la ruba, hx_esco la libera solo alla propria sessione;
//   5. il passaggio dal record unico di prima: presenze vive e picco arrivano,
//      il record vecchio si svuota;
//   6. il costo di un battito non cresce col numero dei giocatori (misura in V8);
//   7. /stats/ (hx_stats_live) legge i record nuovi.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const DOVE = process.argv[2] || path.join(__dirname, '..', 'server', 'nakama', 'index.js');
console.log('provo ' + DOVE + String.fromCharCode(10));
let adesso = Date.UTC(2026, 8, 17, 12, 0, 0);
const DataFinta = function () { return arguments.length ? new (Function.prototype.bind.apply(Date, [null].concat([].slice.call(arguments))))() : new Date(adesso); };
DataFinta.now = () => adesso;
DataFinta.UTC = Date.UTC;
DataFinta.parse = Date.parse;
const mondo = { console, Date: DataFinta, Math, JSON, parseInt, parseFloat, isFinite, String, Object, Array, Error, Number, RegExp };
mondo.global = mondo;
vm.createContext(mondo);
new vm.Script(fs.readFileSync(DOVE, 'utf8')).runInContext(mondo);

let male = 0;
const dice = (ok, che, perche) => {
  if (!ok) male++;
  console.log((ok ? '  ok   ' : '  NO   ') + che);
  if (!ok && perche !== undefined) console.log('        ' + perche);
};
const copia = (x) => JSON.parse(JSON.stringify(x));

// ── lo storage finto, con le versioni come Nakama ─────────────────────────
let archivio = {}, versioni = {}, giro = 0;
let scritti = [];                 // [utente|collezione|chiave] di ogni storageWrite
let dopoLista = null, vecchiaLettura = null, liste = 0;             // per far cambiare un record fra la lista e la cancellazione
const NOMI = { a1: 'zed', a2: 'Bob', a3: 'alice' };
const nk = {
  binaryToString: (x) => x,
  storageRead: (req) => req.map(r => {
    const k = r.userId + '|' + r.collection + '|' + r.key;
    if (vecchiaLettura && vecchiaLettura.k === k) { const v = vecchiaLettura.oggetto; vecchiaLettura = null; return v; }   // una lettura fatta "prima"
    return archivio[k] ? { value: copia(archivio[k]), version: versioni[k] } : null;
  }).filter(Boolean),
  storageWrite: (req) => {
    // come Nakama: la versione "*" vuol dire "solo se non c'e'", una versione "solo se e' ancora quella"
    req.forEach(r => { const k = r.userId + '|' + r.collection + '|' + r.key; if (r.version === '*' ? (k in archivio) : (r.version && versioni[k] !== r.version)) throw Error('Storage write rejected - version check failed.'); });
    req.forEach(r => { const k = r.userId + '|' + r.collection + '|' + r.key; archivio[k] = copia(r.value); versioni[k] = 'v' + (++giro); scritti.push(k); });
  },
  storageDelete: (req) => {
    // come Nakama: tutto o niente, e una versione che non torna ferma il lotto
    req.forEach(r => { const k = r.userId + '|' + r.collection + '|' + r.key; if (r.version && versioni[k] !== r.version) throw Error('Storage delete rejected - version check failed.'); });
    req.forEach(r => { const k = r.userId + '|' + r.collection + '|' + r.key; delete archivio[k]; delete versioni[k]; });
  },
  storageList: (userId, coll, limit, cursor) => {
    if (coll === 'presenza') liste++;
    if (userId === '') throw new TypeError('expects empty or valid user id');   // come Nakama 3.40: "tutti" si chiede con null
    const tutti = Object.keys(archivio).filter(k => { const p = k.split('|'); return p[1] === coll && (userId === null || userId === undefined || p[0] === userId); }).sort();
    const da = cursor ? Number(cursor) : 0;
    const pagina = tutti.slice(da, da + limit).map(k => { const p = k.split('|'); return { userId: p[0], collection: p[1], key: p.slice(2).join('|'), value: copia(archivio[k]), version: versioni[k] }; });
    if (dopoLista) { const f = dopoLista; dopoLista = null; f(); }
    return { objects: pagina, cursor: (da + limit < tutti.length) ? String(da + limit) : '' };
  },
  usersGetId: (ids) => ids.filter(id => NOMI[id]).map(id => ({ userId: id, username: NOMI[id] }))
};
const avvisi = [];
const logger = { info() {}, warn(f, a) { avvisi.push(String(f) + ' ' + String(a)); }, error() {}, debug() {} };
const SIS = '00000000-0000-0000-0000-000000000000|sistema|';
const REC = (u) => u + '|' + mondo.COLL_PRESENZA + '|' + mondo.KEY_BATTITO;
const conto = () => archivio[SIS + mondo.KEY_CONTO_PRESENZE] || {};
const batte = (u, corpo) => JSON.parse(mondo.rpcGiocatoriOnline({ userId: u }, logger, nk, JSON.stringify(Object.assign({ sessione: 's-' + u }, corpo || {}))));
const entra = (u, s) => JSON.parse(mondo.rpcEntro({ userId: u }, logger, nk, JSON.stringify({ sessione: s })));
const esce = (u, s) => JSON.parse(mondo.rpcEsco({ userId: u }, logger, nk, JSON.stringify({ sessione: s })));
const avanti = (ms) => { adesso += ms; };

// ── 1. ognuno scrive il suo ───────────────────────────────────────────────
dice(mondo.COLL_PRESENZA === 'presenza' && mondo.KEY_BATTITO === 'battito' && mondo.CONTO_PRESENZE_OGNI_MS === 15000 && mondo.PRESENZA_SCARTO_MS === 600000, 'record presenza/battito, conto ogni 15 s, scarto dopo 10 minuti');
batte('u1', { gioca: true });
batte('u2', { cerca: true });
scritti = [];
let b = batte('u3', {});
dice(b.giocatori === 3 && b.cercano === 1 && b.inPartita === 1 && b.riavvio === null, 'tre online: uno cerca, uno gioca', JSON.stringify(b));
dice(scritti.length === 2 && scritti.indexOf(REC('u3')) >= 0 && scritti.indexOf(SIS + mondo.KEY_CONTO_PRESENZE) >= 0, 'un battito scrive due cose: il proprio record e il conto', JSON.stringify(scritti));
dice(!archivio[SIS + 'presenze'], 'il record unico di prima non si scrive piu-');
for (let i = 0; i < 2000; i++) batte('m' + i, i % 3 === 0 ? { gioca: true } : {});
b = batte('u3', {});
dice(b.giocatori === 2003 && b.inPartita === 1 + 667, 'con duemila battiti in piu-: 2003 online, 668 in partita', JSON.stringify(b));
dice(JSON.stringify(conto()).length < 160 && JSON.stringify(archivio[REC('m5')]).length < 80, 'e il conto resta piccolo come prima (i record per giocatore pure)', JSON.stringify(conto()).length + ' / ' + JSON.stringify(archivio[REC('m5')]).length + ' byte');

// ── 2. i numeri ───────────────────────────────────────────────────────────
archivio = {}; versioni = {};
avanti(mondo.CONTO_PRESENZE_OGNI_MS + 1);
batte('u1', {});
batte('u2', { cerca: true });
b = batte('u2', { gioca: true });
dice(b.giocatori === 2 && b.cercano === 0 && b.inPartita === 1, 'da chi cerca a chi gioca: i segni si spostano', JSON.stringify(b));
b = batte('u2', {});
dice(b.giocatori === 2 && b.inPartita === 0, 'finita la partita: resta online', JSON.stringify(b));
const perso = copia(conto()); perso.quanti += 5; archivio[SIS + mondo.KEY_CONTO_PRESENZE] = perso;
avanti(1000);
b = batte('u1', {});
dice(b.giocatori === 7, 'una differenza sbagliata (due battiti nello stesso istante) resta fino al conto dopo...', JSON.stringify(b));
avanti(mondo.CONTO_PRESENZE_OGNI_MS + 1);
b = batte('u1', {});
dice(b.giocatori === 2, '...e il conto rifatto la corregge', JSON.stringify(b));
const storto = copia(conto()); storto.quanti = 0; storto.cercano = 2; storto.inPartita = 3; storto.R = adesso; archivio[SIS + mondo.KEY_CONTO_PRESENZE] = storto;
b = JSON.parse(mondo.rpcGiocatoriOnline({}, logger, nk, '{}'));
dice(b.giocatori === 0 && b.cercano === 0 && b.inPartita === 0, 'un conto storto (2 in coda, 0 online) non si legge mai cosi-: chi cerca o gioca e- online', JSON.stringify(b));
avanti(mondo.CONTO_PRESENZE_OGNI_MS + 1);
b = batte('u1', {});
dice(b.giocatori === 2, 'e al conto dopo torna giusto', JSON.stringify(b));
// un conto alla volta: due battiti che trovano il conto vecchio nello stesso istante
avanti(mondo.CONTO_PRESENZE_OGNI_MS + 1);
const chiaveConto = SIS + mondo.KEY_CONTO_PRESENZE;
const primaDiA = { value: copia(archivio[chiaveConto]), version: versioni[chiaveConto] };
liste = 0;
batte('u1', {});                                                  // A lo trova vecchio, lo prenota e rifa' la lista
const dopoA = copia(conto());
vecchiaLettura = { k: chiaveConto, oggetto: primaDiA };           // B l'aveva letto prima della prenotazione di A
scritti = [];
batte('u2', {});
dice(liste === 1, 'due battiti col conto vecchio nello stesso istante: la lista la rifa- uno solo', 'liste: ' + liste);
dice(dopoA.R === adesso && JSON.stringify(conto()) === JSON.stringify(dopoA) && scritti.indexOf(chiaveConto) < 0, 'e l-altro non riscrive il conto vecchio sopra a quello nuovo', JSON.stringify([conto(), dopoA, scritti]));
avanti(mondo.PRESENZA_VIVA_MS + 1000);   // u2 sparisce senza dire niente
b = batte('u1', {});
dice(b.giocatori === 1 && !!archivio[REC('u2')], 'chi smette di battere non si conta piu- (al conto dopo), il record resta per ora', JSON.stringify(b));

// ── 3. la pulizia ─────────────────────────────────────────────────────────
batte('u3', {}); batte('u4', {});
avanti(mondo.PRESENZA_SCARTO_MS + 1000);
dopoLista = () => { archivio[REC('u3')].q = adesso; versioni[REC('u3')] = 'tornato'; };   // u3 torna mentre si fa la lista
b = batte('u1', {});
dice(!!archivio[REC('u3')] && archivio[REC('u3')].q === adesso, 'chi e- tornato fra la lista e la cancellazione non si cancella (versione)', JSON.stringify(archivio[REC('u3')]));
avanti(mondo.CONTO_PRESENZE_OGNI_MS + 1);
avanti(mondo.PRESENZA_SCARTO_MS);
b = batte('u1', {});
dice(!archivio[REC('u2')] && !archivio[REC('u4')] && !!archivio[REC('u1')] && b.giocatori === 1, 'al conto dopo i record vecchi di dieci minuti si buttano', JSON.stringify(Object.keys(archivio)));

// ── 4. la sedia ───────────────────────────────────────────────────────────
archivio = {}; versioni = {};
avanti(mondo.CONTO_PRESENZE_OGNI_MS + 1);
dice(entra('p', 'A').dentro === true, 'si entra');
let r = entra('p', 'B');
dice(r.dentro === false && r.motivo === 'gia in gioco', 'con la sedia occupata da un-altra sessione viva: rifiutato', JSON.stringify(r));
batte('p', { sessione: 'B' });
dice(archivio[REC('p')].s === 'A', 'il battito dell-altra sessione non ruba la sedia');
esce('p', 'B');
dice(!!archivio[REC('p')] && conto().quanti === 1, 'e hx_esco di un-altra sessione non la libera');
esce('p', 'A');
dice(!archivio[REC('p')] && conto().quanti === 0, 'hx_esco della propria: record tolto, e non si conta piu-', JSON.stringify(conto()));
dice(entra('p', 'B').dentro === true, 'e l-altra puo- entrare subito');
avanti(mondo.SEDIA_LIBERA_MS + 1000);
dice(entra('p', 'C').dentro === true && archivio[REC('p')].s === 'C', 'una sedia che non batte da trenta secondi si libera da sola');

// ── 5. dal record unico di prima ──────────────────────────────────────────
archivio = {}; versioni = {};
archivio[SIS + 'presenze'] = { vivo: { q: adesso - 1000, s: 'x', g: 1 }, vecchio: { q: adesso - mondo.PRESENZA_VIVA_MS - 1, s: 'y' }, numero: adesso - 2000 };
archivio[SIS + 'picco-online'] = { n: 12, quando: adesso - 86400000 };
b = batte('nuovo', {});
dice(b.giocatori === 3 && b.inPartita === 1, 'le presenze vive del record unico contano subito (piu- chi batte)', JSON.stringify(b));
dice(archivio[REC('vivo')] && archivio[REC('vivo')].s === 'x' && archivio[REC('vivo')].g === 1 && archivio[REC('numero')] && !archivio[REC('vecchio')], 'e diventano record per giocatore (le scadute no)', JSON.stringify(Object.keys(archivio)));
dice(JSON.stringify(archivio[SIS + 'presenze']) === '{}' && conto().picco === 12 && conto().piccoIl === adesso - 86400000, 'il record vecchio si svuota, il picco passa nel conto', JSON.stringify(conto()));
r = entra('vivo', 'altra');
dice(r.dentro === false, 'chi era seduto durante lo schieramento resta seduto');

// ── 6. il costo ───────────────────────────────────────────────────────────
const misura = (n) => {
  archivio = {}; versioni = {};
  const ora0 = adesso;
  for (let i = 0; i < n; i++) archivio[REC('c' + i)] = { q: ora0, s: 's' + i };
  archivio[SIS + mondo.KEY_CONTO_PRESENZE] = { R: ora0, quanti: n, cercano: 0, inPartita: 0, picco: n, piccoIl: ora0 };
  versioni[SIS + mondo.KEY_CONTO_PRESENZE] = 'm';
  const K = 3000, t0 = process.hrtime.bigint();
  for (let k = 0; k < K; k++) mondo.rpcGiocatoriOnline({ userId: 'c' + (k % n) }, logger, nk, JSON.stringify({ sessione: 's' + (k % n) }));
  return Number(process.hrtime.bigint() - t0) / 1e6 / K;
};
const ms100 = misura(100), ms2000 = misura(2000);
dice(ms2000 < ms100 * 3 + 0.02, 'un battito costa uguale con 100 e con 2000 online (prima: 0,14 ms contro 4,3 ms)', ms100.toFixed(4) + ' ms / ' + ms2000.toFixed(4) + ' ms');
archivio[SIS + mondo.KEY_CONTO_PRESENZE].R -= mondo.CONTO_PRESENZE_OGNI_MS + 1;
const t1 = process.hrtime.bigint();
mondo.rpcGiocatoriOnline({ userId: 'c1' }, logger, nk, JSON.stringify({ sessione: 's1' }));
console.log('        (il conto rifatto da capo con 2000 record, una volta ogni 15 s: ' + (Number(process.hrtime.bigint() - t1) / 1e6).toFixed(2) + ' ms in V8)');

// ── 7. /stats/ ────────────────────────────────────────────────────────────
archivio = {}; versioni = {};
archivio[REC('a1')] = { q: adesso - 1000, s: '1', g: 1 };
archivio[REC('a2')] = { q: adesso - 1000, s: '2', g: 1 };
archivio[REC('a3')] = { q: adesso - 1000, s: '3', c: 1 };
archivio[REC('stats')] = { q: adesso - 1000, s: '4', g: 1 };
archivio[SIS + mondo.KEY_CONTO_PRESENZE] = { R: adesso, quanti: 4, cercano: 1, inPartita: 3, picco: 9, piccoIl: adesso - 5 };
const vera = mondo.STATS_IMPRONTA;
mondo.STATS_IMPRONTA = crypto.createHash('sha256').update(mondo.STATS_SALE + 'prova', 'utf8').digest('hex');
const L = JSON.parse(mondo.rpcStatsLive({ userId: 'stats' }, logger, nk, JSON.stringify({ parola: 'prova' })));
dice(L.online === 3 && L.inPartita === 2 && L.cercano === 1 && JSON.stringify(L.nomi) === JSON.stringify(['Bob', 'zed']), 'hx_stats_live legge i record per giocatore (la pagina esclusa)', JSON.stringify(L));
const S = JSON.parse(mondo.rpcStats({ userId: 'stats' }, logger, nk, JSON.stringify({ parola: 'prova' })));
dice(S.giocatori.online === 3 && S.giocatori.picco === 9 && S.giocatori.piccoIl === adesso - 5, 'hx_stats: online dai record, picco dal conto', JSON.stringify(S.giocatori));
mondo.STATS_IMPRONTA = vera;

console.log(String.fromCharCode(10) + (male ? male + ' NO' : 'tutto a posto'));
process.exit(male ? 1 : 0);
