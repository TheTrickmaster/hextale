// ══════════════════════════════════════════════════════════════════════════
// REIMPORTA LE CARTE: dal foglio Google al database del gioco.
// ══════════════════════════════════════════════════════════════════════════
// Si lancia con un doppio clic su reimporta.cmd. Fa cinque cose, in ordine, e
// SI FERMA alla prima che non torna:
//
//   1. scarica il foglio;
//   2. lo converte col parser del gioco (vedi converti.js);
//   3. CONTROLLA che i valori nel catalogo siano quelli del foglio;
//   4. controlla che non manchi niente di essenziale;
//   5. importa nel database.
//
// Il passaggio 3 non e' prudenza esagerata: e' successo davvero che il
// convertitore leggesse la colonna sbagliata per due lati su sei, e 57 carte
// su 83 siano finite nel database con numeri plausibili ma falsi. Nessun
// errore, nessun avviso: solo carte diverse da quelle scritte nel foglio. Da
// allora il catalogo non entra nel database se prima non e' stato confrontato,
// riga per riga, con la fonte.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const QUI = __dirname;
const RADICE = path.resolve(QUI, '..', '..');       // game-assets/
const CONFIG = path.join(QUI, 'configurazione.json');
const TMP = path.join(QUI, '.lavoro');

const SHEET_ID = '17atpUlgmzHMZibOMDKEMyr9LxN8o0aK18Gg-Q1Ziko4';
// Il gid del foglio "Cards DB". Fissarlo invece di prendere "il primo foglio"
// serve a non cambiare sorgente il giorno in cui qualcuno ne aggiunge un altro
// davanti.
const SHEET_GID = '0';

function muori(messaggio, consiglio) {
  console.log('\n  ✗ ' + messaggio);
  if (consiglio) console.log('\n    ' + consiglio.split('\n').join('\n    '));
  console.log('\n  Il database NON e\' stato toccato.\n');
  process.exit(1);
}
const passo = (n, t) => console.log('\n  [' + n + '/5] ' + t);

// ── configurazione ────────────────────────────────────────────────────────
if (!fs.existsSync(CONFIG)) {
  fs.writeFileSync(CONFIG, JSON.stringify({
    endpoint: 'https://api.hextalegame.com',
    chiaveHttp: 'INCOLLA QUI LA CHIAVE'
  }, null, 2));
  muori('manca la configurazione: ne ho creata una da riempire.',
    'Apri configurazione.json e incolla la chiave al posto di "INCOLLA QUI LA CHIAVE".\n' +
    'La chiave si legge dal server con:\n' +
    '  ssh root@45.59.124.211 "grep NAKAMA_HTTP_KEY /opt/nakama/.env"\n' +
    'Quel file NON va messo su GitHub: e\' gia\' escluso dal .gitignore.');
}
const conf = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
if (!conf.chiaveHttp || conf.chiaveHttp.indexOf('INCOLLA') === 0) {
  muori('la chiave in configurazione.json non e\' ancora stata messa.',
    'Leggila dal server con:\n  ssh root@45.59.124.211 "grep NAKAMA_HTTP_KEY /opt/nakama/.env"');
}

// ── il file del gioco ─────────────────────────────────────────────────────
// Dal 28/08/2026 il gioco non sta piu' nella radice: l'ultima versione vive in
// play/index.html e le altre in versions/ (vedi la REGOLA FISSA nell'handoff).
// Questa funzione cercava un Hextale_*.html nella radice e non lo trovava piu',
// quindi la reimportazione moriva prima di cominciare.
//
// Si guarda in tre posti, in ordine di verita': l'indirizzo stabile, poi
// l'archivio col numero piu' alto, poi la vecchia radice per i repository che
// non sono ancora stati riorganizzati.
function trovaGioco() {
  const inGioco = path.join(RADICE, 'play', 'index.html');
  if (fs.existsSync(inGioco)) return inGioco;

  const numero = f => {
    const pezzi = f.replace('Hextale_', '').replace('.html', '').split('.').map(Number);
    return (pezzi[0] || 0) * 1e6 + (pezzi[1] || 0) * 1e3 + (pezzi[2] || 0);
  };
  const cercaIn = cartella => {
    if (!fs.existsSync(cartella)) return null;
    const file = fs.readdirSync(cartella)
      .filter(f => f.indexOf('Hextale_') === 0 && f.slice(-5) === '.html');
    if (!file.length) return null;
    file.sort((a, b) => numero(b) - numero(a));
    return path.join(cartella, file[0]);
  };

  const archivio = cercaIn(path.join(RADICE, 'versions'));
  if (archivio) return archivio;
  const vecchio = cercaIn(RADICE);
  if (vecchio) return vecchio;

  muori('non trovo il file del gioco.',
    'L\'ho cercato in:\n' +
    '  ' + inGioco + '\n' +
    '  ' + path.join(RADICE, 'versions') + '\\Hextale_*.html\n' +
    '  ' + RADICE + '\\Hextale_*.html');
}

// ── un parser CSV INDIPENDENTE, per il controllo del passaggio 3 ──────────
// Deve essere indipendente da quello del gioco: se usasse lo stesso codice
// confronterebbe un risultato con se stesso, e un errore comune a entrambi
// passerebbe inosservato. E' esattamente cosi' che il guasto delle 57 carte
// sarebbe stato preso al primo colpo.
function leggiCsv(testo) {
  const righe = []; let campo = ''; let riga = []; let dentro = false;
  for (let i = 0; i < testo.length; i++) {
    const ch = testo[i];
    if (dentro) {
      if (ch === '"') { if (testo[i + 1] === '"') { campo += '"'; i++; } else dentro = false; }
      else campo += ch;
    } else if (ch === '"') dentro = true;
    else if (ch === ',') { riga.push(campo); campo = ''; }
    else if (ch === '\n') { riga.push(campo); righe.push(riga); riga = []; campo = ''; }
    else if (ch !== '\r') campo += ch;
  }
  if (campo || riga.length) { riga.push(campo); righe.push(riga); }
  return righe;
}

(async () => {
  console.log('\n  ══ REIMPORTAZIONE DELLE CARTE ══');
  if (!fs.existsSync(TMP)) fs.mkdirSync(TMP);
  const CSV = path.join(TMP, 'foglio.csv');
  const CATALOGO = path.join(TMP, 'catalogo.json');

  // ── 1. scarica ──────────────────────────────────────────────────────────
  passo(1, 'scarico il foglio...');
  // ── SI USA L'ESPORTAZIONE GREZZA, NON gviz ──────────────────────────────
  // gviz decide un TIPO per ogni colonna e scarta le celle che non ci
  // rientrano: le colonne dei lati sono numeriche, quindi una scaletta di
  // livelli come "0-0-0-0" (Excalibur) da li' non arriva affatto, e la carta
  // entra nel database con sei valori inventati. Verificato: da gviz i sei lati
  // di Excalibur tornano vuoti, da export tornano "0-0-0-0".
  // export?format=csv consegna le celle come sono scritte, che e' l'unica cosa
  // che qui interessa.
  const url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID +
    '/export?format=csv&gid=' + SHEET_GID;
  let testo;
  try {
    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    testo = await r.text();
  } catch (e) {
    muori('non riesco a scaricare il foglio: ' + e.message,
      'Controlla la rete. Se il foglio non e\' piu\' condiviso "con chiunque abbia il link",\n' +
      'Google risponde con una pagina di accesso invece che col CSV.');
  }
  if (testo.indexOf('Name') < 0 || testo.indexOf('NW') < 0) {
    muori('quello che e\' arrivato non sembra il foglio delle carte.',
      'Di solito succede quando il foglio non e\' leggibile da chi ha il link:\n' +
      'Google manda la pagina di accesso, che e\' testo ma non e\' un CSV.');
  }
  fs.writeFileSync(CSV, testo);
  console.log('        ' + testo.length + ' byte');

  // ── 2. converti ─────────────────────────────────────────────────────────
  const gioco = trovaGioco();
  passo(2, 'converto col parser di ' + path.basename(gioco) + '...');
  // Si punta all'ESEGUIBILE, non al .cmd: da Node 20 lanciare un .cmd senza
  // shell viene rifiutato, e passare da una shell aggiungerebbe un guscio in
  // mezzo che si mangia i codici d'uscita.
  const electron = process.platform === 'win32'
    ? path.join(RADICE, 'desktop', 'node_modules', 'electron', 'dist', 'electron.exe')
    : path.join(RADICE, 'desktop', 'node_modules', '.bin', 'electron');
  if (!fs.existsSync(electron)) {
    muori('non trovo Electron in desktop/node_modules.',
      'Serve per usare il parser del gioco. Si installa una volta sola:\n  cd desktop && npm install');
  }
  try {
    const out = execFileSync(electron, [path.join(QUI, 'converti.js'), CSV, gioco, CATALOGO],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const riga = out.split('\n').filter(x => x.indexOf('convertite') >= 0 || x.indexOf('ERRORE') >= 0)[0];
    console.log('        ' + (riga || '').trim());
    if (!fs.existsSync(CATALOGO)) muori('la conversione non ha prodotto niente.', out.slice(-600));
  } catch (e) {
    muori('la conversione e\' fallita.', String((e.stdout || '') + (e.stderr || '')).slice(-800));
  }
  const catalogo = JSON.parse(fs.readFileSync(CATALOGO, 'utf8'));

  // ── 3. i valori sono quelli del foglio? ─────────────────────────────────
  passo(3, 'controllo i valori contro il foglio, riga per riga...');
  const righe = leggiCsv(testo);
  const intest = righe[0].map(x => String(x || '').trim());
  const col = {}; intest.forEach((n, j) => { if (!(n in col)) col[n] = j; });
  const LATI = ['NW', 'NE', 'E', 'SE', 'SW', 'W'];

  const indici = catalogo.indiciLati || {};
  const distinti = new Set(Object.values(indici));
  if (distinti.size !== 6) {
    muori('i sei lati non stanno su sei colonne diverse: ' + JSON.stringify(indici),
      'E\' il sintomo esatto del guasto che ha falsato 57 carte: due lati che finiscono\n' +
      'sulla stessa colonna. Non importare finche\' non e\' risolto.');
  }

  const dalFoglio = {};
  for (let i = 1; i < righe.length; i++) {
    const nome = String(righe[i][col['Name']] || '').trim();
    if (!nome) continue;
    dalFoglio[nome] = LATI.map(l => String(righe[i][col[l]] || '').trim());
  }
  const diversi = [];
  for (const c of catalogo.carte) {
    const atteso = dalFoglio[c.name];
    if (!atteso) { diversi.push(c.name + ': non c\'e\' nel foglio'); continue; }
    const base = c.valuesBase || {};
    const trovato = LATI.map(l => String(base[l] === undefined ? '' : base[l]));
    // Una scaletta "4-6-7-7" nel foglio corrisponde al primo numero.
    const primo = atteso.map(v => v.indexOf('-') >= 0 ? v.split('-')[0] : v);
    if (trovato.join(',') !== atteso.join(',') && trovato.join(',') !== primo.join(',')) {
      diversi.push(c.name + ': foglio=' + atteso.join(',') + ' catalogo=' + trovato.join(','));
    }
  }
  if (diversi.length) {
    muori(diversi.length + ' carte hanno valori DIVERSI da quelli del foglio.',
      diversi.slice(0, 10).join('\n') + (diversi.length > 10 ? '\n... e altre ' + (diversi.length - 10) : ''));
  }
  console.log('        ' + catalogo.carte.length + ' carte, tutti i valori combaciano');

  // ── 4. controlli di sanita' ─────────────────────────────────────────────
  passo(4, 'controllo che non manchi niente...');
  const problemi = [];
  const slug = new Map();
  const perMazzo = { 1: 0, 2: 0, 3: 0 };
  for (const c of catalogo.carte) {
    if (!c.name) problemi.push('una carta non ha nome');
    if (c.numero === null || c.numero === undefined) problemi.push('"' + c.name + '" non ha un ID nel foglio');
    if (slug.has(c.slug)) problemi.push('due carte con lo stesso slug: ' + slug.get(c.slug) + ' e ' + c.name);
    slug.set(c.slug, c.name);
    for (const n of (c.starterDecks || [])) {
      if (n < 1 || n > 3) problemi.push('"' + c.name + '" ha uno starter deck fuori da 1-3: ' + n);
      else perMazzo[n]++;
    }
  }
  if (problemi.length) {
    muori(problemi.length + ' problemi nel foglio.',
      problemi.slice(0, 10).join('\n') + (problemi.length > 10 ? '\n... e altri ' + (problemi.length - 10) : ''));
  }
  // Il punto esclamativo davanti alla chiave vuol dire "dichiarata ma non
  // scritta nel codice". Dalla v0.77.57 pero' un'abilita' puo' funzionare
  // senza codice, se le colonne del foglio la descrivono: quelle NON vanno
  // piu' contate fra le mancanti, o l'avviso direbbe il falso proprio sulle
  // carte appena sistemate.
  const senzaAbilita = catalogo.carte.filter(c =>
    String(c.cardAbility || '').charAt(0) === '!' && !(c.abilita && !c.abilita.unica));
  const abilitaDalFoglio = catalogo.carte.filter(c => c.abilita && !c.abilita.unica).length;
  const abilitaAMano = catalogo.carte.filter(c => c.abilita && c.abilita.unica).length;
  console.log('        abilita\' dal foglio: ' + abilitaDalFoglio
    + ' (piu\' ' + abilitaAMano + ' scritte a mano)');
  console.log('        mazzi starter: 1 -> ' + perMazzo[1] + ' carte, 2 -> ' + perMazzo[2] + ', 3 -> ' + perMazzo[3]);
  if (senzaAbilita.length) {
    // Non e' un errore: la carta entra in gioco e mostra NO_SCRIPT. Si dice e basta.
    console.log('        NOTA: ' + senzaAbilita.length + ' abilita\' dichiarate ma non programmate — '
      + senzaAbilita.map(c => c.name).join(', '));
  }

  // ── 5. importa ──────────────────────────────────────────────────────────
  passo(5, 'importo nel database...');
  delete catalogo.indiciLati; delete catalogo.scartate;
  let esito;
  try {
    const r = await fetch(conf.endpoint + '/v2/rpc/hx_importa?http_key=' +
      encodeURIComponent(conf.chiaveHttp) + '&unwrap', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catalogo)
    });
    const t = await r.text();
    if (!r.ok) muori('il server ha rifiutato l\'importazione (HTTP ' + r.status + ').',
      t.indexOf('HTTP key') >= 0
        ? 'La chiave in configurazione.json non e\' quella del server.\n  ssh root@45.59.124.211 "grep NAKAMA_HTTP_KEY /opt/nakama/.env"'
        : t.slice(0, 400));
    esito = JSON.parse(t);
  } catch (e) {
    muori('non riesco a parlare col server: ' + e.message,
      'Controlla che ' + conf.endpoint + ' risponda.');
  }

  console.log('\n  ✓ FATTO: ' + esito.carte + ' carte nel database.');
  console.log('    versione ' + esito.versione);
  console.log('\n    I giocatori la prendono al prossimo accesso: il gioco confronta la\n' +
              '    versione con quella che ha in cache e si aggiorna da solo.\n');
})();
