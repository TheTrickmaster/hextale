// Mette il motore delle abilita' dentro al gioco e dentro al modulo del
// server, fra due segnalibri. Si rilancia ogni volta che il motore cambia.
//
//   node server/nakama/inietta-motore.js
//
// PERCHE' UN'INIEZIONE E NON DUE COPIE. Le stesse regole devono dare la stessa
// risposta di qua e di la': se divergessero, i due client racconterebbero due
// tabelloni diversi e la partita si fermerebbe da sola (vedi l'impronta, nella
// sezione del server arbitro). Una copia scritta a mano diverge sempre; questa
// si riscrive da sola, e chi tocca il motore lo tocca per tutti e due.
//
// Se i segnalibri non ci sono, li mette la prima volta nei punti giusti.

'use strict';
const fs = require('fs');
const path = require('path');

const QUI = __dirname;
const MOTORE = path.join(QUI, 'abilita-motore.js');
const GIOCO = path.resolve(QUI, '../../play/index.html');
const MODULO = path.join(QUI, 'index.js');

const APRE = '// ─── MOTORE DELLE ABILITA (iniettato, non modificare qui) ───────────────';
const CHIUDE = '// ─── fine del motore delle abilita ──────────────────────────────────────';

function corpo() {
  let t = fs.readFileSync(MOTORE, 'utf8');
  // La riga che serve solo a Node non ha senso negli altri due posti.
  t = t.split("\nif (typeof module !== 'undefined' && module.exports) module.exports = ABILITA_MOTORE;\n").join('\n');
  return APRE + '\n' + t.trim() + '\n' + CHIUDE;
}

function metti(file, ancora, dove) {
  let t = fs.readFileSync(file, 'utf8');
  const i = t.indexOf(APRE);
  if (i >= 0) {
    const j = t.indexOf(CHIUDE);
    if (j < 0) throw new Error(file + ': c\'e\' il segnalibro di apertura ma non quello di chiusura');
    t = t.slice(0, i) + corpo() + t.slice(j + CHIUDE.length);
    fs.writeFileSync(file, t);
    return 'aggiornato';
  }
  // Prima volta: si mette prima dell'ancora.
  const n = t.split(ancora).length - 1;
  if (n !== 1) throw new Error(file + ': l\'ancora "' + ancora.slice(0, 40) + '" compare ' + n + ' volte');
  t = t.split(ancora).join(corpo() + '\n\n' + (dove === 'html' ? '' : '') + ancora);
  fs.writeFileSync(file, t);
  return 'inserito';
}

const esiti = [];
esiti.push('gioco:  ' + metti(GIOCO, 'function entryDaId(id){', 'html'));
esiti.push('server: ' + metti(MODULO, 'function InitModule(ctx, logger, nk, initializer) {', 'js'));
esiti.forEach(e => console.log(e));

// Controllo: le due copie devono essere identiche al sorgente.
const atteso = corpo();
for (const [nome, file] of [['gioco', GIOCO], ['server', MODULO]]) {
  const t = fs.readFileSync(file, 'utf8');
  const i = t.indexOf(APRE), j = t.indexOf(CHIUDE);
  const dentro = t.slice(i, j + CHIUDE.length);
  console.log(nome + ': ' + (dentro === atteso ? 'identico al sorgente' : 'DIVERSO dal sorgente'));
}
