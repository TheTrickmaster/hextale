// BANCO DI PROVA — IL VERDE E IL ROSSO DICONO IL BILANCIO
// Il colore del numero di un gruppo deve dire una cosa sola: quel gruppo ADESSO
// vale piu' o meno di quanto valeva quando la carta e' entrata in partita.
// Non "e' appena stato alzato": una carta buffata due volte e debuffata una
// deve restare VERDE, perche' il bilancio e' positivo.
// Si lancia con:
//     node server/nakama/prova-colori.js
// Esce 1 se la regola e' rotta.
//
// La funzione provata e' scartoDallaNascita, estratta dal gioco: se un domani
// cambia li' e non qui, questo banco lo dice.
const fs = require('fs');
const sorgente = fs.readFileSync(__dirname + '/../../play/index.html', 'utf8');
const inizio = sorgente.indexOf('function scartoDallaNascita(');
if (inizio < 0) { console.error("scartoDallaNascita non esiste piu' nel gioco"); process.exit(1); }
const fine = sorgente.indexOf('\n}', inizio) + 2;
const scartoDallaNascita = new Function('return ' + sorgente.slice(inizio, fine))();

const LATI = ['NW', 'NE', 'E', 'SE', 'SW', 'W'];
let ko = 0;

function carta(valori, gruppi) {
  return { values: Object.assign({}, valori), valoriNascita: Object.assign({}, valori), groupSides: gruppi };
}
function colore(d) { return d > 0 ? 'verde' : (d < 0 ? 'rosso' : 'bianco'); }

// Una carta con tre gruppi: 2, 4, 6.
const gruppi = [['NW', 'NE'], ['E', 'SE'], ['SW', 'W']];
const base = { NW: 2, NE: 2, E: 4, SE: 4, SW: 6, W: 6 };

const casi = [
  { nome: "niente e' successo", muovi: {}, atteso: ['bianco', 'bianco', 'bianco'] },
  { nome: 'un buff sul secondo gruppo', muovi: { E: +2, SE: +2 }, atteso: ['bianco', 'verde', 'bianco'] },
  { nome: 'un debuff sul terzo', muovi: { SW: -3, W: -3 }, atteso: ['bianco', 'bianco', 'rosso'] },
  { nome: 'due buff e un debuff: resta verde', muovi: { E: +2 + 2 - 1, SE: +2 + 2 - 1 }, atteso: ['bianco', 'verde', 'bianco'] },
  { nome: 'buffato e poi riportato a zero: bianco', muovi: { NW: +3 - 3, NE: +3 - 3 }, atteso: ['bianco', 'bianco', 'bianco'] },
  { nome: "debuffato piu' di quanto era stato buffato", muovi: { SW: +1 - 4, W: +1 - 4 }, atteso: ['bianco', 'bianco', 'rosso'] },
];

for (const caso of casi) {
  const c = carta(base, gruppi);
  for (const lato in caso.muovi) c.values[lato] += caso.muovi[lato];
  const visti = gruppi.map(g => colore(scartoDallaNascita(c, c.values, { sides: g }, null)));
  const bene = visti.join(',') === caso.atteso.join(',');
  if (!bene) ko++;
  console.log('  ' + (bene ? 'ok   ' : 'ROTTO') + ' ' + caso.nome.padEnd(42)
    + gruppi.map(g => c.values[g[0]]).join(' ') + '   -> ' + visti.join(', ')
    + (bene ? '' : '   atteso: ' + caso.atteso.join(', ')));
}

// E il caso che ha fatto nascere la correzione: il colore NON deve seguire
// l'ultimo movimento. Si simula passando un "ripiego" che dice il contrario:
// con una nascita a disposizione, il ripiego non deve nemmeno essere guardato.
const c2 = carta(base, gruppi);
c2.values.E += 5; c2.values.SE += 5;                 // bilancio: +5, quindi VERDE
const ultimoMovimento = { E: -1, SE: -1 };            // l'ultimo effetto toglieva
const d = scartoDallaNascita(c2, c2.values, { sides: gruppi[1] }, ultimoMovimento);
const bene = d > 0;
if (!bene) ko++;
console.log('  ' + (bene ? 'ok   ' : 'ROTTO') + ' ' + "l'ultimo movimento non decide il colore".padEnd(48)
  + '-> ' + colore(d) + (bene ? '' : '   atteso: verde'));

console.log('\n' + (ko ? 'FALLITO: ' + ko + ' casi' : 'OK: il colore dice il bilancio dalla partenza'));
process.exit(ko ? 1 : 0);
