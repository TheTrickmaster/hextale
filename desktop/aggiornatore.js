// ═══════════════════════════════════════════════════════════════════════════
// HEXTALE — L'AGGIORNATORE DEL GIOCO (app desktop, v0.80.30)
// ═══════════════════════════════════════════════════════════════════════════
// Lorenzo: "creiamo il guscio Electron che installa tutto su locale al primo
// avvio cosi' non deve piu' richiedere gli asset. Da ora in avanti il gioco si
// puo' giocare solo da desktop Electron". Aggiornamenti e installatore stanno su
// Cloudflare R2 (dominio download.hextalegame.com: l'indirizzo r2.dev e' limitato).
//
// COM'E' FATTO IL DEPOSITO
//   gioco/manifesto.json      { versione, generato, file: { "ui/x.png": { sha256, dimensione } } }
//   gioco/file/<sha256>       il contenuto di ogni file, col NOME uguale all'impronta
// Un file col nome uguale all'impronta non cambia mai: nessuna cache puo'
// restituirne una copia vecchia, e ripubblicare carica solo le impronte nuove.
// Il manifesto invece si chiede sempre fresco.
//
// DUE COPIE SUL DISCO
//   inclusa   dentro all'installazione (resources/gioco): il gioco completo del
//             giorno in cui e' stato costruito l'installatore, col suo manifesto;
//   viva      in %APPDATA%\Hextale\gioco: SOLO i file cambiati dopo, e il
//             manifesto che vale adesso.
// Un file si serve dalla viva se c'e', altrimenti dall'inclusa — ma solo se il
// manifesto che vale lo nomina: un file tolto non si serve piu' anche se
// l'inclusa ce l'ha ancora. Se l'installatore e' piu' nuovo della viva (l'app e'
// stata aggiornata), la viva si butta: e' tutta roba vecchia.
//
// COME SI AGGIORNA SENZA ROMPERSI
//   1. tutto quello che manca si scarica in un cantiere e si verifica l'impronta;
//   2. solo quando c'e' tutto, i file vanno al loro posto nella viva;
//   3. il manifesto si scrive PER ULTIMO. Se l'app si chiude a meta', al prossimo
//      avvio il manifesto e' ancora quello vecchio e i file cambiati si riscaricano
//      e si riscrivono: si torna sempre a uno stato coerente.
'use strict';
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const NOME_MANIFESTO = 'manifesto.json';
const IMPRONTA = /^[0-9a-f]{64}$/;

// Un percorso del manifesto e' sempre relativo, con le barre in avanti, senza
// ".." ne' unita' disco: un manifesto che dicesse "../../Windows/x" non deve
// poter scrivere fuori dalla cartella del gioco.
function percorsoSicuro(p) {
  const s = String(p || '');
  if (!s || s.length > 400) return false;
  if (s.indexOf('\\') >= 0 || s.indexOf(':') >= 0 || s.charAt(0) === '/') return false;
  const pezzi = s.split('/');
  for (const x of pezzi) if (!x || x === '.' || x === '..') return false;
  return true;
}

function improntaDi(file) {
  return new Promise((ok, ko) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file).on('data', (d) => h.update(d)).on('end', () => ok(h.digest('hex'))).on('error', ko);
  });
}

async function leggiManifesto(cartella) {
  try {
    const m = JSON.parse(await fsp.readFile(path.join(cartella, NOME_MANIFESTO), 'utf8'));
    return (m && m.file && typeof m.file === 'object') ? m : null;
  } catch (_) { return null; }
}

// Quale di due manifesti e' piu' nuovo: la versione pezzo per pezzo ("0.80.9"
// viene prima di "0.80.10"), e a parita' di versione la data di generazione.
function confronta(a, b) {
  const num = (m) => String((m && m.versione) || '').replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0);
  const x = num(a), y = num(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  }
  const ga = String((a && a.generato) || ''), gb = String((b && b.generato) || '');
  return ga === gb ? 0 : (ga > gb ? 1 : -1);
}

// Il manifesto che vale: la viva se c'e' ed e' almeno nuova quanto l'inclusa;
// se l'inclusa e' piu' nuova, la viva si butta.
async function manifestoEfficace(cartellaInclusa, cartellaViva) {
  const incluso = await leggiManifesto(cartellaInclusa);
  let vivo = await leggiManifesto(cartellaViva);
  if (vivo && incluso && confronta(incluso, vivo) > 0) {
    await fsp.rm(cartellaViva, { recursive: true, force: true });
    vivo = null;
  }
  return vivo || incluso;
}

// Dove sta sul disco il file che il gioco chiede, o null se non e' del gioco.
function trovaFile(efficace, cartellaInclusa, cartellaViva, percorso) {
  if (!efficace || !efficace.file || !percorsoSicuro(percorso) || !efficace.file[percorso]) return null;
  const pezzi = percorso.split('/');
  const vivo = path.join(cartellaViva, ...pezzi);
  if (fs.existsSync(vivo)) return vivo;
  const incluso = path.join(cartellaInclusa, ...pezzi);
  return fs.existsSync(incluso) ? incluso : null;
}

async function chiedi(url, timeoutMs) {
  const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' per ' + url);
  return r;
}

// Il piano: il manifesto remoto, cosa scaricare (per impronta) e cosa togliere.
async function controlla(base, attuale, opzioni) {
  const o = opzioni || {};
  const r = await chiedi(base + 'gioco/' + NOME_MANIFESTO + '?t=' + Date.now(), o.timeoutMs || 6000);
  const remoto = await r.json();
  if (!remoto || !remoto.file || typeof remoto.file !== 'object' || !remoto.versione) throw new Error('manifesto remoto non valido');
  const loc = (attuale && attuale.file) || {};
  const daScaricare = [], daTogliere = [];
  for (const p of Object.keys(remoto.file)) {
    if (!percorsoSicuro(p)) throw new Error('percorso non ammesso nel manifesto: ' + p);
    const v = remoto.file[p];
    if (!v || !IMPRONTA.test(String(v.sha256))) throw new Error('impronta non valida per ' + p);
    if (!loc[p] || loc[p].sha256 !== v.sha256) daScaricare.push({ percorso: p, sha256: v.sha256, dimensione: Number(v.dimensione) || 0 });
  }
  for (const p of Object.keys(loc)) if (!remoto.file[p] && percorsoSicuro(p)) daTogliere.push(p);
  const nuovo = !!(daScaricare.length || daTogliere.length || !attuale || confronta(remoto, attuale) !== 0);
  return { remoto, daScaricare, daTogliere, nuovo };
}

// 1. Nel cantiere, verificati (quelli gia' scaricati da un tentativo di prima
// restano). Da solo serve a gioco aperto: la versione nuova si scarica in
// silenzio e si posa solo quando il gioco ricarica (vedi main.js).
async function prescarica(base, cartellaViva, piano, opzioni) {
  const o = opzioni || {};
  const cantiere = path.join(cartellaViva, '.cantiere');
  await fsp.mkdir(cantiere, { recursive: true });
  const totale = piano.daScaricare.reduce((s, f) => s + (f.dimensione || 0), 0);
  let fatto = 0;
  for (const f of piano.daScaricare) {
    const dest = path.join(cantiere, f.sha256);
    let buono = false;
    if (fs.existsSync(dest)) buono = (await improntaDi(dest)) === f.sha256;
    if (!buono) {
      const r = await chiedi(base + 'gioco/file/' + f.sha256, o.timeoutFileMs || 180000);
      const dati = Buffer.from(await r.arrayBuffer());
      const h = crypto.createHash('sha256').update(dati).digest('hex');
      if (h !== f.sha256) throw new Error('impronta sbagliata per ' + f.percorso);
      await fsp.writeFile(dest + '.parziale', dati);
      await fsp.rename(dest + '.parziale', dest);
    }
    fatto += f.dimensione || 0;
    if (o.suAvanzamento) o.suAvanzamento(totale ? Math.min(1, fatto / totale) : 1, f.percorso);
  }
}

// Il file di un aggiornamento gia' prescaricato, se quel percorso cambia; null altrimenti.
function fileInCantiere(cartellaViva, piano, percorso) {
  if (!piano) return null;
  const f = piano.daScaricare.find((x) => x.percorso === percorso);
  if (!f) return null;
  const p = path.join(cartellaViva, '.cantiere', f.sha256);
  return fs.existsSync(p) ? p : null;
}

async function applica(base, cartellaViva, piano, opzioni) {
  const cantiere = path.join(cartellaViva, '.cantiere');
  await prescarica(base, cartellaViva, piano, opzioni);
  // 2. al loro posto
  for (const f of piano.daScaricare) {
    const finale = path.join(cartellaViva, ...f.percorso.split('/'));
    await fsp.mkdir(path.dirname(finale), { recursive: true });
    await fsp.copyFile(path.join(cantiere, f.sha256), finale);
  }
  // 3. il manifesto per ultimo
  const tmp = path.join(cartellaViva, NOME_MANIFESTO + '.parziale');
  await fsp.writeFile(tmp, JSON.stringify(piano.remoto));
  await fsp.rename(tmp, path.join(cartellaViva, NOME_MANIFESTO));
  // 4. i file tolti (dalla viva: l'inclusa non si tocca, basta che il manifesto non li nomini) e il cantiere
  for (const p of piano.daTogliere) await fsp.rm(path.join(cartellaViva, ...p.split('/')), { force: true });
  await fsp.rm(cantiere, { recursive: true, force: true });
  return piano.remoto;
}

module.exports = { NOME_MANIFESTO, percorsoSicuro, improntaDi, leggiManifesto, confronta, manifestoEfficace, trovaFile, controlla, prescarica, fileInCantiere, applica };
