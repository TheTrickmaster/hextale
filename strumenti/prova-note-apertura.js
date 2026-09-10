// QUANDO LE NOTE DI RILASCIO SI APRONO DA SOLE.
//
//     $ELECTRON strumenti/prova-note-apertura.js
//
// Dalla v0.79.71 la regola e' di Lorenzo: da sole si aprono solo a chi TORNA,
// e solo se c'e' qualcosa di nuovo. Chi entra per la prima volta non se le
// trova davanti — non ha nessun "da quando manchi" da farsi raccontare.
//
// Sono quattro casi e uno di questi non si vede mai giocando, il che lo rende
// il piu' pericoloso: le preferenze (dove sta scritto cosa si e' gia' letto)
// arrivano col profilo, e possono arrivare DOPO che il menu si e' aperto.
// In quell'istante "non ho mai letto niente" e "non lo so ancora" si
// somigliano, e portano a due gesti opposti: il primo dice "segna e taci", il
// secondo "taci e non segnare". Confonderli vuol dire segnare come letto un
// aggiornamento che nessuno ha visto — e quell'aggiornamento e' perso per
// sempre, perche' il segno resta sul server.
//
// Il banco non guarda la finestra: guarda la DECISIONE, caso per caso.
const { app, BrowserWindow } = require('electron');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1400, height: 900,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 13000));

  const esito = await win.webContents.executeJavaScript(`(function(){
    const d = [];
    const dice = (ok, che, perche) => d.push({ ok:!!ok, che, perche: perche||'' });
    try{
      const ov = document.getElementById('patch-notes-overlay');
      const note = [{ versione:'v0.79.71', voci:['Minor bug fixes and improvements'] },
                    { versione:'v0.79.70', voci:['Something else'] }];
      // Si annota cosa viene SEGNATO come letto, senza scriverlo davvero: e'
      // meta- della decisione, e a schermo non si vede.
      let segnate = [];
      const veroRicorda = window.ricordaPatchNotesLette;
      window.ricordaPatchNotesLette = (v)=>{ segnate.push(v); PREFERENZE.patchNotesLette = String(v); };
      const prova = (chi, preferenzeArrivate, giaLetta)=>{
        ov.classList.remove('show');
        segnate = [];
        _preferenzeNote = preferenzeArrivate;
        PREFERENZE = giaLetta === null ? {} : { patchNotesLette: giaLetta };
        mostraPatchNotes(note, { automatico:true });
        return { aperta: ov.classList.contains('show'), segnate: segnate.slice() };
      };

      // ── 1. NON SI SA ANCORA ───────────────────────────────────────────────
      let r = prova('non si sa', false, null);
      dice(!r.aperta && r.segnate.length === 0,
        'se non si sa ancora cosa ha letto, non si apre e non si segna niente',
        'aperta=' + r.aperta + '  segnate=' + JSON.stringify(r.segnate) +
        '\\n        Segnare qui vorrebbe dire dire \"letto\" per conto di chi non ha visto\\n' +
        '        niente, e quell-aggiornamento sarebbe perso per sempre.');

      // ── 2. LA PRIMA VOLTA IN ASSOLUTO ─────────────────────────────────────
      r = prova('prima volta', true, null);
      dice(!r.aperta, 'alla prima entrata NON si aprono da sole');
      dice(r.segnate.length === 1 && r.segnate[0] === '0.79.71',
        'ma si segna dove si e- arrivati, o non si aprirebbero mai piu-',
        JSON.stringify(r.segnate) + '. Senza questo, chi entra resterebbe per sempre\\n' +
        '        \"uno che non ha mai letto\", e la regola del caso 4 non scatterebbe mai.');

      // ── 3. TORNA, E NON C-E- NIENTE DI NUOVO ──────────────────────────────
      r = prova('niente di nuovo', true, '0.79.71');
      dice(!r.aperta && r.segnate.length === 0,
        'chi torna e ha gia- letto l-ultima non viene disturbato',
        'aperta=' + r.aperta);

      // ── 4. TORNA, E C-E- DAVVERO NOVITA- ──────────────────────────────────
      r = prova('novita-', true, '0.79.68');
      dice(r.aperta, 'chi torna dopo un aggiornamento se le trova davanti');
      dice(r.segnate.length === 1 && r.segnate[0] === '0.79.71',
        'e da quel momento risulta in pari', JSON.stringify(r.segnate));

      // ── 5. E IL PULSANTE APRE SEMPRE ──────────────────────────────────────
      // Chiesto col pulsante non e- un'apertura automatica: si apre comunque,
      // anche a chi ha gia- letto tutto. E- l-unico modo di rileggerle.
      ov.classList.remove('show');
      segnate = [];
      _preferenzeNote = true;
      PREFERENZE = { patchNotesLette: '0.79.71' };
      mostraPatchNotes(note, {});
      dice(ov.classList.contains('show'), 'chieste col pulsante si aprono comunque');
      dice(segnate.length === 0, 'e chiederle non cambia cosa risulta letto', JSON.stringify(segnate));

      // ── 6. E IL RIQUADRO E- SEMPRE PIENO ──────────────────────────────────
      // Anche quando l-apertura automatica tace: il pulsante del menu deve
      // trovare le note aggiornate, non quelle di ieri.
      ov.classList.remove('show');
      document.getElementById('patch-notes-body').innerHTML = '';
      _preferenzeNote = true;
      PREFERENZE = { patchNotesLette: '0.79.71' };
      mostraPatchNotes(note, { automatico:true });
      dice(document.getElementById('patch-notes-body').querySelectorAll('.patch-versione').length === 2,
        'e il riquadro si riempie anche quando tace',
        document.getElementById('patch-notes-body').querySelectorAll('.patch-versione').length + ' versioni dentro');

      window.ricordaPatchNotesLette = veroRicorda;
      ov.classList.remove('show');
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
