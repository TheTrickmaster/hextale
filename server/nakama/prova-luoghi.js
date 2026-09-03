// BANCO DI PROVA — "board" E' UN LUOGO, E LO SI CHIEDE NEL MODO GIUSTO
//
// Little John dice "buff ally board power": in campo. Il motore leggeva
// `board` come "il bersaglio non e' la fonte" e non guardava affatto dove
// fosse: le carte in MANO venivano buffate lo stesso (v0.78.15).
//
// La correzione di quel giorno guardava `scena.inCampo`, e SEMBRAVA la stessa
// domanda. Non lo era, e la differenza e' il motivo per cui esiste questo
// banco: chi costruisce una scena puo' mettere in `inCampo` solo la carta che
// sta esaminando. Lo fa il riquadro dei buff, che per sapere quanto dia OGNI
// singola fonte ne mette in campo una alla volta. In quella scena il bersaglio
// non compare — e il motore rispondeva "non e' in campo", quindi il riquadro
// smetteva di dire CHI stesse buffando e lasciava il numero da solo
// (v0.78.16).
//
//     node server/nakama/prova-luoghi.js
//
// Le due proprieta' vanno provate INSIEME, perche' correggere una sola e'
// esattamente cio' che e' successo due volte di fila:
//   1) una carta in MANO non riceve un buff che dice "board";
//   2) una carta in CAMPO lo riceve anche quando chi chiede ha messo in
//      `inCampo` la sola fonte — cioe' quando a chiedere e' il riquadro.
const M = require('./abilita-motore.js');
const cat = require('../importazione/.lavoro/catalogo.json');
const carte = Array.isArray(cat) ? cat : (cat.carte || cat.cards || Object.values(cat)[0]);

const LATI = ['NW', 'NE', 'E', 'SE', 'SW', 'W'];
let ko = 0;
function chiedi(nome, avuto, atteso, perche) {
  const buono = avuto === atteso;
  if (!buono) ko++;
  console.log('  ' + (buono ? 'ok    ' : 'ROTTA ') + nome.padEnd(52) + String(avuto).padStart(4));
  if (!buono) console.log('        atteso ' + atteso + '. ' + perche);
}

// Una carta come la costruisce il gioco, quanto basta al motore.
function finta(entry, owner, id) {
  const c = {
    id: id, owner: owner, name: entry.name,
    baseId: entry.id, traits: (entry.traits || []).slice(),
    abilita: entry.abilita || null,
    values: Object.assign({}, entry.values),
    valoriBase: Object.assign({}, entry.values),
    valoriNascita: Object.assign({}, entry.values)
  };
  return c;
}
const somma = (d) => LATI.reduce((s, l) => s + (d[l] || 0), 0);

const john = carte.find(c => /little john/i.test(c.name || ''));
const compagno = carte.find(c => (c.traits || []).some(t => /wild|explorer/i.test(t)));
if (!john || !compagno) {
  console.log('nel catalogo mancano le carte che servono a questa prova');
  process.exit(0);
}

const lj = finta(john, 1, 'lj');
const inCampo = finta(compagno, 1, 'campo');
const inMano = finta(compagno, 1, 'mano');

// La scena vera: due carte in campo, una in mano.
const dove = new Map([[lj, '0,0'], [inCampo, '1,0']]);
const scenaVera = {
  inCampo: [lj, inCampo],
  inMano: [inMano],
  cellaDi: (c) => dove.get(c) || null,
  vicini: () => [],
  latiLiberi: () => 0,
  turno: 3, seme: 'prova'
};
// E la scena che costruisce il RIQUADRO dei buff: una fonte alla volta.
const scenaDelRiquadro = Object.assign({}, scenaVera, { inCampo: [lj] });

console.log('"BOARD" E\' UN LUOGO\n');
chiedi('un compagno IN CAMPO riceve il buff', somma(M.deltaContinuo(inCampo, scenaVera)) > 0, true,
  'e\' la sinergia stessa: se non arriva, la carta non fa piu\' niente.');
chiedi('un compagno IN MANO non lo riceve', somma(M.deltaContinuo(inMano, scenaVera)), 0,
  '"board" vuol dire in campo. Toccare la mano e\' fare una cosa che il foglio non dice.');

console.log('\nE LO SI CHIEDE A "cellaDi", NON ALL\'ELENCO DEI CONTRIBUTORI\n');
chiedi('il riquadro vede il buff con la sola fonte in campo',
  somma(M.deltaContinuo(inCampo, scenaDelRiquadro)) > 0, true,
  'e\' cosi\' che il riquadro scopre CHI sta buffando: una fonte alla volta.\n' +
  '        Rispondendo di no, il riquadro mostra il numero senza il nome.');
chiedi('e nemmeno cosi\' la mano viene toccata',
  somma(M.deltaContinuo(inMano, scenaDelRiquadro)), 0,
  'la scena ridotta non deve diventare una scorciatoia per rientrare dalla finestra.');

console.log('\n' + (ko ? 'FALLITO: ' + ko : 'OK: un luogo e\' un luogo, e la domanda e\' "dove sei"'));
process.exit(ko ? 1 : 0);
