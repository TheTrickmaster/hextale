// I NOMI DEGLI ADMIN NON SI PRENDONO, PROVATO SENZA NAKAMA (v0.80.17).
//
//     node strumenti/prova-nomi-admin.js
//     node strumenti/prova-nomi-admin.js /percorso/index.js   (la copia schierata)
//
// eAdmin dava l'admin a chiunque avesse un nome uguale a uno di NOMI_ADMIN a
// meno delle maiuscole, e glielo scriveva nei metadati per sempre. Per il
// database "loreadmin" e "LoreAdmin" sono due nomi diversi, quindi il primo si
// poteva prendere registrandosi o rinominandosi. Qui si prova che:
//   1. l'admin per nome scatta solo col nome esatto;
//   2. nessuno si registra (email, dispositivo, custom, Google) con un nome da
//      admin;
//   3. nessuno si rinomina con un nome da admin, a meno di essere gia' admin;
//   4. i nomi normali passano come prima.
const fs = require('fs');
const vm = require('vm');

const DOVE = process.argv[2] || 'C:/Users/masil/Desktop/Hextale/game-assets/server/nakama/index.js';
console.log('provo ' + DOVE + String.fromCharCode(10));
const sorgente = fs.readFileSync(DOVE, 'utf8');
const ctx = { console, Date, Math, JSON, parseInt, parseFloat, isFinite, String, Object, Array, Error, Number, RegExp };
ctx.global = ctx;
vm.createContext(ctx);
new vm.Script(sorgente).runInContext(ctx);

let male = 0;
const dice = (ok, che, perche) => {
  if (!ok) male++;
  console.log((ok ? '  ok   ' : '  NO   ') + che);
  if (perche !== undefined && !ok) console.log('        ' + perche);
};
const sbaglia = fn => { try { fn(); return ''; } catch (e) { return String(e.message || e); } };

const conti = {};
const scritti = [];
const nk = {
  usersGetId: ids => ids.map(id => conti[id]).filter(Boolean),
  accountUpdateId: (id, u, dn, tz, loc, lang, av, meta) => { scritti.push(id); if (conti[id]) conti[id].metadata = meta; },
  storageRead: () => [],
  storageWrite: () => {}
};
ctx.leggiSistema = () => ({ carte: [{ slug: 'puss', name: 'Puss in Boots' }] });
const logger = { info() {}, warn() {}, error() {}, debug() {} };
const nomi = ctx.NOMI_ADMIN;
dice(Array.isArray(nomi) && nomi.length > 0, 'c-e- un elenco di nomi da admin', String(nomi));
const vero = nomi[0];
const storto = vero.toLowerCase() === vero ? vero.toUpperCase() : vero.toLowerCase();

// ── 1. l'admin per nome ───────────────────────────────────────────────────
conti.a = { username: storto, metadata: {} };
dice(ctx.eAdmin(nk, 'a', storto) === false, 'un nome da admin con le maiuscole diverse NON da- l-admin', storto);
dice(!scritti.includes('a') && !conti.a.metadata.admin, 'e non scrive il contrassegno');
conti.b = { username: vero, metadata: {} };
dice(ctx.eAdmin(nk, 'b', vero) === true && conti.b.metadata.admin === true, 'il nome esatto semina ancora il contrassegno, come prima', vero);
conti.c = { username: 'chiunque', metadata: { admin: true } };
dice(ctx.eAdmin(nk, 'c', 'chiunque') === true, 'e chi ha il contrassegno resta admin qualunque nome abbia');

// ── 2. registrarsi ────────────────────────────────────────────────────────
const registra = nome => sbaglia(() => ctx.primaDiEntrareConNome({}, logger, nk, { username: nome, account: { email: 'x@y.z' } }));
dice(/not allowed/.test(registra(storto)), 'registrarsi con un nome da admin (maiuscole diverse) e- vietato', registra(storto));
dice(/not allowed/.test(registra(vero)), 'e col nome esatto pure');
dice(registra('Mario') === '', 'un nome normale passa');
dice(sbaglia(() => ctx.primaDiEntrareConNome({}, logger, nk, { account: { email: 'x@y.z' } })) === '', 'e chi entra senza nome (un accesso, non una registrazione) passa');
const gancio = sorgente.match(/registerBeforeAuthenticate(Email|Device|Custom)\(primaDiEntrareConNome\)/g) || [];
dice(gancio.length === 3, 'il controllo e- agganciato a email, dispositivo e custom', gancio.join(' '));
dice(/_nomeDaAdmin\(data\.username\)/.test(sorgente.slice(sorgente.indexOf('function primaDiGoogle'), sorgente.indexOf('function leggiSistema'))), 'e dentro al gancio di Google');

// ── 3. rinominarsi ────────────────────────────────────────────────────────
conti.d = { username: 'Pippo', metadata: {} };
const rinomina = (id, nome) => sbaglia(() => ctx.primaDiCambiareProfilo({ userId: id }, logger, nk, { username: nome }));
dice(/not allowed/.test(rinomina('d', storto)), 'rinominarsi con un nome da admin e- vietato a chi non e- admin', rinomina('d', storto));
dice(rinomina('c', vero) === '', 'chi e- gia- admin per contrassegno puo- tenerselo');
dice(rinomina('d', 'Pluto') === '', 'un nome normale passa come prima');

console.log(String.fromCharCode(10) + (male ? male + ' controlli NON passati' : 'tutto a posto'));
process.exit(male ? 1 : 0);
