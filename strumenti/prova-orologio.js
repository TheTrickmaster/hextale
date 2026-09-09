// L'orologio del turno e' scritto in DUE file, e devono dire la stessa cosa.
//
//   node strumenti/prova-orologio.js
//
// Niente Electron e niente server: e' un accordo fra due numeri, e un accordo
// fra due numeri si verifica leggendoli.
//
// PERCHE' ESISTE. Il conto alla rovescia lo mostra il client (TURN_SECS), ma la
// scadenza la tiene il SERVER (TURNO_MS): e' lui a decidere quando un turno e'
// finito, e il client si riallinea alla sua scadenza a ogni battito. Se i due
// non combaciano non succede niente di rumoroso — succede la cosa peggiore, e
// cioe' una partita che si comporta in modo diverso da come si vede:
//   - client piu' lungo del server: il turno viene troncato con la barra
//     ancora a meta', e chi stava pensando non capisce cos'e' successo;
//   - client piu' corto: la barra arriva a zero e il turno continua.
// Nessuno dei due da' un errore da nessuna parte.
//
// E' anche l'unico controllo di questo repository che guarda due file INSIEME:
// vale la pena saperlo, perche' e' il modello per il prossimo numero che
// dovesse vivere di qua e di la'.
const fs = require('fs');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const CLIENT = path.join(RADICE, 'play', 'index.html');
const SERVER = path.join(RADICE, 'server', 'nakama', 'index.js');

let male = 0;
const dice = (ok, che, x) => {
  console.log((ok ? '  ok  ' : '  NO  ') + che + (x !== undefined ? '   [' + x + ']' : ''));
  if (!ok) male++;
};

// Si cerca la DICHIARAZIONE, non il numero: un numero cercato da solo lo si
// trova in venti punti che non c'entrano niente.
const cerca = (file, re, nome) => {
  const t = fs.readFileSync(file, 'utf8');
  const tutte = t.match(new RegExp(re.source, 'g')) || [];
  if (tutte.length !== 1) { dice(false, nome + ': dichiarazioni trovate', tutte.length); return null; }
  return parseInt(t.match(re)[1], 10);
};

const secondiClient = cerca(CLIENT, /const TURN_SECS\s*=\s*(\d+)\s*;/, 'TURN_SECS');
const msServer = cerca(SERVER, /var TURNO_MS\s*=\s*(\d+)\s*;/, 'TURNO_MS');

if (secondiClient === null || msServer === null) {
  console.log('\nnon ho potuto leggere i due numeri.');
  process.exit(1);
}

dice(secondiClient > 0, 'il client ha una durata di turno', secondiClient + 's');
dice(msServer > 0, 'e il server pure', (msServer / 1000) + 's');
dice(secondiClient * 1000 === msServer,
  'e sono LO STESSO numero',
  'client ' + secondiClient + 's, server ' + (msServer / 1000) + 's');

console.log('\n3 controlli, ' + male + ' storti');
process.exit(male ? 1 : 0);
