// QUALI ASSET NON LI USA PIU' NESSUNO.
//
//     node strumenti/controlla-asset.js            l'elenco
//     node strumenti/controlla-asset.js --tutti    anche chi e' usato, e come
//
// Sembra un lavoro da grep e non lo e', per due ragioni che si scoprono
// entrambe sbagliando:
//
//   1. META' DEGLI ASSET NON COMPARE MAI PER INTERO. Il nome viene COMPOSTO —
//      'archetype-icon-' + tratto + '-' + variante + '.png' — quindi cercare il
//      nome intero direbbe che sono inutilizzati quasi tutti. E' il modo piu'
//      rapido per cancellare mezzo gioco.
//   2. DUE FILE DIVERSI POSSONO AVERE LO STESSO NOME in due cartelle diverse.
//      Cercare solo il nome del file li fa passare tutti e due appena UNO dei
//      due e' usato — e quello morto resta li' per sempre, oppure lo si sposta
//      e si porta via anche il vivo.
//      (Era il caso di right-button.png, in ui/ e in player-ui/, e di glow.png,
//      in main-menu/ e in loading-screen/. Da v0.79.20 le prime due cartelle
//      non esistono piu': e' proprio guardando questi doppioni che si e' visto
//      che tre cartelle d'interfaccia erano due di troppo.)
//
// Quindi la domanda giusta non e' "questo nome c'e' nel codice?" ma "questo
// nome c'e' nel codice INSIEME ALLA SUA CARTELLA?". Ogni cartella ha il suo
// modo di essere nominata — una costante, una funzione, o il percorso scritto
// per esteso — ed e' quello che si cerca.
//
// Questo programma SEGNALA e non cancella: spostare un asset che qualcuno usa
// ancora vuol dire romperlo per tutti, perche' questi file sono anche il sito.
'use strict';
const fs = require('fs');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const FUORI = ['cards/art'];   // su richiesta: l'arte delle carte non si guarda
const ESTENSIONI = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.mp3', '.ogg', '.wav',
                    '.mp4', '.ttf', '.otf', '.woff', '.woff2'];
// `desktop`, `test` e `versions` restano fuori: applicazione impacchettata,
// materiale di prova, e copie vecchie del gioco.
// v0.79.20 — 'main-menu', 'player-ui' e 'buttons' non esistono piu': la prima e
// la seconda sono state svuotate dentro a ui/, la terza in _old/.
const CARTELLE = ['audio', 'cards', 'fonts', 'loading-screen',
                  'timer', 'ui', 'unpack-screen'];
const CODICE = ['play/index.html', 'server', 'strumenti', 'desktop/main.js', 'desktop/preload.js'];

// Come si nomina, nel codice, la cartella di un asset. La prima che combacia
// vince, quindi le piu' lunghe stanno prima.
const PORTE = [
  ['cards/card-parts/Archetypes', ['ARCHETYPE_BASE', 'card-parts/Archetypes/']],
  ['cards/card-parts',            ['CARD_PARTS_BASE', 'card-parts/']],
  ['cards/packs',                 ['PACK_BASE', 'packFileCandidati', 'cards/packs/']],
  ['cards',                       ['CARDS_BASE', '/cards/']],
  ['audio/sfx',                   ['SFX_BASE', 'playSfxFile', 'audio/sfx/']],
  ['audio/voices',                ['VOCI_BASE', 'VOCI_REL', 'audio/voices/']],
  ['audio/music',                 ['audio/music/']],
  ['audio',                       ['audio/']],
  ['loading-screen',              ['loading-screen/']],
  ['unpack-screen',               ['unpack-screen/']],
  ['ui/ranks',                    ['ranks/']],
  ['ui/tiles',                    ['tiles/']],
  ['ui',                          ['UI_BASE', 'uiFileCandidati', '/ui/']],
  ['timer',                       ['timer/']],
  ['fonts',                       ['fonts/']],
];

function tuttiIFile(dir, dentro) {
  const fuori = [];
  const giro = (d) => {
    let voci = [];
    try { voci = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const v of voci) {
      const p = path.join(d, v.name);
      if (v.isDirectory()) { giro(p); continue; }
      if (!dentro || dentro(p)) fuori.push(p);
    }
  };
  giro(dir);
  return fuori;
}

let codice = '';
for (const c of CODICE) {
  const p = path.join(RADICE, c);
  if (!fs.existsSync(p)) continue;
  if (fs.statSync(p).isDirectory()) {
    for (const f of tuttiIFile(p, f => /\.(js|html|css)$/i.test(f))) codice += fs.readFileSync(f, 'utf8') + '\n';
  } else codice += fs.readFileSync(p, 'utf8') + '\n';
}

// ── I NOMI CHE OGNI PORTA VEDE PASSARE ────────────────────────────────────
// Per ogni modo di nominare una cartella si raccolgono i nomi di file che gli
// stanno vicino: dentro alle stesse virgolette, o nelle 120 lettere successive
// (che e' dove finisce una concatenazione). E si raccolgono anche i PEZZI, cioe'
// le stringhe che finiscono con un trattino: sono gli inizi dei nomi composti.
function nomiVistiDa(chiavi) {
  const nomi = new Set(), prefissi = new Set(), suffissi = new Set();
  for (const k of chiavi) {
    let i = 0;
    while ((i = codice.indexOf(k, i)) >= 0) {
      const zona = codice.slice(i, i + 160);
      for (const m of zona.matchAll(/([A-Za-z0-9_@.\- ]+\.(?:png|jpg|jpeg|webp|gif|svg|mp3|ogg|wav|mp4|ttf|otf|woff2?))/g)) nomi.add(m[1]);
      for (const m of zona.matchAll(/['"`]([A-Za-z0-9_.\-]*-)['"`+]/g)) prefissi.add(m[1]);
      for (const m of zona.matchAll(/[+'"`}]\s*['"`]?(-[A-Za-z0-9_.\-]+\.(?:png|jpg|jpeg|webp|svg|mp3|mp4))/g)) suffissi.add(m[1]);
      i += k.length;
    }
  }
  return { nomi, prefissi, suffissi };
}
const vistiPerCartella = {};
for (const [cartella, chiavi] of PORTE) vistiPerCartella[cartella] = nomiVistiDa(chiavi);

function portaDi(rel) {
  for (const [cartella] of PORTE) if (rel.indexOf(cartella + '/') === 0) return cartella;
  return null;
}

function comeEUsato(rel) {
  const base = path.basename(rel);
  if (codice.indexOf(rel) >= 0) return 'percorso intero';
  const cartella = portaDi(rel);
  if (!cartella) return codice.indexOf(base) >= 0 ? 'nome (cartella sconosciuta)' : null;
  const v = vistiPerCartella[cartella];
  if (v.nomi.has(base)) return 'nome, accanto alla sua cartella';
  for (const p of v.prefissi) if (base.indexOf(p) === 0 && p.length >= 4) return 'composto (' + p + '…)';
  for (const s of v.suffissi) if (base.length > s.length && base.slice(-s.length) === s) return 'composto (…' + s + ')';
  return null;
}

const asset = [];
for (const c of CARTELLE) {
  const dir = path.join(RADICE, c);
  if (!fs.existsSync(dir)) continue;
  for (const f of tuttiIFile(dir, f => ESTENSIONI.indexOf(path.extname(f).toLowerCase()) >= 0)) {
    const rel = path.relative(RADICE, f).split(path.sep).join('/');
    if (FUORI.some(x => rel.indexOf(x + '/') === 0)) continue;
    asset.push(rel);
  }
}
for (const f of ['cursor.png', 'favicon.png']) if (fs.existsSync(path.join(RADICE, f))) asset.push(f);

const orfani = [], usati = [];
for (const a of asset) {
  const come = comeEUsato(a);
  if (come) usati.push([a, come]); else orfani.push(a);
}

console.log('ASSET GUARDATI: ' + asset.length + '   (fuori: cards/art, desktop, test, versions)');
console.log('  qualcuno li nomina: ' + usati.length);
console.log('  NESSUNO LI NOMINA:  ' + orfani.length + '\n');
const perCartella = {};
for (const o of orfani) (perCartella[path.dirname(o)] = perCartella[path.dirname(o)] || []).push(path.basename(o));
for (const d of Object.keys(perCartella).sort()) {
  console.log('  ' + d + '/   (' + perCartella[d].length + ')');
  for (const f of perCartella[d].sort()) console.log('      ' + f);
}
if (process.argv.indexOf('--tutti') >= 0) {
  console.log('\nE CHI LI NOMINA, COME');
  for (const [a, come] of usati) console.log('  ' + a.padEnd(52) + come);
}
if (process.argv.indexOf('--elenco') >= 0) {
  fs.writeFileSync(path.join(RADICE, 'strumenti', 'asset-orfani.txt'), orfani.join('\n') + '\n');
  console.log('\nscritto strumenti/asset-orfani.txt');
}
