// BANCO DI PROVA — CIO' CHE ALTRI PROGRAMMI CHIAMANO DENTRO AL GIOCO
//
// L'importazione non riscrive il parser del foglio: apre play/index.html dentro
// Electron e chiama le funzioni del gioco (vedi il commento in cima a
// converti.js). Vuol dire che dentro index.html esistono funzioni il cui unico
// chiamante sta in UN ALTRO FILE — e quindi un controllo di "codice morto" che
// guardi solo dentro index.html le dichiara morte e invita a cancellarle.
//
// E' successo: nella v0.77.91 sono state tolte _csvParse e _cardaDaRiga, e la
// reimportazione si e' fermata al secondo passo. Questo banco esiste perche'
// non succeda una seconda volta.
//
//     node server/importazione/prova-aggancio.js
//
// Esce 1 se il gioco non offre piu' qualcosa che l'importazione si aspetta.
const fs = require('fs');
const path = require('path');

const QUI = __dirname;
const GIOCO = path.join(QUI, '..', '..', 'play', 'index.html');
const gioco = fs.readFileSync(GIOCO, 'utf8');

// Chi cerca dentro al gioco, e cosa. Si ricava LEGGENDO gli altri programmi,
// non da un elenco scritto a mano: un elenco a mano invecchia in silenzio.
const programmi = fs.readdirSync(QUI).filter(f => f.endsWith('.js') && f !== path.basename(__filename));

// I nomi che un programma "chiama dentro al gioco" si riconoscono cosi': stanno
// dentro al codice che viene iniettato nella pagina, e sono nomi del gioco.
// Invece di indovinare, si cercano le due forme che converti.js usa davvero:
//   typeof _qualcosa !== 'function'      (il controllo che c'e')
//   _qualcosa(                            (la chiamata)
// limitandosi ai nomi che NON sono definiti dal programma stesso.
let ko = 0;
const visti = new Set();

for (const p of programmi) {
  const testo = fs.readFileSync(path.join(QUI, p), 'utf8');
  const suoi = new Set([...testo.matchAll(/(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]));
  const chiesti = new Set();
  // La forma `typeof X !== 'function'` e' il segnale esplicito di "questa me la
  // deve dare il gioco": si prende qualunque nome, non solo quelli col
  // trattino basso. E' cosi' che verificaArtCarte (v0.77.99) e' entrata
  // nell'elenco da sola, senza che nessuno la aggiungesse a mano.
  for (const m of testo.matchAll(/typeof\s+([A-Za-z_$][\w$]*)\s*!==\s*'function'/g)) chiesti.add(m[1]);
  for (const m of testo.matchAll(/\b(_[a-zA-Z][\w$]*)\s*\(/g)) chiesti.add(m[1]);
  const daGioco = [...chiesti].filter(n => !suoi.has(n));
  if (!daGioco.length) continue;
  console.log(p + ':');
  for (const n of daGioco) {
    if (visti.has(n)) continue;
    visti.add(n);
    const esiste = new RegExp('^(?:function|const|let|var)\\s+' + n + '\\b', 'm').test(gioco);
    if (!esiste) ko++;
    console.log('  ' + (esiste ? 'ok    ' : 'MANCA ') + n);
  }
}

console.log('\n' + (ko
  ? "FALLITO: il gioco non offre piu' " + ko + " cosa/e che l'importazione chiama."
  : "OK: tutto cio' che l'importazione chiama dentro al gioco esiste ancora."));
process.exit(ko ? 1 : 0);
