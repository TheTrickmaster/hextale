// BANCO DI PROVA — DUE GIOCATE SONO DUE OCCASIONI
// Un effetto a scatto che colpisce "un gruppo a caso" deve scegliere un gruppo
// DIVERSO a ogni giocata: tre Geni calati uno dopo l'altro non devono regalare
// il bonus sempre allo stesso gruppo.
// Un effetto CONTINUO, al contrario, deve restare fermo: se saltasse da un
// gruppo all'altro a ogni ridisegno la carta cambierebbe forma sotto gli occhi.
// Si lancia con:
//     node server/nakama/prova-occasioni.js
// Esce 1 se una delle due regole e' rotta.
const M = require('./abilita-motore.js');
const cat = require('../importazione/.lavoro/catalogo.json');
const carte = Array.isArray(cat) ? cat : (cat.carte || cat.cards || Object.values(cat)[0]);
const genioEntry = carte.find(x => /genie/i.test(x.name || ''));
const LATI = M.SEI_LATI;

let ko = 0;

function inMano(entry, owner) {
  return { id: entry.id, name: entry.name, owner: owner,
    values: Object.assign({}, entry.values), valoriBase: Object.assign({}, entry.values),
    groupSides: entry.groupSides ? entry.groupSides.map(g => g.slice()) : null, abilita: null };
}
const mano = carte.filter(c => c.id !== genioEntry.id && c.groupSides && c.groupSides.length > 1)
  .slice(0, 3).map(c => inMano(c, 1));

// Tre Geni, tre caselle diverse. Sul server e sul client la carta e' la stessa
// voce di catalogo, quindi hanno lo STESSO id: se l'occasione non entrasse nel
// seme, non ci sarebbe nulla a distinguerli.
const celle = ['0,0', '1,-1', '-1,2'];
const geni = celle.map(() => ({ id: genioEntry.id, name: genioEntry.name, owner: 1,
  values: Object.assign({}, genioEntry.values), abilita: genioEntry.abilita }));

function scenaCon(genio, cella) {
  return {
    inCampo: [genio], inMano: mano.slice(),
    cellaDi: (c) => (c === genio ? cella : null),
    vicini: () => [], latiLiberi: () => 0,
    turno: 1, seme: 'partita-di-prova'
  };
}

console.log('── tre Geni, tre caselle ──');
const scelte = [];
for (let i = 0; i < geni.length; i++) {
  geni[i]._scatti = null;
  const cambi = M.cambiamentiAllEvento(geni[i], 'on_play', scenaCon(geni[i], celle[i]));
  const riga = cambi.map(c => (c.carta.name + ':' + c.lati.join('+'))).join('   ');
  scelte.push(cambi.map(c => c.lati.join('+')).join('|'));
  console.log('  casella ' + celle[i].padEnd(6) + ' -> ' + riga);
}
const tutteUguali = scelte.every(s => s === scelte[0]);
if (tutteUguali) { console.log('  ROTTO: tutti e tre hanno scelto gli stessi gruppi'); ko++; }
else console.log('  ok: le scelte cambiano da una giocata all-altra');

// ── e un effetto continuo, che invece deve restare fermo ─────────────────
console.log('\n── un-abilita- continua, ridisegnata dieci volte ──');
// Pixies: "se in campo c'e' un Trickster, +2 su un gruppo a caso, per ogni
// Trickster". La condizione va SODDISFATTA, o il banco non prova niente: e'
// esattamente cosa era successo alla prima stesura, che pescava una carta la
// cui condizione era falsa e dichiarava vittoria su zero cambiamenti.
const pixie = carte.find(c => /pixies/i.test(c.name || ''));
const trickster = carte.find(c => (c.traitNames || c.traits || []).some(x => /trickster/i.test(x)));
if (!pixie) {
  console.log('  (nessuna carta continua con RAND nel catalogo: niente da provare)');
} else {
  const viva = { id: pixie.id, name: pixie.name, owner: 1,
    values: Object.assign({}, pixie.values), valoriBase: Object.assign({}, pixie.values),
    groupSides: pixie.groupSides ? pixie.groupSides.map(g => g.slice()) : null, abilita: pixie.abilita };
  const viste = {};
  for (let t = 1; t <= 10; t++) {
    const compagno = { id: trickster.id, name: trickster.name, owner: 1,
      values: Object.assign({}, trickster.values),
      traitNames: trickster.traitNames || trickster.traits || [],
      traits: trickster.traitNames || trickster.traits || [], abilita: null };
    const d = M.deltaContinuo(viva, {
      inCampo: [viva, compagno], inMano: [], vicini: () => [], latiLiberi: () => 0,
      cellaDi: () => '0,0', turno: t, seme: 'partita-di-prova'
    });
    viste[LATI.filter(l => d[l]).join('+') || '(niente)'] = true;
  }
  const quante = Object.keys(viste).length;
  if (viste['(niente)']) { console.log("  ROTTO: la condizione non e' soddisfatta, il banco non prova niente"); ko++; }
  console.log('  ' + pixie.name + ': gruppi visti in dieci turni -> ' + Object.keys(viste).join(' , '));
  if (quante > 1) { console.log('  ROTTO: il bonus continuo salta da un gruppo all-altro'); ko++; }
  else console.log('  ok: resta fermo dove-era');
}

console.log('\n' + (ko ? 'FALLITO' : 'OK: le occasioni cambiano, il continuo no'));
process.exit(ko ? 1 : 0);
