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
      const btn = schede.map(s => s.querySelector('.hx-btn'));
      dice(btn.every(b => b && b.offsetWidth === 330), 'i tre pulsanti sono larghi 330', btn.map(b => b && b.offsetWidth).join(', '));
      dice(btn.every((b, i) => b && Math.round(pos(b).y + b.offsetHeight) === ys[i] + 200 - 20),
        'appoggiati in fondo al loro riquadro, a 20 dal bordo', btn.map((b, i) => b && (pos(b).y + b.offsetHeight - ys[i])).join(', '));
      dice(!!document.querySelector('#mm2-sc-packs #mm2-packs-sotto'), 'Card packs dice ancora quante bustine aspettano',
        'Lorenzo: la riga e l-alone restano');
      dice(!!document.querySelector('#mm2-box-donate form.donate-form[action*="paypal.com/donate"]'),
        'e il Donate e- ancora il modulo di PayPal');
      dice((document.getElementById('mm2-supporta') || {}).textContent === 'Support the development',
        'con sopra "Support the development"');

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
