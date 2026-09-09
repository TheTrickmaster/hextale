// Il banco del filtro sui nomi.
//
//   node strumenti/prova-nomi.js
//
// Niente Electron e niente server: il modulo del runtime e' uno script, e uno
// script si puo' far girare in una scatola e poi INTERROGARE. Si finge il
// catalogo — bastano tre carte, purche' una si chiami "Puss in Boots" — e si
// chiede a nomeSporco cosa ne pensa di una cinquantina di nomi.
//
// PERCHE' UN BANCO E NON UNA PROVA DAL VIVO. Perche' un filtro sui nomi si
// giudica su cio' che RESPINGE PER SBAGLIO, e quei casi non capitano mentre lo
// si prova a mano: capitano al giocatore che si chiama Cassandra. Qui stanno in
// fila, e il giorno in cui qualcuno tocca la regola si vede subito chi cade.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const MODULO = path.resolve(__dirname, '..', 'server', 'nakama', 'index.js');

// Il catalogo finto: le tre carte che nella lista delle parolacce ci sono
// davvero, piu' una qualunque. Sono la ragione per cui le parole del gioco si
// ricavano dal catalogo invece di essere scritte a mano.
const CATALOGO = { versione: 'prova', carte: [
  { slug: 'puss-in-boots', name: 'Puss in Boots' },
  { slug: 'babes-in-the-wood', name: 'Babes in the Wood' },
  { slug: 'nymph', name: 'Nymph' },
  { slug: 'merlin', name: 'Merlin' }
]};
const nk = {
  storageRead: function(){ return [{ value: CATALOGO }]; }
};

const scatola = vm.createContext({ console: console, Date: Date, Math: Math, JSON: JSON });
vm.runInContext(fs.readFileSync(MODULO, 'utf8'), scatola, { filename: 'index.js' });
if (typeof scatola.nomeSporco !== 'function') {
  console.error('nomeSporco non esiste nel modulo: il filtro non e\' installato');
  process.exit(1);
}

// nome, atteso: true = deve passare, false = deve essere respinto
const PROVE = [
  // Quelli che DEVONO passare. Sono la meta' che conta: un filtro che respinge
  // troppo si nota subito e fa male a chi non ha fatto niente.
  ['Assatanato', true],   // l'esempio di Lorenzo: contiene "ass", non e' "ass"
  ['Cassandra', true],
  ['Massimo', true],
  ['Banal', true],        // contiene "anal"
  ['analyst', true],
  ['peacock', true],      // contiene "cock"
  ['Cockatoo', true],
  ['Grapes', true],       // contiene "rape"
  ['Scraped', true],
  ['Merlin', true],
  ['Pinocchio', true],
  ['TinkerBell', true],
  ['LittleJohn', true],
  ['xX_Shadow_Xx', true],
  ['Puss in Boots', true],   // e' una carta del gioco
  ['Puss', true],            // idem, parola sola
  ['Babes', true],
  ['Nymph', true],
  ['Aeolus', true],       // il dio dei venti: rumore della lista, in PAROLACCE_AMMESSE
  ['aeolus', true],

  // Quelli che NON devono passare.
  ['ass', false],
  ['Ass', false],
  ['big_ass', false],        // due parole, una e' "ass"
  ['fuck', false],
  ['fuckyou', false],        // tutto attaccato: lo prende il nocciolo
  ['FuCkYoU', false],
  ['fuuuuck', false],        // ripetizioni schiacciate
  ['sh1t', false],           // cifre al posto delle lettere
  ['n1gg3r', false],
  ['nigga', false],
  ['bastard', false],
  ['Slutty', false],
  ['Hitler', false],
  ['adolfhitler', false],
  ['Whoregarden', false],
  ['b!tch', false],
  ['a$$hole', false]
];

let male = 0;
for (const [nome, devePassare] of PROVE){
  const trovata = scatola.nomeSporco(nk, nome);
  const passa = !trovata;
  const ok = passa === devePassare;
  if (!ok) male++;
  console.log((ok ? '  ok  ' : '  NO  ')
    + (devePassare ? 'passa    ' : 'respinto ')
    + nome.padEnd(18)
    + (trovata ? '[' + trovata + ']' : ''));
}
console.log('\n' + PROVE.length + ' nomi, ' + male + ' sbagliati');
process.exit(male ? 1 : 0);
