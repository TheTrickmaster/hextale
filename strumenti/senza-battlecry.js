// Chi non ha ancora un grido di battaglia.
//
//   node strumenti/senza-battlecry.js [rare mythic timeless ...]
//
// Senza argomenti guarda tutte le carte; passando delle rarita' si restringe.
// Il risultato finisce sia a schermo sia in strumenti/senza-battlecry.txt.
//
// PERCHE' LEGGE IL FOGLIO E NON IL GIOCO. L'elenco delle carte non sta in
// nessun file del deposito: il gioco se lo fa dare dal server, e il server dal
// foglio. Aperto da file:// e senza accesso, il gioco ripiega su tre carte
// finte — ci ho provato, e sono uscite tre righe. La fonte vera e' il foglio,
// che e' esportabile in CSV senza chiedere niente a nessuno.
//
// PERCHE' LO SLUG SI RICALCOLA. I gridi si chiamano <slug>-battlecry.mp3, e lo
// slug lo ricava il gioco dal NOME con slugPersonaggio: qui si usa la stessa
// identica regola, o si finirebbe a cercare file con un altro nome e a
// dichiarare mancante roba che c'e'.
const fs = require('fs');
const path = require('path');
const https = require('https');

const SHEET = '17atpUlgmzHMZibOMDKEMyr9LxN8o0aK18Gg-Q1Ziko4';
const URL = 'https://docs.google.com/spreadsheets/d/' + SHEET + '/export?format=csv&gid=0&t=' + Date.now();
const VOCI = path.resolve(__dirname, '..', 'audio', 'voices');
const USCITA = path.resolve(__dirname, 'senza-battlecry.txt');

// La stessa di play/index.html. Le accentate si riducono alla base, non si
// buttano: "Ariel" con l'accento deve dare "ariel" e non "ari-l".
function slugPersonaggio(nome){
  return String(nome||'')
    .trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}

// Un CSV con le virgolette: una cella puo' contenere virgole e a capo, e
// spezzare sulle virgole a occhio sposterebbe tutte le colonne dopo la prima
// descrizione con una virgola dentro.
function righeCsv(testo){
  const righe = [];
  let riga = [], cella = '', dentro = false;
  for (let i = 0; i < testo.length; i++){
    const c = testo[i];
    if (dentro){
      if (c === '"'){ if (testo[i+1] === '"'){ cella += '"'; i++; } else dentro = false; }
      else cella += c;
    } else if (c === '"') dentro = true;
    else if (c === ','){ riga.push(cella); cella = ''; }
    else if (c === '\n'){ riga.push(cella); righe.push(riga); riga = []; cella = ''; }
    else if (c !== '\r') cella += c;
  }
  if (cella.length || riga.length){ riga.push(cella); righe.push(riga); }
  return righe;
}

const fuori = [];
function stampa(s){ fuori.push(String(s === undefined ? '' : s)); }

function scarica(url, poi){
  https.get(url, (r) => {
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return scarica(r.headers.location, poi);
    let dati = '';
    r.on('data', c => dati += c);
    r.on('end', () => poi(dati));
  }).on('error', (e) => {
    console.error('non si e\' potuto leggere il foglio: ' + e.message);
    process.exit(1);
  });
}

scarica(URL, (dati) => {
  const righe = righeCsv(dati);
  const testata = (righe[0] || []).map(s => String(s).trim().toLowerCase());
  const iNome = testata.findIndex(s => s === 'name' || s === 'nome');
  const iRar  = testata.findIndex(s => s === 'rarity' || s === 'rarita' || s === "rarita'");
  if (iNome < 0 || iRar < 0){
    console.error('non trovo le colonne name/rarity. Testata: ' + testata.filter(Boolean).join(' | '));
    process.exit(1);
  }

  const gridi = new Set(fs.readdirSync(VOCI)
    .filter(f => f.endsWith('-battlecry.mp3'))
    .map(f => f.slice(0, -('-battlecry.mp3'.length))));

  // Il foglio ha una riga per LIVELLO: lo stesso personaggio compare piu'
  // volte, e senza questo controllo lo si conterebbe quattro volte.
  const visti = new Set();
  const carte = [];
  for (let i = 1; i < righe.length; i++){
    const nome = String(righe[i][iNome] || '').trim();
    if (!nome) continue;
    const slug = slugPersonaggio(nome);
    if (!slug || visti.has(slug)) continue;
    visti.add(slug);
    carte.push({ nome, slug, rar: String(righe[i][iRar] || '').trim().toLowerCase() });
  }

  const chieste = process.argv.slice(2).map(s => s.toLowerCase());
  const ordine = ['timeless','mythic','rare','common'];
  const scelte = carte.filter(c => !chieste.length || chieste.includes(c.rar));
  const senza = scelte.filter(c => !gridi.has(c.slug));
  senza.sort((a,b) => (ordine.indexOf(a.rar) - ordine.indexOf(b.rar)) || a.nome.localeCompare(b.nome));

  stampa('carte nel foglio: ' + carte.length + '   guardate: ' + scelte.length
    + (chieste.length ? ' (' + chieste.join(', ') + ')' : ''));
  stampa('senza grido di battaglia: ' + senza.length);
  stampa('');
  let rar = null;
  for (const c of senza){
    if (c.rar !== rar){ rar = c.rar; stampa('== ' + (rar || 'senza rarita\'').toUpperCase()
      + ' (' + senza.filter(x => x.rar === rar).length + ') =='); }
    stampa('   ' + c.nome.padEnd(30) + c.slug);
  }
  if (!senza.length) stampa('   nessuno: ce l\'hanno tutti.');

  // E il contrario: un file che non corrisponde a nessun nome del foglio e' un
  // grido che nessuno urlera' mai — di norma vuol dire che la carta e' stata
  // rinominata e il file e' rimasto col nome vecchio.
  const orfani = [...gridi].filter(s => !visti.has(s)).sort();
  if (orfani.length){
    stampa('');
    stampa('gridi senza una carta nel foglio (' + orfani.length + '), probabile nome cambiato:');
    for (const s of orfani) stampa('   ' + s + '-battlecry.mp3');
  }

  const testo = fuori.join('\n') + '\n';
  fs.writeFileSync(USCITA, testo);
  process.stdout.write(testo);
  // Lo stdout di node viene troncato se il processo esce mentre sta ancora
  // svuotando: si aspetta che abbia finito. La copia su file c'e' comunque.
  process.stdout.write('', () => process.exit(0));
});
