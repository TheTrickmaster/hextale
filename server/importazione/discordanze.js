// ══════════════════════════════════════════════════════════════════════════
// FOGLIO CONTRO CODICE: dove le due fonti non dicono la stessa cosa.
// ══════════════════════════════════════════════════════════════════════════
//   node server/importazione/discordanze.js
//
// Le abilita' vivono in due posti: le colonne del foglio e il codice scritto a
// mano. Finche' e' cosi', prima o poi divergono — ed e' gia' successo (il
// Leone Codardo). Questo confronto serve ad accorgersene PRIMA di spostare una
// carta sul motore, invece che dopo, giocando.
//
// Il "cosa fa il codice" non si legge: si ricava da DOVE sta la sigla. Le
// tabelle di smistamento dicono gia' il momento (piazzamento, conquista) e se
// l'abilita' ferma la partita per chiedere un bersaglio.
'use strict';
const fs = require('fs'), https = require('https');
const P = require('./abilita-parser.js');
const HTML = fs.readFileSync('C:/Users/masil/Desktop/Hextale/game-assets/play/index.html', 'utf8');

function g(u) {
  return new Promise((ok, ko) => {
    https.get(u, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return g(r.headers.location).then(ok, ko);
      let d = ''; r.setEncoding('utf8'); r.on('data', c => d += c); r.on('end', () => ok(d));
    }).on('error', ko);
  });
}
function csv(s) {
  const R = []; let c = [], v = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { v += '"'; i++; } else q = false; } else v += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { c.push(v); v = ''; }
    else if (ch === '\n') { c.push(v); R.push(c); c = []; v = ''; }
    else if (ch !== '\r') v += ch;
  }
  if (v !== '' || c.length) { c.push(v); R.push(c); }
  return R;
}

const TABELLE = [
  ['EFFETTI_PIAZZAMENTO', 'on_play', false],
  ['EFFETTI_PIAZZAMENTO_REALI', 'on_play', false],
  ['TRASFORMAZIONI_AL_PIAZZAMENTO', 'on_play', false],
  ['SCELTE_PIAZZAMENTO', 'on_play', true],
  ['SCELTE_DOPO_CONQUISTA', 'on_conquer', true],
  ['EFFETTI_DOPO_SCONTRO', 'on_conquer', false],
];
function chiaviDi(nome) {
  const i = HTML.indexOf('const ' + nome + ' = {'); if (i < 0) return [];
  const j = HTML.indexOf('\nconst ', i + 10);
  const b = HTML.slice(i, j > 0 ? j : i + 40000);
  const out = new Set(); const re = /^  ([a-z_0-9]+):/gm; let m;
  while ((m = re.exec(b))) out.add(m[1]);
  return [...out];
}
const dove = {};
for (const [nome, momento, chiede] of TABELLE) {
  for (const k of chiaviDi(nome)) (dove[k] = dove[k] || []).push({ tabella: nome, momento, chiede });
}
const registro = {};
{ const re = /^\s+([a-z_0-9]+):\s*\{\s*carta:'([^']+)'/gm; let m; while ((m = re.exec(HTML))) registro[m[1]] = m[2]; }
const siglaDi = {}; for (const s in registro) siglaDi[registro[s].toLowerCase()] = s;
const usata = s => (HTML.split(s).length - 1) > 2;

// Le carte gia' passate al PONTE (foglioFa): la decisione la prende il foglio e
// l'esecuzione resta al codice animato. La sigla non compare piu' in nessuna
// tabella, quindi il conteggio qui sopra non le vedrebbe.
const SUL_PONTE = ['Alice', 'Pinocchio', 'Phoenix'];

// La stessa regola di _effettoSemplice nel gioco: cosa il MOTORE sa eseguire.
function semplice(e) {
  if (!e) return true;
  if (e.azione === 'freeze' && e.cosa === 'card' && e.quale !== 'selected') return true;
  if (['buff', 'debuff', 'set'].indexOf(e.azione) < 0) return false;
  if (e.cosa && e.cosa !== 'power') return false;
  if (e.dove === 'drawn' || e.dove === 'deck') return false;
  if (['next', 'last', 'selected'].indexOf(e.quale) >= 0) return false;
  return true;
}
const AGGANCIATI = ['on_play', 'on_conquer', 'on_conquered', 'end_of_turn', 'start_of_turn'];
function loFaIlMotore(a) {
  if (!a || a.unica) return false;
  if (a.regola) return true;                       // le regole le legge sempre
  if (a.trigger === 'while_on_board') return true;  // sinergie continue
  if (AGGANCIATI.indexOf(a.trigger) < 0) return false;
  if (!a.effetto) return false;
  return semplice(a.effetto) && semplice(a.effetto2);
}
function riassunto(a) {
  const e = [a.effetto, a.effetto2].filter(Boolean)
    .map(x => [x.azione, x.chi, x.dove, x.cosa, x.quale, x.ambito, x.scelta ? 'SCELTA-GIOCATORE' : ''].filter(v => v && v !== '-').join(' ')).join(' | ');
  return a.trigger + ', ' + a.frequenza + (e ? ', ' + e : '')
    + (a.regola ? ', REGOLA ' + a.regola.nome + ' ' + a.regola.bersaglio + ' ' + (a.regola.valore || '') : '');
}

const URL = 'https://docs.google.com/spreadsheets/d/17atpUlgmzHMZibOMDKEMyr9LxN8o0aK18Gg-Q1Ziko4/export?format=csv&gid=0&t=' + Date.now();
g(URL).then(t => {
  const R = csv(t), H = R[0];
  let posto; try { posto = P.posizioni(H); } catch (e) { console.log('ERRORE: ' + e.message); process.exit(1); }
  const D = { guaste: [], muta: [], momento: [], scelta: [], doppia: [], testo: [] };
  // Il testo che il gioco MOSTRA al giocatore sta nel registro, non nel foglio.
  // Se racconta un momento diverso da quello delle colonne, chi gioca legge una
  // cosa e ne subisce un'altra: e' la discordanza che si nota per prima.
  const descRegistro = {};
  { const re = /^s+([a-z_0-9]+):s*{s*carta:'([^']+)',[^}]*?desc:s*['"](.*?)['"]s*}/gm; let m;
    while ((m = re.exec(HTML))) descRegistro[m[2].toLowerCase()] = m[3]; }
  const MOMENTO_NEL_TESTO = [
    [/when *?played*?/i, 'on_play'],
    [/if *?played*?/i, 'on_play'],
    [/after *?conquering*?/i, 'on_conquer'],
    [/if *?conquered*?/i, 'on_conquered'],
    [/if *?flipped*?/i, 'on_conquered'],
  ];
  const bene = [];
  for (let i = 1; i < R.length; i++) {
    const r = R[i], nome = (r[5] || '').trim(); if (!nome) continue;
    const leggi = c => { const j = posto[c]; return j === undefined ? '' : (r[j] || ''); };
    let a = null;
    try { a = P.abilitaDaRiga(nome, leggi); } catch (e) { D.guaste.push([nome, e.message]); continue; }
    if (!a) continue;
    if (a.unica) { bene.push([nome, 'UNIQUE — scritta a mano apposta']); continue; }
    const sigla = siglaDi[nome.toLowerCase()] || null;
    const sulPonte = SUL_PONTE.indexOf(nome) >= 0;
    const eseguita = sulPonte || !!(sigla && usata(sigla));
    const posti = (eseguita && dove[sigla]) || [];
    const motore = loFaIlMotore(a);

    if (!motore && !eseguita) { D.muta.push([nome, riassunto(a)]); continue; }
    if (!posti.length) {
      // Eseguita da una funzione sua, fuori dalle tabelle di smistamento: qui
      // il momento non si ricava da solo e va guardato a mano.
      bene.push([nome, riassunto(a) + (motore ? '  → la fa il MOTORE' : (sulPonte ? '  → sul PONTE: decide il foglio, esegue il codice animato' : '  → codice suo (' + sigla + '), momento da guardare a mano'))]);
      continue;
    }

    let segnalata = false;
    const chiedeCodice = posti.some(p => p.chiede);
    // v0.77.67 — chi sceglie lo dice la colonna sua, non piu' "Which".
    const chiedeFoglio = [a.effetto, a.effetto2].some(e => e && e.scelta);
    if (chiedeCodice !== chiedeFoglio) {
      D.scelta.push([nome, chiedeCodice
        ? 'il CODICE fa scegliere col mirino — il FOGLIO dice Player selection = no'
        : 'il FOGLIO dice Player selection = yes — il CODICE decide da solo']);
      segnalata = true;
    }
    const momenti = [...new Set(posti.map(p => p.momento))];
    if (momenti.indexOf(a.trigger) < 0) {
      // Una sinergia continua che ha ANCHE un aggancio al piazzamento e'
      // voluta: serve ad avere il bonus gia' addosso quando si risolve lo
      // scontro. Non e' una discordanza.
      if (a.trigger === 'while_on_board' && momenti.length === 1 && momenti[0] === 'on_play') {
        // voluto
      } else if (motore) {
        D.doppia.push([nome, 'il FOGLIO dice ' + a.trigger + ' e il motore la sa fare; la vecchia funzione e\' ancora in '
          + posti.map(p => p.tabella).join(', ') + ' (' + momenti.join('/') + ') — codice morto']);
        segnalata = true;
      } else {
        D.momento.push([nome, 'il FOGLIO dice ' + a.trigger + '; il CODICE la esegue a ' + momenti.join('/')
          + ' (' + posti.map(p => p.tabella).join(', ') + ')']);
        segnalata = true;
      }
    }
    if (!segnalata) bene.push([nome, riassunto(a) + '  [' + posti.map(p => p.tabella).join(',') + ']']);
    const testo = descRegistro[nome.toLowerCase()];
    if (testo) {
      for (const [re2, momento] of MOMENTO_NEL_TESTO) {
        if (re2.test(testo) && momento !== a.trigger) {
          D.testo.push([nome, 'il TESTO mostrato dice "' + testo.slice(0, 70) + '" (' + momento + '); il foglio dice ' + a.trigger]);
          break;
        }
      }
    }
  }
  const stampa = (titolo, elenco) => {
    if (!elenco.length) return;
    console.log('\n── ' + titolo + ' (' + elenco.length + ')');
    elenco.forEach(([n, d]) => console.log('   ' + n.padEnd(24) + d));
  };
  const tot = D.guaste.length + D.muta.length + D.momento.length + D.scelta.length + D.doppia.length + D.testo.length;
  console.log('════ DISCORDANZE: ' + tot + ' ════');
  stampa('RIGA GUASTA — non si legge', D.guaste);
  stampa('MUTA — il foglio la descrive, ma non la esegue nessuno', D.muta);
  stampa('MOMENTO — foglio e codice scattano in istanti diversi', D.momento);
  stampa('SCELTA — uno chiede al giocatore, laltro no', D.scelta);
  stampa('TESTO — la descrizione mostrata al giocatore racconta un altro momento', D.testo);
  stampa('CODICE MORTO — la fa il motore, ma la vecchia funzione e ancora agganciata', D.doppia);
  console.log('\n════ CONCORDI (' + bene.length + ') ════');
  bene.forEach(([n, d]) => console.log('   ' + n.padEnd(24) + d));
  process.exit(0);
});
