// GLI STICKER SI LEGGONO DALLA CARTELLA (v0.80.28).
//
//   node strumenti/aggiorna-sticker.js              riscrive le due liste
//   node strumenti/aggiorna-sticker.js --controlla  dice solo se sono allineate
//
// Lorenzo: "fai in modo che gli stickers si aggiornino automaticamente in base a
// quelli installati nella cartella sticker/". Una pagina servita dal sito non
// puo' leggere una cartella, e il server tiene la sua lista per scartare i nomi
// inventati: tutte e due si scrivono da qui, dai file di ui/sticker, in ordine
// alfabetico. Lo lanciano da soli pubblica-anteprima.sh e schiera.sh, quindi
// basta mettere o togliere un .png e pubblicare.
//
// Si ferma, senza scrivere niente, se nella cartella c'e' un'immagine che non
// diventerebbe uno sticker (maiuscole, spazi, un formato che non e' .png): meglio
// un fermo che uno sticker che non compare senza dire perche'.
'use strict';
const fs = require('fs');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const CARTELLA = path.join(RADICE, 'ui', 'sticker');
const LISTE = [
  { nome: 'gioco', file: path.join(RADICE, 'play', 'index.html'), riga: /^const STICKER_NOMI = \[[^\]\n]*\];$/m, scrivi: l => 'const STICKER_NOMI = ' + l + ';' },
  { nome: 'server', file: path.join(RADICE, 'server', 'nakama', 'index.js'), riga: /^var STICKER_NOMI = \[[^\]\n]*\];$/m, scrivi: l => 'var STICKER_NOMI = ' + l + ';' }
];
const IMMAGINE = /\.(png|jpe?g|gif|webp|svg|avif)$/i;
const NOME = /^[a-z0-9]+(-[a-z0-9]+)*\.png$/;

function fermo(msg) { console.error('FERMO: ' + msg); process.exit(1); }

const soloControllo = process.argv.includes('--controlla');
let voci;
try { voci = fs.readdirSync(CARTELLA); } catch (e) { fermo('non trovo ui/sticker'); }
const storti = voci.filter(f => IMMAGINE.test(f) && !NOME.test(f));
if (storti.length) fermo('in ui/sticker ci sono file che non diventerebbero sticker: ' + storti.join(', ')
  + ' — servono .png con nome minuscolo, lettere e numeri separati da trattini (es. merlin-perfect.png)');
const nomi = voci.filter(f => NOME.test(f)).map(f => f.slice(0, -4)).sort();
if (!nomi.length) fermo('ui/sticker non ha nessuno sticker: il menu resterebbe vuoto');
const lista = '[' + nomi.map(n => "'" + n + "'").join(', ') + ']';

// Prima si controllano tutte e due, poi si scrive: un file a posto e l'altro no
// vorrebbe dire un gioco e un server che non si capiscono.
const lavori = LISTE.map(L => {
  const testo = fs.readFileSync(L.file, 'utf8');
  const trovate = testo.match(new RegExp(L.riga.source, 'gm')) || [];
  if (trovate.length !== 1) fermo(path.relative(RADICE, L.file) + ': la riga di STICKER_NOMI compare ' + trovate.length + ' volte');
  return { L, testo, prima: (trovate[0].match(/'([^']*)'/g) || []).map(s => s.slice(1, -1)), vecchia: trovate[0] };
});

let diversi = 0;
for (const { L, testo, prima, vecchia } of lavori) {
  const nuova = L.scrivi(lista);
  if (vecchia === nuova) { console.log(L.nome + ': gia\' allineato (' + nomi.length + ' sticker)'); continue; }
  diversi++;
  const piu = nomi.filter(n => prima.indexOf(n) < 0), meno = prima.filter(n => nomi.indexOf(n) < 0);
  const cosa = [piu.length ? 'aggiunti ' + piu.join(', ') : '', meno.length ? 'tolti ' + meno.join(', ') : '',
    !piu.length && !meno.length ? 'riordinati' : ''].filter(Boolean).join('; ');
  if (soloControllo) { console.log(L.nome + ': NON allineato (' + cosa + ')'); continue; }
  fs.writeFileSync(L.file, testo.replace(L.riga, () => nuova));
  console.log(L.nome + ': ' + nomi.length + ' sticker (' + cosa + ')');
}
process.exit(soloControllo && diversi ? 1 : 0);
