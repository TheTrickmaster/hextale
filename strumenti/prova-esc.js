// ESC CHIUDE LA FINESTRA PIU' IN ALTO — E SOLO QUELLA CHE SI PUO' LASCIARE.
//
//     $ELECTRON strumenti/prova-esc.js
//
// Dalla v0.79.72 Esc non chiude: fa quello che farebbe un clic sul VELO della
// finestra piu' in alto. Il bello e' cio' che non serve dire — una finestra che
// si puo' gia' lasciare cliccando fuori si lascia anche con Esc, senza
// aggiungersi a nessuna lista — ma proprio per questo il difetto, se c'e', e'
// silenzioso in tutte e due le direzioni:
//
//   - una finestra che DOVREBBE chiudersi e non si chiude: nessuno se ne
//     accorge finche' non ci prova, e chi ci prova pensa di aver sbagliato tasto;
//   - una finestra che NON deve chiudersi e si chiude: l'accordo del playtest,
//     la scelta della lettera, il blocco del client vecchio. Sono le tre porte
//     da cui si passa DECIDENDO, e Esc che le apre le trasforma in tre porte
//     che si tolgono di mezzo.
//
// Il banco apre ogni finestra per davvero e preme Esc per davvero.
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

  const esito = await win.webContents.executeJavaScript(`(async function(){
    const d = [];
    const dice = (ok, che, perche) => d.push({ ok:!!ok, che, perche: perche||'' });
    const attendi = (ms)=>new Promise(r=>setTimeout(r,ms));
    const esc = ()=>document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
    const aperta = (id)=>{ const e=document.getElementById(id); return !!e && e.classList.contains('show'); };
    const spegniTutto = ()=>document.querySelectorAll('.show').forEach(e=>{
      if(/-overlay$/.test(e.id)) e.classList.remove('show'); });
    try{
      ['splash','start-screen'].forEach(id=>{ const e=document.getElementById(id); if(e) e.style.display='none'; });

      // ── 1. QUELLE CHE SI LASCIANO ─────────────────────────────────────────
      // Si aprono a mano, senza passare dai loro apri*(): qui interessa il velo,
      // non come ci si arriva.
      // Due di queste vivono DENTRO alla Collezione, e le pagine sono
      // ermetiche: dal tavolo non sono nel documento. Montarla e- l-unico modo
      // di guardarle davvero — chiederglielo da qui direbbe "non si chiude"
      // per il motivo sbagliato, cioe- perche- non c-e-.
      showPage('collection');
      await attendi(500);
      const siLasciano = ['report-overlay','bug-overlay','patch-notes-overlay','filters-overlay',
                          'elimina-overlay','avatar-overlay','avviso-overlay','settings-modal-overlay',
                          'delete-overlay','mm-play-overlay','mm2-deck-overlay'];
      const restate = [];
      for(const id of siLasciano){
        spegniTutto();
        const el = document.getElementById(id);
        if(!el){ restate.push(id + ' (non esiste)'); continue; }
        el.classList.add('show');
        await attendi(40);
        esc();
        await attendi(120);
        if(aperta(id)) restate.push(id);
      }
      dice(restate.length === 0, 'Esc chiude le ' + siLasciano.length + ' finestre che si possono lasciare',
        restate.length ? 'sono rimaste aperte: ' + restate.join(', ') : siLasciano.join(', '));

      // ── 2. QUELLE DA CUI SI PASSA DECIDENDO ───────────────────────────────
      // Non hanno un velo che si chiude, e non devono averlo: Esc non le tocca.
      const siDecidono = ['nca-overlay','starter-overlay','disclaimer-overlay','aggiorna-overlay','username-overlay'];
      const cadute = [];
      for(const id of siDecidono){
        spegniTutto();
        const el = document.getElementById(id);
        if(!el){ cadute.push(id + ' (non esiste)'); continue; }
        el.classList.add('show');
        await attendi(40);
        esc();
        await attendi(120);
        if(!aperta(id)) cadute.push(id);
      }
      dice(cadute.length === 0, 'e non tocca le ' + siDecidono.length + ' da cui si passa decidendo',
        cadute.length ? 'si sono chiuse: ' + cadute.join(', ') : siDecidono.join(', '));

      // ── 3. UNA SOLA PER VOLTA, LA PIU' IN ALTO ────────────────────────────
      // Un mazzo aperto sotto l'ingrandimento di una carta: Esc deve richiudere
      // la carta e lasciare il mazzo dov'e-.
      spegniTutto();
      document.getElementById('mm2-deck-overlay').classList.add('show');
      document.getElementById('card-modal-overlay').classList.add('show');
      await attendi(40);
      esc();
      await attendi(150);
      dice(!aperta('card-modal-overlay') && aperta('mm2-deck-overlay'),
        'con due aperte se ne chiude UNA, la piu- in alto',
        'carta ' + (aperta('card-modal-overlay') ? 'ancora aperta' : 'chiusa') +
        ', mazzo ' + (aperta('mm2-deck-overlay') ? 'ancora aperto' : 'chiuso') +
        '.\\n        Chiuderle tutte e due vorrebbe dire perdere il lavoro sul mazzo per\\n' +
        '        aver guardato una carta.');
      esc();
      await attendi(150);
      dice(!aperta('mm2-deck-overlay'), 'e premendolo ancora si chiude anche quella sotto');

      // ── 4. E CON LA SCELTA DEL NOME APERTA, ESC NON TOCCA NIENTE ──────────
      spegniTutto();
      document.getElementById('bug-overlay').classList.add('show');
      document.getElementById('username-overlay').classList.add('show');
      await attendi(40);
      esc();
      await attendi(150);
      dice(aperta('bug-overlay') && aperta('username-overlay'),
        'finche- si sceglie il nome, Esc non chiude nemmeno cio- che sta sotto',
        'La scelta sarebbe forzata solo all-apparenza se la catena continuasse a\\n' +
        '        lavorare sotto di lei.');
      spegniTutto();
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
