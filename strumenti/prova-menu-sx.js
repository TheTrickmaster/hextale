// LE DUE COLONNE DEL MENU: Shop, Donate, le valute — e le Daily quests.
//
//     $ELECTRON strumenti/prova-menu-sx.js [scatto.png]
//
// Dalla v0.79.67 il riquadro dello Shop non ha piu' un'illustrazione sua e
// dev'essere IDENTICO a quello del Donate. "Identico" e' la parola che questo
// banco traduce in numeri: stessa altezza, stesso fondo, stesso bordo, stessi
// angoli, stesso modo di tenere dentro il pulsante.
//
// Perche' serve un banco per una cosa che si vede a occhio: due riquadri quasi
// uguali sono peggio di due riquadri diversi — nessuno sa dire cos'e' che non
// va, e il difetto sopravvive a tutti quelli che ci passano davanti. E i due
// hanno gia' due regole separate nel foglio: basta che qualcuno tocchi una
// delle due perche' tornino a somigliarsi invece che a coincidere.
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
    // Vedi prova-disclaimer: una finestra fuori dallo schermo viene considerata
    // coperta, e da li' in poi non avanzano ne' le transizioni ne' il disegno.
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 14000));

  const esito = await win.webContents.executeJavaScript(`(async function(){
    const d = [];
    const dice = (ok, che, perche) => d.push({ ok:!!ok, che, perche: perche||'' });
    try{
      apriMenuPrincipale();
      await new Promise(r=>setTimeout(r, 1500));
      const shop = document.getElementById('mm2-box-shop');
      const don  = document.getElementById('mm2-box-donate');
      dice(!!shop && !!don, 'i due riquadri ci sono');
      if(!shop || !don) return { d };
      const s = getComputedStyle(shop), o = getComputedStyle(don);

      // ── 1. NIENTE PIU' ILLUSTRAZIONE DENTRO ───────────────────────────────
      dice(!shop.querySelector('.mm2-box-sfondo'),
        'dentro allo Shop non c-e- piu- un fondo illustrato',
        shop.querySelector('.mm2-box-sfondo') ? 'ce n-e- ancora uno' : '');
      dice(!document.getElementById('mm2-shop-bg'),
        'e l-elemento che lo portava non esiste piu-');

      // ── 2. E IL RIQUADRO E- QUELLO DEL DONATE ─────────────────────────────
      dice(shop.offsetHeight === don.offsetHeight,
        'alto uguale al Donate', shop.offsetHeight + ' e ' + don.offsetHeight);
      dice(shop.offsetWidth === don.offsetWidth,
        'e largo uguale', shop.offsetWidth + ' e ' + don.offsetWidth);
      // Le cinque proprieta- che fanno un riquadro quel riquadro. Si chiedono
      // una per una e non "a occhio": il fondo e- un gradiente, e due gradienti
      // diversi di un soffio si vedono solo mettendoli uno accanto all-altro.
      const uguali = ['backgroundImage','borderTopWidth','borderTopColor',
                      'borderTopLeftRadius','borderBottomLeftRadius','padding'];
      const diverse = uguali.filter(p => s[p] !== o[p]);
      dice(diverse.length === 0, 'stesso fondo, stesso bordo, stessi angoli, stesso padding',
        diverse.length ? diverse.map(p=>p + ': "' + s[p] + '" contro "' + o[p] + '"').join('\\n        ') : '');
      dice(s.display === o.display && s.alignItems === o.alignItems,
        'e tiene dentro il pulsante allo stesso modo',
        s.display + '/' + s.alignItems + '  contro  ' + o.display + '/' + o.alignItems);
      // La trama del pannello sta su tutti e due.
      dice(getComputedStyle(shop, '::before').backgroundImage === getComputedStyle(don, '::before').backgroundImage,
        'e la trama e- la stessa',
        getComputedStyle(shop, '::before').backgroundImage.slice(0, 60));

      // ── 3. IL PULSANTE RESTA COM-ERA ──────────────────────────────────────
      const b = document.getElementById('mm2-shop-btn');
      const bs = getComputedStyle(b);
      dice(bs.opacity === '0.3', 'il pulsante Shop resta trasparente al 30%', bs.opacity);
      dice(bs.pointerEvents === 'none', 'e non si puo- ancora premere', bs.pointerEvents);
      dice(b.classList.contains('hx-btn-shop'), 'e porta ancora la sua veste');
      const pezzo = b.querySelector('.hxb-left');
      dice(/button-shop-/.test(getComputedStyle(pezzo).backgroundImage || ''),
        'con addosso i suoi pezzi, non quelli di un altro',
        'ho letto "' + (getComputedStyle(pezzo).backgroundImage || '') + '"');
      dice(b.offsetWidth === document.getElementById('mm2-donate-btn').offsetWidth,
        'e largo quanto quello del Donate',
        b.offsetWidth + ' e ' + document.getElementById('mm2-donate-btn').offsetWidth);

      // ── 4. E LE QUEST SONO ALTE QUANTO LA COLONNA (v0.79.69) ─────────────
      // Non per coincidenza: l'altezza della colonna di sinistra e- una somma
      // che fa il foglio di stile (--mm2-sx-h), e le quest usano quella. Prima
      // erano due numeri scollegati, e nella v0.79.67 lo Shop e- passato da 213
      // a 108: da quel momento i due lati non erano piu- pari, e non se n-e-
      // lamentato niente — due riquadri di altezza diversa non sono un errore,
      // sono solo brutti.
      const sx = document.getElementById('mm2-sx');
      const quest = document.querySelector('#mm2-dx .mm2-box');
      dice(!!sx && !!quest, 'le due colonne ci sono');
      if(sx && quest){
        dice(quest.offsetHeight === sx.offsetHeight,
          'le Daily quests sono alte quanto la colonna di sinistra',
          quest.offsetHeight + ' e ' + sx.offsetHeight);
        // E la somma torna: quattro caselle e tre stacchi.
        const atteso = 2*108 + 2*100 + 3*20;
        dice(sx.offsetHeight === atteso,
          'e quell-altezza e- la somma delle quattro caselle e dei tre stacchi',
          sx.offsetHeight + ', attesi ' + atteso + ' (108+108+100+100 + 3x20)');
        // Il corpo si adatta invece di dettare: e- il pezzo elastico dei tre.
        const corpo = document.getElementById('mm2-quest-corpo');
        const testata = document.getElementById('mm2-quest-testata');
        const bott = document.getElementById('mm2-quest-btn');
        // clientHeight e non offsetHeight: il riquadro ha un bordo da un pixel
        // e mezzo per parte, e quello NON e- spazio dentro. Contarlo faceva
        // mancare due pixel al conto e sembrare storto qualcosa che era giusto.
        const dentro = quest.clientHeight - 40;   // i venti di padding per parte
        dice(corpo && Math.abs(corpo.offsetHeight + testata.offsetHeight + 16
               + bott.offsetHeight + 16 - dentro) <= 2,
          'e il corpo si prende esattamente quel che avanza',
          'corpo ' + (corpo?corpo.offsetHeight:0) + ' + testata ' + testata.offsetHeight
          + ' + pulsante ' + bott.offsetHeight + ' + 32 di stacchi  =  ' + dentro);
      }

      // ── 5. LA FINE PARTITA NON PROMETTE PIU- UNA BUSTINA (v0.79.69) ──────
      // Il premio se n-e- andato di la- (andra- fra le quest), ma il conto lo
      // tiene il server e continua a girare: quel che non deve restare e- il
      // riquadro. Un premio che sparisce a meta- — l-icona via e la barra
      // ancora li- — sarebbe peggio di lasciarlo dov-era.
      //
      // LA PAGINA DI GIOCO VA MONTATA. Le pagine sono ermetiche: dal menu il
      // tabellone non e- nel documento, e con lui nemmeno #gameover. Chiedere
      // "la bustina non c-e- piu-" da li- avrebbe risposto di si- comunque, e
      // per il motivo sbagliato: non c-era NIENTE. E- il modo piu- rapido per
      // scrivere un banco che non guarda quello che crede di guardare.
      showPage('game');
      await new Promise(r=>setTimeout(r, 400));
      dice(!!document.getElementById('gameover-premi'),
        'la schermata di fine partita e- nel documento',
        'senza questa, i tre controlli qui sotto passerebbero perche- non c-e- niente');
      dice(!document.getElementById('go-premio-pack'), 'e non ha piu- il premio bustina');
      dice(!document.getElementById('go-pack-barra') && !document.getElementById('go-pack-num'),
        'ne- la sua barra, ne- il suo numero');
      const eti = [...document.querySelectorAll('#gameover-premi .go-premio-eti')].map(e=>e.textContent);
      dice(eti.length === 2 && eti.join('|') === 'Xp|Magic ink',
        'e i premi rimasti sono due: esperienza e inchiostro',
        eti.length ? eti.join(', ') : '(nessuno)');
      // E la scena non deve piantarsi cercando quel che non c-e- piu-.
      let piantata = '';
      try{ goPremi({ xp:12, ink:34, verso:3, quante:5, bustina:true }); }
      catch(e){ piantata = (e && e.message) || 'boh'; }
      dice(!piantata, 'e la scena dei premi gira lo stesso, anche dicendole che una bustina c-era',
        piantata || 'e- il caso in cui prima si accendeva il terzo riquadro');
      return { d, riquadro: { x:shop.getBoundingClientRect().left, y:shop.getBoundingClientRect().top } };
    }catch(e){ return { guasto:(e&&e.message)+' '+String((e&&e.stack)||'').split(String.fromCharCode(10))[1], d }; }
  })()`);

  if (esito.guasto) {
    console.error('GUASTO: ' + esito.guasto);
    for (const x of (esito.d||[])) console.log((x.ok?'  ok   ':'  NO   ') + x.che);
    app.exit(1); return;
  }

  if (SCATTO) {
    // Il velo di apertura si toglie con una REGOLA: la sequenza di caricamento
    // se lo rimette addosso da sola (vedi prova-disclaimer).
    // Si torna al menu: l-ultimo controllo ha montato la pagina di gioco, e le
    // pagine sono ermetiche — di la- la colonna di sinistra non e- nel
    // documento, e il ritaglio non saprebbe dove andare.
    await win.webContents.executeJavaScript('apriMenuPrincipale(); 1');
    await new Promise(r => setTimeout(r, 1200));
    await win.webContents.insertCSS('#splash,#patch-notes-overlay{display:none!important}');
    win.setPosition(-3200, 0); win.showInactive();
    await new Promise(r => setTimeout(r, 1600));
    fs.writeFileSync(SCATTO, (await win.webContents.capturePage()).toPNG());
    console.log('scritto ' + SCATTO);
    const dove = await win.webContents.executeJavaScript(`(function(){
      const a = document.getElementById('mm2-box-shop').getBoundingClientRect();
      const b = document.getElementById('mm2-box-donate').getBoundingClientRect();
      const x = Math.max(0, Math.round(a.left) - 20), y = Math.max(0, Math.round(a.top) - 30);
      return { x, y,
        width: Math.min(Math.round(a.width) + 80, window.innerWidth - x),
        height: Math.min(Math.round(b.bottom - a.top) + 60, window.innerHeight - y) };
    })()`);
    await new Promise(r => setTimeout(r, 700));
    const via = SCATTO.replace(/\.png$/, '-colonna.png');
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
