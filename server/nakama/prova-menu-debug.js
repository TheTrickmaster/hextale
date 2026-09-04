// BANCO DI PROVA — IL MENU DI DEBUG E' TUTTO COLLEGATO
// Ogni pulsante della finestra deve chiamare una funzione che esiste, e ogni
// getElementById("debug-...") del codice deve trovare il suo elemento. E' il
// controllo che ha fatto saltare fuori i due strumenti rimasti senza pulsante.
//     node server/nakama/prova-menu-debug.js
const fs = require('fs');
const h = fs.readFileSync('C:/Users/masil/Desktop/Hextale/game-assets/play/index.html', 'utf8');
const i = h.indexOf('<div id="debug-modal-overlay"');
const j = h.indexOf('<!-- v0.71.63 NEW', i);
const finestra = h.slice(i, j > 0 ? j : i + 12000);

const grezzi = [...finestra.matchAll(/on(?:click|input|focus)="([^"]+)"/g)]
  .flatMap(m => m[1].split(';'))
  .map(s => (s.trim().match(/^([A-Za-z_$][\w$]*)\s*\(/) || [])[1])
  .filter(Boolean)
  // "if" viene da onclick="if(event.target===this)...", che chiude la finestra
  // cliccando fuori: e' una parola del linguaggio, non un comando da cercare.
  .filter(f => f !== 'if');
const fn = [...new Set(grezzi)];

let ko = 0;
console.log('COMANDI DELLA FINESTRA');
for (const f of fn) {
  const esiste = new RegExp('function\\s+' + f + '\\s*\\(').test(h);
  if (!esiste) ko++;
  console.log('  ' + (esiste ? 'ok   ' : 'MANCA') + ' ' + f);
}

// v0.79.8 — i sette id di "Download latest version" non ci sono piu': quella
// voce e- stata tolta dal menu insieme alle altre tre (Blur test, Show card DB,
// Show asset). Questo banco chiede che markup e codice si corrispondano — con
// gli id vecchi chiedeva che si corrispondessero su qualcosa che non esiste.
const idAttesi = ['debug-music-loop-picker', 'debug-music-loop-select', 'debug-music-loop-lead',
  'debug-music-loop-status', 'debug-card-picker', 'debug-card-search-input', 'debug-card-search-list',
  'debug-grid'];
console.log('ID CHE IL CODICE CERCA');
for (const id of idAttesi) {
  const c1 = finestra.indexOf('id="' + id + '"') >= 0;
  if (!c1) ko++;
  console.log('  ' + (c1 ? 'ok   ' : 'MANCA') + ' ' + id);
}

// E il contrario: ogni id che il codice cerca con getElementById('debug-...')
// deve esistere nella finestra.
const cercati = [...new Set([...h.matchAll(/getElementById\('(debug-[^']+)'\)/g)].map(m => m[1]))];
console.log('E OGNI getElementById(debug-...) DEL CODICE');
for (const id of cercati) {
  const c1 = h.indexOf('id="' + id + '"') >= 0;
  if (!c1) ko++;
  console.log('  ' + (c1 ? 'ok   ' : 'MANCA') + ' ' + id);
}

console.log('\n' + (ko ? 'MANCANO ' + ko + ' COSE' : 'tutto al suo posto'));
process.exit(ko ? 1 : 0);
