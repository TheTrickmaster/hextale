// BANCO DI PROVA — SI ENTRA SU UN TAVOLO VUOTO
//
// Il tabellone e i due ventagli NON vengono ripuliti a fine partita: ci resta
// dentro l'ultimo disegno di quella, e ci resta finche' il primo renderBoard
// della partita dopo non ricostruisce tutto. Ricostruire e' un gesto solo —
// cancella e ridisegna nello stesso fotogramma — quindi finche' il render
// girava subito non si vedeva niente.
//
// Dalla v0.78.27 il render aspetta la fine della schermata versus: le due
// illustrazioni si aprono a 5410ms e il disegno arriva a 6000. In quei sei
// decimi si vedeva il tabellone della PARTITA PRECEDENTE, gia' posato, che poi
// spariva di colpo e ricadeva dall'alto. E' stato misurato: con la pulizia
// disattivata il tabellone porta i 19 tasselli vecchi da 1021ms a 6037ms.
//
//     node server/nakama/prova-ingresso.js
//
// Le domande sono tre, e la terza e' quella che conta:
//   1) la pulizia esiste ed e' chiamata?
//   2) e' chiamata da startGame, cioe' dalla partita che comincia?
//   3) viene PRIMA del render rimandato? Dopo non servirebbe a niente.
const fs = require('fs');
const path = require('path');

const F = path.join(__dirname, '..', '..', 'play', 'index.html');
const gioco = fs.readFileSync(F, 'utf8');

// Il corpo di una funzione: dalla sua dichiarazione in colonna zero fino alla
// graffa che la chiude, anch'essa in colonna zero. Niente regex: qui basta
// sapere dove comincia e dove finisce.
function corpo(nome) {
  const inizio = gioco.indexOf('\nfunction ' + nome + '(');
  if (inizio < 0) return null;
  const righe = gioco.slice(inizio + 1).split('\n');
  const out = [];
  for (const r of righe) { out.push(r); if (r === '}') break; }
  return out.join('\n');
}

let ko = 0;
function dice(buono, testo, spiega) {
  if (!buono) ko++;
  console.log('  ' + (buono ? 'ok    ' : 'ROTTO ') + testo);
  if (!buono && spiega) console.log('        ' + spiega);
}

console.log('LA PULIZIA DEL TAVOLO\n');

const suo = corpo('svuotaLaScena');
dice(!!suo, 'svuotaLaScena esiste',
  'Senza di lei si entra sul tabellone della partita precedente.');

// Cosa svuota, e quei contenitori devono nascere vuoti nel markup: svuotarli
// li riporta esattamente com'erano prima che si giocasse la prima partita.
const CONTENITORI = ['board-svg', 'p1-hand-fan', 'p2-hand-fan'];
for (const id of CONTENITORI) {
  dice(!!(suo && suo.indexOf("'" + id + "'") >= 0), 'svuota #' + id,
    'E- uno dei contenitori che si porta dietro la partita di prima.');
  // "nasce vuoto" = subito dopo il suo tag di apertura c'e' la chiusura.
  const apre = gioco.indexOf('id="' + id + '"');
  const fine = apre >= 0 ? gioco.indexOf('>', apre) : -1;
  const dopo = fine >= 0 ? gioco.slice(fine + 1, fine + 3) : '';
  dice(dopo === '</', '#' + id + ' nasce vuoto nel markup',
    'Se nel markup ci fosse qualcosa, svuotarlo lo perderebbe per sempre.');
}

console.log('\nCHI LA CHIAMA, E QUANDO\n');

const dentroStart = corpo('startGame');
dice(!!dentroStart, 'startGame esiste');

const iPulizia = dentroStart ? dentroStart.indexOf('svuotaLaScena()') : -1;
dice(iPulizia >= 0, 'la chiama startGame',
  'La pulizia deve stare nella partita che comincia, non altrove.');

// Il disegno non sta in startGame: sta in initGame, che startGame chiama in
// fondo. Il rimando e' `conLaManoQuandoSiPuo(...)`, l'attesa introdotta nella
// v0.78.27. La pulizia deve venire prima, o non copre il buco.
const dentroInit = corpo('initGame');
const iRender = dentroInit ? dentroInit.indexOf('conLaManoQuandoSiPuo(') : -1;
dice(iRender >= 0, 'il disegno e- ancora rimandato (conLaManoQuandoSiPuo)',
  'Se non lo fosse piu-, la caduta dei tasselli tornerebbe a girare dietro alla\n' +
  '        schermata versus — e questa prova andrebbe riletta, non cancellata.');
const iInit = dentroStart ? dentroStart.indexOf('initGame(') : -1;
dice(iPulizia >= 0 && iInit >= 0 && iPulizia < iInit,
  'la pulizia viene PRIMA del disegno rimandato',
  'Dopo non servirebbe a niente: il buco e- proprio fra le due.');

// E la pagina dev'essere montata quando si pulisce: prima di showPage('game')
// #board-svg non e' nel documento (vedi PAGE_ELEMENT_IDS), e getElementById
// risponderebbe null senza dire niente.
const iPagina = dentroStart ? dentroStart.indexOf("showPage('game')") : -1;
dice(iPagina >= 0 && iPulizia > iPagina,
  'si pulisce a pagina MONTATA (dopo showPage)',
  'A pagina smontata #board-svg non e- nel documento: si pulirebbe il nulla,\n' +
  '        in silenzio.');

console.log('\n' + (ko ? 'FALLITO: ' + ko : 'OK: si entra su un tavolo vuoto'));
process.exit(ko ? 1 : 0);
