// UNA CARTA TRASFORMATA IN MANO SI GIOCA ANCHE IN RETE — SUL SERVER.
//
//     node strumenti/prova-trasformate-server.js [percorso/index.js]
//
// Segnalazione di Lorenzo (11 settembre 2026): in partita online uno Strigoi
// diventato Dark Strigoi in mano non si poteva giocare. Il server rispondeva
// "quella carta non e' nella tua mano" — la mano la conosce per id di catalogo,
// cioe' come l'ha distribuita, e per lui quella carta era ancora uno Strigoi —
// e allo scadere del tempo la giocava d'ufficio: la partita si fermava.
//
// Da v0.79.99 il client chiede la carta col nome che ha nel MAZZO e dice in
// piu' la FORMA in cui scende. Qui si controlla che il server:
//   - accetti la giocata col nome del mazzo e la forma trasformata;
//   - rimbalzi la forma a tutti e due, perche' l'altro client la ricostruisca;
//   - rifiuti una forma che non e' una trasformazione di quella carta;
//   - resti com'era per un client di prima, che la forma non la manda.
//
// Come prova-rifiuto-server: index.js in un contesto finto, senza Nakama.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DOVE = process.argv[2] || path.join(__dirname, '..', 'server', 'nakama', 'index.js');
console.log('provo ' + DOVE + String.fromCharCode(10));
const mondo = { console, Date, Math, JSON, parseInt, parseFloat, isFinite, String, Object, Array, Error, Number };
mondo.global = mondo;
vm.createContext(mondo);
new vm.Script(fs.readFileSync(DOVE, 'utf8')).runInContext(mondo);

let male = 0;
const dice = (ok, che, perche) => {
  if (!ok) male++;
  console.log((ok ? '  ok   ' : '  NO   ') + che);
  if (perche !== undefined) console.log('        ' + perche);
};

// Un catalogo scritto a mano: la stessa riga dello Strigoi del foglio
// ("always, from turn 8, transform self card #174") e una per nome.
const valori = { NW: 3, NE: 3, E: 3, SE: 3, SW: 3, W: 3 };
const trasforma = (sigla, trigger) => ({
  trigger: trigger || 'always', frequenza: 'once_per_game', finestra: { tipo: 'from_turn', valore: 8 },
  effetto: { azione: 'transform', chi: 'self', cosa: 'card', quanto: { carta: sigla } }, legame: null, effetto2: null
});
const CATALOGO = { versione: 'prova', carte: [
  { id: 'final-strigoi', numero: 60, name: 'Strigoi', values: valori, abilita: trasforma('#174') },
  { id: 'final-dark-strigoi', numero: 174, name: 'Dark Strigoi', values: valori, abilita: null },
  { id: 'final-frog-prince', numero: 20, name: 'Frog Prince', values: valori, abilita: trasforma('Green Prince', 'on_play') },
  { id: 'final-green-prince', numero: 175, name: 'Green Prince', values: valori, abilita: null },
  { id: 'final-fox', numero: 5, name: 'Fox', values: valori, abilita: null }
]};

// ── 1. LA LETTURA DEL FOGLIO ────────────────────────────────────────────
dice(mondo._formaDellaCarta(CATALOGO, 'final-strigoi', 'final-dark-strigoi') === true,
  'Strigoi -> Dark Strigoi e- una trasformazione (bersaglio per numero, #174)');
dice(mondo._formaDellaCarta(CATALOGO, 'final-frog-prince', 'final-green-prince') === true,
  'Frog Prince -> Green Prince e- una trasformazione (bersaglio per nome)');
dice(mondo._formaDellaCarta(CATALOGO, 'final-strigoi', 'final-fox') === false,
  'Strigoi -> Fox no: non e- scritto da nessuna parte');
dice(mondo._formaDellaCarta(CATALOGO, 'final-fox', 'final-dark-strigoi') === false,
  'una carta senza abilita- non si trasforma in niente');
dice(mondo._formaDellaCarta(null, 'final-strigoi', 'final-dark-strigoi') === false,
  'senza catalogo si dice di no, senza piantarsi');

// E col catalogo vero, se c'e' (l'importazione lo lascia in .lavoro).
const VERO = path.join(__dirname, '..', 'server', 'importazione', '.lavoro', 'catalogo.json');
if (fs.existsSync(VERO)) {
  const cat = JSON.parse(fs.readFileSync(VERO, 'utf8'));
  dice(mondo._formaDellaCarta(cat, 'final-strigoi', 'final-dark-strigoi') === true,
    'col catalogo vero: Strigoi -> Dark Strigoi');
} else {
  console.log('  --   catalogo vero assente (' + VERO + '): salto quella riga');
}

// ── 2. LA GIOCATA ───────────────────────────────────────────────────────
const tavolo = (manoA) => ({
  giocatori: ['A', 'B'],
  presenze: { A: { userId: 'A' }, B: { userId: 'B' } },
  iniziata: true, finita: false, natoIl: Date.now(),
  turno: 0, numeroTurno: 9, scadenza: Date.now() + 60000,
  mano: { A: manoA.slice(), B: ['final-fox'] },
  mazzo: { A: [], B: [] },
  mazzoIniziale: { A: manoA.slice(), B: ['final-fox'] },
  buchi: [], occupate: {}, turniGiocati: {}, rapporti: {},
  ultimaGiocataDi: -1, concordato: null,
  ombra: { pronta: false, carte: {}, celle: {}, confronti: 0, divergenze: 0, primaDivergenza: null }
});
const giro = (stato, corpo) => {
  const messaggi = [];
  const nk = {
    storageRead: () => [{ value: CATALOGO }],
    binaryToString: (s) => s
  };
  const dispatcher = {
    broadcastMessage: (op, data, presenze) =>
      messaggi.push({ op, dati: JSON.parse(data), a: presenze ? presenze.map(p => p.userId) : 'tutti' })
  };
  const logger = { info() {}, warn() {}, error() {}, debug() {} };
  mondo.partitaLoop({ matchId: 'm1' }, logger, nk, dispatcher, 1, stato,
    [{ sender: { userId: 'A' }, opCode: mondo.OP_GIOCA, data: JSON.stringify(corpo) }]);
  return messaggi;
};
const giocata = (ms) => ms.find(m => m.op === mondo.OP_GIOCATA);
const rifiuto = (ms) => ms.find(m => m.op === mondo.OP_RIFIUTO);

let s = tavolo(['final-strigoi', 'final-fox']);
let ms = giro(s, { carta: 'final-strigoi', forma: 'final-dark-strigoi', q: 0, r: 0 });
dice(!rifiuto(ms) && !!giocata(ms), 'lo Strigoi trasformato si gioca col nome del mazzo',
  JSON.stringify(rifiuto(ms) || ''));
dice(giocata(ms) && giocata(ms).dati.forma === 'final-dark-strigoi' && giocata(ms).dati.carta === 'final-strigoi',
  'e la forma arriva a tutti e due insieme al nome', giocata(ms) && JSON.stringify(giocata(ms).dati));
dice(s.mano.A.indexOf('final-strigoi') === -1 && s.mano.A.length === 1,
  'dalla mano del server esce lo Strigoi', JSON.stringify(s.mano.A));

// Il difetto di prima, com'era: il nome NUOVO non e' nella mano.
s = tavolo(['final-strigoi', 'final-fox']);
ms = giro(s, { carta: 'final-dark-strigoi', q: 0, r: 0 });
dice(!!rifiuto(ms) && !giocata(ms), 'col nome nuovo resta "non e- nella tua mano" (e- per questo che il client manda quello del mazzo)');

// Una forma inventata.
s = tavolo(['final-strigoi', 'final-fox']);
ms = giro(s, { carta: 'final-strigoi', forma: 'final-fox', q: 0, r: 0 });
dice(!!rifiuto(ms) && !giocata(ms) && s.mano.A.length === 2,
  'una forma che non e- una trasformazione della carta viene rifiutata, e la mano non cambia',
  rifiuto(ms) && rifiuto(ms).dati.perche);

// La forma uguale al nome: la carta non si e' trasformata.
s = tavolo(['final-fox']);
ms = giro(s, { carta: 'final-fox', forma: 'final-fox', q: 0, r: 0 });
dice(!rifiuto(ms) && giocata(ms) && giocata(ms).dati.forma === 'final-fox',
  'una carta mai trasformata porta la forma uguale al nome');

// Un client di prima non la manda.
s = tavolo(['final-fox']);
ms = giro(s, { carta: 'final-fox', q: 0, r: 0 });
dice(!rifiuto(ms) && giocata(ms) && giocata(ms).dati.forma === null,
  'un client di prima gioca come sempre, e la forma rimbalza nulla', giocata(ms) && JSON.stringify(giocata(ms).dati.forma));

console.log(String.fromCharCode(10) + (male ? male + ' controlli NON passano' : 'tutto a posto'));
process.exit(male ? 1 : 0);
