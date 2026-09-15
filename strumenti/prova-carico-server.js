// LA PULIZIA DEL TEST DI CARICO, SENZA NAKAMA (v0.80.30).
//
//     node strumenti/prova-carico-server.js
//
// hx_carico (strumenti/carico/carico.js la chiama prima e dopo il test sul server
// vero). Qui, con uno storage finto:
//   1. da un client non si chiama;
//   2. 'inizia' segna il picco di prima, e un secondo 'inizia' (test lasciato a
//      meta') non lo riscrive con quello gonfiato;
//   3. 'pulisci' toglie gli account hxcarico, i loro record, la loro telemetria
//      (s:, b:, p:, m:) e il registro delle loro partite — e niente dei giocatori veri;
//   4. rimette il picco com'era e fa rifare il conto al primo battito;
//   5. un'azione sconosciuta si rifiuta; hx_carico e' registrata.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DOVE = process.argv[2] || path.join(__dirname, '..', 'server', 'nakama', 'index.js');
console.log('provo ' + DOVE + String.fromCharCode(10));
const mondo = { console, Date, Math, JSON, parseInt, parseFloat, isFinite, String, Object, Array, Error, Number, RegExp };
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
const SYS = '00000000-0000-0000-0000-000000000000';
let archivio = {};
const utenti = { 'id-c0': 'hxcarico0000', 'id-c1': 'hxcarico0001', 'id-vero': 'lorenzo', 'id-furbo': 'hxcarico_vero' };
const cancellati = [];
const nk = {
  storageRead: (req) => req.map(r => archivio[r.userId + '|' + r.collection + '|' + r.key]).filter(Boolean).map(v => ({ value: copia(v) })),
  storageWrite: (req) => { req.forEach(r => { archivio[r.userId + '|' + r.collection + '|' + r.key] = copia(r.value); }); },
  storageDelete: (req) => { req.forEach(r => { delete archivio[r.userId + '|' + r.collection + '|' + r.key]; }); },
  storageList: (userId, coll, limit, cursor) => {
    if (userId === '') throw new TypeError('expects empty or valid user id');   // come Nakama 3.40: "tutti" si chiede con null
    const tutti = Object.keys(archivio).filter(k => { const p = k.split('|'); return p[1] === coll && (userId === null || userId === undefined || p[0] === userId); }).sort();
    const da = cursor ? Number(cursor) : 0;
    return { objects: tutti.slice(da, da + limit).map(k => { const p = k.split('|'); return { userId: p[0], collection: p[1], key: p.slice(2).join('|'), value: copia(archivio[k]) }; }),
      cursor: (da + limit < tutti.length) ? String(da + limit) : '' };
  },
  usersGetUsername: (nomi) => Object.keys(utenti).filter(id => nomi.indexOf(utenti[id]) >= 0).map(id => ({ userId: id, username: utenti[id] })),
  accountDeleteId: (id) => { cancellati.push(id); Object.keys(archivio).forEach(k => { if (k.split('|')[0] === id) delete archivio[k]; }); }
};
const logger = { info() {}, warn() {}, error() {}, debug() {} };
const carico = (dati, ctx) => JSON.parse(mondo.rpcCarico(ctx || {}, logger, nk, JSON.stringify(dati)));
const T = (k) => SYS + '|telemetria|' + k;
const CONTO = SYS + '|sistema|' + mondo.KEY_CONTO_PRESENZE;

// ── 1. dal client no ──────────────────────────────────────────────────────
let rifiutato = '';
try { carico({ azione: 'inizia' }, { userId: 'id-vero' }); } catch (e) { rifiutato = e.message; }
dice(/cannot be called from a client/.test(rifiutato), 'da un client non si chiama', rifiutato);

// ── 2. inizia ─────────────────────────────────────────────────────────────
archivio[CONTO] = { R: 1, quanti: 1, cercano: 0, inPartita: 0, picco: 7, piccoIl: 111 };
let r = carico({ azione: 'inizia' });
dice(r.ok && r.picco === 7 && !r.gia && archivio[SYS + '|sistema|carico-prima'].picco === 7, 'inizia: segna il picco di prima', JSON.stringify(r));
archivio[CONTO].picco = 350; archivio[CONTO].piccoIl = 999;   // i finti lo gonfiano
r = carico({ azione: 'inizia' });
dice(r.gia && r.picco === 7 && archivio[SYS + '|sistema|carico-prima'].picco === 7, 'un secondo inizia (test lasciato a meta-) non lo riscrive col picco gonfiato', JSON.stringify(r));

// ── 3. pulisci ────────────────────────────────────────────────────────────
Object.keys(utenti).forEach(id => {
  archivio[id + '|presenza|battito'] = { q: 1, s: 'x' };
  archivio[id + '|profilo|carte'] = { mazzi: [1] };
});
archivio[T('s:id-c0:sess')] = { u: 'id-c0' };
archivio[T('b:id-c1:123')] = { u: 'id-c1' };
archivio[T('p:M1:id-c0')] = { u: 'id-c0' };
archivio[T('m:M1')] = { giocatori: [{ u: 'id-c0' }, { u: 'id-c1' }] };
archivio[T('s:id-vero:sess')] = { u: 'id-vero' };
archivio[T('m:M2')] = { giocatori: [{ u: 'id-vero' }, { u: 'id-furbo' }] };
archivio[T('p:M2:id-vero')] = { u: 'id-vero' };
archivio[SYS + '|partite|M1'] = { giocatori: ['id-c0', 'id-c1'] };
archivio[SYS + '|partite|M2'] = { giocatori: ['id-vero', 'id-furbo'] };
r = carico({ azione: 'pulisci', quanti: 5 });
dice(r.ok && r.account === 2 && JSON.stringify(cancellati.sort()) === JSON.stringify(['id-c0', 'id-c1']), 'pulisci: due account di carico cancellati, nessun altro', JSON.stringify([r, cancellati]));
dice(r.telemetria === 4 && !archivio[T('s:id-c0:sess')] && !archivio[T('b:id-c1:123')] && !archivio[T('p:M1:id-c0')] && !archivio[T('m:M1')], 'la loro telemetria (s:, b:, p:, m:) se ne va', JSON.stringify(r));
dice(!!archivio[T('s:id-vero:sess')] && !!archivio[T('m:M2')] && !!archivio[T('p:M2:id-vero')], 'quella dei giocatori veri resta (anche con un nome che comincia per hxcarico)');
dice(r.partite === 1 && !archivio[SYS + '|partite|M1'] && !!archivio[SYS + '|partite|M2'], 'il registro delle loro partite se ne va, quello vero resta');
dice(!archivio['id-c0|presenza|battito'] && !archivio['id-c1|profilo|carte'] && !!archivio['id-vero|presenza|battito'] && !!archivio['id-furbo|profilo|carte'], 'e con gli account i loro record; quelli degli altri restano');

// ── 4. il picco ───────────────────────────────────────────────────────────
dice(archivio[CONTO].picco === 7 && archivio[CONTO].piccoIl === 111 && archivio[CONTO].R === 0 && r.picco === 7, 'il picco torna quello di prima, e il conto si rifa- al primo battito', JSON.stringify(archivio[CONTO]));
dice(!archivio[SYS + '|sistema|carico-prima'], 'e il segno del test se ne va');
const b = JSON.parse(mondo.rpcGiocatoriOnline({ userId: 'id-vero' }, logger, nk, JSON.stringify({ sessione: 'x' })));
dice(b.giocatori === 1 && archivio[CONTO].R > 0 && archivio[CONTO].picco === 7, 'il battito dopo conta di nuovo da capo (solo i veri)', JSON.stringify([b, archivio[CONTO]]));

// ── 5. il resto ───────────────────────────────────────────────────────────
let strana = '';
try { carico({ azione: 'boh' }); } catch (e) { strana = e.message; }
dice(strana === 'Unknown action.', 'un-azione sconosciuta si rifiuta', strana);
const registrate = {};
try { mondo.InitModule({ env: {} }, logger, nk, new Proxy({}, { get: (tt, nome) => (...args) => { if (nome === 'registerRpc') registrate[args[0]] = args[1]; } })); } catch (e) { }
dice(registrate.hx_carico === mondo.rpcCarico, 'hx_carico e- registrata');

console.log(String.fromCharCode(10) + (male ? male + ' NO' : 'tutto a posto'));
process.exit(male ? 1 : 0);
