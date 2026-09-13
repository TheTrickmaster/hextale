// GLI STICKER SUL SERVER, PROVATI SENZA NAKAMA (v0.80.19).
//
//     node strumenti/prova-sticker-server.js
//     node strumenti/prova-sticker-server.js /percorso/index.js   (la copia schierata)
//
// Lorenzo: "Se si mandano piu' di 5 sticker entro 10 secondi, si viene bloccati
// per 2 minuti", e il blocco vale solo dentro la partita. Qui si fa girare
// partitaLoop con un orologio finto e si guarda che:
//   - uno sticker valido arrivi a tutti e due, con chi l'ha mandato;
//   - un nome inventato, una partita non cominciata o finita non mandino niente;
//   - il sesto in dieci secondi non passi e faccia scattare due minuti di blocco;
//   - durante il blocco si risponda solo a chi prova, dicendo quanto manca;
//   - dopo i due minuti si possa rimandare, e l'altro giocatore non sia toccato;
//   - cinque sticker sparsi su piu' di dieci secondi non blocchino niente.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DOVE = process.argv[2] || path.join(__dirname, '..', 'server', 'nakama', 'index.js');
console.log('provo ' + DOVE + String.fromCharCode(10));
let adesso = 1000000;
const DataFinta = function () { return arguments.length ? new (Function.prototype.bind.apply(Date, [null].concat([].slice.call(arguments))))() : new Date(adesso); };
DataFinta.now = () => adesso;
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

const mandati = [];
const dispatcher = { broadcastMessage: (op, dati, a) => mandati.push({ op: op, dati: JSON.parse(dati), a: a ? a.map(p => p.userId) : 'tutti' }) };
const nk = { binaryToString: (x) => x };
const logger = { info() {}, warn() {}, error() {}, debug() {} };
const stato = () => ({
  giocatori: ['u1', 'u2'], presenze: { u1: { userId: 'u1' }, u2: { userId: 'u2' } },
  iniziata: true, finita: false, natoIl: adesso, rapporti: {}
});
const manda = (st, chi, sticker) => {
  mandati.length = 0;
  mondo.partitaLoop({}, logger, nk, dispatcher, 1, st, [{ sender: { userId: chi }, opCode: mondo.OP_STICKER, data: JSON.stringify({ sticker: sticker }) }]);
  return mandati.slice();
};
const mostrati = (r) => r.filter(m => m.op === mondo.OP_STICKER_MOSTRA);
const blocchi = (r) => r.filter(m => m.op === mondo.OP_STICKER_BLOCCO);

dice(mondo.OP_STICKER === 14 && mondo.OP_STICKER_MOSTRA === 15 && mondo.OP_STICKER_BLOCCO === 16, 'i tre codici sono 14, 15 e 16 (li usa anche il client)');
dice(Array.isArray(mondo.STICKER_NOMI) && mondo.STICKER_NOMI.length === 5, 'cinque sticker, per tutti', String(mondo.STICKER_NOMI));

let st = stato();
let r = manda(st, 'u1', 'merlin-perfect');
dice(mostrati(r).length === 1 && mostrati(r)[0].a === 'tutti' && mostrati(r)[0].dati.di === 1 && mostrati(r)[0].dati.sticker === 'merlin-perfect', 'uno sticker di u1 arriva a tutti e due, detto di chi e-', JSON.stringify(r));
r = manda(st, 'u2', 'bagheera-scared');
dice(mostrati(r).length === 1 && mostrati(r)[0].dati.di === 2, 'e quello di u2 dice 2', JSON.stringify(r));
r = manda(st, 'u1', 'pippo');
dice(r.length === 0, 'un nome inventato non manda niente', JSON.stringify(r));
r = manda(st, 'u3', 'merlin-perfect');
dice(r.length === 0, 'chi non e- della partita non manda niente');
let st2 = stato(); st2.iniziata = false;
dice(manda(st2, 'u1', 'merlin-perfect').filter(m => m.op === mondo.OP_STICKER_MOSTRA).length === 0, 'a partita non cominciata niente');
let st3 = stato(); st3.finita = true;
dice(manda(st3, 'u1', 'merlin-perfect').length === 0, 'a partita finita niente');

// il limite
st = stato();
let passati = 0;
for (let i = 0; i < 5; i++) { adesso += 1000; passati += mostrati(manda(st, 'u1', 'frog-prince-okay')).length; }
dice(passati === 5, 'cinque in cinque secondi passano tutti', passati);
adesso += 500;
r = manda(st, 'u1', 'frog-prince-okay');
dice(mostrati(r).length === 0, 'il sesto entro dieci secondi non passa');
dice(blocchi(r).length === 1 && blocchi(r)[0].a.join() === 'u1' && blocchi(r)[0].dati.resta === 120000, 'e fa scattare due minuti di blocco, detti solo a lui', JSON.stringify(r));
adesso += 60000;
r = manda(st, 'u1', 'frog-prince-okay');
dice(mostrati(r).length === 0 && blocchi(r).length === 1 && blocchi(r)[0].dati.resta === 60000, 'dopo un minuto e- ancora bloccato, e gli si dice quanto manca', JSON.stringify(r));
r = manda(st, 'u2', 'merlin-perfect');
dice(mostrati(r).length === 1, 'l-avversario intanto manda i suoi');
adesso += 60001;
r = manda(st, 'u1', 'frog-prince-okay');
dice(mostrati(r).length === 1 && blocchi(r).length === 0, 'passati i due minuti si rimanda', JSON.stringify(r));

// sparsi
st = stato();
passati = 0;
for (let i = 0; i < 8; i++) { adesso += 2600; passati += mostrati(manda(st, 'u1', 'queen-of-hearts-angry')).length; }
dice(passati === 8, 'uno ogni 2,6 secondi non blocca mai (mai sei in dieci secondi)', passati);

// il blocco e- della partita
let nuova = stato();
dice(mostrati(manda(nuova, 'u1', 'carabosse-menacing')).length === 1, 'in una partita nuova il blocco non c-e- (vale solo dentro la partita)');

console.log(String.fromCharCode(10) + (male ? male + ' controlli NON passano' : 'tutto a posto'));
process.exit(male ? 1 : 0);
