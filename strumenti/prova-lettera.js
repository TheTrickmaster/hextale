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
    webPreferences: { contextIsolation: false, webSecurity: false } });
  await win.loadURL(PAGINA);
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
    const tit = getComputedStyle(document.querySelector('#starter-titlebar h2'));
    dice(/Marcellus/.test(tit.fontFamily) && tit.fontSize === '30px'
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
    col.forEach(c=>{ c.style.transition = 'none'; });
    const scelta = col[0];
    await scegliStarter(scelta.querySelector('.starter-pick'));
    await attendi(200);

    dice(scelta.classList.contains('starter-presa'), 'quella scelta si accende');
    dice(document.getElementById('starter-overlay').classList.contains('starter-solo'),
      'il riquadro che le conteneva e il titolo se ne vanno');
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
    const riga = document.getElementById('starter-colonne').getBoundingClientRect();
    const mia = scelta.getBoundingClientRect();
    const scarto = Math.abs((mia.left + mia.width/2) - (riga.left + riga.width/2));
    dice(scarto < 2, 'e quella rimasta e- al centro', 'scarto di ' + scarto.toFixed(1) + 'px');
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
    dice(frase === 'Congratulations! You picked the Starter Wild deck!', 'e la frase giusta', frase);

    // ── 3. e non si sceglie due volte ──────────────────────────────────────
    const prima = window.__chiestoQuante || 0;
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
