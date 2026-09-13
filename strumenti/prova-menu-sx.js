// LE DUE COLONNE DEL MENU: bustine, libreria, donazione — e le Daily quests.
//
//     $ELECTRON strumenti/prova-menu-sx.js [scatto.png]
//
// v0.80.11 — riscritto per il menu nuovo (Figma: Main menu, 985:29258). Prima
// questo banco controllava che lo Shop fosse identico al Donate; lo Shop non
// c'e' piu' (Lorenzo), e le valute sono salite nella barra in alto. La
// colonna di sinistra sono adesso tre riquadri uguali — Card packs, Library &
// decks, Support the development — e "uguali" e' ancora la parola che il banco
// traduce in numeri: stessa misura, stesso vetro, stesso bordo, stessi angoli.
//
// E le Daily quests sono alte quanto quella colonna, per regola di Lorenzo:
// due riquadri affiancati di altezza diversa non sono un errore, sono solo
// brutti, e nessuno se ne accorge finche' non li mette in fila.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';
const SCATTO = process.argv[2] || '';

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
setTimeout(() => { console.error('PIANTATA: nessuna risposta in 120s'); app.exit(2); }, 120000);

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
      // Le misure si leggono con offset*: sono in pixel della tela (1920x1080)
      // anche quando la finestra rimpicciolisce #game-root.
      const pos = el => { let x = 0, y = 0; for(let n = el; n && n.id !== 'mm2'; n = n.offsetParent){ x += n.offsetLeft; y += n.offsetTop; } return { x, y }; };

      // ── 1. LA COLONNA DI SINISTRA: TRE RIQUADRI, NIENTE SHOP ─────────────
      dice(!document.getElementById('mm2-box-shop') && !document.getElementById('mm2-shop-btn'),
        'lo Shop non c-e- piu-', 'Lorenzo: non serve per ora');
      dice(!document.getElementById('mm2-box-ink') && !document.getElementById('mm2-box-dust'),
        'e le valute non stanno piu- nella colonna');
      const sx = document.getElementById('mm2-sx');
      const schede = ['mm2-sc-packs','mm2-sc-library','mm2-box-donate'].map(id => document.getElementById(id));
      dice(!!sx && schede.every(Boolean), 'i tre riquadri ci sono: bustine, libreria, donazione');
      if(!sx || !schede.every(Boolean)) return { d };
      dice(schede.every(s => s.parentElement === sx), 'e stanno tutti e tre nella colonna, in quest-ordine',
        schede.map(s => s.parentElement && s.parentElement.id).join(', '));
      dice(schede.every(s => s.offsetWidth === 370 && s.offsetHeight === 200), 'larghi 370 e alti 200, come nel disegno',
        schede.map(s => s.offsetWidth + 'x' + s.offsetHeight).join(', '));
      const ys = schede.map(s => pos(s).y);
      dice(ys[0] === 237 && ys[1] === 456 && ys[2] === 675 && pos(schede[0]).x === 0,
        'appesi al bordo sinistro da 237, a 19 l-uno dall-altro', ys.join(', '));
      // "Uguali": le proprieta- che fanno un riquadro quel riquadro, una per
      // una. Il fondo e- un gradiente, e due gradienti diversi di un soffio si
      // vedono solo mettendoli accanto.
      const st = schede.map(s => getComputedStyle(s));
      const uguali = ['backgroundImage','borderTopLeftRadius','borderTopRightRadius','borderBottomRightRadius','padding','display','justifyContent'];
      const diverse = uguali.filter(p => st.some(x => x[p] !== st[0][p]));
      dice(diverse.length === 0, 'stesso vetro, stessi angoli, stesso padding, stesso modo di tenere il pulsante',
        diverse.map(p => p + ': ' + st.map(x => '"' + x[p] + '"').join(' / ')).join('\\n        '));
      dice(st[0].borderTopLeftRadius === '0px' && st[0].borderTopRightRadius === '20px',
        'dritti contro il bordo dello schermo, a 20 dall-altra parte', st[0].borderTopLeftRadius + ' / ' + st[0].borderTopRightRadius);
      const trama = schede.map(s => getComputedStyle(s, '::before').backgroundImage);
      dice(/brushed-texture/.test(trama[0]) && trama.every(x => x === trama[0]), 'e la trama e- la stessa, brushed-texture',
        trama[0].slice(0, 60));
      const bordi = schede.map(s => getComputedStyle(s, '::after').borderTopColor);
      dice(bordi.every(b => b === 'rgba(255, 255, 255, 0.2)'), 'con il bordo bianco al 20%', bordi.join(', '));

      // ── 2. I PULSANTI ────────────────────────────────────────────────────
      // L-ULTIMO pulsante di ogni riquadro: dalla v0.80.15 quello della
      // donazione ne ha due (Donate e, sotto, Give us feedback), e quello che
      // tocca il fondo e- il secondo.
      const btn = schede.map(s => [...s.querySelectorAll('.hx-btn')].pop());
      dice(btn.every(b => b && b.offsetWidth === 330), 'i tre pulsanti sono larghi 330', btn.map(b => b && b.offsetWidth).join(', '));
      dice(btn.every((b, i) => b && Math.round(pos(b).y + b.offsetHeight) === ys[i] + 200 - 20),
        'appoggiati in fondo al loro riquadro, a 20 dal bordo', btn.map((b, i) => b && (pos(b).y + b.offsetHeight - ys[i])).join(', '));
      dice(!!document.querySelector('#mm2-sc-packs #mm2-packs-sotto'), 'Card packs dice ancora quante bustine aspettano',
        'Lorenzo: la riga e l-alone restano');
      dice(!!document.querySelector('#mm2-box-donate form.donate-form[action*="paypal.com/donate"]'),
        'e il Donate e- ancora il modulo di PayPal');
      // v0.80.15 — "Support the development" non c-e- piu-: al suo posto, sotto
      // al Donate, "Give us feedback" (Lorenzo).
      const fb = document.getElementById('mm2-feedback-btn');
      dice(!document.getElementById('mm2-supporta'), 'la scritta Support the development non c-e- piu-');
      dice(fb && fb.parentElement && fb.parentElement.id === 'mm2-box-donate' && fb.offsetWidth === 330
          && /Give us feedback/.test(fb.textContent) && fb.getAttribute('onclick') === 'apriFeedback()',
        'e nel riquadro, sotto al Donate, c-e- Give us feedback largo 330', fb ? (fb.parentElement.id + ' ' + fb.offsetWidth) : 'manca');
      const don = document.getElementById('mm2-donate-btn');
      dice(fb && don && Math.round(pos(fb).y) === Math.round(pos(don).y + don.offsetHeight + 12)
          && Math.round(pos(fb).y + fb.offsetHeight) === ys[2] + 200 - 20,
        'a 12 sotto al Donate, e il riquadro resta alto 200', fb && don ? ((pos(fb).y - pos(don).y - don.offsetHeight) + ', fondo ' + (pos(fb).y + fb.offsetHeight - ys[2])) : '');
      // v0.80.14 — le illustrazioni non si tagliano: disegnate con le proporzioni
      // del loro file (la busta aveva perso la cima, segnalato da Lorenzo).
      const icone = ['#mm2-sc-packs','#mm2-sc-library'].map(s => document.querySelector(s + ' .mm2-scorciatoia-icona'));
      dice(icone.every(im => im && im.naturalWidth && Math.abs(im.offsetWidth / im.offsetHeight - im.naturalWidth / im.naturalHeight) < 0.02
          && getComputedStyle(im).objectFit !== 'cover'),
        'la busta e la scatola dei mazzi hanno le proporzioni del loro file, niente tagli',
        icone.map(im => im ? (im.offsetWidth + 'x' + im.offsetHeight + ' contro ' + im.naturalWidth + 'x' + im.naturalHeight) : 'manca').join(' / '));

      // ── 3. E LE QUEST SONO ALTE QUANTO LA COLONNA ────────────────────────
      const quest = document.getElementById('mm2-quest-pannello');
      dice(!!quest, 'il pannello delle quest c-e-');
      if(quest){
        dice(quest.offsetHeight === sx.offsetHeight && quest.offsetHeight === 638,
          'le Daily quests sono alte quanto la colonna di sinistra: 638',
          quest.offsetHeight + ' e ' + sx.offsetHeight);
        dice(pos(quest).y === 237, 'e partono alla stessa altezza', pos(quest).y);
        dice(quest.offsetWidth === 370 && pos(quest).x + quest.offsetWidth === 1921,
          'larghe 370, e uscite di un pixel dal bordo destro come nel disegno', pos(quest).x + ' + ' + quest.offsetWidth);
        // Il corpo si prende quel che avanza: testata 28, pulsante 68, due
        // stacchi da 12 e 20 di padding per parte.
        const corpo = document.getElementById('mm2-quest-corpo');
        const testata = document.getElementById('mm2-quest-testata');
        const bott = document.getElementById('mm2-quest-btn');
        dice(testata.offsetHeight === 28 && bott.offsetHeight === 68 && corpo.offsetHeight === 638 - 40 - 28 - 68 - 24,
          'e il corpo si prende esattamente quel che avanza (478)',
          'testata ' + testata.offsetHeight + ', corpo ' + corpo.offsetHeight + ', pulsante ' + bott.offsetHeight);
        // E finisce dove finisce la colonna delle modalita-.
        const normal = document.getElementById('mm2-modo-normal');
        dice(normal && Math.abs((pos(normal).y + normal.offsetHeight) - (pos(quest).y + quest.offsetHeight)) <= 2,
          'e finisce alla stessa altezza dei riquadri delle modalita-',
          normal ? ((pos(normal).y + normal.offsetHeight) + ' e ' + (pos(quest).y + quest.offsetHeight)) : 'manca');
      }

      // ── 2b. MISURE DI LORENZO (v0.80.15) ──────────────────────────────────
      // La scatola dei mazzi: 163.56 del Figma, +15% e poi +20% = 225.71, e
      // 15 piu- in basso. E i testi delle schede delle quest a 16 nel pannello
      // del menu; l-avviso in basso resta a 14.
      const scatola = document.querySelector('#mm2-sc-library .mm2-scorciatoia-icona');
      const cs = scatola && getComputedStyle(scatola);
      dice(cs && Math.abs(parseFloat(cs.height) - 225.71) < 0.05 && Math.abs(scatola.offsetHeight - 225.71) < 1,
        'la scatola dei mazzi e- alta 225.71', cs && cs.height);
      const regolaScatola = [].concat.apply([], [].map.call(document.styleSheets, f => { try{ return [].slice.call(f.cssRules); }catch(e){ return []; } }))
        .filter(r => r.selectorText === '#mm2-sc-library .mm2-scorciatoia-icona').map(r => r.style.transform).join(' | ');
      dice(/-50% - 9\\.85px/.test(regolaScatola), 'e 15 piu- in basso di prima (da -24.85 a -9.85)', regolaScatola);
      mm2DisegnaQuest([{ id:'a', nome:'Win 3 PvP matches', fatto:1, quanto:3, premio:'pack', presa:false }]);
      const nomeQuest = document.querySelector('#mm2-quest-corpo .quest-nome');
      const contaQuest = document.querySelector('#mm2-quest-corpo .quest-conta');
      dice(nomeQuest && contaQuest && getComputedStyle(nomeQuest).fontSize === '16px' && getComputedStyle(contaQuest).fontSize === '16px',
        'nel pannello delle quest nome e conto sono a 16', nomeQuest && (getComputedStyle(nomeQuest).fontSize + ' / ' + getComputedStyle(contaQuest).fontSize));
      const avviso = questScheda({ id:'b', nome:'Flip 20 cards', fatto:2, quanto:20, premio:'ink', presa:false });
      document.getElementById('quest-avvisi').appendChild(avviso);
      dice(getComputedStyle(avviso.querySelector('.quest-nome')).fontSize === '14px', 'e l-avviso in basso resta a 14',
        getComputedStyle(avviso.querySelector('.quest-nome')).fontSize);
      avviso.remove();
      mm2DisegnaQuest([]);

      // ── 3a. LA TRAMA RIEMPIE TUTTA LA BARRA (v0.80.14) ────────────────────
      // brushed-texture e- larga 847: senza ripetersi copriva meno di meta- dei
      // 1920 della barra in alto (segnalato da Lorenzo). In Figma si ripete.
      const tramaBarra = getComputedStyle(document.getElementById('mm2-topbar'), '::before');
      dice(/brushed-texture/.test(tramaBarra.backgroundImage) && tramaBarra.backgroundRepeat === 'repeat',
        'la trama della barra in alto si ripete su tutta la larghezza', tramaBarra.backgroundRepeat);

      // ── 3b. PLAY VS BOT (v0.80.13) ───────────────────────────────────────
      // Nella v0.80.11 non si poteva piu- premere: il gruppo delle valute,
      // largo meta- barra, stava sopra al pulsante. Si chiede quindi al
      // browser COSA c-e- sotto al centro del pulsante, e si clicca li-, come
      // farebbe il mouse: chiamare mm2Vista direttamente passerebbe anche col
      // pulsante coperto.
      const botBtn = document.querySelector('#mm2-nav .mm2-nav-btn[data-vista="ai"]');
      const bb = botBtn.getBoundingClientRect();
      const sotto = document.elementFromPoint(bb.left + bb.width / 2, bb.top + bb.height / 2);
      dice(sotto && botBtn.contains(sotto), 'al centro di Play vs Bot c-e- il pulsante, non qualcosa sopra',
        sotto ? (sotto.id || sotto.className) : 'niente');
      const mmBtn = document.querySelector('#mm2-nav .mm2-nav-btn[data-vista="matchmaking"]');
      const mb = mmBtn.getBoundingClientRect();
      const sottoMm = document.elementFromPoint(mb.left + mb.width * 0.85, mb.top + mb.height / 2);
      dice(sottoMm && mmBtn.contains(sottoMm), 'e nemmeno su Matchmaking', sottoMm ? (sottoMm.id || sottoMm.className) : 'niente');
      if(sotto) sotto.click();
      await new Promise(r=>setTimeout(r, 200));
      const h2 = id => (document.querySelector('#' + id + ' h2') || {}).textContent;
      const online = document.getElementById('mm2-online');
      const etichetta = () => (document.querySelector('#mm2-find .hxb-label') || {}).textContent;
      dice(botBtn.classList.contains('attivo'), 'cliccato, Play vs Bot e- la vista scelta');
      dice(h2('mm2-modo-draft') === 'Draft vs Bot' && h2('mm2-modo-normal') === 'Normal vs Bot',
        'le modalita- diventano Draft vs Bot e Normal vs Bot', h2('mm2-modo-draft') + ' / ' + h2('mm2-modo-normal'));
      dice(etichetta() === 'Start match vs Bot', 'il pulsante dice Start match vs Bot', etichetta());
      dice(online && getComputedStyle(online).display === 'none', 'e i giocatori online non si vedono');
      // v0.80.14 — e il riquadro Normal ha la sua immagine contro il bot.
      const fondi = [...document.querySelectorAll('#mm2-modo-normal .mm2-modo-fondo')];
      const fondoVisto = () => fondi.filter(f => getComputedStyle(f).display !== 'none').map(f => (f.getAttribute('src') || '').split('/').pop()).join(', ');
      dice(fondoVisto() === 'matchmaking-container-bot.png', 'e Normal vs Bot ha la sua immagine, matchmaking-container-bot', fondoVisto());
      dice(document.getElementById('mm2-modo-normal').classList.contains('scelto') && document.getElementById('mm2-modo-draft').classList.contains('spento'),
        'e il resto del centro e- identico: Normal scelta, Draft spenta');
      mmBtn.click();
      await new Promise(r=>setTimeout(r, 200));
      dice(h2('mm2-modo-draft') === 'Draft pick' && h2('mm2-modo-normal') === 'Normal' && etichetta() === 'Find opponent'
        && getComputedStyle(online).display !== 'none', 'e tornando a Matchmaking torna tutto com-era',
        h2('mm2-modo-draft') + ' / ' + h2('mm2-modo-normal') + ' / ' + etichetta());
      dice(fondoVisto() === 'matchmaking-container.png', 'e il riquadro torna alla sua immagine', fondoVisto());
      // v0.80.14 — il pulsante e- largo 400 (Lorenzo) e sta al centro, sotto alle modalita-.
      const trova = document.getElementById('mm2-find');
      dice(trova.offsetWidth === 400 && Math.abs(pos(trova).x + 200 - 960) <= 1, 'Find opponent e- largo 400, al centro',
        trova.offsetWidth + ' a ' + pos(trova).x);

      // ── 4. LA FINE PARTITA NON PROMETTE PIU- UNA BUSTINA (v0.79.69) ──────
      // LA PAGINA DI GIOCO VA MONTATA. Le pagine sono ermetiche: dal menu il
      // tabellone non e- nel documento, e con lui nemmeno #gameover. Chiedere
      // "la bustina non c-e- piu-" da li- avrebbe risposto di si- comunque, e
      // per il motivo sbagliato: non c-era NIENTE.
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
      let piantata = '';
      try{ goPremi({ xp:12, ink:34, verso:3, quante:5, bustina:true }); }
      catch(e){ piantata = (e && e.message) || 'boh'; }
      dice(!piantata, 'e la scena dei premi gira lo stesso, anche dicendole che una bustina c-era',
        piantata || 'e- il caso in cui prima si accendeva il terzo riquadro');
      return { d };
    }catch(e){ return { guasto:(e&&e.message)+' '+String((e&&e.stack)||'').split(String.fromCharCode(10))[1], d }; }
  })()`);

  if (esito.guasto) {
    console.error('GUASTO: ' + esito.guasto);
    for (const x of (esito.d||[])) console.log((x.ok?'  ok   ':'  NO   ') + x.che);
    app.exit(1); return;
  }

  if (SCATTO) {
    // Si torna al menu: l-ultimo controllo ha montato la pagina di gioco, e le
    // pagine sono ermetiche — di la- la colonna di sinistra non e- nel documento.
    await win.webContents.executeJavaScript('apriMenuPrincipale(); 1');
    await new Promise(r => setTimeout(r, 1200));
    await win.webContents.insertCSS('#splash,#patch-notes-overlay,#tutorial-overlay{display:none!important}');
    win.setPosition(-3200, 0); win.showInactive();
    await new Promise(r => setTimeout(r, 1600));
    fs.writeFileSync(SCATTO, (await win.webContents.capturePage()).toPNG());
    console.log('scritto ' + SCATTO);
    const dove = await win.webContents.executeJavaScript(`(function(){
      const a = document.getElementById('mm2-sx').getBoundingClientRect();
      const x = Math.max(0, Math.round(a.left)), y = Math.max(0, Math.round(a.top) - 30);
      return { x, y, width: Math.min(Math.round(a.width) + 40, window.innerWidth - x),
        height: Math.min(Math.round(a.height) + 60, window.innerHeight - y) };
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
