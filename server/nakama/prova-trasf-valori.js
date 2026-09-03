// BANCO DI PROVA — I NUMERI DI UNA CARTA CHE SI TRASFORMA
//
// La regola: la carta trasformata prende i valori della carta NUOVA, e si
// porta dietro i buff e i debuff che aveva addosso.
// I colpi permanenti si misurano come distanza fra la sua base e i suoi numeri
// di nascita; le sinergie vive NON si riportano, perche' si ricalcolano da sole
// dalla base — sommarle qui vorrebbe dire contarle due volte al primo disegno.
//
//     node server/nakama/prova-trasf-valori.js
const fs = require('fs');
const path = require('path');
const sorgente = fs.readFileSync(path.join(__dirname, '..', '..', 'play', 'index.html'), 'utf8');

const LATI = ['NW', 'NE', 'E', 'SE', 'SW', 'W'];

// Si riproduce il conto che fa trasformaCartaIn, e si controlla che il codice
// vero contenga ancora le righe che lo fanno: se qualcuno le toglie, questo
// banco lo dice invece di lasciare che i numeri tornino indietro in silenzio.
const righeAttese = [
  'card.valoriBase = {..._nuovaBase};',
  'card.valoriNascita = {...nuova.values};',
  '_addosso[s] = (_base[s]||0) - (_prima[s]||0);'
];
let ko = 0;
console.log('LE RIGHE CHE FANNO IL CONTO');
for (const r of righeAttese) {
  const c1 = sorgente.indexOf(r) >= 0;
  if (!c1) ko++;
  console.log('  ' + (c1 ? 'ok    ' : 'MANCA ') + r);
}

// Il conto, provato sui casi che contano.
function trasforma(vecchia, nuova) {
  const addosso = {};
  for (const s of LATI) addosso[s] = (vecchia.valoriBase[s] || 0) - (vecchia.valoriNascita[s] || 0);
  const base = Object.assign({}, nuova.values);
  for (const g of nuova.groupSides) {
    const d = addosso[g[0]] || 0;
    if (!d) continue;
    for (const s of g) base[s] = Math.max(0, (base[s] || 0) + d);
  }
  return { valoriNascita: Object.assign({}, nuova.values), valoriBase: base };
}
function mostra(v) { return LATI.map(l => v[l]).join(' '); }

const gruppi = [['NW', 'NE'], ['E', 'SE'], ['SW', 'W']];
const nuova = { values: { NW: 8, NE: 8, E: 6, SE: 6, SW: 4, W: 4 }, groupSides: gruppi };

console.log('\nIL CONTO');
const casi = [
  { nome: 'nessun colpo preso: i numeri sono i suoi',
    v: { valoriNascita: { NW: 3, NE: 3, E: 5, SE: 5, SW: 7, W: 7 },
         valoriBase:    { NW: 3, NE: 3, E: 5, SE: 5, SW: 7, W: 7 } },
    atteso: '8 8 6 6 4 4' },
  { nome: 'un buff di +2 sul secondo gruppo, si porta dietro',
    v: { valoriNascita: { NW: 3, NE: 3, E: 5, SE: 5, SW: 7, W: 7 },
         valoriBase:    { NW: 3, NE: 3, E: 7, SE: 7, SW: 7, W: 7 } },
    atteso: '8 8 8 8 4 4' },
  { nome: 'un debuff di -3 sul terzo, idem',
    v: { valoriNascita: { NW: 3, NE: 3, E: 5, SE: 5, SW: 7, W: 7 },
         valoriBase:    { NW: 3, NE: 3, E: 5, SE: 5, SW: 4, W: 4 } },
    atteso: '8 8 6 6 1 1' },
  { nome: 'un debuff piu- grande del valore: non si scende sotto zero',
    v: { valoriNascita: { NW: 3, NE: 3, E: 5, SE: 5, SW: 7, W: 7 },
         valoriBase:    { NW: 3, NE: 3, E: 5, SE: 5, SW: 0, W: 0 } },
    atteso: '8 8 6 6 0 0' },
];
for (const caso of casi) {
  const r = trasforma(caso.v, nuova);
  const visto = mostra(r.valoriBase);
  const bene = visto === caso.atteso;
  if (!bene) ko++;
  console.log('  ' + (bene ? 'ok   ' : 'ROTTO') + ' ' + caso.nome.padEnd(52) + visto
    + (bene ? '' : '   atteso: ' + caso.atteso));
  // e la nascita e' sempre quella della carta nuova, o il verde/rosso mentirebbe
  if (mostra(r.valoriNascita) !== '8 8 6 6 4 4') { console.log('        ROTTO: la nascita non e- quella nuova'); ko++; }
}

console.log('\n' + (ko ? 'FALLITO: ' + ko : 'OK: numeri nuovi, colpi presi conservati, gruppi interi'));
process.exit(ko ? 1 : 0);
