// NESSUNO GIOCA CONTRO SE STESSO — SUL SERVER.
//
//     node strumenti/prova-accoppiamento-server.js [percorso/index.js]
//
// Segnalazione di Lorenzo (v0.80.1): "giocando online, a volte si entra in
// partita con noi stessi". Nel registro del server: "partita cominciata:
// f59b401d... contro f59b401d...". Lo stesso account con due sessioni in cerca
// (due finestre, due dispositivi) aveva due biglietti, e il matchmaker li
// accoppiava. accoppiati adesso rifiuta un accoppiamento con se stessi, e un
// accoppiamento fra due persone diverse nasce come prima.
//
// Come prova-rifiuto-server: index.js in un contesto finto, senza Nakama.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DOVE = process.argv[2] || path.join(__dirname, '..', 'server', 'nakama', 'index.js');
console.log('provo ' + DOVE + String.fromCharCode(10));
const mondo = { console, Date, Math, JSON, parseInt, parseFloat, isFinite, String, Object, Array, Error, Number };
mondo.global = mondo;
vm.createContext(mondo);
new vm.Script(fs.readFileSync(DOVE, 'utf8')).runInContext(mondo);

let male = 0;
const dice = (ok, che, perche) => {
  if (!ok) male++;
  console.log((ok ? '  ok   ' : '  NO   ') + che);
  if (perche !== undefined) console.log('        ' + perche);
};

// Il possesso e il mazzo non sono la domanda di questo banco: validi per tutti.
mondo.leggiPossesso = () => ({ livello: 1 });
mondo._mazzoDi = () => ({ carte: ['a', 'b'] });

const biglietto = (u, nome) => ({ presence: { userId: u }, properties: { nome: nome, avatar: '', rank: 3 } });
const prova = (matches) => {
  const create = [];
  const avvisi = [];
  const nk = { matchCreate: (modulo, parametri) => { create.push(parametri); return 'partita-' + create.length; } };
  const logger = { info() {}, warn(f, a) { avvisi.push(String(f).replace('%s', a)); }, error() {} };
  const esito = mondo.accoppiati({}, logger, nk, matches);
  return { esito, create, avvisi };
};

const stesso = prova([biglietto('f59b401d-073b', 'Lorenzo'), biglietto('f59b401d-073b', 'Lorenzo')]);
dice(stesso.esito === '' && stesso.create.length === 0, 'lo stesso account due volte: nessuna partita',
  'esito ' + JSON.stringify(stesso.esito) + ', partite create ' + stesso.create.length);
dice(stesso.avvisi.some(a => /se stesso/.test(a)), 'e nel registro si dice perche-', stesso.avvisi.join(' | '));

const due = prova([biglietto('a9d9d917', 'Uno'), biglietto('f59b401d', 'Due')]);
dice(due.esito === 'partita-1' && due.create.length === 1, 'due account diversi: la partita nasce come sempre', JSON.stringify(due.esito));
dice(due.create[0] && JSON.parse(due.create[0].giocatori).join() === 'a9d9d917,f59b401d', 'con tutti e due dentro');

console.log(String.fromCharCode(10) + (male ? male + ' controlli NON passano' : 'tutto a posto'));
process.exit(male ? 1 : 0);
