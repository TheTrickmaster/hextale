// IL DISCLAIMER DEL PROTOTIPO: "niente IA definitiva, niente pay-to-win".
//
//     $ELECTRON strumenti/prova-disclaimer.js [scatto.png]
//
// Si vede UNA volta sola per account, appena firmato l'accordo, e questo lo
// rende difficile da riprovare a mano quanto "Pick a letter": per rivederlo
// servirebbe un account nuovo ogni volta.
//
// Il controllo che conta piu' di tutti non e' come sta in piedi: e' la
// CATENA. Questa finestra non ha una memoria sua — sta attaccata
// all'accettazione dell'accordo, che avviene una volta per account — e chi la
// chiude deve far proseguire chi stava andando al menu. Se quel filo si
// spezza, chi firma resta davanti a un velo scuro e non entra piu': un guasto
// che colpisce SOLO chi si registra, cioe' nessuno di quelli che provano il
// gioco tutti i giorni.
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
    // backgroundThrottling spento: una finestra fuori dallo schermo viene
    // considerata coperta, e le TRANSIZIONI CSS non avanzano piu-. Le
    // finestre del gioco compaiono in dissolvenza (--hx-dissolvenza), quindi
    // restavano a opacita- zero: misurabili in ogni loro parte, e nere in
    // fotografia.
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 13000));

  const dette = await win.webContents.executeJavaScript(`(async function(){
    const d = [];
    const dice = (ok, che, perche) => d.push({ ok:!!ok, che, perche: perche||'' });
    const attendi = (ms)=>new Promise(r=>setTimeout(r,ms));
    try{
      ['splash','patch-notes-overlay','start-screen'].forEach(id=>{
        const e=document.getElementById(id); if(e) e.style.display='none'; });

      // ── 1. LA CATENA: FIRMA -> DISCLAIMER -> MENU ─────────────────────────
      // Il server si finge. Quel che si guarda e' che dopo "I agree" compaia
      // QUESTA finestra e NON si vada al menu, e che al menu ci si vada solo
      // premendo "Got it!".
      let proseguito = 0;
      sessioneAccount = { token:'finto', userId:'u1', username:'Prova' };
      window.nakamaRpc = async ()=>({ accettato:true });
      apriAccordo(()=>{ proseguito++; });
      const spunta = document.getElementById('nca-spunta');
      spunta.checked = true; aggiornaAccordo();
      await accettaAccordo(document.getElementById('nca-accetto'));
      await attendi(200);
      const ov = document.getElementById('disclaimer-overlay');
      dice(!document.getElementById('nca-overlay').classList.contains('show'),
        'firmato l-accordo, la sua finestra si chiude');
      dice(!!ov && ov.classList.contains('show'),
        'e al suo posto compare il disclaimer del prototipo');
      dice(proseguito === 0,
        'e al menu NON ci si va ancora',
        'Se ci si andasse adesso, il disclaimer sarebbe una finestra sopra a un menu\\n' +
        '        gia- aperto invece dell-ultimo passo dell-ingresso.');

      // ── 2. COM-E- FATTO ───────────────────────────────────────────────────
      // v0.79.96 — lo stendardo nuovo, e il titolo accorciato da Lorenzo.
      const tit = document.querySelector('#disclaimer-barra h2');
      const ts = getComputedStyle(tit);
      dice(tit.textContent === 'Disclaimer', 'il titolo dice "Disclaimer"', tit.textContent);
      dice(/Marcellus/.test(ts.fontFamily) && ts.fontSize === '36px' && ts.color === 'rgb(237, 224, 198)',
        'ed e- vestito come quello di ogni altra finestra',
        ts.fontFamily + '  ' + ts.fontSize + '  ' + ts.color);

      const col = [...document.querySelectorAll('.disclaimer-col')];
      dice(col.length === 3, 'tre colonne', 'ne ho contate ' + col.length + ' (v0.79.88: si e- aggiunta Progress will be wiped)');
      // v0.79.66 — larghe il doppio di prima (erano 275). Non e- un numero
      // scritto nel CSS: le colonne si dividono quel che resta dentro al
      // riquadro, quindi si misura il risultato e non la regola.
      // offsetWidth e non getBoundingClientRect: il gioco e- disegnato a
      // 1920x1080 e poi SCALATO alla finestra, e il rettangolo a schermo porta
      // dentro quella scala (549 invece di 550). offsetWidth e- la misura nel
      // disegno, che e- quella di cui si sta parlando.
      const larghe = col.map(c=>c.offsetWidth);
      dice(larghe.length === 3 && larghe.every(l => l === 400), 'larghe 400 l-una, tutte e tre (erano 550 fino alla v0.79.88)',
        larghe.join(' e ') + '  (riquadro ' + document.getElementById('disclaimer-box').offsetWidth + ')');

      // Formattate come quelle della lettera: stesso fondo, stesso bordo,
      // stessi angoli, stessa trama.
      const lettera = getComputedStyle(document.querySelector('.starter-col'));
      const mia = getComputedStyle(col[0]);
      dice(mia.backgroundImage === lettera.backgroundImage,
        'col fondo delle colonne della lettera',
        mia.backgroundImage.slice(0, 70));
      dice(mia.borderTopWidth === lettera.borderTopWidth && mia.borderTopColor === lettera.borderTopColor
        && mia.borderTopLeftRadius === lettera.borderTopLeftRadius,
        'e lo stesso bordo e gli stessi angoli',
        mia.borderTopWidth + ' ' + mia.borderTopColor + ' r' + mia.borderTopLeftRadius);
      const trama = getComputedStyle(col[0], '::before').backgroundImage;
      dice(/url\\(/.test(trama), 'e la trama addosso, come loro', trama.slice(0, 70));
      // ...ma SENZA la tinta colorata: li' i tre colori distinguevano tre
      // lettere fra cui scegliere, qui non c'e' niente da scegliere.
      dice(!document.querySelector('#disclaimer-overlay .starter-tinta'),
        'e senza la tinta colorata sopra');
      dice(col.every(c => Math.abs(c.getBoundingClientRect().height - col[0].getBoundingClientRect().height) < 1),
        'e sono alte uguali tutte e tre, anche se una dice un capoverso in piu-',
        col.map(c => Math.round(c.getBoundingClientRect().height)).join(' e '));

      // Le icone: cento pixel, centrate.
      const icone = [...document.querySelectorAll('.disclaimer-icona')];
      dice(icone.map(i=>i.getAttribute('data-disclaimer-icona')).join(',') === 'no-ai-icon.png,no-p2w-icon.png,clean-icon.png',
        'da sinistra no-ai-icon, no-p2w-icon e clean-icon',
        icone.map(i=>i.getAttribute('data-disclaimer-icona')).join('  '));
      dice(icone.every(i=>i.offsetWidth === 100), 'larghe 100', icone.map(i=>i.offsetWidth).join(' '));
      dice(icone.every(i=>String(i.getAttribute('src')||'').indexOf(i.getAttribute('data-disclaimer-icona')) >= 0),
        'e il disegno e- arrivato davvero, ognuno il suo',
        icone.map(i=>String(i.getAttribute('src')).split('/').pop()).join('  '));
      dice(icone.every((i, n)=>{
        const r = i.getBoundingClientRect(), c = col[n].getBoundingClientRect();
        return Math.abs((r.left + r.width/2) - (c.left + c.width/2)) < 1;
      }), 'e stanno in mezzo alla loro colonna',
        icone.map((i,n)=>{ const r=i.getBoundingClientRect(), c=col[n].getBoundingClientRect();
          return ((r.left + r.width/2) - (c.left + c.width/2)).toFixed(1); }).join('  ') + ' di scarto');

      // I titoli e i testi.
      const titoli = [...document.querySelectorAll('.disclaimer-titolo')].map(e=>e.textContent);
      dice(titoli.join('|') === 'No AI policy|No Pay-to-win policy|Progress will be wiped', 'i tre titoli', titoli.join('  '));
      // E alla stessa altezza. Le icone non hanno tutte la stessa proporzione, e
      // se ognuna occupa l-altezza del suo disegno il titolo di una colonna sale o
      // scende rispetto alle altre: con la scopa di clean-icon saliva di tredici
      // pixel. Il banco lo guarda sullo schermo, perche- e- li- che si vede.
      const cimeTitoli = [...document.querySelectorAll('.disclaimer-titolo')].map(e => e.getBoundingClientRect().top);
      dice(cimeTitoli.every(y => Math.abs(y - cimeTitoli[0]) < 1), 'e i tre titoli stanno alla stessa altezza',
        cimeTitoli.map(y => Math.round(y)).join('  '));
      const capoversi = col.map(c=>c.querySelectorAll('.disclaimer-testo p').length);
      dice(capoversi.join(',') === '3,4,3', 'tre capoversi, poi quattro, poi tre', capoversi.join(' e '));
      const primo = col[0].querySelector('.disclaimer-testo p').textContent;
      const secondo = col[1].querySelector('.disclaimer-testo p').textContent;
      const terzo = col[2] ? col[2].querySelector('.disclaimer-testo p').textContent : '';
      dice(primo.indexOf('We do not believe AI should be considered a replacement') === 0
        && secondo.indexOf('Hextale is, and will always be, a strictly no-pay-to-win game') === 0
        && terzo.indexOf('Please note that all player progress from the current prototype') === 0,
        'e ognuna comincia col suo discorso');

      // ── 3. IL PULSANTE ────────────────────────────────────────────────────
      const btn = document.getElementById('disclaimer-ok');
      const box = document.getElementById('disclaimer-box');
      dice(btn.querySelector('.hxb-label').textContent === 'Got it!', 'il pulsante dice "Got it!"',
        btn.querySelector('.hxb-label').textContent);
      dice(!box.contains(btn), 'e sta FUORI dal riquadro, non dentro');
      dice(btn.getBoundingClientRect().top >= box.getBoundingClientRect().bottom - 1,
        'sotto di lui', 'pulsante a ' + Math.round(btn.getBoundingClientRect().top)
        + ', riquadro finito a ' + Math.round(box.getBoundingClientRect().bottom));
      const pezzo = btn.querySelector('.hxb-left');
      dice(btn.classList.contains('hx-btn-opaco'), 'ed e- della famiglia opaca');
      dice(/button-opaque-/.test(getComputedStyle(pezzo).backgroundImage || ''),
        'e ha addosso i pezzi opachi, non quelli trasparenti',
        'ho letto "' + (getComputedStyle(pezzo).backgroundImage || '') + '"');
      const rb = btn.getBoundingClientRect(), rx = box.getBoundingClientRect();
      dice(Math.abs((rb.left + rb.width/2) - (rx.left + rx.width/2)) < 1,
        'e- in mezzo, sotto al riquadro',
        ((rb.left + rb.width/2) - (rx.left + rx.width/2)).toFixed(1) + 'px di scarto');

      return { dette: d };
    }catch(e){ return { guasto:(e&&e.message)+' '+String((e&&e.stack)||'').slice(0,300), dette:d }; }
  })()`);

  if (dette.guasto) {
    console.error('GUASTO: ' + dette.guasto);
    for (const x of (dette.dette||[])) console.log((x.ok?'  ok   ':'  NO   ') + x.che);
    app.exit(1); return;
  }
  let righe = dette.dette;

  if (SCATTO) {
    // Si mostra adesso, e fuori dallo schermo: prima non serviva (le misure ci
    // sono lo stesso) e mostrarla subito faceva partire la dissolvenza in un
    // momento in cui nessuno la stava guardando.
    win.setPosition(-3200, 0); win.showInactive();
    await new Promise(r => setTimeout(r, 600));
    // Il velo di apertura si toglie con una REGOLA, non con uno stile in linea:
    // la sequenza di caricamento se lo rimette addosso da sola, e a tredici
    // secondi puo- essere ancora li- sopra a tutto. Un !important non se lo
    // riprende nessuno.
    await win.webContents.insertCSS("#splash,#start-screen{display:none!important}");
    await new Promise(r => setTimeout(r, 1200));
    fs.writeFileSync(SCATTO, (await win.webContents.capturePage()).toPNG());
    console.log('scritto ' + SCATTO);
  }

  // ── 4. E PREMENDO "GOT IT!" SI PROSEGUE ────────────────────────────────
  const dopo = await win.webContents.executeJavaScript(`(async function(){
    const d = [];
    const dice = (ok, che, perche) => d.push({ ok:!!ok, che, perche: perche||'' });
    try{
      let proseguito = 0;
      _disclaimerPoi = ()=>{ proseguito++; };
      chiudiDisclaimer();
      await new Promise(r=>setTimeout(r, 150));
      dice(!document.getElementById('disclaimer-overlay').classList.contains('show'),
        'premuto "Got it!", la finestra si chiude');
      dice(proseguito === 1, 'e SOLO ADESSO si va al menu',
        'E- il filo che regge tutto l-ingresso di un account nuovo: se si spezza,\\n' +
        '        chi firma resta davanti a un velo scuro e non entra piu-.');
      // E premuto due volte non si prosegue due volte.
      chiudiDisclaimer();
      dice(proseguito === 1, 'e premuto due volte non si prosegue due volte', proseguito);
      return { dette:d };
    }catch(e){ return { guasto:(e&&e.message), dette:d }; }
  })()`);
  if (dopo.guasto) { console.error('GUASTO: ' + dopo.guasto); app.exit(1); return; }
  righe = righe.concat(dopo.dette);

  let male = 0;
  for (const x of righe) {
    if (!x.ok) male++;
    console.log((x.ok ? '  ok   ' : '  NO   ') + x.che);
    if (x.perche) console.log('        ' + x.perche);
  }
  console.log(male ? '\n' + male + ' cose non tornano' : '\ntutto a posto (' + righe.length + ' controlli)');
  app.exit(male ? 1 : 0);
}).catch(e => { console.error(e); app.exit(1); });
