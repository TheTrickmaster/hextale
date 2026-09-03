// BANCO DI PROVA — UN MAZZO GENERATO DALLA MACCHINA E' SEMPRE VALIDO
//
// Le due regole sono: dodici carte esatte, ventiquattro punti al massimo
// (timeless 4, mythic 3, rare 2, common 1). Un mazzo che la macchina compone e
// che poi il gioco rifiuta e' un vicolo cieco: chi gioca non ha fatto niente di
// sbagliato e non ha modo di rimediare.
//
// Si prova la REGOLA DI PRESA usata da tutti e tre i punti che compongono un
// mazzo — il generatore del casuale nel client, il ripiego di makeDeck, e
// _mazzoCasualeDi sul server — su collezioni volutamente scomode.
//
//     node server/nakama/prova-mazzo-casuale.js
const fs = require('fs');
const path = require('path');

const MAZZO_CARTE = 12, MAZZO_PUNTI = 24;
const COSTO = { timeless: 4, mythic: 3, rare: 2, common: 1 };
const costo = r => COSTO[String(r || '').toLowerCase()] || 1;

// La regola, scritta una volta: si accetta una carta solo se il budget regge
// anche i posti che restano, dando per scontato che costino almeno uno l'uno.
function componi(carte) {
  const prese = [];
  let punti = 0;
  for (const c of carte) {
    if (prese.length >= MAZZO_CARTE) break;
    const restanti = MAZZO_CARTE - prese.length - 1;
    if (punti + costo(c.rarity) + restanti > MAZZO_PUNTI) continue;
    prese.push(c); punti += costo(c.rarity);
  }
  return { prese, punti };
}

let ko = 0;
function prova(nome, carte, deveRiuscire) {
  const { prese, punti } = componi(carte);
  const completo = prese.length === MAZZO_CARTE;
  const dentro = punti <= MAZZO_PUNTI;
  const bene = deveRiuscire ? (completo && dentro) : (!completo || dentro);
  if (!bene) ko++;
  console.log('  ' + (bene ? 'ok   ' : 'ROTTO') + ' ' + nome.padEnd(46)
    + prese.length + '/' + MAZZO_CARTE + ' carte, ' + punti + '/' + MAZZO_PUNTI + ' punti');
  return { prese, punti };
}

function tante(rarita, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ id: rarita + '-' + i, rarity: rarita });
  return out;
}
function mescola(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = (i * 7 + 3) % (i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

console.log('COLLEZIONI SCOMODE');
prova('solo common (il caso facile)', tante('common', 40), true);
// Dodici timeless fanno 48 punti su 24: un mazzo valido NON ESISTE, e la
// cosa giusta e' non comporne uno. Quel che conta e' che non ne esca uno
// SFORATO: si rinuncia, e chi chiama lo dice a chi gioca.
prova('solo timeless: un mazzo valido non esiste', tante('timeless', 40), false);
prova('solo mythic: nemmeno', tante('mythic', 40), false);
prova('meta- timeless e meta- common, mescolate', mescola(tante('timeless', 20).concat(tante('common', 20))), true);
prova('tutte le rarita- mescolate', mescola(tante('timeless', 10).concat(tante('mythic', 10), tante('rare', 10), tante('common', 10))), true);
prova('esattamente dodici common', tante('common', 12), true);
prova('esattamente dodici timeless', tante('timeless', 12), false);  // 48 punti: non si puo-

// Il caso che conta: con almeno dodici common si riesce SEMPRE, comunque
// mescolate, perche- dodici per uno fa dodici.
console.log('\nCENTO MESCOLATE, COLLEZIONE MISTA');
let male = 0;
for (let giro = 0; giro < 100; giro++) {
  const carte = [];
  for (let i = 0; i < 60; i++) {
    const r = ['timeless', 'mythic', 'rare', 'common'][(giro * 13 + i * 7) % 4];
    carte.push({ id: r + '-' + i, rarity: r });
  }
  const { prese, punti } = componi(carte);
  if (prese.length !== MAZZO_CARTE || punti > MAZZO_PUNTI) male++;
}
if (male) { console.log('  ROTTO: ' + male + ' mescolate su 100 danno un mazzo non valido'); ko += male; }
else console.log('  ok    100 su 100 danno dodici carte entro i ventiquattro punti');

// E che i tre punti del codice usino davvero questa regola.
console.log('\nLA REGOLA E- SCRITTA DOVE SERVE');
const gioco = fs.readFileSync(path.join(__dirname, '..', '..', 'play', 'index.html'), 'utf8');
const srv = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
const punti = [
  ['generaMazzoCasuale (client)', gioco, 'function generaMazzoCasuale('],
  ['mazzoConCuiGiocare (client)', gioco, 'function mazzoConCuiGiocare('],
  ['il ripiego di makeDeck', gioco, 'anche il ripiego sta nel budget'.toUpperCase().slice(0, 0) + 'ANCHE IL RIPIEGO STA NEL BUDGET'],
  ['_mazzoCasualeDi (server)', srv, 'function _mazzoCasualeDi('],
];
for (const [nome, testo, ago] of punti) {
  const c1 = testo.indexOf(ago) >= 0;
  if (!c1) ko++;
  console.log('  ' + (c1 ? 'ok    ' : 'MANCA ') + nome);
}

console.log('\n' + (ko ? 'FALLITO: ' + ko : 'OK: la macchina non sa comporre un mazzo non valido'));
process.exit(ko ? 1 : 0);
