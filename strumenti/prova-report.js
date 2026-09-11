// SEGNALARE UN GIOCATORE.
//
//     $ELECTRON strumenti/prova-report.js [scatto.png]
//
// Un pulsante speculare a quello delle impostazioni, e una finestra che manda
// un'email a una casella che qualcuno legge davvero. Due cose vanno tenute
// ferme, e sono di natura diversa.
//
// LA FORMA: "speculare" e' una parola, e qui diventa una misura. Stessa
// grandezza, stessa altezza dal bordo, e la distanza da destra uguale a quella
// da sinistra dell'altro. Due pulsanti quasi speculari non sembrano un errore,
// sembrano una svista di chi guarda.
//
// LA SOSTANZA, e conta di piu': il client NON manda il nome dell'accusato.
// Manda l'identificativo del tavolo, e chi ci fosse seduto lo dice il server
// dal registro scritto a inizio partita. Se il nome lo dicesse il client,
// chiunque potrebbe accusare chiunque senza averlo mai incontrato — e sarebbe
// una segnalazione che arriva a una persona vera, con dentro un nome vero.
// Questo banco guarda cosa parte davvero, non cosa la finestra mostra.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';
const SCATTO = process.argv[2] || '';

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, frame: false,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 14000));

  const esito = await win.webContents.executeJavaScript(`(async function(){
    const d = [];
    const dice = (ok, che, perche) => d.push({ ok:!!ok, che, perche: perche||'' });
    const attendi = (ms)=>new Promise(r=>setTimeout(r,ms));
    try{
      ['splash','patch-notes-overlay','start-screen'].forEach(id=>{
        const e=document.getElementById(id); if(e) e.style.display='none'; });
      showPage('game');
      await attendi(300);

      // ── 1. IL PULSANTE, SPECULARE ─────────────────────────────────────────
      const rep = document.getElementById('report-btn');
      const imp = document.getElementById('settings-btn');
      dice(!!rep && !!imp, 'i due pulsanti ci sono');
      if(!rep || !imp) return { d };
      // Si accendono tutti e due per misurarli: da spenti non hanno posizione.
      imp.style.display = 'block'; rep.style.display = 'block';
      await attendi(60);
      const r = rep.getBoundingClientRect(), i = imp.getBoundingClientRect();
      dice(Math.round(r.width) === Math.round(i.width) && Math.round(r.height) === Math.round(i.height),
        'grandi uguali', Math.round(r.width)+'x'+Math.round(r.height) + '  e  ' + Math.round(i.width)+'x'+Math.round(i.height));
      dice(Math.abs(r.top - i.top) < 1, 'alla stessa altezza', Math.round(r.top) + ' e ' + Math.round(i.top));
      const daDestra = window.innerWidth - r.right, daSinistra = i.left;
      dice(Math.abs(daDestra - daSinistra) < 1, 'e alla stessa distanza dal loro bordo',
        Math.round(daDestra) + ' da destra, ' + Math.round(daSinistra) + ' da sinistra');

      // ── 2. SOLO IN RETE ───────────────────────────────────────────────────
      // Contro la macchina non c-e- nessuno da segnalare, e una finestra per
      // accusare un avversario che non esiste manda posta a vuoto a una casella
      // che qualcuno legge.
      const veraRete = PARTITA_RETE;
      const cs = document.createElement('style');
      cs.textContent = '#versus-overlay{display:none!important}';
      document.head.appendChild(cs);
      PARTITA_RETE = null;
      try{ startGame(true); }catch(e){}
      await attendi(400);
      dice(getComputedStyle(rep).display === 'none',
        'contro la macchina il pulsante non si accende', getComputedStyle(rep).display);
      PARTITA_RETE = { matchId:'tavolo-di-prova', io:1, mano:[], mazzo:[], buchi:[],
                       turno:1, scadenza:0, numeroTurno:1, pubblico:{} };
      try{ startGame(false); }catch(e){}
      await attendi(400);
      dice(getComputedStyle(rep).display !== 'none',
        'in una partita online si-', getComputedStyle(rep).display);
      // Il disegno si chiede ADESSO e non prima: a vestire la schermata di
      // partita e- montaGraficaPartita, che gira dentro a initGame. Prima di
      // una partita quel <img> e- nudo, e chiederglielo li- direbbe che manca
      // il file quando manca solo il momento.
      dice(/report-player-button/.test(rep.querySelector('img').getAttribute('src')||''),
        'col suo disegno addosso',
        String(rep.querySelector('img').getAttribute('src')).split('/').pop());

      // ── 3. LA FINESTRA ────────────────────────────────────────────────────
      AVVERSARIO_INFO = { nome:'Mallory', rank:3, avatar:'' };
      sessioneAccount = { token:'finto', userId:'u1', username:'Prova' };
      apriReport();
      await attendi(300);
      const ov = document.getElementById('report-overlay');
      dice(ov.classList.contains('show'), 'premendolo si apre la finestra');
      const tit = document.querySelector('#report-barra h2');
      const ts = getComputedStyle(tit);
      dice(tit.textContent === 'Report player', 'che si chiama "Report player"', tit.textContent);
      dice(/Marcellus/.test(ts.fontFamily) && ts.fontSize === '36px',
        'ed e- vestita come ogni altra finestra', ts.fontFamily + ' ' + ts.fontSize);
      dice(document.getElementById('report-chi').textContent === 'Mallory',
        'e dice contro chi si sta per andare', document.getElementById('report-chi').textContent);
      const voci = [...document.querySelectorAll('#report-motivo .hx-dropdown-voce')].map(b=>b.getAttribute('data-valore'));
      dice(voci.join(',') === 'name,stalling,cheating,unsporting,other',
        'la tendina ha i suoi cinque motivi', voci.join(' '));
      dice(!!document.getElementById('report-testo'), 'e c-e- la casella per raccontare');
      const inv = document.getElementById('report-invia');
      dice(inv.querySelector('.hxb-label').textContent === 'Report abuse',
        'il pulsante dice "Report abuse"', inv.querySelector('.hxb-label').textContent);
      dice(inv.classList.contains('hx-btn-warning'), 'ed e- rosso, come quello che cancella un account');
      const pezzo = inv.querySelector('.hxb-left');
      dice(/warning|rosso|red/.test(getComputedStyle(pezzo).backgroundImage || ''),
        'con addosso i pezzi rossi',
        'ho letto "' + (getComputedStyle(pezzo).backgroundImage || '') + '"');

      // ── 4. NON SI MANDA UN MODULO VUOTO ───────────────────────────────────
      let mandate = [];
      const veroRpc = window.nakamaRpc;
      window.nakamaRpc = async (nome, corpo)=>{ mandate.push({ nome, corpo }); return {}; };
      await inviaReport(inv);
      dice(mandate.length === 0 && /reason/i.test(document.getElementById('report-messaggio').textContent),
        'senza motivo non parte niente, e lo dice',
        document.getElementById('report-messaggio').textContent);
      _tendinaScegli('report-motivo', 'stalling', 'Stalling / wasting time');
      await inviaReport(inv);
      dice(mandate.length === 0 && /happened/i.test(document.getElementById('report-messaggio').textContent),
        'e senza racconto nemmeno',
        document.getElementById('report-messaggio').textContent);

      // ── 5. E QUEL CHE PARTE NON CONTIENE UN NOME ──────────────────────────
      document.getElementById('report-testo').value = 'He kept letting the clock run out.';
      await inviaReport(inv);
      await attendi(200);
      dice(mandate.length === 1 && mandate[0].nome === 'hx_report',
        'col modulo pieno la segnalazione parte', JSON.stringify(mandate.map(m=>m.nome)));
      const c = (mandate[0] || {}).corpo || {};
      dice(c.motivo === 'stalling' && c.testo.indexOf('clock') > 0,
        'e porta il motivo e il racconto', JSON.stringify({motivo:c.motivo, testo:String(c.testo).slice(0,30)}));
      dice(c.partita === 'tavolo-di-prova', 'e l-identificativo del TAVOLO', String(c.partita));
      const dentro = JSON.stringify(c);
      dice(dentro.indexOf('Mallory') === -1,
        'e NON il nome dell-avversario',
        'Il nome che il client vede serve a chi segnala, per sapere di chi sta\\n' +
        '        parlando. A dire chi e- dev-essere il server, o chiunque potrebbe\\n' +
        '        accusare chiunque senza averlo mai incontrato.   ' + dentro.slice(0, 160));
      dice(document.getElementById('report-grazie').style.display !== 'none',
        'e dopo si ringrazia');
      window.nakamaRpc = veroRpc;
      PARTITA_RETE = veraRete;
      return { d };
    }catch(e){ return { guasto:(e&&e.message)+' '+String((e&&e.stack)||'').split(String.fromCharCode(10))[1], d }; }
  })()`);

  if (esito.guasto) {
    console.error('GUASTO: ' + esito.guasto);
    for (const x of (esito.d||[])) console.log((x.ok?'  ok   ':'  NO   ') + x.che);
    app.exit(1); return;
  }

  if (SCATTO) {
    await win.webContents.executeJavaScript(`(function(){
      document.getElementById('report-grazie').style.display = 'none';
      document.getElementById('report-modulo').style.display = '';
      document.getElementById('report-overlay').classList.add('show');
      return 1; })()`);
    await win.webContents.insertCSS('#splash{display:none!important}');
    win.setPosition(-3200, 0); win.showInactive();
    await new Promise(r => setTimeout(r, 1600));
    fs.writeFileSync(SCATTO, (await win.webContents.capturePage()).toPNG());
    console.log('scritto ' + SCATTO);
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
