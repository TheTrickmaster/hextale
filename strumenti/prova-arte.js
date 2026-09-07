// L'ARTE DELLE CARTE SI AGGANCIA.
//
//     $ELECTRON strumenti/prova-arte.js
//
// Il difetto: il gioco cercava l'illustrazione di una carta SOLO in .jpg.
// Chi ne caricava una in .png o in .jpeg non lo scopriva — nessun errore,
// nessun avviso: il gioco chiedeva un indirizzo che non esiste, non trovava
// niente, e la carta restava col segnaposto. Cinque personaggi sono rimasti
// invisibili cosi'.
//
// PERCHE' NON BASTA GUARDARE LA COSTANTE. Che EST_ART sia diventata una lista
// di tre si vede leggendo il file; che il gioco USI tutte e tre no — fra la
// costante e la richiesta ci sono _candidatiArt, artUrlVariante,
// _livelliDiVariante e _primoCheEsiste, e basta che uno dei quattro sia rimasto
// indietro perche' non cambi niente.
// Quindi il banco non guarda la costante: guarda QUALI INDIRIZZI il gioco
// compone davvero, chiamando artUrlVariante — la funzione che sta a valle di
// tutti e quattro. Se fra quelli compaiono il .png e il .jpeg, allora tutta la
// catena li usa.
//
// Non si scarica niente: puntare ART_BASE a un server finto non si puo', perche'
// e' un `const` di primo livello, e un const non finisce su window —
// l'assegnazione crea una seconda proprieta' che il gioco non legge, e le
// richieste continuano ad andare al sito vero. Ci si e' persi mezz'ora.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.replace(/\\/g, '/') + '/play/index.html';
const ESTENSIONI = ['jpg', 'png', 'jpeg'];
const FINTO = 'banco-di-prova';   // uno slug che non esiste davvero

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
setTimeout(() => { console.error('PIANTATA'); app.exit(2); }, 150000);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 900, height: 700, frame: false,
    webPreferences: { contextIsolation: false, webSecurity: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 3500));

  const dette = [];
  const dice = (ok, che, perche) => dette.push({ ok: !!ok, che, perche: perche === undefined ? '' : String(perche) });

  // Le costanti dicono cosa il gioco SI PROPONE di fare. Il resto della prova
  // guarda cosa fa.
  const dichiarato = await win.webContents.executeJavaScript(`(function(){
    return { est: EST_ART, lista: Array.isArray(EST_ART),
             helper: typeof _candidatiArt === 'function' };
  })()`);
  dice(dichiarato.lista, 'EST_ART e- una lista, non una sola estensione', JSON.stringify(dichiarato.est));
  dice(ESTENSIONI.every(e => (dichiarato.est || []).indexOf(e) >= 0),
    'e sono jpg, png e jpeg', JSON.stringify(dichiarato.est));
  dice((dichiarato.est || [])[0] === 'jpg',
    'col jpg per primo: e- quasi tutta l-arte, e chi lo trova non paga le altre due',
    JSON.stringify(dichiarato.est));
  dice(dichiarato.helper, 'e c-e- un solo punto che compone gli indirizzi dell-arte');

  // Il cuore: QUALI INDIRIZZI il gioco compone per cercare l'illustrazione di
  // una carta. E' il passo che era rotto — ne componeva uno solo, in .jpg — e
  // sta a valle di tutta la catena: EST_ART, _candidatiArt, artUrlVariante.
  // Se qui compaiono tutte e tre le estensioni, tutti e tre i pezzi le usano.
  const indirizzi = await win.webContents.executeJavaScript(
    `(function(){ const u = artUrlVariante('banco-di-prova', 'dark');
       return { piatta: u.senzaNumero, livello3: u.per[3] }; })()`);

  for (const est of ESTENSIONI) {
    dice(indirizzi.piatta.some(u => u.endsWith('-dark.' + est)),
      'cerca l-illustrazione anche in .' + est, indirizzi.piatta.join(' '));
  }
  dice(indirizzi.piatta[0].endsWith('.jpg'), 'e prova il .jpg per primo', indirizzi.piatta[0]);
  for (const est of ESTENSIONI) {
    dice(indirizzi.livello3.some(u => u.endsWith('-dark-layer3.' + est)),
      'e i livelli d-arte pure, in .' + est, indirizzi.livello3.join(' '));
  }

  // E le due varianti speciali — il fumo del Caterpillar e la notte di Strigoi
  // — passano dallo stesso punto: erano due indirizzi scritti a mano, ed erano
  // due posti in cui la correzione poteva restare indietro.
  const speciali = await win.webContents.executeJavaScript(
    `(function(){ return { fumo: _candidatiArt('x/x-smoke-dark'), notte: _candidatiArt('x/x-night-dark') }; })()`);
  dice(ESTENSIONI.every(e => speciali.fumo.some(u => u.endsWith('.' + e))),
    'anche la variante fumo cerca tutte e tre', speciali.fumo.join(' '));
  dice(ESTENSIONI.every(e => speciali.notte.some(u => u.endsWith('.' + e))),
    'e la variante notte', speciali.notte.join(' '));

  // Un'illustrazione che sta davvero sul disco in .png deve comparire fra gli
  // indirizzi che il gioco chiederebbe. E' la prova che chiude il cerchio: il
  // file c'e', e adesso il gioco lo chiede.
  const png = await win.webContents.executeJavaScript(
    `artUrlVariante('fairy-godmother', 'dark').senzaNumero`);
  dice(png.some(u => u.endsWith('/fairy-godmother/fairy-godmother-dark.png')),
    'e Fairy Godmother, che ha l-arte in .png, adesso viene chiesta', png.join(' '));
  // ── L'ARTE CHE STA DAVVERO SUL DISCO ────────────────────────────────────
  // Non e' un controllo sul codice: e' un controllo sulla CARTELLA. Dice quali
  // illustrazioni ci sono e in che formato, cosi' chi ne carica una in un
  // formato che non e' ammesso lo scopre qui invece che in partita.
  const cartelle = fs.readdirSync(RADICE + '/cards/art', { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name);
  const fuoriFormato = [];
  const conteggio = {};
  for (const c of cartelle) {
    for (const f of fs.readdirSync(RADICE + '/cards/art/' + c)) {
      const m = /-(dark|light)(-layer\d|-smoke|-night)?\.([a-z0-9]+)$/i.exec(f);
      if (!m) continue;
      const est = m[3].toLowerCase();
      conteggio[est] = (conteggio[est] || 0) + 1;
      if (ESTENSIONI.indexOf(est) < 0) fuoriFormato.push(c + '/' + f);
    }
  }
  dice(fuoriFormato.length === 0, 'nessuna illustrazione in un formato non ammesso',
    fuoriFormato.slice(0, 6).join(' '));
  console.log('  --  sul disco: ' + Object.keys(conteggio).map(k => conteggio[k] + ' ' + k).join(', '));

  // E il nome della cartella deve essere lo slug della carta, altrimenti non la
  // si trova comunque — con qualunque estensione.
  // Il gioco cerca cards/art/<slug>/<slug>-<fazione>.<est>: un file che si
  // chiama diversamente dalla sua cartella non lo trova nessuno, con qualunque
  // estensione. Le varianti (-smoke, -night, -layerN) sono nomi buoni.
  const ospiti = [];
  for (const c of cartelle) {
    for (const f of fs.readdirSync(RADICE + '/cards/art/' + c)) {
      if (!/-(dark|light)\.[a-z0-9]+$/i.test(f)) continue;
      const suo = f.replace(/(-layer\d|-smoke|-night)?-(dark|light)\.[a-z0-9]+$/i, '');
      if (suo !== c) ospiti.push(c + '/' + f);
    }
  }
  // Non e' un errore del codice, e non tutti sono sbagliati: l'arte di una
  // carta in cui un'altra si trasforma sta di casa nella cartella della prima.
  // Ma nessuno di questi file verra' mai trovato per slug, quindi si dice.
  if (ospiti.length) console.log('  --  file che non si chiamano come la loro cartella (non li trova nessuno per slug):\n        '
    + ospiti.join('\n        '));

  let male = 0;
  for (const d of dette) {
    if (!d.ok) male++;
    console.log((d.ok ? '  ok  ' : '  NO  ') + d.che + (d.perche && !d.ok ? '  —  ' + d.perche : ''));
  }
  console.log('\n' + (dette.length - male) + ' su ' + dette.length +
    (male ? '  — ' + male + ' da sistemare' : '  — tutto a posto'));
  app.exit(male ? 1 : 0);
});
