// BANCO DI PROVA — CIO' CHE DEVE PARTIRE, PARTE DA UNA PORTA CHE SI APRE
//
// Il contatore dei giocatori non ha mostrato un numero per sei versioni. Il
// codice era giusto: era il GANCIO a essere sbagliato. L'avvio era appeso a
// `aggiornaDatiMenu`, una funzione rimasta da una versione precedente del menu
// che NON LA CHIAMA PIU' NESSUNO — compariva una volta sola in tutto il file,
// li' dove era definita.
//
// E' l'errore che non lascia traccia: non fallisce, non scrive niente in
// console, non rompe niente. Semplicemente non accade. Da fuori si vede solo
// una cosa che manca, e da dentro il codice sembra a posto — ed e' per questo
// che ci sono volute sei versioni e un uomo arrabbiato per trovarlo.
//
//     node server/nakama/prova-ganci.js
//
// Questo banco chiede due cose per ogni avvio che conta:
//   1) e' agganciato alla porta giusta?
//   2) quella porta la apre qualcuno?
// La seconda e' quella che mancava.
const fs = require('fs');
const path = require('path');

const F = path.join(__dirname, '..', '..', 'play', 'index.html');
const gioco = fs.readFileSync(F, 'utf8');

// Quante volte un nome compare come CHIAMATA, cioe' seguito da una parentesi,
// senza contare la riga in cui la funzione viene dichiarata.
function chiamate(nome) {
  const re = new RegExp('(^|[^.\\w$])' + nome + '\\s*\\(', 'g');
  let quante = 0, m;
  while ((m = re.exec(gioco)) !== null) {
    // La riga della dichiarazione non e' una chiamata.
    const inizio = gioco.lastIndexOf('\n', m.index) + 1;
    const riga = gioco.slice(inizio, gioco.indexOf('\n', m.index));
    if (/^\s*(async\s+)?function\s/.test(riga)) continue;
    quante++;
  }
  return quante;
}
// Il corpo di una funzione, per vedere cosa chiama.
function corpo(nome) {
  const re = new RegExp('^(async\\s+)?function\\s+' + nome + '\\b', 'm');
  const m = re.exec(gioco);
  if (!m) return null;
  const righe = gioco.slice(m.index).split('\n');
  const out = [];
  for (const r of righe) { out.push(r); if (r === '}') break; }
  return out.join('\n');
}

// Le porte: funzioni a cui si appendono degli avvii. Una porta che nessuno
// apre non e' una porta.
const PORTE = ['apriMenuPrincipale'];
// Cosa deve partire, e da quale porta.
const AVVII = [
  { cosa: 'avviaContatoreOnline', porta: 'apriMenuPrincipale',
    perche: 'il battito che dice al server "ci sono" e chiede quanti siamo' },
  { cosa: 'sorvegliaLaVersione', porta: 'apriMenuPrincipale',
    perche: "l'avviso di versione vecchia, che deve poter comparire da dentro" },
  { cosa: 'aggiornaPallinoNovita', porta: 'apriMenuPrincipale',
    perche: 'il pallino delle carte ancora da guardare' },
];

let ko = 0;
console.log('LE PORTE, E CHI LE APRE\n');
for (const p of PORTE) {
  const n = chiamate(p);
  const buono = n > 0;
  if (!buono) ko++;
  console.log('  ' + (buono ? 'ok    ' : 'ROTTA ') + p.padEnd(24) + n + ' chiamate');
  if (!buono) console.log('        Nessuno la chiama: tutto cio- che ci e- appeso non parte,\n' +
    '        e non lo dice nessuno. E- il difetto della v0.78.16.');
}

console.log('\nE CIO- CHE CI STA APPESO\n');
for (const a of AVVII) {
  const c = corpo(a.porta);
  const dentro = !!(c && new RegExp('(^|[^.\\w$])' + a.cosa + '\\s*\\(').test(c));
  const esiste = chiamate(a.cosa) > 0 || dentro;
  const buono = dentro && esiste;
  if (!buono) ko++;
  console.log('  ' + (buono ? 'ok    ' : 'ROTTA ') + a.cosa.padEnd(24) + 'da ' + a.porta);
  if (!buono) console.log('        ' + a.perche + '\n        Non e- agganciato alla porta: non partira- mai.');
}

// E la funzione morta resta morta: se un domani qualcuno la richiama, va
// riletto il cartello che ha addosso invece di appenderci roba nuova.
console.log('');
const morte = chiamate('aggiornaDatiMenu');
if (morte > 0) {
  console.log('  --    aggiornaDatiMenu ha ' + morte + ' chiamate: non e- piu- morta.');
  console.log('        Va bene, ma allora si tolga il cartello che ha addosso.');
} else {
  console.log('  ok    aggiornaDatiMenu e- ancora senza chiamanti, e col suo cartello');
}

console.log('\n' + (ko ? 'FALLITO: ' + ko : 'OK: cio- che deve partire e- appeso a una porta che si apre'));
process.exit(ko ? 1 : 0);
