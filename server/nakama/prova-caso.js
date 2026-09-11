// BANCO DI PROVA — IL CASO E' CASO, E IN RETE E' LO STESSO CASO
// Segnalazione di Lorenzo (v0.79.99): copiando o rubando l'abilita' del Genio,
// la carta che copia buffava gli STESSI gruppi che aveva buffato il Genio. "Un
// numero random dev'essere SEMPRE random e cambiare ogni volta che si ripropone
// l'abilita'."
// Il difetto era nell'hash: `h * 16777619` perdeva i bit bassi (un double non
// tiene 56 bit esatti), e `% 2` leggeva proprio quelli.
// Qui si controlla:
//   1. l'hash ha i bit bassi vivi: su due gruppi, meta' e meta';
//   2. la moltiplicazione a 32 bit coincide con Math.imul;
//   3. il Genio e chi lo copia pescano indipendentemente;
//   4. la stessa carta, in turni diversi, pesca di nuovo;
//   5. la stessa occasione vista da due client da' lo stesso risultato
//      (ripetibile, per la rete), anche per "set 1-3" e per "or";
//   6. i cambiamenti decisi dal caso escono marcati (aCaso, fraChi).
// Si lancia con:  node server/nakama/prova-caso.js
const M = require('./abilita-motore.js');
let ko = 0;
const dice = (ok, che, x) => { if (!ok) ko++; console.log((ok ? '  ok   ' : '  NO   ') + che + (x !== undefined ? '   [' + x + ']' : '')); };

// Due gruppi, come quasi tutte le carte.
const valori = { NW: 2, NE: 5, E: 5, SE: 5, SW: 2, W: 2 };
const gruppi = [['NE', 'E', 'SE'], ['SW', 'W', 'NW']];
const carta = (id, owner, abilita) => ({ id, name: id, owner, values: Object.assign({}, valori),
  valoriBase: Object.assign({}, valori), groupSides: gruppi, abilita: abilita || null });
const riga = (effetto, extra) => Object.assign({ trigger: 'on_play', frequenza: 'every_time', finestra: { tipo: 'always' },
  se: null, legame: null, effetto2: null, effetto }, extra || {});
const GENIO = riga({ azione: 'buff', chi: 'ally', dove: 'in_hand', cosa: 'power', quale: 'all', ambito: 'RAND', quanto: { numero: 3 } });

function scena(fonte, cella, turno, seme, mano) {
  return { inCampo: [fonte], inMano: mano || [], cellaDi: c => (c === fonte ? cella : null),
    vicini: () => [], latiLiberi: () => 0, turno, seme };
}
const primoGruppo = (lati) => (lati.indexOf('NE') >= 0 ? 0 : 1);

// ── 1. i bit bassi ──────────────────────────────────────────────────────
console.log('── 1. la meta- dei casi va da una parte ──');
let zero = 0;
const N = 2000;
for (let i = 0; i < N; i++) {
  const lati = M.latiColpiti('RAND', valori, { id: 'final-carta-1-r' + i, groupSides: gruppi }, 'partita-' + i + '|0,0|t' + i);
  if (primoGruppo(lati) === 0) zero++;
}
dice(zero > N * 0.45 && zero < N * 0.55, 'su due gruppi il primo esce circa meta- delle volte', zero + '/' + N);

// ── 2. la moltiplicazione ──────────────────────────────────────────────
// _per32 non e' esportata: la si ritrova dal suo effetto, confrontando l'hash
// scritto qui con Math.imul — se coincidono su chiavi a caso, coincide lei.
function semeRiferimento(t) {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h = (h ^ t.charCodeAt(i)) >>> 0; h = Math.imul(h, 16777619) >>> 0; }
  h = (h ^ (h >>> 16)) >>> 0; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
let diversi = 0;
for (let i = 0; i < 500; i++) {
  const id = 'c' + Math.random().toString(36).slice(2), seme = 's' + i;
  const g3 = [['NW'], ['NE', 'E'], ['SE', 'SW', 'W']];
  const atteso = g3[semeRiferimento(id + '|' + seme) % 3];
  const avuto = M.latiColpiti('RAND', valori, { id, groupSides: g3 }, seme);
  if (atteso.join() !== avuto.join()) diversi++;
}
dice(diversi === 0, 'l-hash del motore coincide con quello scritto con Math.imul', diversi + ' diversi su 500');

// ── 3. il Genio e chi lo copia ──────────────────────────────────────────
console.log('── 3. il Genio e lo Specchio che lo copia ──');
let tutteUguali = 0;
const PROVE = 400;
for (let i = 0; i < PROVE; i++) {
  const mano = [0, 1, 2, 3].map(n => carta('final-mano' + n + '-1-r' + i, 1));
  const genio = carta('final-the-genie-1-r' + i, 1, GENIO);
  const specchio = carta('final-magic-mirror-1-r' + (i + 50), 1, JSON.parse(JSON.stringify(GENIO)));
  const a = M.cambiamentiAllEvento(genio, 'on_play', scena(genio, '0,0', 5, 'partita-' + i, mano)).map(c => primoGruppo(c.lati)).join('');
  const b = M.cambiamentiAllEvento(specchio, 'on_play', scena(specchio, '1,-1', 6, 'partita-' + i, mano)).map(c => primoGruppo(c.lati)).join('');
  if (a === b) tutteUguali++;
}
// Quattro carte a due gruppi: per caso coincidono tutte e quattro 1 volta su 16.
dice(tutteUguali < PROVE / 8, 'lo Specchio non ricalca il Genio (coincidono tutte e quattro solo per caso)',
  tutteUguali + '/' + PROVE + ', atteso circa ' + Math.round(PROVE / 16));

// ── 4. la stessa carta in turni diversi ────────────────────────────────
console.log('── 4. la stessa carta, dalla stessa casella, turno dopo turno ──');
const carabosse = carta('final-carabosse-2-r1', 2, riga({ azione: 'debuff', chi: 'ally', dove: 'in_hand', cosa: 'power', quale: 'all', ambito: 'RAND', quanto: { numero: 1 } }, { trigger: 'end_of_turn' }));
const bersaglio = carta('final-bersaglio-2-r2', 2);
const visti = {};
for (let t = 1; t <= 12; t++) {
  const c = M.cambiamentiAllEvento(carabosse, 'end_of_turn', scena(carabosse, '2,0', t, 'partita-x', [bersaglio]));
  visti[primoGruppo(c[0].lati)] = (visti[primoGruppo(c[0].lati)] || 0) + 1;
}
dice(Object.keys(visti).length === 2, 'in dodici turni escono tutti e due i gruppi', JSON.stringify(visti));

// ── 5. ripetibile per la rete ───────────────────────────────────────────
console.log('── 5. due client, la stessa occasione ──');
const mano5 = [0, 1, 2].map(n => carta('final-m' + n + '-1-r9', 1));
const g5 = carta('final-the-genie-1-r4', 1, GENIO);
const qui = M.cambiamentiAllEvento(g5, 'on_play', scena(g5, '0,1', 7, 'match-uguale', mano5)).map(c => c.lati.join('+')).join('|');
const la = M.cambiamentiAllEvento(g5, 'on_play', scena(g5, '0,1', 7, 'match-uguale', mano5)).map(c => c.lati.join('+')).join('|');
dice(qui === la, 'stessa partita, casella e turno: stessi gruppi di qua e di la-');
// Il Cappellaio: "set self power ALL 1-3". Prima era Math.random.
const cappellaio = carta('final-mad-hatter-1-r3', 1, riga({ azione: 'set', chi: 'self', cosa: 'power', ambito: 'ALL', quanto: { da: 1, a: 3 } }, { trigger: 'on_conquered' }));
const tiri = new Set();
let concordi = true;
for (let t = 1; t <= 30; t++) {
  const v1 = M.cambiamentiAllEvento(cappellaio, 'on_conquered', scena(cappellaio, '1,1', t, 'match-uguale'))[0].valore;
  const v2 = M.cambiamentiAllEvento(cappellaio, 'on_conquered', scena(cappellaio, '1,1', t, 'match-uguale'))[0].valore;
  if (v1 !== v2) concordi = false;
  tiri.add(v1);
}
dice(concordi, 'set 1-3: i due client tirano lo stesso numero');
dice(tiri.size === 3 && [...tiri].every(v => v >= 1 && v <= 3), 'e in trenta occasioni escono 1, 2 e 3', [...tiri].sort().join(','));
// "or": una delle due meta', a sorte.
const oppure = carta('final-oppure-1-r1', 1, riga({ azione: 'buff', chi: 'self', cosa: 'power', ambito: 'ALL', quanto: { numero: 1 } },
  { legame: 'or', effetto2: { azione: 'buff', chi: 'self', cosa: 'power', ambito: 'ALL', quanto: { numero: 5 } } }));
const esiti = new Set();
let orConcordi = true;
for (let t = 1; t <= 30; t++) {
  const a = M.cambiamentiAllEvento(oppure, 'on_play', scena(oppure, '0,0', t, 'match-uguale'))[0];
  const b = M.cambiamentiAllEvento(oppure, 'on_play', scena(oppure, '0,0', t, 'match-uguale'))[0];
  if (a.delta !== b.delta) orConcordi = false;
  esiti.add(a.delta);
  if (!a.aCaso) orConcordi = false;
}
dice(orConcordi && esiti.size === 2, '"or": stesso esito sui due client, marcato a caso, ed escono tutte e due', [...esiti].join(','));

// ── 6. i segni per l'anteprima ─────────────────────────────────────────
console.log('── 6. cosa esce marcato ──');
const g6 = carta('final-the-genie-1-r6', 1, GENIO);
const c6 = M.cambiamentiAllEvento(g6, 'on_play', scena(g6, '0,0', 3, 'm', [carta('a-1', 1), carta('b-1', 1)]));
dice(c6.length === 2 && c6.every(c => c.aCaso === true), 'il buff RAND del Genio esce aCaso');
const tutti = [carta('a-1', 1), carta('b-1', 1), carta('c-1', 1)];
const ginevra = carta('final-guinevere-1-r1', 1, riga({ azione: 'buff', chi: 'ally', dove: 'in_hand', cosa: 'power', quale: 'random', ambito: 'ALL', quanto: { numero: 2 } }));
const c7 = M.cambiamentiAllEvento(ginevra, 'on_play', scena(ginevra, '0,0', 3, 'm', tutti));
dice(c7.length === 1 && c7[0].aCaso === true && Array.isArray(c7[0].fraChi) && c7[0].fraChi.length === 3,
  'un bersaglio pescato a caso porta con se- fra chi e- stato pescato', c7[0] && (c7[0].fraChi || []).length);
const fermo = carta('final-fermo-1-r1', 1, riga({ azione: 'buff', chi: 'self', cosa: 'power', ambito: 'ALL', quanto: { numero: 2 } }));
const c8 = M.cambiamentiAllEvento(fermo, 'on_play', scena(fermo, '0,0', 3, 'm'));
dice(c8.length === 1 && !c8[0].aCaso && !c8[0].fraChi, 'un +2 ALL non e- a caso');

console.log('\n' + (ko ? 'FALLITO: ' + ko : 'OK: il caso cambia a ogni occasione, e di qua e di la- e- lo stesso'));
process.exit(ko ? 1 : 0);
