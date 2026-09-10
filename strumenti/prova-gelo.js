// IL GELO: DUE LASTRE DI GHIACCIO, UNA SULLA CARTA E UNA SUL TASSELLO.
//
//     $ELECTRON strumenti/prova-gelo.js [scatto.png]
//
// In partita si possono congelare due cose, e sono due mestieri diversi:
//   - una CARTA IN MANO (Snow Queen, "Yo. Chill"), che vive in HTML dentro al
//     ventaglio, e' inclinata, si solleva al passaggio del mouse e si rimette
//     in fila nella mano espansa;
//   - un TASSELLO in campo (Sherazade, "Cliffhanger"), che vive in SVG dentro
//     al gruppo della sua cella, cade dall'alto a inizio partita, trema quando
//     viene colpito e si solleva se Ali Baba lo prende.
//
// Le due lastre devono percio' rispondere alle stesse tre domande, e questo
// banco le fa a tutte e due:
//   1. sono GRANDI QUANTO cio' che coprono? (non "circa": in pixel)
//   2. si fondono in `hard-light`?
//   3. SEGUONO cio' che coprono quando si sposta o si inclina?
//
// La terza e' quella che nessuno controlla mai a mano, perche' a carta ferma
// non si vede: un overlay tenuto in pari a mano sembra perfetto finche' la
// cosa sotto non si muove, e si scolla al primo caso che nessuno aveva
// previsto. Qui il tassello viene spostato per davvero e la carta inclinata
// per davvero, e si guarda dove finisce il ghiaccio.
//
// Con un nome di file come argomento fa anche le fotografie: la scena intera,
// la carta da vicino e il tassello da vicino.
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
  // MOSTRATA subito, fuori dallo schermo. Non e' per le fotografie: su una
  // finestra nascosta il contenitore della plancia nasce largo zero, e
  // renderBoard esce alla prima riga senza disegnare una sola cella. Con la
  // mano non succede — quella non misura niente — ed e' il modo piu' rapido
  // per credere che il banco funzioni mentre meta' della scena non c'e'.
  win.setPosition(-3200, 0); win.showInactive();
  await new Promise(r => setTimeout(r, 14000));

  // ── La scena: una partita locale, una carta gelata in mano, un tassello
  //    gelato in campo. Si prende la cella centrale e la prima carta, cosi' la
  //    fotografia inquadra sempre le stesse due cose.
  const posa = await win.webContents.executeJavaScript(`(async function(){ try{
    ['splash','patch-notes-overlay'].forEach(id=>{ const e=document.getElementById(id); if(e) e.style.display='none'; });
    // La partita si comincia come la comincia il gioco. Montarla a pezzi —
    // showPage piu' initGame — lascia #app spento (lo accende startGame) e
    // il fondo del tavolo mai posato: la mano si vede, il tavolo resta nero,
    // e sembra che sia il ghiaccio a non funzionare.
    PARTITA_RETE = null;
    showPage('game');
    startGame(true);
    return { avviata:true };
  }catch(e){ return { guasto:(e&&e.message)+' '+String((e&&e.stack)||'').slice(0,300) }; } })()`);

  // startGame passa dalla schermata del confronto e poi distribuisce le mani:
  // sono una decina di secondi, e prima di allora non c'e' ne' una carta in
  // mano da congelare ne' un tassello posato su cui posare il ghiaccio.
  await new Promise(r => setTimeout(r, 16000));

  const gelata = await win.webContents.executeJavaScript(`(async function(){ try{
    G.gameOver = false;
    G.currentPlayer = 1;
    // La carta: l-ULTIMA del ventaglio, congelata per due turni. Non la prima:
    // quella sta in fondo alla pila e mezza fuori dallo schermo, e in
    // fotografia si vedrebbe un angolo di ghiaccio invece di una carta gelata.
    const carta = G.p1Hand[G.p1Hand.length - 1];
    carta.congelataFinoAlTurno = (G.numeroTurno||1) + 2;
    // Il tassello: uno libero in mezzo al tabellone, cosi' la fotografia lo
    // inquadra sempre nello stesso posto.
    const libere = celleLibere();
    G.gelo[libere[Math.floor(libere.length/2)]] = (G.numeroTurno||1) + 2;
    _firmaTabellonePrecedente = null;
    render(); renderBoard();
    await new Promise(r=>setTimeout(r, 800));
    return { carta: carta.id, celle: celleCongelateOra(), inMano: G.p1Hand.length,
             tasselli: document.querySelectorAll('#board-svg g[data-cellkey]').length };
  }catch(e){ return { guasto:(e&&e.message)+' '+String((e&&e.stack)||'').slice(0,300) }; } })()`);
  const posaEsito = gelata;

  if (posa.guasto) { console.error('GUASTO all\'avvio: ' + posa.guasto); app.exit(1); return; }
  if (posaEsito.guasto) { console.error('GUASTO al gelo: ' + posaEsito.guasto); app.exit(1); return; }
  console.log('scena: ' + posaEsito.tasselli + ' tasselli, ' + posaEsito.inMano
    + ' carte in mano, gelate ' + JSON.stringify(posaEsito.celle));

  await new Promise(r => setTimeout(r, 800));

  const dette = await win.webContents.executeJavaScript(`(function(){ try{
    const d = [];
    const dice = (ok, che, perche) => d.push({ ok:!!ok, che, perche: perche||'' });

    // ── LA CARTA IN MANO ────────────────────────────────────────────────────
    const wrap = document.querySelector('#p1-hand-fan .hand-card-wrap.congelata');
    dice(!!wrap, 'la carta congelata e- riconoscibile nel ventaglio',
      wrap ? '' : 'nessun .hand-card-wrap.congelata: senza questa il resto non si puo- chiedere');
    if(!wrap) return d;
    const dopo = getComputedStyle(wrap, '::after');
    dice(/frozen-card\\.png/.test(dopo.backgroundImage),
      'e ci sta sopra la lastra frozen-card.png',
      'ho letto "' + String(dopo.backgroundImage).slice(0, 120) + '"');
    dice(dopo.mixBlendMode === 'hard-light',
      'fusa in hard-light', 'ho letto "' + dopo.mixBlendMode + '"');
    // La misura: il ::after riempie il wrap, che e- la carta.
    const lw = Math.round(parseFloat(dopo.width)), lh = Math.round(parseFloat(dopo.height));
    const cw = Math.round(wrap.clientWidth), ch = Math.round(wrap.clientHeight);
    dice(lw === cw && lh === ch,
      'grande esattamente quanto la carta',
      'lastra ' + lw + 'x' + lh + ', carta ' + cw + 'x' + ch);
    // v0.79.63 — senza isolamento hard-light fonderebbe col TAVOLO dietro alla
    // mano invece che con la carta, e il ghiaccio cambierebbe colore a seconda
    // di cosa gli passa sotto.
    const suo = getComputedStyle(wrap);
    dice(suo.isolation === 'isolate' || suo.filter !== 'none',
      'e la fusione e- confinata alla carta, non al tavolo dietro',
      'isolation=' + suo.isolation + '  filter=' + String(suo.filter).slice(0,40));

    // SEGUE LA CARTA? Il ventaglio le inclina: se la carta e- girata, e- girata
    // anche la lastra, perche- il ::after e- dentro all-elemento che gira.
    // Si misura sull-elemento, che e- cio- che porta la trasformazione.
    const t = suo.transform;
    const giaGirata = t && t !== 'none';
    // E si prova a muoverla per davvero: si aggiunge una rotazione e si guarda
    // che il riquadro a schermo cambi. Se la lastra fosse un elemento tenuto in
    // pari a mano, resterebbe dov-era.
    // La transizione va spenta prima di misurare: .hand-card-wrap fa scorrere
    // la sua trasformazione, e getBoundingClientRect legge il fotogramma di
    // ADESSO — cioe- ancora quello di partenza. Senza questa riga la carta
    // sembrava non muoversi affatto.
    wrap.style.transition = 'none';
    const prima = wrap.getBoundingClientRect();
    const eraStile = wrap.style.transform;
    // "important": il ventaglio scrive la sua inclinazione nello stile in
    // linea, e una seconda scrittura sulla stessa proprieta- la sostituisce
    // invece di aggiungersi. Senza questo la carta non si muoveva di un
    // pixel e il controllo passava per finta.
    wrap.style.setProperty('transform', (eraStile ? eraStile + ' ' : '') + 'rotate(18deg) translate(40px, -30px)', 'important');
    const poi = wrap.getBoundingClientRect();
    const dopo2 = getComputedStyle(wrap, '::after');
    // Il ::after resta della misura della carta anche girato: la rotazione non
    // cambia le sue dimensioni proprie, cambia dove finisce sullo schermo.
    dice(Math.round(parseFloat(dopo2.width)) === cw && Math.round(parseFloat(dopo2.height)) === ch,
      'e inclinando la carta la lastra resta della sua misura',
      Math.round(parseFloat(dopo2.width)) + 'x' + Math.round(parseFloat(dopo2.height)));
    dice(Math.abs(poi.left - prima.left) > 5 || Math.abs(poi.top - prima.top) > 5,
      'e si sposta insieme a lei (e- dentro all-elemento che si muove)',
      'la carta e- passata da ' + Math.round(prima.left) + ',' + Math.round(prima.top)
      + ' a ' + Math.round(poi.left) + ',' + Math.round(poi.top) + '; il ::after e- suo figlio,'
      + ' quindi non c-e- niente da tenere in pari.');
    wrap.style.setProperty('transform', eraStile);
    wrap.style.transition = '';

    // ── IL TASSELLO ─────────────────────────────────────────────────────────
    const gelate = celleCongelateOra();
    dice(gelate.length === 1, 'in campo c-e- un tassello congelato', gelate.join(' '));
    const k = gelate[0];
    const gruppo = document.querySelector('#board-svg g[data-cellkey="' + k + '"]');
    dice(!!gruppo, 'e ha il suo gruppo nella plancia', k);
    if(!gruppo) return d;
    const immagini = [...gruppo.querySelectorAll('image')];
    const ghiaccio = immagini.find(i => /frozen-tile\\.png/.test(i.getAttribute('href')||''));
    const tassello = immagini.find(i => i !== ghiaccio);
    dice(!!ghiaccio, 'con sopra la lastra frozen-tile.png',
      immagini.map(i=>String(i.getAttribute('href')).split('/').pop()).join(', '));
    if(!ghiaccio) return d;
    dice(getComputedStyle(ghiaccio).mixBlendMode === 'hard-light',
      'fusa in hard-light', getComputedStyle(ghiaccio).mixBlendMode);
    const q = a => Math.round(parseFloat(a));
    dice(!!tassello && q(ghiaccio.getAttribute('x')) === q(tassello.getAttribute('x'))
      && q(ghiaccio.getAttribute('y')) === q(tassello.getAttribute('y'))
      && q(ghiaccio.getAttribute('width')) === q(tassello.getAttribute('width'))
      && q(ghiaccio.getAttribute('height')) === q(tassello.getAttribute('height')),
      'grande esattamente quanto il tassello, e nello stesso posto',
      'ghiaccio ' + [ghiaccio.getAttribute('x'),ghiaccio.getAttribute('y'),ghiaccio.getAttribute('width'),ghiaccio.getAttribute('height')].map(q).join(',')
      + '   tassello ' + (tassello ? [tassello.getAttribute('x'),tassello.getAttribute('y'),tassello.getAttribute('width'),tassello.getAttribute('height')].map(q).join(',') : '(manca)'));
    dice((ghiaccio.getAttribute('clip-path')||'').indexOf('clip-gelo-') >= 0,
      'e ritagliata sull-esagono, non su un rettangolo',
      ghiaccio.getAttribute('clip-path'));
    dice(getComputedStyle(gruppo).isolation === 'isolate',
      'e la fusione e- confinata a questa cella, non a tutta la plancia',
      getComputedStyle(gruppo).isolation);

    // SEGUE IL TASSELLO? Si muove il GRUPPO della cella — che e- esattamente
    // cio- che muovono la caduta dei tasselli, la scossa e Ali Baba — e si
    // guarda che le due immagini si spostino della stessa quantita-.
    const gPrima = ghiaccio.getBoundingClientRect(), tPrima = tassello.getBoundingClientRect();
    gruppo.setAttribute('transform', 'translate(40, -25)');
    const gPoi = ghiaccio.getBoundingClientRect(), tPoi = tassello.getBoundingClientRect();
    gruppo.removeAttribute('transform');
    const dg = Math.round(gPoi.left - gPrima.left), dt = Math.round(tPoi.left - tPrima.left);
    const dgy = Math.round(gPoi.top - gPrima.top), dty = Math.round(tPoi.top - tPrima.top);
    dice(dg === dt && dgy === dty && dg !== 0,
      'e spostando il tassello il ghiaccio si sposta con lui, dello stesso tanto',
      'tassello ' + dt + ',' + dty + '   ghiaccio ' + dg + ',' + dgy
      + '. Il gruppo della cella e- quello che muovono la caduta a inizio partita,'
      + ' la scossa di chi viene colpito e il sollevamento di Ali Baba.');

    // ── E NON CI SI PUO- GIOCARE ────────────────────────────────────────────
    const [cq, cr] = k.split(',').map(Number);
    dice(!canPlace(cq, cr, G.p1Hand[1]), 'su un tassello congelato non si posa una carta');
    G.gelo = {};
    dice(canPlace(cq, cr, G.p1Hand[1]), 'e scaduto il gelo torna una cella come le altre');
    return d;
  }catch(e){ return [{ ok:false, che:'PIANTATA', perche:(e&&e.message)+' '+String((e&&e.stack)||'').split(String.fromCharCode(10))[1] }]; } })()`);

  let male = 0;
  for (const d of dette) {
    if (!d.ok) male++;
    console.log((d.ok ? '  ok   ' : '  NO   ') + d.che);
    if (d.perche) console.log('        ' + d.perche);
  }
  console.log(male ? '\n' + male + ' cose non tornano' : '\ntutto a posto (' + dette.length + ' controlli)');
  if (SCATTO) try {
    // Si rimette il gelo che l'ultimo controllo ha tolto, e si fotografa.
    await win.webContents.executeJavaScript(`(function(){
      const libere = celleLibere();
      G.gelo[libere[Math.floor(libere.length/2)]] = (G.numeroTurno||1) + 2;
      _firmaTabellonePrecedente = null; renderBoard(); render(); return 1; })()`);
    await new Promise(r => setTimeout(r, 900));
    fs.writeFileSync(SCATTO, (await win.webContents.capturePage()).toPNG());
    console.log('scritto ' + SCATTO);
    // E i due ritagli, uno per lastra.
    const dove = await win.webContents.executeJavaScript(`(function(){
      // Per il ritratto la carta si solleva: nel ventaglio sporge sotto al
      // bordo dei 1080, e un ritaglio che esce dalla finestra torna nero senza
      // dire perche'. Si alza quel tanto che basta a starci tutta — ed e'
      // anche il modo di far vedere che il ghiaccio la segue, visto che a
      // muoversi e' la carta e non lui.
      const el = document.querySelector('#p1-hand-fan .hand-card-wrap.congelata');
      el.style.transition = 'none';
      el.style.setProperty('transform', (el.style.transform || '') + ' translateY(-140px) scale(1.15)', 'important');
      el.style.zIndex = 999;
      const w = el.getBoundingClientRect();
      const k = celleCongelateOra()[0];
      const g = document.querySelector('#board-svg g[data-cellkey="'+k+'"]').getBoundingClientRect();
      // Il riquadro va TENUTO DENTRO alla finestra: le carte del ventaglio
      // sporgono sotto al bordo dei 1080, e un ritaglio che esce restituisce
      // un rettangolo nero senza dire perche-.
      const r = o => {
        const x = Math.max(0, Math.round(o.left) - 40), y = Math.max(0, Math.round(o.top) - 40);
        return { x, y,
          width: Math.min(Math.round(o.width) + 80, window.innerWidth - x),
          height: Math.min(Math.round(o.height) + 80, window.innerHeight - y) };
      };
      return { carta:r(w), cella:r(g), gr:JSON.stringify(w.toJSON?w.toJSON():w), quante:document.querySelectorAll('.hand-card-wrap.congelata').length }; })()`);
    console.log('  ritaglio carta: ' + JSON.stringify(dove.carta) + '  (rect ' + dove.gr + ', ' + dove.quante + ' congelate nel documento)');
    // Un respiro prima del primo ritaglio: la carta si e- appena sollevata, e
    // capturePage col riquadro presa nello stesso fotogramma torna nera.
    await new Promise(r => setTimeout(r, 900));
    for (const [nome, rect] of [['carta', dove.carta], ['tassello', dove.cella]]) {
      const via = SCATTO.replace(/\.png$/, '-' + nome + '.png');
      fs.writeFileSync(via, (await win.webContents.capturePage(rect)).toPNG());
      console.log('scritto ' + via);
    }
  } catch(e) {
    console.log('  (le fotografie non sono riuscite: ' + (e && e.message) + ')');
  }

  app.exit(male ? 1 : 0);
}).catch(e => { console.error(e); app.exit(1); });
