// IL BASILISCO, "Rocky", SENZA IL GIOCO (v0.80.30).
//
//     node strumenti/prova-basilisk-server.js
//
// Lorenzo: "Basilisk congela per 1 turno, ma la carta alleata messa in campo,
// prima di congelarsi attacca". Sul foglio: on_play, once_per_game, freeze ally
// board card next 1 n_turns. Qui la parte che non ha bisogno del gioco:
//   1. il parser legge la riga;
//   2. il motore all'on_play non descrive nessun gelo (la carta non c'e' ancora),
//      quindi nessuna alleata gia' in campo si congela; la stessa riga senza "next"
//      continua a descriverlo come prima;
//   3. il server: l'ombra si spegne quando si cala il Basilisco (non tiene il gelo),
//      e non per una carta qualunque;
//   4. il motore nuovo e' iniettato nel gioco e nel server.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RADICE = path.resolve(__dirname, '..');
const P = require(path.join(RADICE, 'server', 'importazione', 'abilita-parser.js'));
const M = require(path.join(RADICE, 'server', 'nakama', 'abilita-motore.js'));

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
const BASILISK = {
  Name: 'Basilisk', 'Is unique': 'No', Trigger: 'on_play', Frequency: 'once_per_game', Window: 'always',
  'Player selection': 'no', Action: 'freeze', Who: 'ally', Which: 'next', Where: 'board', What: 'card',
  Amount: '1', Duration: 'n_turns', Link: '-', 'Player selection 2': 'no'
};
const ab = P.abilitaDaRiga('Basilisk', leggi(riga(BASILISK)));
const e = ab && ab.effetto;
dice(e && e.azione === 'freeze' && e.chi === 'ally' && e.quale === 'next' && e.dove === 'board' && e.cosa === 'card'
  && e.quanto && e.quanto.numero === 1 && e.durata === 'n_turns' && ab.frequenza === 'once_per_game' && ab.trigger === 'on_play',
  'la riga del Basilisco: freeze ally next board card, 1, n_turns, una volta a partita', JSON.stringify(ab));

// ── 2. il motore ──────────────────────────────────────────────────────────
const carta = (id, owner, abilita) => ({ id: id, name: id, owner: owner, values: { NW: 1, NE: 1, E: 1, SE: 1, SW: 1, W: 1 }, abilita: abilita });
const alleata = carta('alleata', 1), nemica = carta('nemica', 2);
const scena = (fonte) => ({ inCampo: [fonte, alleata, nemica], vicini: () => [alleata, nemica], turno: 1, seme: 'prova' });
const basilisco = carta('basilisco', 1, JSON.parse(JSON.stringify(ab)));
let cambi = M.cambiamentiAllEvento(basilisco, 'on_play', scena(basilisco));
dice(!cambi.some(c => c.azione === 'freeze'), 'all-on_play nessun gelo: la prossima carta non c-e- ancora, e le alleate in campo restano libere', JSON.stringify(cambi.map(c => ({ az: c.azione, carta: c.carta && c.carta.id }))));
const senzaNext = JSON.parse(JSON.stringify(ab)); senzaNext.effetto.quale = 'single';
const altra = carta('altra', 1, senzaNext);
cambi = M.cambiamentiAllEvento(altra, 'on_play', scena(altra));
dice(cambi.some(c => c.azione === 'freeze'), 'la stessa riga con Which = single continua a congelare come prima', JSON.stringify(cambi.map(c => c.azione)));

// ── 3. il server ──────────────────────────────────────────────────────────
const mondo = { console, Date, Math, JSON, parseInt, parseFloat, isFinite, String, Object, Array, Error, Number, RegExp };
mondo.global = mondo;
vm.createContext(mondo);
const modulo = fs.readFileSync(path.join(RADICE, 'server', 'nakama', 'index.js'), 'utf8');
new vm.Script(modulo).runInContext(mondo);
dice(mondo._ombraNonSegue([], carta('b', 1, JSON.parse(JSON.stringify(ab)))) === true, 'l-ombra si spegne quando si cala il Basilisco');
dice(mondo._ombraNonSegue([], carta('s', 1, JSON.parse(JSON.stringify(senzaNext)))) === false && mondo._ombraNonSegue([], carta('x', 1)) === false,
  'e non per un gelo normale o per una carta senza abilita-');
const inGiocata = modulo.slice(modulo.indexOf('function ombraGiocata('), modulo.indexOf('function _ombraNonSegue('));
dice(inGiocata.indexOf('_ombraNonSegue(cambi, carta)') >= 0, 'ombraGiocata passa la carta calata');

// ── 4. iniettato ──────────────────────────────────────────────────────────
const guardia = "if (eff.quale === 'next' || eff.quale === 'last') return;";
const gioco = fs.readFileSync(path.join(RADICE, 'play', 'index.html'), 'utf8');
dice(gioco.indexOf(guardia) >= 0 && modulo.indexOf(guardia) >= 0, 'il motore nuovo e- nel gioco e nel server (inietta-motore.js)');

console.log(String.fromCharCode(10) + (male ? male + ' NO' : 'tutto a posto'));
process.exit(male ? 1 : 0);
