// BANCO DI PROVA — L'ANTEPRIMA DEVE FARE QUEL CHE FA IL PIAZZAMENTO
//
// Trascinando una carta sul tabellone si vedono i numeri che avra' un istante
// dopo averla posata. Quei numeri li calcola `simulaPiazzamento`, che rifa' su
// una copia del campo cio' che il piazzamento vero fa su quello vero.
// Se il piazzamento vero fa una cosa in piu', l'anteprima tace su quella cosa —
// e tacere e' il difetto peggiore, perche' non sbaglia un numero: ne nasconde
// uno. Si vede la carta atterrare e SOLO ALLORA cambiare.
// E' successo con lo Spaventapasseri (v0.78.8): lascia un bonus alla prossima
// carta giocata, e l'anteprima di quella carta non lo mostrava.
//
//     node server/nakama/prova-anteprima.js
//
// Non si confrontano i NOMI delle funzioni — le due strade fanno le stesse cose
// a granularita' diverse, e un confronto di nomi darebbe allarmi falsi — ma le
// CAPACITA': "ricalcolare le sinergie" e' una capacita', e la strada vera la
// esercita chiamando ricalcolaTabellone mentre l'anteprima chiama
// ricalcolaValoriVivi carta per carta. Sono la stessa cosa, e vanno contate
// come tale.
// Aggiungere al piazzamento una capacita' nuova senza darla anche all'anteprima
// fa fallire questo banco. Ed e' esattamente lo scopo.
const fs = require('fs');
const path = require('path');

const F = path.join(__dirname, '..', '..', 'play', 'index.html');
const righe = fs.readFileSync(F, 'utf8').split('\n');

function corpo(nome) {
  const i = righe.findIndex(r => new RegExp('^function\\s+' + nome + '\\b').test(r));
  if (i < 0) return null;
  let j = i;
  while (j < righe.length && righe[j] !== '}') j++;
  return righe.slice(i, j + 1)
    .map(r => { const k = r.indexOf('//'); return k < 0 ? r : r.slice(0, k); })
    .join('\n');
}
function chiamate(txt) {
  const out = new Set();
  if (!txt) return out;
  for (const m of txt.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) out.add(m[2]);
  return out;
}

// Le capacita' che decidono i NUMERI di una carta appena posata. Suoni,
// animazioni e disegno non ci sono: non hanno niente da mostrare in anteprima.
const CAPACITA = [
  { nome: "l'abilita' della carta che si posa",
    modi: ['applicaAbilitaPiazzamento'] },
  { nome: 'le reazioni delle carte vicine',
    modi: ['reazioniAlPiazzamento'] },
  { nome: 'la promessa lasciata da una carta giocata prima',
    modi: ['riscuotiPremioProssimaGiocata'] },
  { nome: 'il ricalcolo delle sinergie in campo',
    modi: ['ricalcolaTabellone', 'ricalcolaValoriVivi',
           'recalcHoorayShesStays', 'recalcMischief', 'recalcNightmare', 'recalcBearNecessities'] },
];

// Quel che la strada vera fa e l'anteprima NON deve fare, col suo perche'.
const SOLO_VERE = [
  { modo: 'applicaEffettiRealiPiazzamento',
    perche: "tocca lo stato della partita (una taglia, un dado, una conquista\n" +
            "        annullata) e non i valori della carta: in anteprima farebbe\n" +
            "        succedere per finta cose che restano" },
  { modo: 'attivaTrasformazioneAlPiazzamento',
    perche: "in anteprima la trasformazione si mostra con l'ARTE\n" +
            "        (__anteprimaTrasformazione), non rifacendo la carta" },
];

const vera = new Set([...chiamate(corpo('doPlace')), ...chiamate(corpo('resolveConquestAndEndTurn'))]);
const finta = chiamate(corpo('simulaPiazzamento'));
const ha = (insieme, modi) => modi.some(m => insieme.has(m));

let ko = 0;
console.log('LE CAPACITA- CHE DECIDONO I NUMERI DI UNA CARTA POSATA\n');
for (const c of CAPACITA) {
  const v = ha(vera, c.modi), f = ha(finta, c.modi);
  if (v && f) { console.log('  ok    ' + c.nome); continue; }
  if (!v && !f) { console.log('  --    ' + c.nome + ' (nessuna delle due la esercita)'); continue; }
  ko++;
  console.log('  ROTTA ' + c.nome);
  console.log('        piazzamento: ' + (v ? 'si' : 'no') + '   anteprima: ' + (f ? 'si' : 'no'));
  console.log('        Se il piazzamento la fa e l-anteprima no, chi trascina non');
  console.log('        vede un numero che poi arrivera-. Il contrario e- peggio:');
  console.log('        vede un numero che non arrivera- mai.');
}

console.log('\nE QUEL CHE SOLO IL PIAZZAMENTO DEVE FARE\n');
for (const s of SOLO_VERE) {
  const v = vera.has(s.modo), f = finta.has(s.modo);
  if (v && !f) { console.log('  ok    ' + s.modo); continue; }
  if (!v) { console.log('  --    ' + s.modo + ' (non la chiama piu- nessuno)'); continue; }
  ko++;
  console.log('  ROTTA ' + s.modo + ' — la chiama anche l-anteprima, e non deve:');
  console.log('        ' + s.perche);
}

console.log('\n' + (ko ? 'FALLITO: ' + ko : 'OK: l-anteprima e il piazzamento dicono la stessa cosa'));
process.exit(ko ? 1 : 0);
