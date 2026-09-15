// PREPARA LA COPIA DEL GIOCO PER L'APP DESKTOP (v0.80.30).
//
//     node desktop/prepara-gioco.js                     dall'ultimo commit
//     node desktop/prepara-gioco.js --copia-di-lavoro   dai file sul disco (per i banchi)
//
// Copia in desktop/gioco-pronto/ i file che il gioco usa davvero e scrive
// manifesto.json con impronta (sha256) e dimensione di ognuno. La stessa cartella
// va dentro all'installatore (resources/gioco) e si pubblica su R2 (vedi
// aggiornatore.js per com'e' fatto il deposito).
//
// DALL'ULTIMO COMMIT, di norma: i file e il loro contenuto sono quelli di HEAD,
// cioe' quelli pubblicati. La copia di lavoro e' condivisa fra piu' sessioni e
// puo' avere modifiche in corso, anche di qualcun altro: nell'installatore o su
// R2 non devono finire. I banchi invece provano proprio le modifiche in corso,
// e per loro c'e' --copia-di-lavoro (solo i file registrati in git, letti dal disco).
// La versione si legge dal numero sul gioco (build-version-badge).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const RADICE = path.resolve(__dirname, '..');
const USCITA = path.join(__dirname, 'gioco-pronto');
// Cio' che il gioco chiede (misurato dai riferimenti in play/index.html):
// web-assets e unpack-screen non li usa, versions/ e _old/ nemmeno.
const INCLUSI = ['play/index.html', 'patch-notes.txt', 'favicon.png', 'ui', 'audio', 'cards', 'fonts', 'loading-screen', 'timer', 'video'];
const DAL_DISCO = process.argv.includes('--copia-di-lavoro');
const git = (args, opzioni) => execFileSync('git', args, Object.assign({ cwd: RADICE, maxBuffer: 1024 * 1024 * 1024 }, opzioni || {}));

// [{ percorso, dati }]
function fileDelDisco() {
  const elenco = git(['ls-files', '-z', '--'].concat(INCLUSI)).toString('utf8').split('\0').filter(Boolean);
  const voci = [];
  for (const p of elenco) {
    const da = path.join(RADICE, ...p.split('/'));
    if (!fs.existsSync(da) || !fs.statSync(da).isFile()) continue;   // registrato ma cancellato dal disco
    voci.push({ percorso: p, dati: fs.readFileSync(da) });
  }
  return voci;
}

function fileDelCommit() {
  // "<modo> <tipo> <id>\t<percorso>", con -z i percorsi arrivano come sono
  const albero = git(['ls-tree', '-r', '-z', 'HEAD', '--'].concat(INCLUSI)).toString('utf8').split('\0').filter(Boolean).map((riga) => {
    const tab = riga.indexOf('\t');
    const [modo, tipo, id] = riga.slice(0, tab).split(' ');
    return { modo, tipo, id, percorso: riga.slice(tab + 1) };
  }).filter((x) => x.tipo === 'blob' && x.modo !== '120000');
  // Tutti i contenuti in una volta sola: "<id> blob <dimensione>\n<contenuto>\n"
  const uscita = git(['cat-file', '--batch'], { input: albero.map((x) => x.id).join('\n') + '\n' });
  const voci = [];
  let pos = 0;
  for (const x of albero) {
    const aCapo = uscita.indexOf(10, pos);
    const testa = uscita.subarray(pos, aCapo).toString('utf8').split(' ');
    if (testa[0] !== x.id || testa[1] !== 'blob') throw new Error('git cat-file: risposta inattesa per ' + x.percorso);
    const dimensione = Number(testa[2]);
    voci.push({ percorso: x.percorso, dati: uscita.subarray(aCapo + 1, aCapo + 1 + dimensione) });
    pos = aCapo + 1 + dimensione + 1;
  }
  return voci;
}

const voci = DAL_DISCO ? fileDelDisco() : fileDelCommit();
const indice = voci.find((v) => v.percorso === 'play/index.html');
const badge = indice && indice.dati.toString('utf8').match(/id="build-version-badge"[^>]*>(v[0-9.]+)</);
if (!badge) { console.error('FERMO: nel gioco non trovo il numero di versione (build-version-badge)'); process.exit(1); }

fs.rmSync(USCITA, { recursive: true, force: true });
const manifesto = { versione: badge[1], generato: new Date().toISOString(), origine: DAL_DISCO ? 'copia di lavoro' : 'commit ' + git(['rev-parse', '--short', 'HEAD']).toString('utf8').trim(), file: {} };
let byte = 0;
for (const v of voci) {
  const a = path.join(USCITA, ...v.percorso.split('/'));
  fs.mkdirSync(path.dirname(a), { recursive: true });
  fs.writeFileSync(a, v.dati);
  manifesto.file[v.percorso] = { sha256: crypto.createHash('sha256').update(v.dati).digest('hex'), dimensione: v.dati.length };
  byte += v.dati.length;
}
fs.writeFileSync(path.join(USCITA, 'manifesto.json'), JSON.stringify(manifesto));
console.log('gioco pronto: ' + manifesto.versione + ' (' + manifesto.origine + '), ' + Object.keys(manifesto.file).length + ' file, ' + (byte / 1048576).toFixed(1) + ' MB -> ' + path.relative(RADICE, USCITA));
