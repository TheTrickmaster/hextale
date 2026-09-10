// IL TESTO DELLE ABILITA' DISEGNATO SULLA CARTA, PAROLA PER PAROLA.
//
//     $ELECTRON strumenti/prova-spazi.js
//
// Lorenzo il 10/09/2026: il Cowardly Lion recitava "When Played , Inflicts -1
// RAND to itself" — uno spazio fra "Played" e la virgola. Nel foglio la virgola
// e' attaccata; a metterlo era il gioco.
//
// PERCHE' SUCCEDEVA, ed e' il genere di cosa che nessuno riprova a mano su
// centoundici carte: per andare a capo il testo va spezzato in parole, e lo si
// faceva con `split(/\s+/)`, che gli spazi li BUTTA. Da li' in poi nessuno
// sapeva piu' dove fossero, e chi disegna ne rimetteva uno fra ogni parola e la
// successiva. Con un grassetto seguito da punteggiatura la punteggiatura
// diventa una parola per conto suo, e si prende il suo spazio davanti.
//
// L'INVARIANTE. Il testo DISEGNATO, rimesso insieme, dev'essere esattamente il
// testo del FOGLIO senza i marcatori. Non "simile": uguale. Questo banco lo
// chiede per ogni abilita' del catalogo — e' l'unico modo di sapere che non c'e'
// una seconda carta con lo stesso difetto e nessuno che ci abbia guardato.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';
const CATALOGO = path.join(RADICE, 'server/importazione/.lavoro/catalogo.json');

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  let carte = [];
  try { carte = JSON.parse(fs.readFileSync(CATALOGO, 'utf8')).carte; }
  catch(_) { console.error('manca ' + CATALOGO + ': serve il catalogo importato.'); app.exit(1); return; }
  const testi = carte.map(c => c.abilityDescSheet || '').filter(s => s.trim());

  const win = new BrowserWindow({ show: false, width: 1400, height: 900,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 13000));

  const esito = await win.webContents.executeJavaScript(`(function(){
    const d = [];
    const dice = (ok, che, perche) => d.push({ ok:!!ok, che, perche: perche||'' });
    const testi = ${JSON.stringify(testi)};
    try{
      // Il testo com'e' a schermo: si rimettono insieme le righe e i tratti
      // esattamente come fa chi disegna (vedi il <tspan> in buildFullHandCardSVG).
      const disegnato = (testo, larghezza) => svgWrapBoldWords(testo, larghezza, "'Rosarivo',serif", 13)
        .map(runs => runs.map((r,i) => (i>0 && r.spazioPrima ? ' ' : '') + r.text).join(''))
        .join(' ');
      const atteso = testo => testoSenzaMarcatori(testo).replace(/\\s+/g,' ').trim();

      // ── 1. IL CASO RACCONTATO ─────────────────────────────────────────────
      const leone = 'When *Played*, *Inflicts* -1 RAND to itself';
      dice(disegnato(leone, 800) === 'When Played, Inflicts -1 RAND to itself',
        'il Cowardly Lion non ha piu- lo spazio prima della virgola',
        '"' + disegnato(leone, 800) + '"');

      // ── 2. E NESSUN ALTRO CE L-HA ─────────────────────────────────────────
      // Ogni abilita' del catalogo, a due larghezze: una che sta su una riga
      // sola e una che manda a capo spesso. L'andata a capo e- proprio il posto
      // in cui uno spazio si puo' perdere o guadagnare.
      const storte = [];
      for(const testo of testi){
        for(const larghezza of [2000, 150]){
          const ho = disegnato(testo, larghezza), voglio = atteso(testo);
          if(ho !== voglio) storte.push('(' + larghezza + ') "' + ho + '"\\n              invece di "' + voglio + '"');
        }
      }
      dice(storte.length === 0,
        'e il testo disegnato e- quello del foglio, per tutte le ' + testi.length + ' abilita-',
        storte.length ? storte.slice(0, 6).join('\\n        ') : 'due larghezze ciascuna: una riga sola, e a capo spesso');

      // ── 3. GLI SPAZI NON SI PERDONO NEMMENO ───────────────────────────────
      // Il difetto opposto, che questo controllo prende da solo: due parole
      // attaccate perche' lo spazio fra un tratto e l'altro non e- stato messo.
      dice(disegnato('*Steals* 1 Power from *every* enemy', 2000) === 'Steals 1 Power from every enemy',
        'e due parole di stile diverso restano staccate',
        '"' + disegnato('*Steals* 1 Power from *every* enemy', 2000) + '"');
      dice(disegnato('(*On play*) do a thing', 2000) === '(On play) do a thing',
        'e una parentesi resta attaccata a cio- che apre',
        '"' + disegnato('(*On play*) do a thing', 2000) + '"');

      // ── 4. E L-ANDATA A CAPO NON SI E- SPOSTATA ───────────────────────────
      // La larghezza si misura contando gli spazi VERI: se se ne contasse uno
      // di troppo, una riga andrebbe a capo un pelo prima del dovuto.
      const righe = svgWrapBoldWords(testi.find(s=>s.length>80) || leone, 150, "'Rosarivo',serif", 13);
      dice(righe.length > 1, 'un testo lungo va a capo davvero', righe.length + ' righe');
      dice(righe.every(runs => runs.length && !runs[0].spazioPrima),
        'e nessuna riga comincia con uno spazio');
      return { d };
    }catch(e){ return { guasto:(e&&e.message)+' '+String((e&&e.stack)||'').split(String.fromCharCode(10))[1], d }; }
  })()`);

  if (esito.guasto) {
    console.error('GUASTO: ' + esito.guasto);
    for (const x of (esito.d||[])) console.log((x.ok?'  ok   ':'  NO   ') + x.che);
    app.exit(1); return;
  }
  let male = 0;
  for (const x of esito.d) {
    if (!x.ok) male++;
    console.log((x.ok ? '  ok   ' : '  NO   ') + x.che);
    if (x.perche) console.log('        ' + x.perche);
  }
  console.log(male ? '\n' + male + ' cose non tornano' : '\ntutto a posto (' + esito.d.length + ' controlli)');
  app.exit(male ? 1 : 0);
}).catch(e => { console.error(e); app.exit(1); });
