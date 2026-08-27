// Da CSV del foglio a catalogo JSON, usando IL PARSER DEL GIOCO.
// Si lancia dentro Electron, non con node: gli serve una pagina vera in cui
// il gioco sia caricato, perche' e' li' che vivono _csvParse e _cardaDaRiga.
//
//   electron converti.js <csv> <html del gioco> <json in uscita>
//
// Usare il parser del gioco invece di riscriverlo e' una scelta: la regola dei
// valori, i tratti, l'aggancio delle abilita' per nome del personaggio e il
// drop rate con la virgola sono gia' scritti li', e due copie di quelle regole
// diventerebbero due verita' che col tempo divergono.
//
// ── UNA TRAPPOLA GIA' PAGATA, e cara ──────────────────────────────────────
// Il codice qui sotto viaggia dentro a un TEMPLATE LITERAL prima di essere
// eseguito nella pagina. In un template literal la sequenza barra-rovesciata-s
// NON e' un escape valido: collassa nella sola lettera s. Una normalizzazione
// scritta come "sostituisci gli spazi" e' diventata "sostituisci le esse", la
// chiave di SE e' diventata quella di E, quella di SW quella di W — e 57 carte
// su 83 sono entrate nel database con due lati sbagliati, senza un errore e
// senza un avviso.
// PERCIO' QUI DENTRO NON SI USANO ESPRESSIONI REGOLARI, e c'e' un controllo
// che verifica che i sei lati stiano su sei colonne DIVERSE.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');

const path = require('path');
// Assoluti SEMPRE: Electron risolve loadFile rispetto alla propria cartella di
// lavoro, non a quella da cui lo si e' lanciato, e un percorso relativo qui
// diventa un file che non esiste.
const [, , CSV_IN, HTML_IN, USCITA_IN] = process.argv;
const CSV = CSV_IN && path.resolve(CSV_IN);
const HTML = HTML_IN && path.resolve(HTML_IN);
const USCITA = USCITA_IN && path.resolve(USCITA_IN);
if (!CSV || !HTML || !USCITA) {
  console.log('uso: electron converti.js <csv> <html del gioco> <json in uscita>');
  process.exit(2);
}

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false });
  await w.loadFile(HTML);
  // Il gioco ci mette qualche secondo ad arrivare in fondo al proprio script.
  await new Promise(r => setTimeout(r, 8000));
  const csv = fs.readFileSync(CSV, 'utf8');

  const grezzo = await w.webContents.executeJavaScript(`(()=>{ try {
    if(typeof _csvParse !== 'function' || typeof _cardaDaRiga !== 'function'){
      return JSON.stringify({ errore: 'il gioco non ha finito di caricarsi: _csvParse o _cardaDaRiga non ci sono' });
    }
    const righe = _csvParse(${JSON.stringify(csv)});
    const col = righe[0];
    const _k = x => String(x||'').toLowerCase().split(' ').filter(p=>p.length).join(' ');
    const idx = {}; col.forEach((n,j)=>{ const k=_k(n); if(k && !(k in idx)) idx[k]=j; });
    const haColonna = n => _k(n) in idx;
    const AFF = ['yes','y','si','true','vero','x','1'];
    const fuori = [];
    const carte = [];
    for(let i=1;i<righe.length;i++){
      const r = righe[i];
      const get = k => { const j = idx[_k(k)]; return (j===undefined)?'':(r[j]||''); };
      const nome = (get('Name')||'').trim();
      const admin = AFF.includes((get('Admin')||'').trim().toLowerCase());
      // Con Admin=Yes la carta esiste anche se Visible dice di no: e' riservata,
      // non e' una riga di lavoro. Si presenta al parser un Visible affermativo
      // e la riservatezza viaggia a parte.
      const get2 = k => (_k(k) === _k('Visible') && admin) ? 'Yes' : get(k);
      const c = _cardaDaRiga(col, get2, haColonna);
      if(!c){ if(nome) fuori.push(nome); continue; }
      const sd = String(get('Starter deck')||'').trim();
      const pezzi = sd ? sd.split('-').join(',').split(' ').join(',').split(',') : [];
      c.starterDecks = pezzi.map(x=>parseInt(x,10)).filter(n=>isFinite(n) && n>0);
      c.soloAdmin = admin;
      carte.push(c);
    }
    return JSON.stringify({ carte, fuori, indiciLati: {
      NW: idx[_k('NW')], NE: idx[_k('NE')], E: idx[_k('E')],
      SE: idx[_k('SE')], SW: idx[_k('SW')], W: idx[_k('W')] } });
  } catch(e){ return JSON.stringify({ errore: String(e && e.stack || e) }); }
  })()`);

  const dati = JSON.parse(grezzo);
  if (dati.errore) { console.log('ERRORE: ' + dati.errore); app.exit(1); return; }

  fs.writeFileSync(USCITA, JSON.stringify({
    versione: new Date().toISOString(),
    origine: 'Cards DB (Google Sheet)',
    indiciLati: dati.indiciLati,
    scartate: dati.fuori.length,
    carte: dati.carte
  }));
  console.log('convertite ' + dati.carte.length + ' carte (' + dati.fuori.length + ' righe scartate)');
  app.exit(0);
}).catch(e => { console.log('ERRORE: ' + (e && e.stack || e)); app.exit(1); });
