// PUNTI E VALORI CHE NON TORNANO (v0.80.26), LATO SERVER, SENZA NAKAMA.
//
//     node strumenti/prova-v08026-server.js
//
// Lorenzo: stessa partita, due punteggi finali diversi (199 e 203) sullo stesso
// tabellone. Qui:
//   1. i racconti (op 7) portano anche i valori delle carte; quando i due
//      tabelloni coincidono ma punti o valori no, il registro lo dice UNA volta,
//      col turno, le caselle e le carte — e la partita non si ferma;
//   2. a fine partita op 6 ("finita") e l'esito portano i punti con cui il server
//      ha deciso, cosi' tutti e due vedono gli stessi numeri.
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

const registro = [];
const scrivi = (f, args) => { let i = 0; return String(f).replace(/%[sd]/g, () => String(args[i++])); };
const informazioni = [];
const logger = { info(f, ...a) { informazioni.push(scrivi(f, a)); }, warn(f, ...a) { registro.push(scrivi(f, a)); }, error() {}, debug() {} };
const nk = { binaryToString: (x) => x, storageRead: () => [], storageWrite: () => {} };
const mandati = [];
const dispatcher = { broadcastMessage: (op, dati, a) => mandati.push({ op: op, dati: JSON.parse(dati), a: a ? a.map(p => p.userId) : 'tutti' }), matchLabelUpdate() {} };
const stato = () => ({
  idPartita: 'M', giocatori: ['u1', 'u2'], info: {}, presenze: { u1: { userId: 'u1' }, u2: { userId: 'u2' } },
  mazzoIniziale: { u1: [], u2: [] }, mano: { u1: [], u2: [] }, mazzo: { u1: [], u2: [] },
  buchi: [], occupate: {}, turniGiocati: {}, turno: 0, numeroTurno: 5, scadenza: Date.now() + 30000,
  iniziata: true, finita: false, natoIl: Date.now(), inizioIl: Date.now(), rapporti: {}, ultimaGiocataDi: -1, concordato: null,
  ultimaGiocata: null, yeti: [], ombra: { pronta: false, carte: {}, celle: {} }
});
const racconto = (st, chi, corpo) => {
  mandati.length = 0;
  mondo.partitaLoop({}, logger, nk, dispatcher, 1, st, [{ sender: { userId: chi }, opCode: mondo.OP_IMPRONTA, data: JSON.stringify(corpo) }]);
};
const IMPRONTA = '0,0:final-baloo:1|1,0:final-fox:2';

// ── 1. la diagnosi ────────────────────────────────────────────────────────
let st = stato();
racconto(st, 'u1', { turno: 4, impronta: IMPRONTA, hp: { 1: 10, 2: 5 }, valori: '0,0:3.3.3.3.3.3|1,0:1.2.3.4.5.6', finita: false });
racconto(st, 'u2', { turno: 4, impronta: IMPRONTA, hp: { 1: 10, 2: 9 }, valori: '0,0:3.3.4.3.3.3|1,0:1.2.3.4.5.6', finita: false });
const punti = registro.filter(r => /punti diversi/.test(r));
const valori = registro.filter(r => /valori diversi/.test(r));
dice(!st.finita && !mandati.some(m => m.op === mondo.OP_DISACCORDO), 'stessi tabelloni, numeri diversi: la partita va avanti');
dice(punti.length === 1 && punti[0] === 'punti diversi al turno 4: {"1":10,"2":5} contro {"1":10,"2":9}', 'i punti diversi si scrivono col turno e i due conti', punti[0]);
dice(valori.length === 1 && valori[0] === 'valori diversi al turno 4: 0,0 (final-baloo) 3.3.3.3.3.3 / 3.3.4.3.3.3', 'i valori diversi con la casella, la carta e i due lati', valori[0]);
racconto(st, 'u1', { turno: 5, impronta: IMPRONTA, hp: { 1: 12, 2: 5 }, valori: '0,0:9.9.9.9.9.9', finita: false });
racconto(st, 'u2', { turno: 5, impronta: IMPRONTA, hp: { 1: 12, 2: 11 }, valori: '0,0:1.1.1.1.1.1', finita: false });
dice(registro.filter(r => /punti diversi|valori diversi/.test(r)).length === 2, 'una volta sola per partita (il primo turno e- quello che serve)');
registro.length = 0;
st = stato();
racconto(st, 'u1', { turno: 4, impronta: IMPRONTA, hp: { 1: 10, 2: 5 }, valori: '0,0:3.3.3.3.3.3', finita: false });
racconto(st, 'u2', { turno: 4, impronta: IMPRONTA, hp: { 1: 10, 2: 5 }, valori: '0,0:3.3.3.3.3.3', finita: false });
dice(registro.length === 0, 'se tornano, niente nel registro', registro.join(' | '));
st = stato();
racconto(st, 'u1', { turno: 4, impronta: IMPRONTA, hp: { 1: 10, 2: 5 }, finita: false });
racconto(st, 'u2', { turno: 4, impronta: IMPRONTA, hp: { 1: 10, 2: 5 }, valori: '0,0:3.3.3.3.3.3', finita: false });
dice(registro.length === 0, 'un client di prima (senza valori) non fa scattare niente');

// ── 2. i punti a fine partita ─────────────────────────────────────────────
mondo.applicaEsito = () => ({});
st = stato();
mandati.length = 0;
mondo._chiudiPartita(st, dispatcher, logger, nk, { hp: { 1: 118, 2: 203 }, punteggio: { 1: 12, 2: 26 } });
const fine = mandati.filter(m => m.op === mondo.OP_FINE)[0];
const esiti = mandati.filter(m => m.op === mondo.OP_ESITO);
dice(fine && fine.dati.motivo === 'finita' && fine.dati.vincitore === 2 && fine.dati.punti[1] === 118 && fine.dati.punti[2] === 203, 'op 6 porta vincitore e punti', fine && JSON.stringify(fine.dati));
dice(esiti.length === 2 && esiti.every(e => e.dati.punti[1] === 118 && e.dati.punti[2] === 203), 'e anche l-esito di tutti e due');
dice(fine && fine.dati.senzaCarte === 0 && esiti.every(e => e.dati.senzaCarte === 0), 'con le carte in mano a tutti e due decidono i punti (senzaCarte 0)');

// ── 3. chi resta senza carte perde ────────────────────────────────────────
const chiudi = (prep, hp) => {
  const s = stato();
  s.mano = { u1: ['final-a'], u2: ['final-b'] }; s.mazzo = { u1: ['final-c'], u2: [] };
  prep(s);
  mandati.length = 0;
  mondo._chiudiPartita(s, dispatcher, logger, nk, { hp: hp });
  return { fine: mandati.filter(m => m.op === mondo.OP_FINE)[0], esiti: mandati.filter(m => m.op === mondo.OP_ESITO) };
};
let x = chiudi(s => { s.mano.u1 = []; s.mazzo.u1 = []; }, { 1: 250, 2: 100 });
dice(x.fine.dati.vincitore === 2 && x.fine.dati.pari === false && x.fine.dati.senzaCarte === 1, 'il giocatore 1 senza carte perde anche con 250 contro 100', JSON.stringify(x.fine.dati));
dice(x.esiti.length === 2 && x.esiti[0].a.join() === 'u1' && x.esiti[0].dati.senzaCarte === 1, 'e l-esito lo dice a tutti e due');
dice(informazioni.some(r => /il giocatore 1 e' rimasto senza carte e perde \(punti 250 contro 100\)/.test(r)), 'e il registro lo dice', informazioni.slice(-2).join(' | '));
x = chiudi(s => { s.mano.u2 = []; s.mazzo.u2 = []; }, { 1: 100, 2: 100 });
dice(x.fine.dati.vincitore === 1 && x.fine.dati.pari === false && x.fine.dati.senzaCarte === 2, 'a punti pari, chi resta senza carte perde lo stesso (niente pareggio)', JSON.stringify(x.fine.dati));
x = chiudi(s => { s.mano.u2 = []; s.mazzo.u2 = ['final-z']; }, { 1: 250, 2: 100 });
dice(x.fine.dati.vincitore === 1 && x.fine.dati.senzaCarte === 0, 'mano vuota ma mazzo no: non e- senza carte, decidono i punti');
x = chiudi(s => { s.mano.u1 = []; s.mazzo.u1 = []; s.mano.u2 = []; s.mazzo.u2 = []; }, { 1: 250, 2: 100 });
dice(x.fine.dati.vincitore === 1 && x.fine.dati.senzaCarte === 0, 'tutti e due senza carte: decidono i punti');
x = chiudi(s => { s.mano.u1 = []; s.mazzo.u1 = []; mondo._caselle().forEach(k => { s.occupate[k] = { carta: 'final-a', di: 1 }; }); }, { 1: 250, 2: 100 });
dice(x.fine.dati.vincitore === 1 && x.fine.dati.senzaCarte === 0, 'tabellone pieno: decidono i punti anche se uno e- senza carte');

console.log(String.fromCharCode(10) + (male ? male + ' NO' : 'tutto a posto'));
process.exit(male ? 1 : 0);
