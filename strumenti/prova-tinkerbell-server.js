// TINKER BELL, "Jealous Spark", SENZA IL GIOCO (v0.80.30).
//
//     node strumenti/prova-tinkerbell-server.js
//
// Lorenzo: "Nella colonna del foglio What ho aggiunto l'opzione buff ... Tinkerbell
// ruba buff alleati o avversari. Insegna ad interpretare questa nuova abilita' a
// client e server". Qui la parte che non ha bisogno del gioco:
//   1. il parser accetta What = buff, legge la riga di Tinker Bell, e ferma "buff"
//      con un'azione che non sia steal;
//   2. il motore: col furto di un buff offre solo le carte che la scena dice avere
//      un buff (haBuffRubabile), con la scelta e senza; senza la domanda (il
//      server) l'elenco resta com'e';
//   3. il server: l'ombra non segue un buff rubato e si spegne;
//   4. il motore nuovo e' iniettato nel gioco e nel server, e il vocabolario lo dice.
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
dice(P.VOCE.What.indexOf('buff') >= 0, 'What accetta "buff"');
const intestazione = ['Name'].concat(P.COLONNE);
const riga = (valori) => intestazione.map(c => (c in valori ? valori[c] : '-'));
const leggi = P.lettoreDi(intestazione);
const TINKER = {
  Name: 'Tinker Bell', 'Is unique': 'No', Trigger: 'on_play', Frequency: 'once_per_game', Window: 'always',
  'Player selection': 'yes', Action: 'steal', Who: 'opponent', Which: 'single', Where: 'board', What: 'buff',
  Duration: 'permanent', Link: '-', 'Player selection 2': 'no'
};
const ab = P.abilitaDaRiga('Tinker Bell', leggi(riga(TINKER)));
const e = ab && ab.effetto;
dice(e && e.azione === 'steal' && e.cosa === 'buff' && e.chi === 'opponent' && e.quale === 'single' && e.dove === 'board' && e.scelta === true,
  'la riga di Tinker Bell: steal, opponent, single, board, buff, scelta del giocatore', JSON.stringify(e));
let fermo = '';
try { P.abilitaDaRiga('Prova', leggi(riga(Object.assign({}, TINKER, { Action: 'buff', Scope: 'ALL', Amount: '1' })))); } catch (err) { fermo = err.message; }
dice(/"buff" per ora vale solo con Action = steal/.test(fermo), 'What = buff con un-altra azione si ferma, e dice perche-', fermo);

// ── 2. il motore ──────────────────────────────────────────────────────────
const carta = (id, owner, buff) => ({ id: id, name: id, owner: owner, values: { NW: 1, NE: 1, E: 1, SE: 1, SW: 1, W: 1 }, conBuff: !!buff });
const tinker = Object.assign(carta('tinker', 1), { abilita: ab });
const nemicaConBuff = carta('nemica-con-buff', 2, true);
const nemicaSenza = carta('nemica-senza', 2, false);
const amicaConBuff = carta('amica-con-buff', 1, true);
const inCampo = [tinker, nemicaConBuff, nemicaSenza, amicaConBuff];
const scena = { inCampo: inCampo, vicini: () => inCampo.filter(c => c !== tinker), haBuffRubabile: (c) => !!c.conBuff, turno: 1, seme: 'prova' };
let cambi = M.cambiamentiAllEvento(tinker, 'on_play', scena);
let furto = cambi.filter(c => c.azione === 'steal' && c.cosa === 'buff')[0];
dice(furto && furto.candidati && furto.candidati.map(c => c.id).join() === 'nemica-con-buff', 'con la scelta: si offrono solo le avversarie che hanno un buff', JSON.stringify(cambi.map(c => ({ az: c.azione, cosa: c.cosa, cand: (c.candidati || []).map(x => x.id) }))));
// Una Tinker Bell nuova per ogni chiamata: l'abilita' e' once_per_game, e il
// motore giustamente non la fa scattare due volte alla stessa carta.
const nuovaTinker = (id) => Object.assign(carta(id, 1), { abilita: JSON.parse(JSON.stringify(ab)) });
const scenaServer = Object.assign({}, scena); delete scenaServer.haBuffRubabile;
cambi = M.cambiamentiAllEvento(nuovaTinker('tinker-server'), 'on_play', scenaServer);
furto = cambi.filter(c => c.azione === 'steal' && c.cosa === 'buff')[0];
dice(furto && furto.candidati.map(c => c.id).sort().join() === 'nemica-con-buff,nemica-senza', 'senza la domanda (il server) l-elenco resta tutte le avversarie', furto && furto.candidati.map(c => c.id).join());
const senzaScelta = JSON.parse(JSON.stringify(ab)); senzaScelta.effetto.scelta = false;
const tinkerAuto = Object.assign(carta('tinker-auto', 1), { abilita: senzaScelta });
const scenaAuto = Object.assign({}, scena, { inCampo: [tinkerAuto, nemicaSenza, nemicaConBuff, amicaConBuff] });
cambi = M.cambiamentiAllEvento(tinkerAuto, 'on_play', scenaAuto);
furto = cambi.filter(c => c.azione === 'steal' && c.cosa === 'buff')[0];
dice(furto && furto.carta && furto.carta.id === 'nemica-con-buff' && furto.fonte === tinkerAuto, 'senza scelta: il bersaglio e- una carta con un buff (anche se non e- la prima in campo)', furto && furto.carta && furto.carta.id);
const scenaVuota = Object.assign({}, scena, { haBuffRubabile: () => false });
cambi = M.cambiamentiAllEvento(nuovaTinker('tinker-vuota'), 'on_play', scenaVuota);
dice(!cambi.some(c => c.azione === 'steal'), 'se nessuno ha un buff da prendere non esce nessun furto');

// ── 3. il server ──────────────────────────────────────────────────────────
const mondo = { console, Date, Math, JSON, parseInt, parseFloat, isFinite, String, Object, Array, Error, Number, RegExp };
mondo.global = mondo;
vm.createContext(mondo);
const modulo = fs.readFileSync(path.join(RADICE, 'server', 'nakama', 'index.js'), 'utf8');
new vm.Script(modulo).runInContext(mondo);
dice(mondo._ombraNonSegue([{ azione: 'buff', lati: ['NW'] }, { azione: 'steal', cosa: 'buff', carta: {} }]) === true
  && mondo._ombraNonSegue([{ azione: 'buff', lati: ['NW'], delta: 1 }]) === false, 'l-ombra riconosce un buff rubato (e solo quello)');
const inGiocata = modulo.slice(modulo.indexOf('function ombraGiocata('), modulo.indexOf('function _ombraNonSegue('));
dice(/_ombraNonSegue\(cambi, carta\)[\s\S]*ombraRinuncia/.test(inGiocata) && inGiocata.indexOf('_ombraNonSegue(cambi, carta)') < inGiocata.indexOf('ombraApplica(cambi)'),
  'e ombraGiocata si spegne prima di applicare');
const logger = { info() {}, warn(f, a) { spenta = String(a); }, error() {}, debug() {} };
let spenta = '';
const state = { ombra: { pronta: true } };
mondo.ombraRinuncia(state, logger, 'furto di un buff: prova');
dice(state.ombra.pronta === false && /furto di un buff/.test(spenta), 'spegnendosi lo scrive nel registro', spenta);

// ── 4. iniettato e documentato ────────────────────────────────────────────
const gioco = fs.readFileSync(path.join(RADICE, 'play', 'index.html'), 'utf8');
dice(gioco.indexOf('scena.haBuffRubabile') >= 0 && modulo.indexOf('scena.haBuffRubabile') >= 0, 'il motore nuovo e- nel gioco e nel server (inietta-motore.js)');
dice(/`buff`/.test(fs.readFileSync(path.join(RADICE, 'server', 'importazione', 'vocabolario-abilita.md'), 'utf8')), 'il vocabolario documenta What = buff');

console.log(String.fromCharCode(10) + (male ? male + ' NO' : 'tutto a posto'));
process.exit(male ? 1 : 0);
