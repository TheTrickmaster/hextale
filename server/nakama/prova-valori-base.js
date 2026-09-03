// BANCO DI PROVA — CHI SCRIVE `values` DEVE SCRIVERE ANCHE `valoriBase`
//
// Da v0.77.58 i numeri veri di una carta non sono piu' `values`: sono
// `valoriBase` piu' le sinergie in corso, rifatti a ogni disegno da
// ricalcolaValoriVivi. Chi cambia solo `values` scrive su una lavagna che verra'
// cancellata al primo ridisegno — e l'effetto sparisce senza un errore.
//
// E' successo TRE volte, da tre porte diverse:
//   v0.77.88  la Lepre Marzolina: lo scambio si annullava
//   v0.78.1   la trasformazione: Dark Strigoi tornava Strigoi
//   v0.78.6   la taglia della Regina di Cuori: il +2 durava un fotogramma
// Ogni volta la diagnosi e' stata la stessa e ogni volta e' costata una
// segnalazione. Questo banco la fa da solo.
//
//     node server/nakama/prova-valori-base.js
//
// Cerca nel gioco i punti che scrivono dentro a `.values[...]` e controlla che
// nelle vicinanze si tocchi anche `valoriBase`. Non e' una prova formale — e'
// un cane da guardia: segnala i punti da guardare, e chi legge decide.
const fs = require('fs');
const path = require('path');

const F = path.join(__dirname, '..', '..', 'play', 'index.html');
const righe = fs.readFileSync(F, 'utf8').split('\n');

// Le scritture: `qualcosa.values[x] = ...` oppure `+=`.
const SCRIVE = /\.values\[.*?\]\s*(?:=(?!=)|\+=|-=)/;
// I punti che sono per costruzione a posto, con il perche'.
const ASSOLTI = [
  { ago: 'card.values[s] = nuovo;', perche: 'e- dentro modificaValori, che la riga dopo scrive valoriBase' },
  { ago: 'card.values[SIDES[(i+1)%SIDES.length]] = prima[SIDES[i]]', perche: 'rotazione: METRI_DELLA_CARTA porta valoriBase con se-' },
  { ago: 'for(const s of gruppo.sides) card.values[s] = tirato;', perche: 'set di gruppo: passa da modificaValori subito dopo' },
];

const FINESTRA = 14;   // righe da guardare intorno
let sospetti = 0, visti = 0;
console.log('PUNTI CHE SCRIVONO NEI VALORI');
for (let i = 0; i < righe.length; i++) {
  const r = righe[i];
  if (!SCRIVE.test(r)) continue;
  if (r.trim().startsWith('//')) continue;
  visti++;
  const assolto = ASSOLTI.find(a => r.indexOf(a.ago) >= 0);
  if (assolto) { console.log('  ok    riga ' + (i + 1) + ' — ' + assolto.perche); continue; }
  // Si guarda intorno: qualcuno tocca valoriBase?
  const da = Math.max(0, i - FINESTRA), a = Math.min(righe.length, i + FINESTRA);
  const intorno = righe.slice(da, a).join('\n');
  const copre = /valoriBase/.test(intorno) || /modificaValori\s*\(/.test(intorno)
             || /METRI_DELLA_CARTA/.test(intorno);
  if (copre) { console.log('  ok    riga ' + (i + 1) + ' — valoriBase e- toccata qui intorno'); continue; }
  sospetti++;
  console.log('  ?     riga ' + (i + 1) + ' — scrive values e non si vede valoriBase:');
  console.log('        ' + r.trim().slice(0, 96));
}

console.log('\n' + visti + ' scritture esaminate, ' + sospetti + ' da guardare.');
if (sospetti) {
  console.log('Non e- detto che siano guasti: puo- essere una copia di lavoro, o');
  console.log('un valore che nasce li-. Ma sono i punti in cui il difetto e- gia-');
  console.log('nato tre volte, e vanno letti prima di dire che vanno bene.');
}
process.exit(sospetti ? 1 : 0);
