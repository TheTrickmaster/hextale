// Collauda il tabellone in ombra FUORI dal server: si estrae il blocco da
// index.js e lo si fa girare con il motore vero e un catalogo finto.
'use strict';
const fs = require('fs');
const vm = require('vm');

const SRV = fs.readFileSync('C:/Users/masil/Desktop/Hextale/game-assets/server/nakama/index.js', 'utf8');
const i = SRV.indexOf('var OMBRA_DIR');
const j = SRV.indexOf('function partitaInit');
const blocco = SRV.slice(i, j);

const ABILITA_MOTORE = require('C:/Users/masil/Desktop/Hextale/game-assets/server/nakama/abilita-motore.js');

// il catalogo finto, e le briciole di server che il blocco usa
const CATALOGO = { carte: [
  { id: '#A', name: 'Forte',  values: { NW: 9, NE: 9, E: 9, SE: 9, SW: 9, W: 9 }, traitNames: [], abilita: null },
  { id: '#B', name: 'Debole', values: { NW: 1, NE: 1, E: 1, SE: 1, SW: 1, W: 1 }, traitNames: [], abilita: null },
  { id: '#C', name: 'Scudo',  values: { NW: 5, NE: 5, E: 5, SE: 5, SW: 5, W: 5 }, traitNames: [],
    abilita: { unica:false, trigger:'always', frequenza:'every_time', finestra:{tipo:'always'},
               se:null, regola:{nome:'invincible', bersaglio:'self', valore:null},
               legame:null, se2:null, regola2:null, effetto:null, effetto2:null } },
  { id: '#D', name: 'Cresce', values: { NW: 4, NE: 4, E: 4, SE: 4, SW: 4, W: 4 }, traitNames: [],
    abilita: { unica:false, trigger:'on_play', frequenza:'once_per_game', finestra:{tipo:'always'},
               se:null, regola:null, legame:null, se2:null, regola2:null, effetto2:null,
               effetto:{azione:'buff', scelta:false, chi:'self', dove:null, cosa:'power', quale:null,
                        ambito:'ALL', quanto:{numero:3}, per:'', durata:'permanent'} } },
]};

const ctx = {
  ABILITA_MOTORE,
  KEY_CATALOGO: 'catalogo',
  leggiSistema: () => CATALOGO,
  _caselle: () => { const out = []; for (let q=-2;q<=2;q++) for (let r=-2;r<=2;r++) if (Math.abs(q+r)<=2) out.push(q+','+r); return out; },
  Math, Object, String, Number, JSON, console,
};
vm.createContext(ctx);
vm.runInContext(blocco, ctx);

const logger = { warn: (...a) => ctx._avvisi.push(a.join(' ')), info: () => {} };
ctx._avvisi = [];

function statoFinto(mazzo1, mazzo2) {
  return {
    giocatori: ['u1', 'u2'],
    mazzoIniziale: { u1: mazzo1, u2: mazzo2 },
    numeroTurno: 1, matchId: 'prova',
    ombra: { pronta: false, carte: {}, celle: {}, confronti: 0, divergenze: 0, primaDivergenza: null }
  };
}

const esiti = [];
const nota = (n, ok, m) => esiti.push((ok ? 'OK   ' : 'FAIL ') + n + ' -> ' + m);

// ── 1. il catalogo si prepara solo con le carte dei due mazzi ─────────────
let s = statoFinto(['#A', '#B'], ['#C', '#D']);
ctx.ombraPrepara({ matchId: 'prova' }, null, logger, s);
nota('prepara solo le carte dei due mazzi',
  Object.keys(s.ombra.carte).sort().join() === '#A,#B,#C,#D', Object.keys(s.ombra.carte).sort().join());

// ── 2. una conquista semplice ────────────────────────────────────────────
s = statoFinto(['#A'], ['#B']);
ctx.ombraPrepara({ matchId: 'prova' }, null, logger, s);
ctx.ombraGiocata(s, logger, '0,0', '#B', 2);      // il debole si cala per primo
ctx.ombraGiocata(s, logger, '1,0', '#A', 1);      // il forte gli si mette accanto
nota('il forte conquista il debole', s.ombra.celle['0,0'].di === 1,
  'proprietario di 0,0: ' + s.ombra.celle['0,0'].di);
nota('  e l impronta ha la forma dei client', ctx.ombraImpronta(s) === '0,0:#B:1|1,0:#A:1',
  ctx.ombraImpronta(s));

// ── 3. una regola del foglio: l invincibile non si prende ─────────────────
s = statoFinto(['#A'], ['#C']);
ctx.ombraPrepara({ matchId: 'prova' }, null, logger, s);
ctx.ombraGiocata(s, logger, '0,0', '#C', 2);
ctx.ombraGiocata(s, logger, '1,0', '#A', 1);
nota('la regola invincible del foglio vale anche sul server', s.ombra.celle['0,0'].di === 2,
  'proprietario di 0,0: ' + s.ombra.celle['0,0'].di);

// ── 4. un effetto al piazzamento cambia l esito ───────────────────────────
// #D vale 4 e cresce di 3 al piazzamento: 7 contro il 5 dello scudo. Senza
// l'effetto perderebbe, con l'effetto vince — se lo scudo non fosse invincibile.
s = statoFinto(['#D'], ['#B']);
ctx.ombraPrepara({ matchId: 'prova' }, null, logger, s);
ctx.ombraGiocata(s, logger, '0,0', '#B', 2);
ctx.ombraGiocata(s, logger, '1,0', '#D', 1);
const cresciuta = s.ombra.celle['1,0'].carta.values.W;
nota('gli effetti al piazzamento entrano nei valori del server', cresciuta === 7, 'W = ' + cresciuta);

// ── 5. il confronto non ferma niente, prende nota ─────────────────────────
s = statoFinto(['#A'], ['#B']);
ctx.ombraPrepara({ matchId: 'prova' }, null, logger, s);
ctx.ombraGiocata(s, logger, '0,0', '#B', 2);
ctx.ombraConfronta(s, logger, '1', ctx.ombraImpronta(s));
nota('quando concorda non segna divergenze', s.ombra.divergenze === 0 && s.ombra.confronti === 1,
  s.ombra.confronti + ' confronti, ' + s.ombra.divergenze + ' divergenze');
ctx.ombraConfronta(s, logger, '2', 'UN-ALTRA-COSA');
nota('quando diverge prende nota e non ferma niente',
  s.ombra.divergenze === 1 && s.ombra.pronta === true && !!s.ombra.primaDivergenza,
  'divergenze=' + s.ombra.divergenze + ', ombra ancora accesa=' + s.ombra.pronta);

// ── 6. una carta che il catalogo non ha spegne l ombra, non la partita ────
s = statoFinto(['#A'], ['#B']);
ctx.ombraPrepara({ matchId: 'prova' }, null, logger, s);
ctx.ombraGiocata(s, logger, '0,0', '#SCONOSCIUTA', 1);
nota('una carta sconosciuta spegne l ombra invece di sbagliare in silenzio',
  s.ombra.pronta === false, 'ombra spenta, avvisi: ' + ctx._avvisi.length);
ctx.ombraConfronta(s, logger, '3', 'qualunque');
nota('  e da spenta non confronta piu', s.ombra.confronti === 0, 'confronti: ' + s.ombra.confronti);

esiti.forEach(x => console.log(x));
const verdi = esiti.filter(x => x.indexOf('OK') === 0).length;
console.log('\nRIEPILOGO: ' + verdi + '/' + esiti.length + ' verdi');
process.exit(verdi === esiti.length ? 0 : 1);
