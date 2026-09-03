// BANCO DI PROVA — LA REGOLA DEI GRUPPI
// Un effetto che tocca i valori di una carta muove SEMPRE un gruppo intero,
// mai un lato solo: un gruppo e' un numero solo, e spaccarlo lascia la carta in
// uno stato che non si puo' nemmeno disegnare. Si lancia con:
//     node server/nakama/prova-gruppi.js
// Esce 1 se qualcuno rompe la regola.
// UN GRUPPO INTERO, UNA VOLTA SOLA. Su tutte le carte del catalogo.
const M = require('C:/Users/masil/Desktop/Hextale/game-assets/server/nakama/abilita-motore.js');
const cat = require('C:/Users/masil/Desktop/Hextale/game-assets/server/importazione/.lavoro/catalogo.json');
const carte = Array.isArray(cat) ? cat : (cat.carte || cat.cards || Object.values(cat)[0]);
const LATI = M.SEI_LATI;

let ko = 0, provati = 0;

// ── 1. l'esempio di Lorenzo, alla lettera ────────────────────────────────
console.log('── tre gruppi da 2, 4 e 6; il Genio buffa di 2 ──');
const finta = {
  id: 'prova', name: 'Carta di prova', owner: 1,
  values: { NW: 2, NE: 2, E: 4, SE: 4, SW: 6, W: 6 },
  groupSides: [['NW', 'NE'], ['E', 'SE'], ['SW', 'W']]
};
for (const seme of ['a', 'b', 'c', 'd', 'e', 'f']) {
  const lati = M.latiColpiti('RAND', finta.values, finta, seme);
  const dopo = Object.assign({}, finta.values);
  for (const l of lati) dopo[l] += 2;
  // Quanti GRUPPI si sono mossi?
  const mossi = finta.groupSides.filter(g => dopo[g[0]] !== finta.values[g[0]]).length;
  // Ogni gruppo e' rimasto coerente (tutti i suoi lati con lo stesso numero)?
  const coerente = finta.groupSides.every(g => g.every(l => dopo[l] === dopo[g[0]]));
  const riga = finta.groupSides.map(g => dopo[g[0]]).join(' ');
  console.log('  seme "' + seme + '" -> ' + riga
    + '   gruppi mossi: ' + mossi + (coerente ? '' : '   ROTTO: gruppo spaccato'));
  if (mossi !== 1 || !coerente) ko++;
  provati++;
}

// ── 2. tutte le carte vere, per RAND, HIGHEST e LOWEST ───────────────────
console.log('\n── tutte le carte del catalogo ──');
const conGruppi = carte.filter(c => c.groupSides && c.groupSides.length && c.values);
for (const ambito of ['RAND', 'HIGHEST', 'LOWEST']) {
  let male = 0;
  for (const c of conGruppi) {
    for (const seme of ['s1', 's2', 's3']) {
      const lati = M.latiColpiti(ambito, c.values, c, seme);
      provati++;
      // I lati scelti devono essere ESATTAMENTE un gruppo dichiarato.
      const gruppo = c.groupSides.find(g => g.indexOf(lati[0]) >= 0);
      const esatto = gruppo && gruppo.length === lati.length
        && gruppo.every(l => lati.indexOf(l) >= 0);
      if (!esatto) { male++; ko++; if (male <= 3) console.log('  ROTTO ' + c.name + ' [' + ambito + ']: ' + lati.join(',')); }
    }
  }
  console.log('  ' + ambito.padEnd(8) + (male ? male + ' casi rotti' : 'sempre un gruppo intero e dichiarato'));
}

console.log('\n' + (ko ? 'FALLITO: ' + ko + ' casi su ' + provati : 'OK: ' + provati + ' casi, tutti un gruppo solo e intero'));
process.exit(ko ? 1 : 0);
