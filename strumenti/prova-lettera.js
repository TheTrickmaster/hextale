// LA SCELTA DEL MAZZO INIZIALE: "Pick a letter".
//
//     $ELECTRON strumenti/prova-lettera.js [scatto.png]
//
// E' una schermata che si vede UNA volta sola per account, e quindi la piu'
// difficile da riprovare a mano: sbagliarla vuol dire sbagliarla per tutti
// quelli che si registreranno, e accorgersene per caso mesi dopo guardando un
// account nuovo. Qui si apre a comando, si sceglie, e si guarda cosa succede.
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
    // considerata coperta, e da li- non avanzano ne- il disegno ne- gli stati
    // del puntatore — :hover non si accende piu- e la prova dell-hover cade
    // per un motivo che non ha niente a che fare con la regola che prova.
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await win.loadURL(PAGINA);
  // v0.79.96 — lo zoom a 1, sempre. Chromium ricorda lo zoom di ogni pagina nel
  // profilo di Electron, e su questo computer play/index.html se n'era tenuto
  // uno a 1,5: la finestra da 1920 diventava larga 1280 in pixel CSS e il
  // puntatore finto di sendInputEvent cadeva una volta e mezza piu' in la',
  // fuori dalla colonna. La prova dell'hover falliva per un motivo che non
  // aveva niente a che fare con la lettera.
  win.webContents.setZoomFactor(1);
  await new Promise(r => setTimeout(r, 2500));

  const dette = await win.webContents.executeJavaScript(`(async function(){ try{
    const dette = [];
    const dice = (ok, che, perche) => dette.push({ ok:!!ok, che:che, perche:perche||'' });
    const attendi = (ms)=>new Promise(r=>setTimeout(r,ms));

    // ── il server, finto ma con le stesse risposte ─────────────────────────
    const chiesto = [];
    let giaScelto = false;
    sessioneAccount = { token:'finto', userId:'u1', username:'Prova' };
    window.nakamaRpc = async (nome, corpo)=>{
      chiesto.push({ nome, corpo });
      if(nome !== 'hx_starter') return {};
      if(corpo && corpo.mazzo){ giaScelto = true;
        return { scelto:true, mazzo:corpo.mazzo, nome:{1:'Starter Wild',2:'Starter Debuff',3:'Starter Princess'}[corpo.mazzo] }; }
      return { scelto:giaScelto, mazzo:0, nome:'' };
    };
    // I mazzi non si vanno a prendere davvero: qui non c'e' un database.
    window.aggiornaCarteDopoAccesso = async ()=>{};
    window.mazzoPerId = (id)=> ({ id:id, nome:'Starter Wild', carte:new Array(20).fill('final-robin-hood') });

    // ── 1. si apre, e cosa c'e' dentro ─────────────────────────────────────
    // v0.79.96 — il tutorial d'apertura viene PRIMA della lettera, e
    // chiediStarterSeServe aspetta che lo si chiuda (v0.79.82). Senza dirgli
    // che e' gia' stato visto il banco restava fermo li' per sempre, e dalla
    // v0.79.82 non arrivava piu' alla fine.
    TUTORIAL_VISTI = { principale:1, pacchetti:1, libreria:1 };
    await chiediStarterSeServe();
    const ov = document.getElementById('starter-overlay');
    dice(!!ov && ov.classList.contains('show'), 'la finestra si apre quando il mazzo non e- ancora scelto');
    const col = [...document.querySelectorAll('.starter-col')];
    dice(col.length === 3, 'tre colonne', 'ne ho contate ' + col.length);
    dice(col.map(c=>c.getAttribute('data-mazzo')).join(',') === '1,3,2',
      'sinistra 1, centro 3, destra 2',
      'E- la corrispondenza decisa da Lorenzo, e non ha una regola dietro:\\n' +
      '        se si sbaglia qui, il giocatore riceve un mazzo che non ha scelto.');
    const misure = col.map(c=>{ const r=c.getBoundingClientRect(); return Math.round(c.offsetWidth)+'x'+Math.round(c.offsetHeight); });
    dice(misure.every(m=>m === '330x580'), 'larghe 330 e alte 580', misure.join('  '));
    const gap = getComputedStyle(document.getElementById('starter-colonne')).gap;
    dice(gap === '30px', 'trenta di distanza', 'ho letto ' + gap);
    const file = col.map(c=>(c.querySelector('.starter-lettera')||{}).getAttribute
      ? c.querySelector('.starter-lettera').getAttribute('data-starter-icona') : '');
    dice(file.join(',') === 'letter-friend.png,letter-lover.png,letter-stranger.png',
      'e ognuna ha la sua lettera', file.join('  '));
    const larghezze = col.map(c=>c.querySelector('.starter-lettera').offsetWidth);
    dice(larghezze.every(w=>w === 200), 'le lettere sono larghe 200', larghezze.join('  '));
    const st = getComputedStyle(col[0].querySelector('.starter-testo'));
    dice(/Rosarivo/.test(st.fontFamily) && st.fontSize === '15px' && st.fontStyle === 'italic',
      'il testo e- Rosarivo 15 corsivo', st.fontFamily + ' ' + st.fontSize + ' ' + st.fontStyle);
    const fusioni = col.map(c=>getComputedStyle(c.querySelector('.starter-tinta')).mixBlendMode);
    dice(fusioni.join(',') === 'color,color,difference',
      'le prime due tinte fondono in "color", la terza in "difference"', fusioni.join('  '));
    const testi = col.map(c=>c.querySelector('.starter-testo').textContent);
    dice(testi[0].indexOf('Hey!') === 0 && testi[1].indexOf('My dearest,') === 0
      && testi[2].indexOf('To thee who hast found this letter,') === 0,
      'e ognuna dice la sua');
    const tit = getComputedStyle(document.querySelector('#starter-barra h2'));
    dice(/Marcellus/.test(tit.fontFamily) && tit.fontSize === '36px'
      && tit.textAlign === 'center' && tit.color === 'rgb(237, 224, 198)',
      'il titolo e- come quello di ogni altra finestra',
      tit.fontFamily + '  ' + tit.fontSize + '  ' + tit.textAlign + '  ' + tit.color);
    const pick = col[0].querySelector('.starter-pick');
    dice(Math.abs(pick.offsetWidth - (col[0].offsetWidth - 52)) < 3,
      'e il Pick riempie la colonna',
      'largo ' + pick.offsetWidth + ' dentro a una colonna di ' + col[0].offsetWidth + ' meno 26 di bordo per parte');
    dice(getComputedStyle(col[0].querySelector('.starter-nome b')).color === 'rgb(255, 255, 255)',
      'chi scrive la lettera e- in bianco');
    const et = pick.querySelector('.hxb-label');
    const cb = pick.getBoundingClientRect(), ce = et.getBoundingClientRect();
    dice(Math.abs((ce.left+ce.width/2) - (cb.left+cb.width/2)) < 2,
      'e la sua scritta sta in mezzo',
      'scarto di ' + Math.abs((ce.left+ce.width/2)-(cb.left+cb.width/2)).toFixed(1) + 'px');

    // Per la fotografia: via il velo di apertura, che sta sopra a tutto finche'
    // il gioco non ha finito di caricare e coprirebbe la finestra.
    ['splash','start-screen'].forEach(id=>{ const e=document.getElementById(id); if(e) e.style.display='none'; });
    return { dette, chiesto, fase:'aperta' };
  }catch(e){ return { guasto:(e&&e.message)+' '+String((e&&e.stack)||'').slice(0,240) }; } })()`);

  if (dette.guasto) { console.error('GUASTO: ' + dette.guasto); app.exit(1); return; }
  let righe = dette.dette;

  // ── v0.79.61 — LA LETTERA SI INGRANDISCE PASSANDOCI SOPRA ───────────────
  // Col mouse VERO: :hover non si accende con un evento sintetico da JS, e
  // nemmeno guardando il foglio di stile si saprebbe se la regola arriva
  // davvero all'immagine. sendInputEvent muove il puntatore per davvero,
  // anche a finestra nascosta, e dopo si misura la carta com'e' sullo schermo.
  const misura = (sel) => win.webContents.executeJavaScript(
    'getComputedStyle(document.querySelector("' + sel + '")).transform');
  // La finestra va MOSTRATA, anche se fuori dallo schermo: su una finestra
  // nascosta Chromium non accende :hover, e il puntatore finto passerebbe
  // sopra a una colonna che non se ne accorge.
  win.setPosition(-3200, 0); win.showInactive();
  await new Promise(r => setTimeout(r, 600));
  // v0.79.96 — il punto si calcola DOPO aver mostrato la finestra: mostrandola,
  // Windows puo' ridimensionarla, la scena si riscala e la colonna si sposta.
  // Calcolato prima, il puntatore finiva dove la colonna non c'era piu'.
  const dovE = await win.webContents.executeJavaScript(
    '(function(){ var r=document.querySelector(".starter-col").getBoundingClientRect();' +
    ' return [Math.round(r.left+r.width/2), Math.round(r.top+r.height-40)]; })()');
  const fermo = await misura('.starter-col .starter-lettera');
  // In fondo alla colonna, lontano dall'immagine: e' li' che si vede se
  // l'aggancio e' la COLONNA e non solo la lettera.
  win.webContents.sendInputEvent({ type:'mouseMove', x:dovE[0], y:dovE[1] });
  await new Promise(r => setTimeout(r, 400));
  const sopra = await misura('.starter-col .starter-lettera');
  const scala = (m) => { const n = String(m||'').match(/matrix\(([-0-9.]+)/); return n ? parseFloat(n[1]) : 1; };
  righe.push({ ok: scala(fermo) === 1, che: 'ferma, la lettera e- alla sua misura', perche: fermo });
  righe.push({ ok: scala(sopra) > 1.02 && scala(sopra) < 1.2,
    che: 'e si ingrandisce passando sul CONTAINER, non solo sulla lettera',
    perche: 'ingrandita di ' + scala(sopra) + ' (letto "' + sopra + '"), col puntatore in fondo alla colonna' });
  const tr = await win.webContents.executeJavaScript(
    'getComputedStyle(document.querySelector(".starter-col .starter-lettera")).transitionProperty');
  righe.push({ ok: /transform/.test(tr), che: 'e l-ingrandimento e- accompagnato, non a scatto', perche: tr });
  // Il puntatore torna fuori: le fotografie e la scelta non lo vogliono addosso.
  win.webContents.sendInputEvent({ type:'mouseMove', x:5, y:5 });
  await new Promise(r => setTimeout(r, 300));

  if (SCATTO) {
    win.setPosition(-3200, 0); win.showInactive();
    await new Promise(r => setTimeout(r, 1500));
    fs.writeFileSync(SCATTO, (await win.webContents.capturePage()).toPNG());
    console.log('scritto ' + SCATTO);
  }

  const dopo = await win.webContents.executeJavaScript(`(async function(){ try{
    const dette = [];
    const dice = (ok, che, perche) => dette.push({ ok:!!ok, che:che, perche:perche||'' });
    const attendi = (ms)=>new Promise(r=>setTimeout(r,ms));
    const col = [...document.querySelectorAll('.starter-col')];

    // ── 2. si sceglie quella di sinistra ───────────────────────────────────
    // Le transizioni si spengono: a finestra nascosta non avanzano affatto, e a
    // finestra visibile si misurerebbe un fotogramma a caso del movimento. Qui
    // interessa DOVE si fermano le colonne, non come ci arrivano.
    // Transizioni E animazioni, dentro e fuori: a finestra nascosta non
    // avanzano affatto, a finestra visibile si misura un fotogramma a caso del
    // movimento — e un elemento a meta' di una traslazione ha un rettangolo che
    // non e' quello dove si fermera'. Qui interessa DOVE si ferma tutto.
    const stop = document.createElement('style');
    stop.textContent = '.starter-col, .starter-col *, #starter-galleria{ transition:none !important; animation:none !important; }';
    document.head.appendChild(stop);
    const scelta = col[0];
    await scegliStarter(scelta.querySelector('.starter-pick'));
    await attendi(200);
    // v0.79.96 — le misure a schermo si riportano al disegno 1920x1080. Il gioco
    // scala la scena alla finestra (fitGameRoot), e la finestra del banco non e-
    // sempre larga 1920: su questo computer, fuori dallo schermo, viene 1280x720, e
    // una colonna da 330 misura 220. Prima il banco passava o no a seconda di come
    // Windows dimensionava la finestra.
    const k = (typeof _fit === 'object' && _fit.scale) ? _fit.scale : 1;
    const R = el => { const r = el.getBoundingClientRect(); return { left:r.left/k, right:r.right/k, top:r.top/k, bottom:r.bottom/k, width:r.width/k, height:r.height/k }; };

    dice(scelta.classList.contains('starter-presa'), 'quella scelta si accende');
    // v0.79.60 — il riquadro e il titolo RESTANO: fino alla v0.79.59 se ne
    // andavano e la colonna restava sola in mezzo allo schermo.
    const pan = document.getElementById('starter-pannello');
    const ps = getComputedStyle(pan);
    dice(ps.backgroundImage !== 'none' && parseFloat(ps.paddingLeft) === 30,
      'il riquadro che le conteneva resta, col suo fondo e i suoi trenta di bordo',
      'fondo "' + ps.backgroundImage.slice(0, 40) + '", bordo ' + ps.paddingLeft);
    const h2 = document.querySelector('#starter-barra h2');
    dice(getComputedStyle(document.getElementById('starter-barra')).opacity === '1'
      && h2.textContent === 'New deck!',
      'e il titolo resta e dice "New deck!"', h2.textContent);
    dice(scelta.classList.contains('starter-lampo'), 'la colonna lampeggia');
    const arte = scelta.querySelector('.starter-arte');
    dice(!!arte && (arte.style.backgroundImage || '').indexOf('url(') >= 0,
      'e il suo fondo diventa l-arte del mazzo',
      'ho letto "' + ((arte && arte.style.backgroundImage) || '') + '"');
    dice(col[1].classList.contains('starter-via') && col[2].classList.contains('starter-via'),
      'e le altre due se ne vanno');
    // Non zero spaccato: a larghezza zero restano i due bordi da un pixel e
    // mezzo, che box-sizing non puo' togliere. Quel che conta e' che non
    // occupino piu' spazio.
    dice(col[1].offsetWidth <= 4 && col[2].offsetWidth <= 4,
      'si chiudono davvero su se stesse',
      'larghezze: ' + col.map(c=>c.offsetWidth).join(' / ') + '  —  ' +
      'Se restassero larghe, quella scelta non arriverebbe al centro:\\n' +
      '        il centro non e- calcolato, e- dove finiscono le altre.');
    const riga = R(document.getElementById('starter-colonne'));
    const mia = R(scelta);
    // v0.79.60 — non piu' al centro: a SINISTRA, e a destra la galleria.
    dice(Math.abs(mia.left - riga.left) < 2, 'e quella rimasta scivola a sinistra',
      'scarto di ' + Math.abs(mia.left - riga.left).toFixed(1) + 'px dal bordo della riga');
    dice(Math.round(mia.width) === 330 && Math.round(mia.height) === 580,
      'e resta larga 330 e alta 580', Math.round(mia.width) + 'x' + Math.round(mia.height));
    // ── 2b. LA GALLERIA DELLE CARTE (v0.79.60) ────────────────────────────
    const ov = document.getElementById('starter-overlay');
    dice(ov.classList.contains('starter-carte'), 'e a destra si apre la galleria');
    const gal = document.getElementById('starter-galleria');
    const rg = R(gal);
    dice(Math.round(rg.width) === 960, 'larga 960: tre carte da 300 e due gap da 30', 'larga ' + Math.round(rg.width));
    dice(Math.abs(rg.left - mia.right - 30) < 2, 'a trenta pixel dalla colonna', 'distanza ' + (rg.left - mia.right).toFixed(1));
    dice(Math.abs(rg.top - mia.top) < 2, 'allineata in alto con la colonna', 'scarto ' + (rg.top - mia.top).toFixed(1));
    dice(Math.abs(rg.bottom - (mia.bottom + 30)) < 2,
      'e arriva fin sul bordo del riquadro, trenta pixel sotto la colonna',
      'scarto ' + (rg.bottom - mia.bottom).toFixed(1));
    const carte = [...gal.querySelectorAll('.starter-carta')];
    dice(carte.length === 20, 'dentro ci sono le carte del mazzo, tutte', 'ne ho contate ' + carte.length + ' su 20 finte');
    dice(carte.every(c=>c.querySelector('svg')), 'e ognuna e- una carta disegnata intera');
    const rc = carte.slice(0, 4).map(R);
    dice(rc.length === 4 && Math.round(rc[0].width) === 300 && Math.round(rc[0].height) === Math.round(300*360/210),
      'larghe 300 e con le proporzioni della carta', rc.length ? Math.round(rc[0].width) + 'x' + Math.round(rc[0].height) : '-');
    dice(rc.length === 4 && rc[0].top === rc[1].top && rc[1].top === rc[2].top && rc[3].top > rc[0].bottom,
      'tre per riga, la quarta va a capo');
    dice(rc.length === 4 && Math.abs(rc[1].left - rc[0].right - 30) < 1 && Math.abs(rc[3].top - rc[0].bottom - 30) < 1,
      'a trenta pixel una dall-altra, in riga e in colonna');
    dice(gal.scrollHeight > gal.clientHeight + 100, 'si scorre in verticale',
      'contenuto ' + gal.scrollHeight + ' in una finestra di ' + gal.clientHeight);
    const gs = getComputedStyle(gal);
    dice(gs.overflowY === 'auto' && gs.overflowX === 'hidden' && gs.scrollbarWidth === 'none',
      'con la rotella e senza barra, come la Libreria', gs.overflowY + ' ' + gs.overflowX + ' barra=' + gs.scrollbarWidth);
    gal.scrollTop = 10000;
    dice(Math.abs(gal.scrollTop - (gal.scrollHeight - gal.clientHeight)) < 1 && gal.scrollTop > 0,
      'e arriva in fondo', 'scrollTop ' + gal.scrollTop);
    const ultima = R(carte[carte.length-1]);
    dice(Math.abs(rg.bottom - ultima.bottom - 30) < 2,
      'in fondo l-ultima riga si ferma trenta pixel prima del bordo, come la colonna',
      'scarto ' + (rg.bottom - ultima.bottom).toFixed(1));
    gal.scrollTop = 0;
    dice(scelta.classList.contains('starter-fatta'), 'la lettera lascia il posto al mazzo');
    dice(getComputedStyle(scelta.querySelector('.starter-dentro')).display === 'none',
      'la lettera e il suo testo non ci sono piu-');
    const slot = scelta.querySelector('.starter-anteprima .deck-slot');
    dice(!!slot, 'e al suo posto c-e- l-anteprima del mazzo');
    dice(!!slot && slot.offsetWidth > 250,
      'ed e- larga quanto la colonna, non un quadratino',
      'larga ' + (slot ? slot.offsetWidth : 0) + 'px. La casella nasce in una COLONNA, dove il suo '
      + 'flex-basis e- l-altezza; qui il contenitore e- una riga, e quella stessa base diventa la larghezza.');
    dice(!scelta.querySelector('.starter-anteprima .deck-slot-check')
      && !scelta.querySelector('.starter-anteprima .deck-slot-edit'),
      'una vetrina, non una lista: niente spunta e niente matita');
    const frase = scelta.querySelector('.starter-frase').textContent;
    dice(frase === '20 new cards have been added to your library.',
      'e la frase conta le carte del mazzo', frase);
    const tt = scelta.querySelector('.starter-titolo');
    const ts = getComputedStyle(tt);
    dice(tt.textContent === 'New deck unlocked!' && /Marcellus/.test(ts.fontFamily)
      && ts.fontSize === '22px' && ts.color === 'rgb(237, 231, 218)',
      'e sopra c-e- "New deck unlocked!"',
      tt.textContent + '  ' + ts.fontFamily + '  ' + ts.fontSize + '  ' + ts.color);
    const velo = scelta.querySelector('.starter-velo');
    dice(!!velo && getComputedStyle(velo).opacity === '1',
      'e un velo scende sull-arte, dal pieno al niente');
    const bot = scelta.querySelector('.starter-esito .hxb-label');
    dice(bot && bot.textContent === 'Collect', 'e il pulsante dice Collect', bot ? bot.textContent : '(manca)');
    const btn = scelta.querySelector('.starter-esito .hx-btn');
    const pezzo = btn && btn.querySelector('.hxb-left');
    dice(!!btn && btn.classList.contains('hx-btn-opaco'), 'ed e- della famiglia opaca');
    dice(!!pezzo && /button-opaque-/.test(getComputedStyle(pezzo).backgroundImage || ''),
      'e ha addosso i pezzi opachi, non quelli trasparenti',
      'ho letto "' + ((pezzo && getComputedStyle(pezzo).backgroundImage) || '') + '"');
    // La frase sta in mezzo fra il mazzo e il pulsante: non a occhio, in pixel.
    const rp = scelta.querySelector('.starter-anteprima').getBoundingClientRect();
    const rf = scelta.querySelector('.starter-frase').getBoundingClientRect();
    const rb = scelta.querySelector('.starter-esito .hx-btn').getBoundingClientRect();
    const sopra = rf.top - rp.bottom, sotto = rb.top - rf.bottom;
    dice(Math.abs(sopra - sotto) < 3, 'ed e- in mezzo fra il mazzo e il pulsante',
      'sopra ' + sopra.toFixed(1) + ', sotto ' + sotto.toFixed(1));

    // ── 3. e premuto Collect se ne va verso l-alto ─────────────────────────
    // Le animazioni qui restano ACCESE: quel che si misura non e- dove si
    // ferma, ma che parta e che a fine corsa la finestra sia davvero chiusa.
    stop.remove();
    chiudiSceltaStarter();
    await attendi(60);
    // v0.79.60 — a partire e' il riquadro intero, non la colonna sola.
    const box = document.getElementById('starter-box');
    dice(box.classList.contains('starter-esce'), 'premuto Collect, il riquadro intero parte');
    const uscita = getComputedStyle(box).animationName;
    dice(uscita === 'starterEsce',
      'ed e- l-uscita che gira, non piu- il respiro dell-alone',
      'sta girando "' + uscita + '"');
    await attendi(700);
    const ov2 = document.getElementById('starter-overlay');
    dice(!ov2.classList.contains('show'), 'e a corsa finita la finestra e- chiusa');
    dice(!box.classList.contains('starter-esce'),
      'e il riquadro e- rimesso a posto: riaprendo non parte gia- andato');
    return { dette };
  }catch(e){ return { guasto:(e&&e.message)+' '+String((e&&e.stack)||'').slice(0,240) }; } })()`);

  if (dopo.guasto) { console.error('GUASTO: ' + dopo.guasto); app.exit(1); return; }
  righe = righe.concat(dopo.dette);

  if (SCATTO) {
    await new Promise(r => setTimeout(r, 900));
    const secondo = SCATTO.replace(/\.png$/, '-2.png');
    fs.writeFileSync(secondo, (await win.webContents.capturePage()).toPNG());
    console.log('scritto ' + secondo);
  }

  let male = 0;
  for (const d of righe) {
    if (!d.ok) male++;
    console.log((d.ok ? '  ok   ' : '  NO   ') + d.che);
    if (!d.ok && d.perche) console.log('        ' + d.perche);
  }
  console.log(male ? '\n' + male + ' cose non tornano' : '\ntutto a posto (' + righe.length + ' controlli)');
  app.exit(male ? 1 : 0);
}).catch(e => { console.error(e); app.exit(1); });
