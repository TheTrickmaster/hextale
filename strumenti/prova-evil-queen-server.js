// THE EVIL QUEEN SUL SERVER (v0.80.32).
//
//     node strumenti/prova-evil-queen-server.js
//
// In rete il mazzo vero lo tiene il server, ed e' lui a pescare: la Poisoned Apple
// deve finire in cima al mazzo anche li', o il server pescherebbe un'altra carta e
// poi rifiuterebbe la mela giocata. Qui:
//   1. il parser legge la riga della Regina come summon opponent deck next #175;
//   2. dal catalogo si ricava chi evoca cosa nel mazzo (per numero e per nome), e
//      non le carte senza evocazione o con una condizione;
//   3. calata dal giocatore 1 la mela va in cima al mazzo del 2, e viceversa; una
//      carta qualunque non tocca i mazzi; il catalogo si legge una volta per partita;
//   4. alla sua pescata l'avversario prende proprio la mela;
//   5. l'aggancio c'e' nella giocata e nella giocata d'ufficio, e il codice nuovo e' ES5.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RADICE = path.resolve(__dirname, '..');
const P = require(path.join(RADICE, 'server', 'importazione', 'abilita-parser.js'));

let male = 0;
const dice = (ok, che, perche) => {
  if (!ok) male++;
  console.log((ok ? '  ok   ' : '  NO   ') + che);
  if (!ok && perche !== undefined) console.log('        ' + perche);
};

// ── 1. il parser ──────────────────────────────────────────────────────────
const intestazione = ['Name'].concat(P.COLONNE);
const riga = (valori) => intestazione.map(c => (c in valori ? valori[c] : '-'));
const leggi = P.lettoreDi(intestazione);
const REGINA = P.abilitaDaRiga('The Evil Queen', leggi(riga({
  Name: 'The Evil Queen', 'Is unique': 'No', Trigger: 'on_play', Frequency: 'once_per_game', Window: 'always',
  'Player selection': 'no', Action: 'summon', Who: 'opponent', Which: 'next', Where: 'deck', What: 'card',
  Amount: '#175', Duration: 'permanent', Link: '-', 'Player selection 2': 'no'
})));
const e = REGINA && REGINA.effetto;
dice(e && e.azione === 'summon' && e.chi === 'opponent' && e.dove === 'deck' && e.quale === 'next' && e.quanto && e.quanto.carta === '#175' && REGINA.trigger === 'on_play',
  'la riga della Regina: summon opponent deck next #175, alla calata', JSON.stringify(REGINA));

// ── il server, in una scatola ─────────────────────────────────────────────
const mondo = { console, Date, Math, JSON, parseInt, parseFloat, isFinite, String, Object, Array, Error, Number, RegExp };
mondo.global = mondo;
vm.createContext(mondo);
const modulo = fs.readFileSync(path.join(RADICE, 'server', 'nakama', 'index.js'), 'utf8');
new vm.Script(modulo).runInContext(mondo);

const clona = (x) => JSON.parse(JSON.stringify(x));
const alleataDiRegina = clona(REGINA); alleataDiRegina.effetto.chi = 'ally'; alleataDiRegina.effetto.quanto = { carta: 'Poisoned Apple' };
const conSe = clona(REGINA); conSe.se = { soggetto: 'adjacent', test: 'has_trait', valore: { tratti: ['Princess'] } };
const CATALOGO = { carte: [
  { id: 'final-the-evil-queen', numero: 122, name: 'The Evil Queen', abilita: clona(REGINA) },
  { id: 'final-poisoned-apple', numero: 175, name: 'Poisoned Apple', abilita: null },
  { id: 'final-baba-yaga', numero: 0, name: 'Baba Yaga', abilita: null },
  { id: 'final-prova-alleata', numero: 900, name: 'Prova Alleata', abilita: alleataDiRegina },
  { id: 'final-prova-condizione', numero: 901, name: 'Prova Condizione', abilita: conSe },
] };
let letture = 0;
const nk = { storageRead: () => { letture++; return [{ value: CATALOGO }]; } };
const registro = [];
const logger = { info: (...a) => registro.push(a.join(' ')), warn: (...a) => registro.push('WARN ' + a.join(' ')), error: () => {} };

// ── 2. chi evoca cosa ─────────────────────────────────────────────────────
const mappa = mondo._evocazioniNelMazzo(nk);
dice(mappa['final-the-evil-queen'] && mappa['final-the-evil-queen'][0].id === 'final-poisoned-apple' && mappa['final-the-evil-queen'][0].avversario === true
  && mappa['final-prova-alleata'] && mappa['final-prova-alleata'][0].id === 'final-poisoned-apple' && mappa['final-prova-alleata'][0].avversario === false
  && !mappa['final-baba-yaga'] && !mappa['final-prova-condizione'],
  'dal catalogo: la Regina evoca la mela per l-avversario (per numero), per nome si trova lo stesso, senza evocazione o con condizione niente', JSON.stringify(mappa));

// ── 3. la giocata ─────────────────────────────────────────────────────────
letture = 0;
const stato = () => ({ giocatori: ['u1', 'u2'], mazzo: { u1: ['a1', 'a2'], u2: ['b1', 'b2'] }, mano: { u1: ['x1'], u2: ['y1'] }, turno: 0, numeroTurno: 1 });
const s = stato();
mondo._evocaNelMazzo(nk, logger, s, 'final-the-evil-queen', 0);
dice(s.mazzo.u2[0] === 'final-poisoned-apple' && s.mazzo.u2.length === 3 && s.mazzo.u1.join() === 'a1,a2', 'calata dal giocatore 1: la mela in cima al mazzo del 2, il suo intatto', JSON.stringify(s.mazzo));
mondo._evocaNelMazzo(nk, logger, s, 'final-the-evil-queen', 1);
dice(s.mazzo.u1[0] === 'final-poisoned-apple' && s.mazzo.u2.length === 3, 'calata dal giocatore 2: in cima a quello dell-1');
mondo._evocaNelMazzo(nk, logger, s, 'final-baba-yaga', 0);
dice(s.mazzo.u1.length === 3 && s.mazzo.u2.length === 3 && letture === 1, 'una carta qualunque non tocca i mazzi, e il catalogo si e- letto una volta sola', 'letture: ' + letture);

// ── 4. la pescata ─────────────────────────────────────────────────────────
const s2 = stato();
mondo._evocaNelMazzo(nk, logger, s2, 'final-the-evil-queen', 0);
s2.turno = 1;
const pescata = mondo._passaTurno(s2, null, 'u2');
dice(pescata === 'final-poisoned-apple' && s2.mano.u2.indexOf('final-poisoned-apple') >= 0, 'alla sua pescata l-avversario prende la mela, e il server la sa nella sua mano', pescata);

// ── 5. gli agganci ────────────────────────────────────────────────────────
const loop = modulo.slice(modulo.indexOf('function partitaLoop('));
const giocata = loop.slice(0, loop.indexOf('var pescata = _passaTurno(state, dispatcher, chi);'));
const ufficio = loop.slice(0, loop.indexOf('var pescata2 = _passaTurno(state, dispatcher, chiEra);'));
dice(giocata.lastIndexOf('_evocaNelMazzo(nk, logger, state, forma || carta, idx)') > giocata.lastIndexOf('state.mano[chi].splice(posto, 1)'), 'aggancio nella giocata, prima della pescata');
dice(ufficio.lastIndexOf('_evocaNelMazzo(nk, logger, state, scelta, state.turno)') > ufficio.lastIndexOf('var scelta = mano.shift()'), 'aggancio nella giocata d-ufficio, prima della pescata');
const nuovo = modulo.slice(modulo.indexOf('function _evocazioniNelMazzo('), modulo.indexOf('// v0.80.30 — cio\' che l\'ombra non sa seguire'));
dice(nuovo.length > 200 && !/=>|\blet\s|\bconst\s|`/.test(nuovo), 'il codice nuovo del server e- ES5 (niente =>, let, const, template)');

console.log(String.fromCharCode(10) + (male ? male + ' NO' : 'tutto a posto'));
process.exit(male ? 1 : 0);
