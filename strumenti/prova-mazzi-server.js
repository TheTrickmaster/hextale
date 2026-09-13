// IL MAZZO DEL SORTEGGIO E QUELLO SCELTO, PROVATI SENZA NAKAMA (v0.80.16).
//
//     node strumenti/prova-mazzi-server.js
//     node strumenti/prova-mazzi-server.js /percorso/index.js   (la copia schierata)
//
// Il 13 set 2026 un giocatore nuovo ha scelto lo Starter Trickster, ma sul
// server e' tornato il Princess del sorteggio: una copia dei mazzi letta prima
// della scelta e' stata salvata sopra a quella nuova, e il salvataggio ha tolto
// le carte non piu' sue. Restavano tre carte, e il matchmaking ha rifiutato la
// partita ("Match error"). Qui si prova, con un magazzino finto in memoria:
//   - che la scelta sostituisca il sorteggio, anche con altri mazzi addosso;
//   - che una copia col mazzo del sorteggio, o letta prima dell'ultima
//     scrittura, NON venga scritta, e che la risposta porti la copia buona;
//   - che una scrittura buona passi e alzi la versione;
//   - che chi e' gia' rotto venga riparato leggendo i mazzi e in matchmaking.
const fs = require('fs');
const vm = require('vm');

const DOVE = process.argv[2] || 'C:/Users/masil/Desktop/Hextale/game-assets/server/nakama/index.js';
console.log('provo ' + DOVE + String.fromCharCode(10));
const sorgente = fs.readFileSync(DOVE, 'utf8');
let prossimoCaso = 0.9;                    // Math.random: 0.9 sceglie lo starter 3
const MathFinto = Object.create(Math);
MathFinto.random = () => prossimoCaso;
const ctx = { console, Date, Math: MathFinto, JSON, parseInt, parseFloat, isFinite, String, Object, Array, Error, Number, RegExp };
ctx.global = ctx;
vm.createContext(ctx);
new vm.Script(sorgente).runInContext(ctx);

let male = 0;
const dice = (ok, che, perche) => {
  if (!ok) male++;
  console.log((ok ? '  ok   ' : '  NO   ') + che);
  if (perche !== undefined && (!ok || process.env.DETTAGLI)) console.log('        ' + perche);
};
const copia = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));

// ── IL MONDO FINTO ────────────────────────────────────────────────────────
// Tre starter da dodici carte. Il 2 (Trickster) e il 3 (Princess) ne hanno due
// in comune, come fox e kitsune nel foglio vero; "p-hare" e' del Princess e il
// giocatore rotto l'ha avuta da un pacchetto.
const carte = [];
const aggiungi = (slug, sd) => carte.push({ id: 'final-' + slug, slug: slug, name: slug, rarity: 'common', starterDecks: sd });
for (let i = 1; i <= 12; i++) aggiungi('w-' + i, [1]);
for (let i = 1; i <= 10; i++) aggiungi('t-' + i, [2]);
for (let i = 1; i <= 9; i++) aggiungi('p-' + i, [3]);
aggiungi('p-hare', [3]);
aggiungi('fox', [2, 3]);
aggiungi('kitsune', [2, 3]);
const CATALOGO = { versione: 1, carte: carte };

const deposito = {};
const chiave = (k, u) => k + '|' + u;
const nk = {
  storageRead: lista => lista.map(q => deposito[chiave(q.key, q.userId)] !== undefined
    ? { value: copia(deposito[chiave(q.key, q.userId)]) } : null).filter(Boolean),
  storageWrite: lista => lista.forEach(w => { deposito[chiave(w.key, w.userId)] = copia(w.value); }),
  storageDelete: lista => lista.forEach(w => { delete deposito[chiave(w.key, w.userId)]; })
};
ctx.leggiSistema = () => copia(CATALOGO);
ctx.leggiBustina = () => null;
ctx.cancellaBustina = () => {};
ctx.eAdmin = () => false;
const avvisi = [];
const logger = { info() {}, debug() {}, error() {}, warn() { avvisi.push([].slice.call(arguments).join(' ')); } };
const chi = u => ({ userId: u, username: u });
const mazziDi = u => copia(deposito[chiave('mazzi', u)]) || null;
const rpc = (fn, u, dati) => JSON.parse(ctx[fn](chi(u), logger, nk, dati === undefined ? '' : JSON.stringify(dati)));
const idDi = m => (m && m.mazzi || []).map(x => x.id).join(',');
const soloDi = n => carte.filter(c => c.starterDecks.indexOf(n) >= 0).map(c => c.id);

// ── 1. IL SORTEGGIO E LA SCELTA ───────────────────────────────────────────
prossimoCaso = 0.9;
ctx.assicuraPossesso(chi('u1'), nk, logger, 'u1', 'u1');
let m = mazziDi('u1');
dice(idDi(m) === 'starter-3' && m.scelto === 'starter-3', 'un account nuovo nasce col mazzo del sorteggio', idDi(m));
dice(m.versione === 1, 'e i suoi mazzi hanno una versione, la 1', m.versione);
const letta = rpc('rpcMazziLeggi', 'u1');
dice(letta.versione === 1 && letta.mazzi.length === 1 && letta.mazzi[0].carte.length === 12, 'la lettura porta la versione', letta.versione);

rpc('rpcStarter', 'u1', { mazzo: 2 });
m = mazziDi('u1');
dice(idDi(m) === 'starter-2' && m.scelto === 'starter-2', 'la scelta della lettera sostituisce il sorteggio', idDi(m) + ' scelto ' + m.scelto);
dice(m.versione === 2 && m.mazzi[0].carte.join() === soloDi(2).join(), 'con le dodici carte dello starter scelto, versione 2', m.versione);

// ── 2. LA COPIA VECCHIA NON PASSA ─────────────────────────────────────────
// Un client di prima della v0.80.16 (niente base) con la copia letta prima.
let r = rpc('rpcMazziScrivi', 'u1', { mazzi: letta.mazzi, scelto: 'starter-3' });
m = mazziDi('u1');
dice(r.conflitto === true, 'la lista col mazzo del sorteggio viene rifiutata, anche senza base');
dice(idDi(m) === 'starter-2' && m.mazzi[0].carte.length === 12 && m.versione === 2, 'e sul server resta lo starter scelto, intero', idDi(m) + ' v' + m.versione);
dice(r.versione === 2 && idDi(r) === 'starter-2' && r.scelto === 'starter-2', 'la risposta porta la copia buona, da adottare', JSON.stringify(r).slice(0, 120));
dice(avvisi.some(a => a.indexOf('NON scritti') >= 0 && a.indexOf('starter-3') >= 0), 'e il registro dice perche-');

// Un client nuovo con una copia vecchia che il sorteggio non ce l'ha piu'.
r = rpc('rpcMazziScrivi', 'u1', { mazzi: [{ id: 'starter-2', nome: 'Vecchio nome', carte: soloDi(2) }], scelto: 'starter-2', base: 1 });
dice(r.conflitto === true && mazziDi('u1').mazzi[0].nome !== 'Vecchio nome', 'una copia letta alla versione 1 non passa sopra alla 2');

// ── 3. LA SCRITTURA BUONA ─────────────────────────────────────────────────
r = rpc('rpcMazziScrivi', 'u1', {
  mazzi: [{ id: 'starter-2', nome: 'Il mio', carte: soloDi(2) }, { id: 'm1', nome: 'Nuovo', carte: ['final-t-1', 'final-p-1'] }],
  scelto: 'm1', base: 2 });
m = mazziDi('u1');
dice(!r.conflitto && r.versione === 3 && m.versione === 3, 'una copia alla versione giusta si scrive e sale alla 3', 'risposta v' + r.versione);
dice(idDi(m) === 'starter-2,m1' && m.mazzi[0].nome === 'Il mio' && m.scelto === 'm1', 'con quello che il giocatore ha fatto', idDi(m));
dice(m.mazzi[1].carte.join() === 'final-t-1', 'e senza le carte che non possiede (come prima)', m.mazzi[1].carte.join());
dice(r.mazzi[1].carte.join() === 'final-t-1', 'la risposta dice cosa e- stato scritto davvero');

// ── 4. CHI E' GIA' ROTTO ─────────────────────────────────────────────────
// Il giocatore del 13 set: ha scelto il 2, sul server c'e' il 3 con tre carte.
prossimoCaso = 0.9;
ctx.assicuraPossesso(chi('u2'), nk, logger, 'u2', 'u2');
rpc('rpcStarter', 'u2', { mazzo: 2 });
deposito[chiave('mazzi', 'u2')] = { mazzi: [{ id: 'starter-3', nome: 'Starter Princess', carte: ['final-fox', 'final-kitsune', 'final-p-hare'] }], scelto: 'starter-3', modificatoIl: 1 };
const inPartita = ctx._mazzoDi(nk, logger, 'u2');
dice(inPartita && inPartita.carte.length === 12, 'in matchmaking il suo mazzo e- di nuovo da dodici', inPartita && inPartita.carte.length);
m = mazziDi('u2');
dice(idDi(m) === 'starter-2' && m.scelto === 'starter-2', 'e sul server il sorteggio e- stato sostituito dallo starter scelto', idDi(m) + ' scelto ' + m.scelto);
dice(m.versione === 1, 'con una versione nuova, cosi- le copie vecchie in giro non ci passano sopra', m.versione);
dice(avvisi.some(a => a.indexOf('mazzi riparati per') >= 0 && a.indexOf('u2') >= 0 && a.indexOf('starter-3') >= 0), 'e il registro lo dice', avvisi.join(' | '));

prossimoCaso = 0.9;
ctx.assicuraPossesso(chi('u3'), nk, logger, 'u3', 'u3');
rpc('rpcStarter', 'u3', { mazzo: 2 });
deposito[chiave('mazzi', 'u3')] = { mazzi: [{ id: 'm9', nome: 'Suo', carte: soloDi(2).slice(0, 12) }, { id: 'starter-3', nome: 'Starter Princess', carte: ['final-fox'] }], scelto: 'starter-3', modificatoIl: 1 };
r = rpc('rpcMazziLeggi', 'u3');
dice(idDi(r) === 'm9,starter-2' && r.scelto === 'starter-2', 'anche leggendo i mazzi: il sorteggio esce, lo starter entra al suo posto, gli altri restano', idDi(r) + ' scelto ' + r.scelto);

// ── 5. LA SCELTA CON ALTRI MAZZI GIA' FATTI ──────────────────────────────
prossimoCaso = 0.9;
ctx.assicuraPossesso(chi('u4'), nk, logger, 'u4', 'u4');
r = rpc('rpcMazziScrivi', 'u4', { mazzi: [{ id: 'starter-3', nome: 'Starter Princess', carte: soloDi(3) }, { id: 'm5', nome: 'Mio', carte: ['final-fox'] }], scelto: 'starter-3', base: 1 });
dice(!r.conflitto && idDi(mazziDi('u4')) === 'starter-3,m5', 'prima di scegliere, il sorteggio e- il suo starter e si salva', idDi(mazziDi('u4')));
rpc('rpcStarter', 'u4', { mazzo: 1 });
m = mazziDi('u4');
dice(idDi(m) === 'starter-1,m5' && m.scelto === 'starter-1', 'scegliendo con altri mazzi addosso, il sorteggio lascia il posto allo starter scelto', idDi(m) + ' scelto ' + m.scelto);
dice(m.mazzi[1].carte.join() === 'final-fox' || m.mazzi[1].carte.length === 1, 'e il mazzo che si era fatto resta');

// ── 6. CHI NON C'ENTRA ────────────────────────────────────────────────────
prossimoCaso = 0;
ctx.assicuraPossesso(chi('u5'), nk, logger, 'u5', 'u5');
const primaU5 = mazziDi('u5');
r = rpc('rpcMazziLeggi', 'u5');
dice(idDi(r) === 'starter-1' && mazziDi('u5').versione === primaU5.versione, 'chi non ha mai scelto e ha il suo starter non viene toccato', idDi(r));
deposito[chiave('mazzi', 'u6')] = { mazzi: [{ id: 'm1', nome: 'Vecchio', carte: [] }], scelto: 'm1', modificatoIl: 5 };
prossimoCaso = 0;
ctx.assicuraPossesso(chi('u6'), nk, logger, 'u6', 'u6');
r = rpc('rpcMazziScrivi', 'u6', { mazzi: [{ id: 'm1', nome: 'Rinominato', carte: [] }], scelto: 'm1' });
dice(!r.conflitto && r.versione === 1 && mazziDi('u6').mazzi[0].nome === 'Rinominato', 'i mazzi salvati prima delle versioni si scrivono come sempre (versione 0 -> 1)', JSON.stringify(r).slice(0, 100));

console.log(String.fromCharCode(10) + (male ? male + ' controlli NON passati' : 'tutto a posto'));
process.exit(male ? 1 : 0);
