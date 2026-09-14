// LE CASELLE BLOCCATE SEGUONO IL TABELLONE, E CHI CERCA SI CONTA (v0.80.23).
//
//     node strumenti/prova-buchi-server.js
//
// Tre segnalazioni di Lorenzo, lato server, senza Nakama:
//   1. "se sposto un tile bloccato e poi provo a mettere una carta dove prima
//      c'era, mi dice move refused, quella casella e' bloccata". Le caselle
//      bloccate si prendono dal racconto concorde (op 7 con `buchi`): uguali da
//      tutti e due valgono; diverse, o da un client di prima, no;
//   2. il rifiuto e' in inglese;
//   3. hx_giocatori conta anche chi cerca una partita (`cerca`), e smette di
//      contarlo quando smette di cercare o quando il suo segno invecchia.
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

const CATALOGO = { carte: [{ id: 'final-uno', cardAbility: '', name: 'Uno' }] };
const nk = { binaryToString: (x) => x, storageRead: () => [{ value: CATALOGO }], storageWrite: () => {} };
const avvisi = [];
const logger = { info() {}, warn(f) { avvisi.push(String(f)); }, error() {}, debug() {} };
const mandati = [];
const dispatcher = { broadcastMessage: (op, dati, a) => mandati.push({ op: op, dati: JSON.parse(dati), a: a ? a.map(p => p.userId) : 'tutti' }), matchLabelUpdate() {} };
const stato = (buchi) => ({
  giocatori: ['u1', 'u2'], info: {}, presenze: { u1: { userId: 'u1' }, u2: { userId: 'u2' } },
  mazzoIniziale: {}, mano: { u1: ['final-uno', 'final-uno', 'final-uno'], u2: ['final-uno', 'final-uno', 'final-uno'] }, mazzo: { u1: [], u2: [] },
  buchi: buchi, occupate: {}, turniGiocati: {}, turno: 0, numeroTurno: 1, scadenza: Date.now() + 3600000,
  iniziata: true, finita: false, natoIl: Date.now(), rapporti: {}, ultimaGiocataDi: -1, concordato: null,
  ultimaGiocata: null, yeti: [], ombra: { pronta: false, carte: {}, celle: {} }
});
const manda = (st, chi, op, corpo) => {
  mandati.length = 0;
  mondo.partitaLoop({}, logger, nk, dispatcher, 1, st, [{ sender: { userId: chi }, opCode: op, data: JSON.stringify(corpo) }]);
  return mandati.slice();
};
const di = (r, op) => r.filter(m => m.op === op);
const gioca = (st, chi, k) => { const p = k.split(','); return manda(st, chi, mondo.OP_GIOCA, { carta: 'final-uno', q: Number(p[0]), r: Number(p[1]) }); };
const racconta = (st, turno, buchiU1, buchiU2) => {
  const corpo = (b) => { const c = { turno: turno, impronta: '', punteggio: null, hp: null, finita: false }; if (b !== undefined) c.buchi = b; return c; };
  manda(st, 'u1', mondo.OP_IMPRONTA, corpo(buchiU1));
  return manda(st, 'u2', mondo.OP_IMPRONTA, corpo(buchiU2));
};

const celle = mondo._caselle();
const A = '2,-1', B = '1,1', C = '-1,0';
dice([A, B, C].every(k => celle.indexOf(k) !== -1), 'le caselle della prova esistono sul tabellone');

// ── 1. il tassello bloccato spostato ────────────────────────────────────────
let st = stato([A]);
let r = gioca(st, 'u1', A);
dice(di(r, mondo.OP_RIFIUTO).length === 1 && di(r, mondo.OP_RIFIUTO)[0].dati.perche === 'That tile is blocked.', 'sulla casella bloccata non si gioca, e il rifiuto e- in inglese', JSON.stringify(r));
racconta(st, 1, [B], [B]);
dice(st.buchi.join() === B && !st.finita, 'spostato da A a B: il racconto concorde lo porta sul server', JSON.stringify(st.buchi));
r = gioca(st, 'u1', A);
dice(di(r, mondo.OP_GIOCATA).length === 1, 'dove il tassello era stato adesso si gioca', JSON.stringify(r));
st.turno = 0;
r = gioca(st, 'u1', B);
dice(di(r, mondo.OP_RIFIUTO).length === 1 && /blocked/.test(di(r, mondo.OP_RIFIUTO)[0].dati.perche), 'e dove e- arrivato no');

// ── 2. racconti che non vanno bene ──────────────────────────────────────────
st = stato([A]);
avvisi.length = 0;
racconta(st, 1, [B], [C]);
dice(st.buchi.join() === A && !st.finita, 'caselle bloccate diverse: restano quelle di prima, e la partita non si ferma', JSON.stringify(st.buchi));
dice(avvisi.some(a => /caselle bloccate diverse/.test(a)), 'e il registro lo dice');
st = stato([A]);
racconta(st, 1, undefined, undefined);
dice(st.buchi.join() === A, 'un client di prima non le manda: restano com-erano');
st = stato([A]);
racconta(st, 1, [B], undefined);
dice(st.buchi.join() === A, 'se le manda uno solo, restano com-erano');
st = stato([A]);
racconta(st, 1, [], []);
dice(st.buchi.length === 0, 'distrutte tutte (elenco vuoto uguale): non ce n-e- piu- nessuna');
st = stato([A]);
racconta(st, 1, [C, 'fuori', B, B, '99,99'], [B, C, '99,99', 'fuori', B]);
dice(st.buchi.slice().sort().join('|') === [B, C].sort().join('|'), 'caselle che non esistono o ripetute non entrano', JSON.stringify(st.buchi));

// ── 3. i rifiuti del server sono in inglese ─────────────────────────────────
st = stato([]);
st.turno = 1;
r = gioca(st, 'u1', A);
dice(di(r, mondo.OP_RIFIUTO)[0] && di(r, mondo.OP_RIFIUTO)[0].dati.perche === "It's not your turn.", 'fuori turno', JSON.stringify(r));
const sorgente = fs.readFileSync(DOVE, 'utf8');
const rimasti = (sorgente.match(/perche: '[^']*'|throw Error\('[^']*'|rejectMessage: '[^']*'/g) || [])
  .filter(s => /\b(non|serve|servono|quella|codice|inchiostro|mazzo|carta|casella|partita|scrivi|riprova|sei)\b/i.test(s));
dice(rimasti.length === 0, 'nessun messaggio per il giocatore resta in italiano', rimasti.join(' | '));

// ── 4. chi cerca una partita ────────────────────────────────────────────────
let presenze = {};
mondo.leggiSistema = (n, chiave) => (chiave === mondo.KEY_PRESENZE ? JSON.parse(JSON.stringify(presenze)) : null);
mondo.scriviSistema = (n, chiave, valore) => { if (chiave === mondo.KEY_PRESENZE) presenze = JSON.parse(JSON.stringify(valore)); };
const batte = (u, s, cerca) => JSON.parse(mondo.rpcGiocatoriOnline({ userId: u }, logger, nk, JSON.stringify(cerca === undefined ? { sessione: s } : { sessione: s, cerca: cerca })));
let x = batte('u1', 's1', true);
dice(x.giocatori === 1 && x.cercano === 1, 'uno che cerca: 1 online, 1 in cerca', JSON.stringify(x));
x = batte('u2', 's2');
dice(x.giocatori === 2 && x.cercano === 1, 'uno che batte senza cercare (client di prima): 2 online, 1 in cerca', JSON.stringify(x));
x = batte('u3', 's3', false);
dice(x.giocatori === 3 && x.cercano === 1, 'uno che dice di non cercare: non si conta fra chi cerca', JSON.stringify(x));
x = batte('u1', 's1', false);
dice(x.giocatori === 3 && x.cercano === 0, 'smette di cercare: 0 in cerca, ma resta online', JSON.stringify(x));
batte('u1', 's1', true);
presenze.u1.q = Date.now() - (mondo.RICERCA_VIVA_MS + 5000);
x = batte('u2', 's2');
dice(x.giocatori === 3 && x.cercano === 0, 'un segno di ricerca vecchio non conta piu- (la presenza si-)', JSON.stringify(x));
presenze.u1.q = Date.now() - (mondo.PRESENZA_VIVA_MS + 5000);
x = batte('u2', 's2');
dice(x.giocatori === 2 && x.cercano === 0 && !presenze.u1, 'e oltre la presenza sparisce del tutto', JSON.stringify(x));
dice(mondo.RICERCA_VIVA_MS > 10000 * 2 && mondo.RICERCA_VIVA_MS < mondo.PRESENZA_VIVA_MS, 'il segno vale piu- di due battiti da dieci secondi, e meno della presenza');

console.log(String.fromCharCode(10) + (male ? male + ' NO' : 'tutto a posto'));
process.exit(male ? 1 : 0);
