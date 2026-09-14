// LO YETI SUL SERVER, PROVATO SENZA NAKAMA (v0.80.21).
//
//     node strumenti/prova-yeti-server.js
//
// Lorenzo: "rendila segreta davvero". Dove si nasconde lo Yeti lo sa solo il
// server. Qui si fa girare partitaLoop con un dispatcher finto e si guarda che:
//   - la decisione dello Yeti (op 17) torni a chi l'ha giocato con la casella
//     vera, e all'avversario con le sole impronte (op 18);
//   - le caselle occupate seguano lo Yeti, e un secondo op 17 non valga;
//   - un op 17 dopo una carta che non e' uno Yeti, o da chi non ha giocato, non
//     faccia niente; una casella vera impossibile lo lasci dov'era;
//   - l'avversario non possa giocare su nessuna delle due impronte (stessa
//     risposta di una casella occupata), il padrone si' su quella vuota;
//   - una carta posata accanto all'impronta finta non lo scopra, una accanto a
//     quella vera si' (op 3 con `yeti`, a tutti e due);
//   - resti la casella dello Yeti anche quando si rifanno le occupate
//     dall'impronta concordata, e la giocata d'ufficio salti le impronte;
//   - la fine (op 6) dica dove sono gli Yeti ancora nascosti.
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

const CATALOGO = { carte: [
  { id: 'final-yeti', cardAbility: '!yeti', name: 'Yeti' },
  { id: 'final-uno', cardAbility: '', name: 'Uno' }
] };
const nk = {
  binaryToString: (x) => x,
  storageRead: () => [{ value: CATALOGO }],
  storageWrite: () => {}
};
const logger = { info() {}, warn() {}, error() {}, debug() {} };
const mandati = [];
const dispatcher = { broadcastMessage: (op, dati, a) => mandati.push({ op: op, dati: JSON.parse(dati), a: a ? a.map(p => p.userId) : 'tutti' }), matchLabelUpdate() {} };
const stato = (mano1, mano2) => ({
  giocatori: ['u1', 'u2'], info: {}, presenze: { u1: { userId: 'u1' }, u2: { userId: 'u2' } },
  mazzoIniziale: {}, mano: { u1: mano1, u2: mano2 }, mazzo: { u1: [], u2: [] },
  buchi: [], occupate: {}, turniGiocati: {}, turno: 0, numeroTurno: 1, scadenza: Date.now() + 3600000,
  iniziata: true, finita: false, natoIl: Date.now(), rapporti: {}, ultimaGiocataDi: -1, concordato: null,
  ultimaGiocata: null, yeti: [], ombra: { pronta: false, carte: {}, celle: {} }
});
const manda = (st, chi, op, corpo) => {
  mandati.length = 0;
  mondo.partitaLoop({}, logger, nk, dispatcher, 1, st, [{ sender: { userId: chi }, opCode: op, data: JSON.stringify(corpo) }]);
  return mandati.slice();
};
const di = (r, op) => r.filter(m => m.op === op);
const aChi = (r, op, u) => r.filter(m => m.op === op && (m.a === 'tutti' || m.a.indexOf(u) >= 0));
const gioca = (st, chi, carta, k) => { const p = k.split(','); return manda(st, chi, mondo.OP_GIOCA, { carta: carta, q: Number(p[0]), r: Number(p[1]) }); };
const rifiuto = (r) => di(r, mondo.OP_RIFIUTO)[0];

dice(mondo.OP_YETI === 17 && mondo.OP_YETI_IMPRONTE === 18, 'i codici sono 17 e 18');
const celle = mondo._caselle();
const esiste = (k) => celle.indexOf(k) !== -1;
dice(['0,0', '2,-1', '2,0', '-1,0', '1,1'].every(esiste), 'le caselle della prova esistono sul tabellone');

// ── 1. si nasconde spostandosi ─────────────────────────────────────────────
let st = stato(['final-yeti', 'final-uno', 'final-uno'], ['final-uno', 'final-uno', 'final-uno']);
let r = gioca(st, 'u1', 'final-yeti', '0,0');
dice(di(r, mondo.OP_GIOCATA).length === 1 && !di(r, mondo.OP_GIOCATA)[0].dati.yeti, 'lo Yeti si gioca come ogni carta');
r = manda(st, 'u1', mondo.OP_YETI, { vera: '2,-1', finta: null });
const suo = aChi(r, mondo.OP_YETI_IMPRONTE, 'u1')[0], altro = aChi(r, mondo.OP_YETI_IMPRONTE, 'u2')[0];
dice(suo && suo.a.join() === 'u1' && suo.dati.vera === '2,-1' && suo.dati.impronte.join('|') === '0,0|2,-1', 'chi l-ha giocato riceve le impronte e la casella vera', JSON.stringify(suo));
dice(altro && altro.a.join() === 'u2' && altro.dati.vera === undefined && altro.dati.impronte.join('|') === '0,0|2,-1' && altro.dati.di === 1 && altro.dati.da === '0,0', 'l-avversario riceve solo le impronte (niente casella vera)', JSON.stringify(altro));
dice(st.occupate['2,-1'] && !st.occupate['0,0'], 'le caselle occupate seguono lo Yeti', JSON.stringify(st.occupate));
r = manda(st, 'u1', mondo.OP_YETI, { vera: '1,1' });
dice(r.length === 0 && st.yeti.length === 1, 'un secondo op 17 per la stessa giocata non vale');

// ── 2. le impronte ──────────────────────────────────────────────────────────
r = gioca(st, 'u2', 'final-uno', '0,0');
dice(rifiuto(r) && /occupata|already taken/.test(rifiuto(r).dati.perche), 'l-avversario non gioca sull-impronta vuota', JSON.stringify(r));
const suVera = gioca(st, 'u2', 'final-uno', '2,-1');
dice(rifiuto(suVera) && rifiuto(suVera).dati.perche === rifiuto(r).dati.perche, 'ne- su quella con lo Yeti, con la stessa identica risposta', JSON.stringify(suVera));
r = gioca(st, 'u2', 'final-uno', '-1,0');
dice(di(r, mondo.OP_GIOCATA).length === 1 && !di(r, mondo.OP_GIOCATA)[0].dati.yeti && !st.yeti[0].rivelato, 'una carta accanto alla sola impronta finta non lo scopre');
r = gioca(st, 'u1', 'final-uno', '0,0');
dice(di(r, mondo.OP_GIOCATA).length === 1, 'il padrone gioca sull-impronta vuota');
r = gioca(st, 'u2', 'final-uno', '2,0');
const scoperta = di(r, mondo.OP_GIOCATA)[0];
dice(scoperta && scoperta.a === 'tutti' && Array.isArray(scoperta.dati.yeti) && scoperta.dati.yeti.length === 1
  && scoperta.dati.yeti[0].cella === '2,-1' && scoperta.dati.yeti[0].di === 1 && scoperta.dati.yeti[0].da === '0,0' && st.yeti[0].rivelato,
  'una carta accanto a quella vera lo scopre, nella giocata, per tutti e due', JSON.stringify(scoperta && scoperta.dati.yeti));

// ── 3. resta dov'e' ─────────────────────────────────────────────────────────
st = stato(['final-yeti', 'final-uno'], ['final-uno', 'final-uno']);
gioca(st, 'u1', 'final-yeti', '0,0');
r = manda(st, 'u1', mondo.OP_YETI, { vera: '0,0', finta: '1,1' });
let m = aChi(r, mondo.OP_YETI_IMPRONTE, 'u1')[0];
dice(m && m.dati.vera === '0,0' && m.dati.impronte.join('|') === '0,0|1,1' && st.occupate['0,0'], 'restando dov-e-, la seconda impronta e- quella scelta', JSON.stringify(m && m.dati));
st = stato(['final-yeti', 'final-uno'], ['final-uno', 'final-uno']);
st.occupate['1,1'] = { carta: 'final-uno', di: 2 };
gioca(st, 'u1', 'final-yeti', '0,0');
r = manda(st, 'u1', mondo.OP_YETI, { vera: '0,0', finta: '1,1' });
m = aChi(r, mondo.OP_YETI_IMPRONTE, 'u1')[0];
dice(m && m.dati.impronte.length === 2 && m.dati.impronte[1] !== '1,1' && m.dati.impronte[1] !== '0,0', 'un-impronta finta su una casella occupata ripiega su una libera', JSON.stringify(m && m.dati));
st = stato(['final-yeti', 'final-uno'], ['final-uno', 'final-uno']);
st.occupate['2,-1'] = { carta: 'final-uno', di: 2 };
gioca(st, 'u1', 'final-yeti', '0,0');
r = manda(st, 'u1', mondo.OP_YETI, { vera: '2,-1' });
m = aChi(r, mondo.OP_YETI_IMPRONTE, 'u1')[0];
dice(m && m.dati.vera === '0,0' && m.dati.impronte.length === 2, 'una casella vera occupata lo lascia dov-era (con un-impronta finta)', JSON.stringify(m && m.dati));

// ── 4. chi non puo' ─────────────────────────────────────────────────────────
st = stato(['final-uno', 'final-yeti'], ['final-uno', 'final-uno']);
gioca(st, 'u1', 'final-uno', '0,0');
r = manda(st, 'u1', mondo.OP_YETI, { vera: '2,-1' });
dice(r.length === 0 && st.yeti.length === 0, 'dopo una carta che non e- uno Yeti, op 17 non fa niente');
st = stato(['final-yeti', 'final-uno'], ['final-uno', 'final-uno']);
gioca(st, 'u1', 'final-yeti', '0,0');
r = manda(st, 'u2', mondo.OP_YETI, { vera: '2,-1' });
dice(r.length === 0 && st.yeti.length === 0, 'e nemmeno se lo manda l-avversario');
r = manda(st, 'u3', mondo.OP_YETI, { vera: '2,-1' });
dice(r.length === 0 && st.yeti.length === 0, 'o chi non e- della partita');

// ── 5. le occupate dal racconto concorde, la giocata d'ufficio, la fine ────
st = stato(['final-yeti', 'final-uno'], ['final-uno', 'final-uno', 'final-uno']);
gioca(st, 'u1', 'final-yeti', '0,0');
manda(st, 'u1', mondo.OP_YETI, { vera: '0,0', finta: '1,1' });
manda(st, 'u1', mondo.OP_IMPRONTA, { turno: 1, impronta: '', finita: false });
manda(st, 'u2', mondo.OP_IMPRONTA, { turno: 1, impronta: '', finita: false });
dice(st.concordato && st.occupate['0,0'], 'rifatte le occupate da un racconto senza lo Yeti, la sua casella resta presa', JSON.stringify(st.occupate));
// d'ufficio: tocca a u2, le prime caselle libere nell'ordine del tabellone sono le impronte?
const primeLibere = celle.filter(k => !st.occupate[k]);
st.scadenza = Date.now() - 60000;
mandati.length = 0;
mondo.partitaLoop({}, logger, nk, dispatcher, 1, st, []);
const ufficio = di(mandati, mondo.OP_GIOCATA)[0];
const kUff = ufficio ? ufficio.dati.q + ',' + ufficio.dati.r : null;
dice(ufficio && ufficio.dati.dOfficio && kUff !== '0,0' && kUff !== '1,1', 'la giocata d-ufficio dell-avversario salta le impronte', kUff + ' (prime libere: ' + primeLibere.slice(0, 3).join(' ') + ')');
st = stato(['final-yeti', 'final-uno'], ['final-uno', 'final-uno']);
gioca(st, 'u1', 'final-yeti', '0,0');
manda(st, 'u1', mondo.OP_YETI, { vera: '2,-1' });
r = manda(st, 'u2', mondo.OP_MI_ARRENDO, {});
const fine = di(r, mondo.OP_FINE)[0];
dice(fine && Array.isArray(fine.dati.yeti) && fine.dati.yeti.length === 1 && fine.dati.yeti[0].cella === '2,-1', 'la fine dice dov-e- lo Yeti ancora nascosto', JSON.stringify(fine && fine.dati));

console.log(String.fromCharCode(10) + (male ? male + ' controlli NON passano' : 'tutto a posto'));
process.exit(male ? 1 : 0);
