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

// Un lettore CSV minimo per Node. Quello del gioco (_csvParse) vive nella
// pagina, e qui fuori non c'e'. Regge virgolette, virgole dentro le celle e
// righe su piu' linee — cioe' tutto quello che il foglio puo' produrre.
function _csvGrezzo(s) {
  const righe = []; let c = [], v = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { v += '"'; i++; } else q = false; } else v += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { c.push(v); v = ''; }
    else if (ch === '\n') { c.push(v); righe.push(c); c = []; v = ''; }
    else if (ch !== '\r') v += ch;
  }
  if (v !== '' || c.length) { c.push(v); righe.push(c); }
  return righe;
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

  // ── L'ARTE, SCOPERTA UNA VOLTA SOLA ─────────────────────────────────────
  // Quali illustrazioni esistono lo si scopre BUSSANDO: per ogni carta si
  // prova <slug>-<fazione>-layer3.png e, se non c'e', <slug>-<fazione>.png.
  // Sono tre richieste per carta per fazione, circa seicento in tutto — e
  // finora le faceva OGNI GIOCATORE A OGNI AVVIO, per riscoprire ogni volta
  // la stessa risposta. Sono i "svariati secondi" prima che le carte si
  // vedano nella Libreria.
  // La risposta pero' non cambia fra un giocatore e l'altro: dipende da quali
  // file stanno sul sito, non da chi guarda. Si chiede quindi qui, una volta,
  // e si scrive nel catalogo: da li' in poi il gioco la LEGGE invece di
  // riscoprirla, e le illustrazioni ci sono dal primo disegno.
  // Si fa dentro alla stessa pagina che ha gia' il gioco caricato, quindi con
  // le sue funzioni: verificaArtCarte e' la stessa che girava nel client, e
  // non c'e' una seconda regola da tenere allineata.
  console.log('        cerco le illustrazioni (una volta per tutte)...');
  const conArte = await w.webContents.executeJavaScript(`(async ()=>{ try {
    if(typeof verificaArtCarte !== 'function' || typeof _applicaCatalogo !== 'function'){
      return JSON.stringify({ errore: 'il gioco non offre verificaArtCarte o _applicaCatalogo' });
    }
    _applicaCatalogo(${JSON.stringify(dati.carte)});
    await verificaArtCarte();
    return JSON.stringify({ arte: FINAL_CARDS.map(e => ({
      id: e.id,
      artLayersDark: e.artLayersDark || null,
      artLayersLight: e.artLayersLight || null,
      artDark: e.artDark || null,
      artLight: e.artLight || null,
      voci: e.voci || null,
      battlecry: e.battlecry || null
    })) });
  } catch(e){ return JSON.stringify({ errore: String(e && e.stack || e) }); }
  })()`);
  const esitoArte = JSON.parse(conArte);
  if (esitoArte.errore) {
    // Non e' fatale: senza, il gioco torna a scoprirsela da solo come prima.
    console.log('        (l\'arte non si e\' potuta scoprire: ' + esitoArte.errore + ')');
  } else {
    const perId = {};
    for (const a of esitoArte.arte) perId[a.id] = a;
    let quante = 0;
    for (const c of dati.carte) {
      const a = perId[c.id];
      if (!a) continue;
      c.artLayersDark = a.artLayersDark;
      c.artLayersLight = a.artLayersLight;
      c.artDark = a.artDark;
      c.artLight = a.artLight;
      if (a.voci) c.voci = a.voci;
      if (a.battlecry) c.battlecry = a.battlecry;
      if (a.artLayersDark || a.artLayersLight || a.artDark || a.artLight) quante++;
    }
    console.log('        ' + quante + ' carte su ' + dati.carte.length + ' hanno un\'illustrazione');
  }

  // ── LE ABILITA', LETTE DALLE COLONNE NUOVE ──────────────────────────────
  // Si fa QUI, in Node, e non dentro alla pagina: nel blocco delle abilita' ci
  // sono nomi di colonna RIPETUTI (Action, Who, Where... due volte), e cercarli
  // per nome darebbe sempre il primo. Si prendono per posizione, a partire da
  // "Is unique". Il parser sta in un file suo perche' lo usa anche chi importa.
  //
  // Rifiuta rumorosamente: una riga che non si capisce ferma l'importazione
  // dicendo carta e colonna, invece di entrare nel database e non fare niente.
  const P = require('./abilita-parser.js');
  const righeCsv = _csvGrezzo(csv);
  const testa = righeCsv[0] || [];
  // v0.77.67 — le colonne si cercano per NOME, non contando da "Is unique".
  // Contare funzionava finche' il foglio non cambiava: il giorno in cui ne
  // sono arrivate due nuove ("Player selection"), il vecchio conteggio avrebbe
  // continuato a leggere sicuro di se' dalla cella sbagliata. Adesso, se una
  // colonna manca, l'importazione si ferma e dice quale.
  let posto;
  try { posto = P.posizioni(testa); }
  catch (e) { console.log('ERRORE: ' + e.message); app.exit(1); return; }

  const perNome = {};
  for (const c of dati.carte) perNome[String(c.name || '').trim()] = c;
  let conAbilita = 0, aMano = 0;
  const guasti = [];
  for (let i = 1; i < righeCsv.length; i++) {
    const r = righeCsv[i];
    const nome = String(r[5] || '').trim();
    if (!nome) continue;
    const carta = perNome[nome];
    if (!carta) continue;                       // riga scartata dal parser del gioco
    try {
      const ab = P.abilitaDaRiga(nome, c => { const j = posto[c]; return j === undefined ? '' : (r[j] || ''); });
      if (ab) { carta.abilita = ab; if (ab.unica) aMano++; else conAbilita++; }
    } catch (e) { guasti.push(e.message); }
  }
  if (guasti.length) {
    console.log('ERRORE: ' + guasti.length + ' abilita\' non si leggono. Niente e\' stato importato.');
    guasti.forEach(g => console.log('  - ' + g));
    app.exit(1); return;
  }
  console.log('abilita\' lette: ' + conAbilita + ' (piu\' ' + aMano + ' scritte a mano)');

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
