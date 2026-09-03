// BANCO DI PROVA — CHI TOGLIE UNA CARTA LO FA DOPO LA CONQUISTA
//
// Mordred toglieva la carta indicata PRIMA che lo scontro venisse calcolato.
// Non e' una questione di regia: una carta che non c'e' piu' non partecipa al
// conteggio dei lati, quindi toglierla in anticipo CAMBIA l'esito. Da fuori si
// vede una conquista che non avviene, senza nessun modo di capire perche'.
//
//     node server/nakama/prova-rimozioni.js
//
// La regola per chi scrivera' la prossima abilita' che rimuove: si chiama
// `rimuoviDopoLaConquista`, mai `distruggiCarta`. La seconda e' la rimozione
// vera e non sa niente di quando sia il momento giusto — e' il martello, non la
// decisione di battere.
const fs = require('fs');
const path = require('path');
const gioco = fs.readFileSync(path.join(__dirname, '..', '..', 'play', 'index.html'), 'utf8');

let ko = 0;
function chiedi(nome, buono, perche) {
  if (!buono) ko++;
  console.log('  ' + (buono ? 'ok    ' : 'ROTTA ') + nome);
  if (!buono) console.log('        ' + perche);
}

console.log('LA RIMOZIONE DI UNA CARTA DAL TABELLONE\n');

chiedi('esiste la coda, e chi la svuota',
  /function rimuoviDopoLaConquista\b/.test(gioco) && /function svuotaLeRimozioniInAttesa\b/.test(gioco),
  'senza la coda ogni abilita- che rimuove torna a togliere la carta subito');

chiedi('la coda si svuota a scontro finito, dentro chiudiIlTurno',
  /const chiudiIlTurno = \(\)=>\{[\s\S]{0,600}?svuotaLeRimozioniInAttesa\(\)/.test(gioco),
  'e- l-unico punto in cui lo scontro e- gia- risolto e il turno non e- ancora cambiato');

chiedi('e si aspetta il volo della carta distrutta',
  /Math\.max\(effettiDopoLoScontro\(card, q, r\), _tolte \? DISTRUZIONE_MS : 0\)/.test(gioco),
  'senza, il turno cambia mentre la carta e- ancora per aria');

chiedi('la coda nasce vuota a ogni partita',
  /rimozioniInAttesa:\[\]/.test(gioco),
  'una rimozione rimasta appesa farebbe sparire una carta nel turno dopo');

// E la regola vera: nessuna abilita' chiama la rimozione diretta.
// Si guardano i due registri delle scelte, che sono il posto da cui le
// abilita' agiscono sul tabellone.
console.log('');
const registri = ['SCELTE_PIAZZAMENTO', 'SCELTE_DOPO_CONQUISTA', 'EFFETTI_PIAZZAMENTO', 'EFFETTI_PIAZZAMENTO_REALI'];
for (const nome of registri) {
  const i = gioco.indexOf('const ' + nome + ' = {');
  if (i < 0) { console.log('  --    ' + nome + ' (non c-e- piu-)'); continue; }
  // Fino alla chiusura del registro: la prima riga che comincia con '};'.
  const fine = gioco.indexOf('\n};', i);
  const corpo = gioco.slice(i, fine < 0 ? i + 40000 : fine);
  const colpevoli = [];
  const righe = corpo.split('\n');
  for (let n = 0; n < righe.length; n++) {
    if (righe[n].indexOf('//') === 0 || righe[n].trim().indexOf('//') === 0) continue;
    if (/\bdistruggiCarta\s*\(/.test(righe[n])) colpevoli.push(righe[n].trim());
  }
  if (colpevoli.length) {
    ko++;
    console.log('  ROTTA ' + nome + ' chiama distruggiCarta direttamente:');
    for (const r of colpevoli) console.log('        ' + r);
    console.log('        Va chiamata rimuoviDopoLaConquista: quella aspetta lo scontro.');
  } else {
    console.log('  ok    ' + nome + ' non toglie niente prima dello scontro');
  }
}

console.log('\n' + (ko ? 'FALLITO: ' + ko : 'OK: le carte escono dal tabellone dopo lo scontro, non prima'));
process.exit(ko ? 1 : 0);
