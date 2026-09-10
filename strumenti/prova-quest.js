// LE SCHEDE DELLE DAILY QUESTS.
//
//     $ELECTRON strumenti/prova-quest.js [scatto.png]
//
// Il disegno (Figma > Main menu > wrapper) mostra CINQUE schede, ma gli stati
// sono TRE: in corso, completata, riscattata. Le cinque del disegno sono tre
// stati per due premi — busta e inchiostro — e il premio non e' uno stato, e'
// un'icona. Questo banco lo tiene fermo: tenta i sei incroci e chiede che le
// classi siano tre, non sei.
//
// E poi il vincolo che non si vede finche' non si rompe: CINQUE SCHEDE DEVONO
// STARCI. Il riquadro e' alto quanto la colonna di sinistra (regola di Lorenzo,
// v0.79.69) e non puo' crescere; cinque schede da 55 con quattro di stacco sono
// 315 pixel esatti. Bastano tre pixel di bordo contati male perche' la quinta
// finisca sotto il bordo — e nessuno se ne accorge, perche' una lista che
// scorre di poco sembra una lista che sta dentro.
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
      apriMenuPrincipale();
      await attendi(1200);
      const corpo = document.getElementById('mm2-quest-corpo');

      // ── 1. IL RIQUADRO VUOTO ──────────────────────────────────────────────
      mm2DisegnaQuest([]);
      dice(corpo.classList.contains('vuoto') && /Coming soon/.test(corpo.textContent),
        'senza quest il riquadro dice "Coming soon"', corpo.textContent.trim());
      dice(document.getElementById('mm2-quest-conta').textContent === '0/5',
        'e il contatore in cima dice zero su cinque',
        document.getElementById('mm2-quest-conta').textContent);

      // ── 2. LE CINQUE DEL DISEGNO ──────────────────────────────────────────
      mm2DisegnaQuest([
        { nome:'Win 3 PvP matches',    fatto:1,  quanto:3,  premio:'pack', presa:false },
        { nome:'Flip 20 cards',        fatto:20, quanto:20, premio:'ink',  presa:false },
        { nome:'Flip a Timeless card', fatto:1,  quanto:1,  premio:'pack', presa:false },
        { nome:'Play 5 PvP matches',   fatto:5,  quanto:5,  premio:'ink',  presa:true  },
        { nome:'Flip 2 cards with 1',  fatto:1,  quanto:3,  premio:'ink',  presa:false }
      ]);
      await attendi(500);
      const schede = [...corpo.querySelectorAll('.quest-scheda')];
      dice(schede.length === 5, 'cinque schede', schede.length + '');
      dice(!corpo.classList.contains('vuoto'), 'e il riquadro non e- piu- quello vuoto');

      // ── 3. CI STANNO TUTTE E CINQUE ───────────────────────────────────────
      dice(schede.every(s=>s.offsetHeight === 55), 'alte 55 come nel disegno',
        schede.map(s=>s.offsetHeight).join(' '));
      dice(corpo.scrollHeight <= corpo.clientHeight,
        'e ci stanno tutte senza scorrere',
        'contenuto ' + corpo.scrollHeight + ' in ' + corpo.clientHeight +
        '.\\n        Il riquadro non puo- crescere: e- alto quanto la colonna di sinistra.');
      const ultima = schede[4].getBoundingClientRect(), dentro = corpo.getBoundingClientRect();
      dice(ultima.bottom <= dentro.bottom + 1, 'e la quinta non finisce sotto il bordo',
        'la quinta finisce a ' + Math.round(ultima.bottom) + ', il riquadro a ' + Math.round(dentro.bottom));

      // ── 4. TRE STATI, NON SEI ─────────────────────────────────────────────
      // Sei incroci (tre stati per due premi) devono dare tre classi.
      const casi = [];
      for(const premio of ['pack','ink']){
        for(const [f,q,p] of [[1,3,false],[3,3,false],[3,3,true]]){
          mm2DisegnaQuest([{ nome:'x', fatto:f, quanto:q, premio:premio, presa:p }]);
          const s = corpo.querySelector('.quest-scheda');
          casi.push({ premio, f, q, p, classi:s.className.replace('quest-scheda','').trim() });
        }
      }
      const perStato = casi.map(c=>c.classi);
      dice(perStato[0] === '' && perStato[1] === 'quest-fatta' && perStato[2] === 'quest-presa'
        && perStato[3] === '' && perStato[4] === 'quest-fatta' && perStato[5] === 'quest-presa',
        'gli stati sono tre e non dipendono dal premio',
        casi.map(c=>c.premio + ' ' + c.f + '/' + c.q + (c.p?' presa':'') + ' -> "' + c.classi + '"').join('\\n        '));

      // ── 5. E IL PREMIO E- UN-ICONA ────────────────────────────────────────
      // L-indirizzo si legge DOPO un respiro: impostaImgDaCandidati prova gli
      // indirizzi uno per uno e scrive il src quando trova quello buono. Letto
      // nello stesso istante e- ancora vuoto, e il banco direbbe che manca
      // l-immagine quando manca solo il tempo.
      const icona = async (f,q,p,premio)=>{
        mm2DisegnaQuest([{ nome:'x', fatto:f, quanto:q, premio:premio, presa:p }]);
        await attendi(300);
        const i = corpo.querySelector('.quest-premio');
        return String(i.getAttribute('src')||'').split('/').pop();
      };
      const iBusta = await icona(1,3,false,'pack');
      const iInk = await icona(1,3,false,'ink');
      const iSpuntaA = await icona(3,3,true,'pack');
      const iSpuntaB = await icona(3,3,true,'ink');
      dice(/card-pack-icon/.test(iBusta), 'la busta ha la busta', iBusta);
      dice(/magic-ink-icon/.test(iInk), 'l-inchiostro ha l-inchiostro', iInk);
      dice(/check-icon/.test(iSpuntaA) && /check-icon/.test(iSpuntaB),
        'e una gia- riscossa ha la spunta, qualunque fosse il premio',
        iSpuntaA + ' / ' + iSpuntaB);

      // ── 6. LA BARRA DICE QUANTO MANCA ─────────────────────────────────────
      mm2DisegnaQuest([{ nome:'x', fatto:1, quanto:4, premio:'pack', presa:false }]);
      const b = corpo.querySelector('.quest-barra'), pieno = corpo.querySelector('.quest-barra-piena');
      await attendi(600);
      const quota = pieno.getBoundingClientRect().width / b.getBoundingClientRect().width;
      dice(Math.abs(quota - 0.25) < 0.02, 'un quarto fatto, un quarto di barra',
        (quota*100).toFixed(1) + '%');
      // E non si sfora: quattro vittorie su tre richieste sono finite, non 4/3.
      mm2DisegnaQuest([{ nome:'x', fatto:9, quanto:3, premio:'pack', presa:false }]);
      dice(corpo.querySelector('.quest-conta').textContent === '3/3',
        'e chi ha fatto piu- del dovuto legge il traguardo, non un numero storto',
        corpo.querySelector('.quest-conta').textContent);

      // ── 7. IL PULSANTE ────────────────────────────────────────────────────
      const bott = document.getElementById('mm2-quest-btn');
      dice(bott.querySelector('.hxb-label').textContent === 'Collect rewards',
        'il pulsante dice "Collect rewards"', bott.querySelector('.hxb-label').textContent);
      mm2DisegnaQuest([{ nome:'x', fatto:1, quanto:3, premio:'pack', presa:false }]);
      dice(getComputedStyle(bott).pointerEvents === 'none',
        'ed e- spento se non c-e- niente da riscuotere', getComputedStyle(bott).opacity);
      mm2DisegnaQuest([{ nome:'x', fatto:3, quanto:3, premio:'pack', presa:false }]);
      dice(getComputedStyle(bott).pointerEvents !== 'none',
        'e acceso appena una quest e- finita', getComputedStyle(bott).opacity);
      mm2DisegnaQuest([{ nome:'x', fatto:3, quanto:3, premio:'pack', presa:true }]);
      dice(getComputedStyle(bott).pointerEvents === 'none',
        'e di nuovo spento quando sono state tutte riscosse');

      // ── 8. IL CONTATORE IN CIMA CONTA LE RISCOSSE ─────────────────────────
      // Non le completate: una completata che aspetta e- ancora una cosa da fare.
      mm2DisegnaQuest([
        { nome:'a', fatto:3, quanto:3, premio:'pack', presa:true },
        { nome:'b', fatto:3, quanto:3, premio:'ink',  presa:false },
        { nome:'c', fatto:0, quanto:3, premio:'ink',  presa:false }
      ]);
      dice(document.getElementById('mm2-quest-conta').textContent === '1/3',
        'in cima si contano le riscosse, non le completate',
        document.getElementById('mm2-quest-conta').textContent +
        ' con una riscossa, una completata che aspetta e una da fare');
      return { d };
    }catch(e){ return { guasto:(e&&e.message)+' '+String((e&&e.stack)||'').split(String.fromCharCode(10))[1], d }; }
  })()`);

  if (esito.guasto) {
    console.error('GUASTO: ' + esito.guasto);
    for (const x of (esito.d||[])) console.log((x.ok?'  ok   ':'  NO   ') + x.che);
    app.exit(1); return;
  }

  if (SCATTO) {
    await win.webContents.executeJavaScript(`mm2DisegnaQuest([
      { nome:'Win 3 PvP matches',    fatto:1,  quanto:3,  premio:'pack', presa:false },
      { nome:'Flip 20 cards',        fatto:20, quanto:20, premio:'ink',  presa:false },
      { nome:'Flip a Timeless card', fatto:1,  quanto:1,  premio:'pack', presa:false },
      { nome:'Play 5 PvP matches',   fatto:5,  quanto:5,  premio:'ink',  presa:true  },
      { nome:'Flip 2 cards with 1',  fatto:1,  quanto:3,  premio:'ink',  presa:false }
    ]); 1`);
    await win.webContents.insertCSS('#splash,#patch-notes-overlay{display:none!important}');
    win.setPosition(-3200, 0); win.showInactive();
    await new Promise(r => setTimeout(r, 2000));
    fs.writeFileSync(SCATTO, (await win.webContents.capturePage()).toPNG());
    console.log('scritto ' + SCATTO);
    const dove = await win.webContents.executeJavaScript(`(function(){
      const b = document.querySelector('#mm2-dx .mm2-box').getBoundingClientRect();
      const x = Math.max(0, Math.round(b.left) - 30), y = Math.max(0, Math.round(b.top) - 40);
      return { x, y, width: Math.min(Math.round(b.width) + 60, window.innerWidth - x),
               height: Math.min(Math.round(b.height) + 80, window.innerHeight - y) };
    })()`);
    await new Promise(r => setTimeout(r, 800));
    const via = SCATTO.replace(/\.png$/, '-pannello.png');
    fs.writeFileSync(via, (await win.webContents.capturePage(dove)).toPNG());
    console.log('scritto ' + via);
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
