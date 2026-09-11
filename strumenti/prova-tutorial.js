// IL TUTORIAL — SEI SCHEDE, TRE MOMENTI.
//
//     $ELECTRON strumenti/prova-tutorial.js [foto.png]
//
// Il tutorial e' la prima cosa che un giocatore nuovo vede dopo aver scelto il
// nome, e questo lo rende diverso da ogni altra finestra: chi lo prova non e'
// mai chi lo ha scritto. Un difetto qui non lo segnala nessuno — chi arriva
// pensa che il gioco sia fatto cosi'.
//
// Le cose che si rompono in silenzio, e che il banco guarda una per una:
//
//   IL RIQUADRO CHE CAMBIA MISURA. E' 1200x700 SEMPRE, per decisione di
//     Lorenzo. Dentro c'e' un video: se il riquadro seguisse il testo,
//     passando da una scheda corta a una lunga il video si allargherebbe a
//     ogni passo. La misura non e' una conseguenza, e' un vincolo.
//   IL VIDEO SBAGLIATO. Sei schede, sei clip, e l'unico modo di accorgersi di
//     uno scambio e' guardare. Il banco controlla che ogni scheda punti al suo.
//   LA FRECCIA CHE SPARISCE invece di spegnersi. Sulla prima scheda
//     l'indietro non ha dove andare: se se ne andasse, l'avanti scivolerebbe
//     al suo posto e il pollice tornerebbe su un pulsante diverso.
//   IL "GOT IT!" SULLA SCHEDA SBAGLIATA. Se comparisse prima dell'ultima, si
//     chiuderebbe un discorso a meta'; se non comparisse sull'ultima, non ci
//     sarebbe modo di uscire — la finestra non si chiude col velo ne' con Esc,
//     ed e' voluto.
//   IL RICORDO. Chiudere vuol dire anche non rivederlo. Sta sul server, e qui
//     si guarda che il client se lo segni e smetta di chiederlo.
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
  // Il filo di progresso: ogni controllo dice il suo nome mentre passa. Un
  // banco lungo che tace non si distingue da un banco appeso, e la
  // differenza cambia cosa si fa dopo — aspettare o andare a cercare.
  win.webContents.on('console-message', (...args) => {
    // Electron recente passa UN oggetto con .message, quello vecchio tre
    // argomenti col testo al terzo. Scritto per una firma sola, sull-altra il
    // filo tace e sembra che il banco non stia facendo niente — che e-
    // esattamente il difetto che questo filo doveva togliere.
    const a0 = args[0];
    const msg = (a0 && typeof a0 === 'object' && a0.message !== undefined) ? a0.message : args[2];
    if (String(msg).indexOf('[passo] ') === 0) console.log('  ..   ' + String(msg).slice(8));
  });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 14000));

  const esito = await win.webContents.executeJavaScript(`(async function(){
    const d = [];
    const dice = (ok, che, perche) => { console.log('[passo] ' + che); d.push({ ok:!!ok, che, perche: perche||'' }); };
    const attendi = (ms)=>new Promise(r=>setTimeout(r,ms));
    // Il corpo corre contro un orologio. Un banco appeso non dice niente e non
    // si distingue da uno lento; scaduto il tempo, questo torna i controlli
    // gia- fatti — e l-ultimo dell-elenco e- il punto in cui si e- fermato.
    const _corpo = (async function(){
    try{
      ['splash','start-screen'].forEach(id=>{ const e=document.getElementById(id); if(e) e.style.display='none'; });

      // ── 1. I PEZZI CI SONO ────────────────────────────────────────────────
      const ov = document.getElementById('tutorial-overlay');
      dice(!!ov, 'la finestra del tutorial esiste');
      for(const id of ['tutorial-cornice','tutorial-video','tutorial-velo','tutorial-colonna',
                       'tutorial-corpo','tutorial-fondo','tutorial-passi',
                       'tutorial-indietro','tutorial-avanti']){
        if(!document.getElementById(id)) dice(false, 'manca il pezzo #' + id);
      }
      dice(TUTORIAL.principale.length === 4 && TUTORIAL.pacchetti.length === 1
           && TUTORIAL.libreria.length === 1,
        'quattro schede all-inizio, una sui pacchetti, una in libreria',
        TUTORIAL.principale.length + ' + ' + TUTORIAL.pacchetti.length + ' + ' + TUTORIAL.libreria.length);

      // ── 2. SI APRE ────────────────────────────────────────────────────────
      TUTORIAL_VISTI = {};
      apriTutorial('principale');
      await attendi(1200);
      dice(ov.classList.contains('show'), 'e si apre');

      // ── 3. IL RIQUADRO NON CAMBIA MAI MISURA ──────────────────────────────
      const cornice = document.getElementById('tutorial-cornice');
      const misure = [];
      for(let i=0;i<4;i++){
        _tutorialQui = i; tutorialDisegna(); await attendi(350);
        const s = getComputedStyle(cornice);
        misure.push(Math.round(parseFloat(s.width)) + 'x' + Math.round(parseFloat(s.height)));
      }
      dice(misure.every(m => m === '1200x700'), 'il riquadro e- 1200x700 su tutte e quattro',
        misure.join(', ') + '.\\n        Dentro c-e- un video: un riquadro che segue il testo lo fa saltare a ogni passo.');

      // ── 4. LA COLONNA ─────────────────────────────────────────────────────
      const col = document.getElementById('tutorial-colonna');
      const sc = getComputedStyle(col);
      dice(Math.round(parseFloat(sc.width)) === 370, 'la colonna e- larga 370',
        Math.round(parseFloat(sc.width)) + 'px');
      // 700 meno i 30 di padding sopra e sotto (v0.79.83).
      dice(Math.round(parseFloat(sc.height)) === 640, 'e alta quanto il riquadro le lascia',
        Math.round(parseFloat(sc.height)) + 'px — 700 meno i 30 di padding sopra e sotto.');
      // Lo scostamento si misura in pixel CSS e non a schermo: il gioco scala
      // tutta la scena per starci dentro, e a 1920 di larghezza 30 pixel ne
      // misurano 22. Quel numero direbbe quanto e- grande la finestra del
      // banco, non dove sta la colonna. Il rapporto fra i due rettangoli
      // invece la scala non la sente.
      const rc = col.getBoundingClientRect(), rk = cornice.getBoundingClientRect();
      const scala = rk.width / parseFloat(getComputedStyle(cornice).width);
      dice(Math.round((rc.left - rk.left) / scala) === 30, 'e sta a sinistra, a 30 dal bordo',
        Math.round((rc.left - rk.left) / scala) + 'px in CSS, ' + Math.round(rc.left - rk.left) +
        ' sullo schermo di questo banco (scala ' + (Math.round(scala*100)/100) + ').');

      // ── 4b. LA BARRA DEL TITOLO E LA VIA D-USCITA (v0.79.83) ─────────────
      // v0.79.93 — la barra del titolo non c-e- piu-: tolta su richiesta di Lorenzo.
      dice(!document.getElementById('tutorial-titlebar') && !document.querySelector('#tutorial-overlay .hx-titlebar'),
        'sopra al riquadro non c-e- piu- la barra del titolo');
      const salta = document.getElementById('tutorial-salta');
      dice(!!salta && getComputedStyle(salta).display !== 'none',
        'e "Skip tutorial" sta sotto, fuori dal riquadro');
      dice(salta.getBoundingClientRect().top >= rk.bottom - 1,
        'proprio sotto', Math.round(salta.getBoundingClientRect().top) + ' contro ' + Math.round(rk.bottom));

      // ── 5. IL GRADIENTE ───────────────────────────────────────────────────
      // I due numeri sono di Lorenzo: pieno fino al 20%, trasparente dal 45%.
      const velo = getComputedStyle(document.getElementById('tutorial-velo')).backgroundImage;
      dice(/20%/.test(velo) && /45%/.test(velo) && /46,\\s*58,\\s*60/.test(velo),
        'il velo e- pieno fino al 20% e via dal 45%',
        velo.slice(0, 120));

      // ── 6. OGNI SCHEDA IL SUO VIDEO ───────────────────────────────────────
      const attesi = ['welcome-to-hextale','basics','card-layout','score-system'];
      const visti = [];
      for(let i=0;i<4;i++){
        _tutorialQui = i; tutorialDisegna(); await attendi(400);
        const src = document.getElementById('tutorial-video').getAttribute('src') || '';
        visti.push(src.split('/').pop().replace('.mp4',''));
      }
      dice(JSON.stringify(visti) === JSON.stringify(attesi),
        'ogni scheda punta al suo video', visti.join(', '));

      // Da qui in poi si prova il TESTO e i comandi, non il video: ogni
      // tutorialDisegna scarica una clip da quattro megabyte, e una ventina di
      // volte sono dieci minuti di banco per una cosa gia- provata sopra.
      const veroVideo = window.tutorialMettiVideo;
      window.tutorialMettiVideo = function(){};

      // ── 7. I PALLINI E LE FRECCE ──────────────────────────────────────────
      const passi = ()=>[...document.querySelectorAll('#tutorial-passi .tutorial-passo')];
      const qui = ()=>passi().findIndex(p=>p.classList.contains('qui'));
      _tutorialQui = 0; tutorialDisegna(); await attendi(300);
      dice(passi().length === 4, 'quattro pallini, uno per scheda', passi().length + '');
      dice(qui() === 0, 'e il primo e- acceso', 'acceso il ' + (qui()+1));
      const dietro = document.getElementById('tutorial-indietro');
      const avanti = document.getElementById('tutorial-avanti');
      dice(dietro.disabled && !avanti.disabled, 'sulla prima l-indietro e- spento');
      dice(dietro.getBoundingClientRect().width > 0,
        'ma non sparisce', 'Sparendo, l-avanti scivolerebbe al suo posto e il\\n' +
        '        pollice tornerebbe su un pulsante diverso.');
      tutorialVai(1); await attendi(400);
      dice(qui() === 1 && !dietro.disabled, 'avanti porta alla seconda e riaccende l-indietro');
      tutorialVai(-1); await attendi(400);
      dice(qui() === 0, 'e indietro riporta alla prima');

      // ── 8. IL "GOT IT!" SOLO SULL-ULTIMA ──────────────────────────────────
      const ok = ()=>document.getElementById('tutorial-ok');
      const dove = [];
      for(let i=0;i<4;i++){ _tutorialQui=i; tutorialDisegna(); await attendi(250); dove.push(ok()?'si':'no'); }
      dice(JSON.stringify(dove) === JSON.stringify(['no','no','no','si']),
        'il "Got it!" c-e- solo sull-ultima scheda', dove.join(' '));
      _tutorialQui = 3; tutorialDisegna(); await attendi(300);
      dice(document.getElementById('tutorial-avanti').disabled,
        'e sull-ultima l-avanti e- spento');
      dice(col.contains(ok()), 'e il pulsante sta DENTRO alla colonna',
        'E- la fine del discorso, non un comando della finestra.');

      // ── 9. LA LISTA DELLE RARITA- ─────────────────────────────────────────
      // impostaImgDaCandidati scrive il src quando ha finito di provare gli
      // indirizzi, non subito: leggerlo prima direbbe 'gemma mancante' per il
      // motivo sbagliato.
      await attendi(700);
      const righe = [...document.querySelectorAll('#tutorial-corpo .tutorial-lista li')];
      dice(righe.length === 4, 'quattro rarita- in elenco', righe.length + '');
      const colori = righe.map(li => getComputedStyle(li.querySelector('.tutorial-rarita')).color);
      const attesiCol = ['common','rare','mythic','timeless'].map(k=>coloreRarita(k));
      const aRgb = (h)=>{ const n=parseInt(h.slice(1),16);
        return 'rgb(' + ((n>>16)&255) + ', ' + ((n>>8)&255) + ', ' + (n&255) + ')'; };
      dice(JSON.stringify(colori) === JSON.stringify(attesiCol.map(aRgb)),
        'e ognuna ha il colore che ha in tutto il resto del gioco',
        colori.join(' ') + '.\\n        I colori vengono da COLORI_RARITA: una rarita- ha un colore solo.');
      dice(righe.every(li => (li.querySelector('.tutorial-gemma').getAttribute('src')||'').indexOf('gem-') >= 0),
        'e la sua gemma accanto',
        righe.map(li=>(li.querySelector('.tutorial-gemma').getAttribute('src')||'?').split('/').pop()).join(' '));

      // ── 10. CHIUDERE VUOL DIRE NON RIVEDERLO ──────────────────────────────
      dice(tutorialDaVedere('principale') === false || TUTORIAL_VISTI.principale !== true,
        'finche- e- aperto non risulta visto');
      chiudiTutorial();
      await attendi(500);
      dice(!ov.classList.contains('show'), 'il "Got it!" chiude la finestra');
      dice(TUTORIAL_VISTI.principale === true && !tutorialDaVedere('principale'),
        'e da quel momento non si rivede piu-',
        'Il ricordo sta sul server (hx_tutorial): chi cambia computer non lo rivede.');
      dice(!document.getElementById('tutorial-video').getAttribute('src'),
        'e il video si stacca invece di continuare a girare dietro al nulla');

      // I video tornano: le due schede singole si provano anche per la clip.
      window.tutorialMettiVideo = veroVideo;

      // ── 11. LE SCHEDE SINGOLE ─────────────────────────────────────────────
      // Con una sola scheda, un pallino solo e due frecce spente sarebbero tre
      // comandi che non comandano niente.
      TUTORIAL_VISTI = {};
      apriTutorial('pacchetti');
      await attendi(900);
      // Si guarda cio- che SI VEDE e non la proprieta- "hidden": fino alla
      // v0.79.83 la proprieta- era a posto e la riga restava in scena lo
      // stesso, perche- la regola display:flex e- scritta su un id e batte
      // quella del browser per gli elementi nascosti. Un banco che chiede la
      // proprieta- dice di si- e ha torto.
      // (Niente apici inclinati qui dentro: questo blocco vive in un template
      //  literal, e un apice inclinato lo chiude a meta- — e- il motivo per cui
      //  questo banco non e- partito per un paio d-ore.)
      dice(getComputedStyle(document.getElementById('tutorial-fondo')).display === 'none',
        'la scheda dei pacchetti non ha ne- pallini ne- frecce',
        'display: ' + getComputedStyle(document.getElementById('tutorial-fondo')).display);
      dice(getComputedStyle(document.getElementById('tutorial-salta')).display === 'none',
        'e nemmeno "Skip tutorial"',
        'Su una scheda sola, saltare e aver capito sono lo stesso gesto.');
      // E il "Got it!" si appoggia al fondo della colonna invece di restare
      // a mezz-aria sotto l-ultimo paragrafo.
      const gr = ok().getBoundingClientRect(), cr = col.getBoundingClientRect();
      dice(cr.bottom - gr.bottom < 40, 'e il "Got it!" sta in fondo alla colonna',
        Math.round(cr.bottom - gr.bottom) + 'px dal fondo (c-e- il padding della colonna).');
      dice(!!ok(), 'e ha il suo "Got it!"');
      dice((document.getElementById('tutorial-video').getAttribute('src')||'').indexOf('open-packs') >= 0,
        'e il video giusto');
      chiudiTutorial();
      await attendi(400);
      apriTutorial('libreria');
      await attendi(900);
      dice((document.getElementById('tutorial-video').getAttribute('src')||'').indexOf('deck-building') >= 0,
        'e la scheda della libreria il suo');
      dice(document.querySelector('#tutorial-corpo .tutorial-titolo').textContent === 'Deck building',
        'col titolo giusto', document.querySelector('#tutorial-corpo .tutorial-titolo').textContent);
      chiudiTutorial();
      await attendi(300);
      return { d };
    }catch(e){ return { guasto:(e&&e.message)+' '+String((e&&e.stack)||'').split(String.fromCharCode(10))[1], d }; }
    })();
    const _guardia = new Promise(r=>setTimeout(()=>r({ d, scaduto:true }), 180000));
    return await Promise.race([_corpo, _guardia]);
  })()`);

  if (esito && esito.scaduto) {
    console.error('IL BANCO NON HA FINITO IN TRE MINUTI.');
    const fatti = esito.d || [];
    const ultimo = fatti[fatti.length - 1];
    console.error('Ultimo controllo arrivato (' + fatti.length + ' in tutto): '
      + (ultimo ? ultimo.che : 'nessuno — si e- fermato prima del primo'));
    app.exit(1); return;
  }

  if (esito.guasto) {
    console.error('GUASTO: ' + esito.guasto);
    for (const x of (esito.d||[])) console.log((x.ok?'  ok   ':'  NO   ') + x.che);
    app.exit(1); return;
  }

  if (SCATTO) {
    await win.webContents.executeJavaScript(`(async function(){
      TUTORIAL_VISTI = {};
      apriTutorial('principale');
      await new Promise(r=>setTimeout(r,600));
      _tutorialQui = 0; tutorialDisegna(); 1;
    })()`);
    await win.webContents.insertCSS('#splash,#patch-notes-overlay{display:none!important}');
    win.setPosition(-3200, 0); win.showInactive();
    await new Promise(r => setTimeout(r, 3000));
    const dove = await win.webContents.executeJavaScript(`(function(){
      const b = document.getElementById('tutorial-cornice').getBoundingClientRect();
      return { x:Math.max(0,Math.round(b.left)-16), y:Math.max(0,Math.round(b.top)-16),
               width:Math.round(b.width)+32, height:Math.round(b.height)+32 };
    })()`);
    for (const [i, nome] of [[0,'1-welcome'],[1,'2-basics'],[2,'3-card-layout'],[3,'4-score']]) {
      await win.webContents.executeJavaScript(`_tutorialQui=${i}; tutorialDisegna(); 1`);
      await new Promise(r => setTimeout(r, 2200));
      const f = SCATTO.replace(/\.png$/, '-' + nome + '.png');
      fs.writeFileSync(f, (await win.webContents.capturePage(dove)).toPNG());
      console.log('scritto ' + f);
    }
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
