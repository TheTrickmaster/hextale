// "MATCH FOUND!" — DIECI SECONDI PER DIRE DI SI'.
//
//     $ELECTRON strumenti/prova-trovato.js [foto.png]
//
// Prima, trovato l'avversario, si entrava in partita da soli. Adesso i due si
// devono dire di si' tutti e due, e questo splash e' l'unico posto in cui la
// partita puo' non cominciare senza che sia successo niente di male.
//
// Le cose che si rompono in silenzio:
//
//   IL RIQUADRO CHE RITAGLIA. I due personaggi devono uscire dai lati e da
//     SOPRA — nel disegno il cappello del pirata sta fuori dal bordo alto — e
//     mai da sotto. Un overflow:hidden li taglierebbe tutti e tre i lati; il
//     fondo si evita ancorandoli al bordo basso, non tagliandoli. Se un domani
//     qualcuno mette overflow:hidden per "pulizia", il disegno si perde e
//     nessun errore lo dice.
//   IL SUONO CHE ARRIVA PRIMA DI CIO' CHE ANNUNCIA. Suonava all'accoppiamento;
//     adesso deve suonare quando lo splash si vede.
//   I DUE VOLTI. Prima di accettare: Accept e Decline. Dopo: la scritta
//     d'attesa al posto di Accept, e il rosso che diventa "Cancel match". Se
//     "Accept" restasse premibile dopo aver accettato, si manderebbe un
//     secondo match_join.
//   LA BARRA CHE NON SCENDE, o che scende dalla parte sbagliata. Scorre a
//     ritroso: piena all'inizio, vuota alla scadenza.
//   IL PULSANTE DELLA RICERCA che dice il cronometro e il comando insieme.
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
  win.webContents.on('console-message', (...args) => {
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
    const _corpo = (async function(){
    try{
      ['splash','start-screen'].forEach(id=>{ const e=document.getElementById(id); if(e) e.style.display='none'; });

      // Il menu principale deve essere in scena: le pagine sono ermetiche, e
      // dal tavolo il pulsante della ricerca non e- nel documento. Un banco
      // che non lo trova direbbe "manca" per il motivo sbagliato.
      showPage('mainmenu');
      await attendi(600);
      // Una sessione finta: chi rifiuta lo dice al server solo se e- entrato,
      // e senza questa riga quel pezzo non verrebbe mai provato.
      // Si assegna la VARIABILE e non window.sessioneAccount: e- dichiarata
      // nel copione della pagina, e scrivere sulla finestra crea una seconda
      // cosa con lo stesso nome che il codice non guarda mai.
      if(!sessioneAccount || !sessioneAccount.token) sessioneAccount = { token: 'finto' };

      // Nessun server: si zittiscono le due strade che ci parlano, o lo splash
      // proverebbe a entrare in una partita che non c'e-.
      const mandati = [];
      window.mmManda = (m)=>{ mandati.push(m); };
      const rpc = [];
      window.nakamaRpc = (nome, corpo)=>{ rpc.push({nome, corpo}); return Promise.resolve({}); };
      const suoni = [];
      const veroSfx = window.playSfxFile;
      window.playSfxFile = function(f){ suoni.push(f); };

      // ── 1. I PEZZI ────────────────────────────────────────────────────────
      const ov = document.getElementById('trovato-overlay');
      dice(!!ov, 'lo splash esiste');
      for(const id of ['trovato-cornice','trovato-hook','trovato-lrrh','trovato-velo',
                       'trovato-titolo','trovato-accetta','trovato-attesa','trovato-rifiuta',
                       'trovato-timer','trovato-timer-mask','trovato-timer-pin']){
        if(!document.getElementById(id)) dice(false, 'manca il pezzo #' + id);
      }

      // ── 2. SI APRE, E IL SUONO ARRIVA CON LUI ─────────────────────────────
      suoni.length = 0;
      apriTrovato('match-finto-1');
      await attendi(1200);
      dice(ov.classList.contains('show'), 'si apre quando si trova un avversario');
      dice(suoni.filter(s=>/match-found/.test(s)).length === 1,
        'e il suono arriva insieme a lui, una volta sola',
        suoni.join(', ') + '.\\n        Prima suonava all-accoppiamento, cioe- prima di cio- che annuncia.');
      dice(mandati.length === 0, 'e NON si entra in partita da soli',
        'Prima si entrava. Adesso accettare e- entrare, e nessuno ha ancora accettato.');

      // ── 3. IL RIQUADRO E I DUE PERSONAGGI ─────────────────────────────────
      const k = document.getElementById('trovato-cornice');
      const sk = getComputedStyle(k);
      dice(Math.round(parseFloat(sk.width)) === 650 && Math.round(parseFloat(sk.height)) === 400,
        'il riquadro e- 650x400',
        Math.round(parseFloat(sk.width)) + 'x' + Math.round(parseFloat(sk.height)));
      dice(sk.overflow === 'visible', 'e NON ritaglia',
        'overflow: ' + sk.overflow + '.\\n        I due devono uscire dai lati e da sopra: tagliarli e- perdere il disegno.');
      const kr = k.getBoundingClientRect();
      const scala = kr.width / parseFloat(sk.width);
      for(const [id, nome] of [['trovato-hook','hook'],['trovato-lrrh','lrrh']]){
        const r = document.getElementById(id).getBoundingClientRect();
        dice(r.bottom <= kr.bottom + 1, nome + ' non sbuca da sotto',
          Math.round((r.bottom - kr.bottom)/scala) + 'px oltre il bordo basso (deve essere <= 0)');
        dice(r.top < kr.top, 'e sbuca da sopra, come nel disegno',
          Math.round((kr.top - r.top)/scala) + 'px sopra il bordo');
      }
      // Il gradiente sta SOPRA ai due e SOTTO al testo.
      const zv = +getComputedStyle(document.getElementById('trovato-velo')).zIndex;
      const za = +getComputedStyle(document.getElementById('trovato-hook')).zIndex;
      const zt = +getComputedStyle(document.getElementById('trovato-dentro')).zIndex;
      dice(za < zv && zv < zt, 'il gradiente copre i personaggi e sta sotto al testo',
        'personaggi ' + za + ' < gradiente ' + zv + ' < testo ' + zt);
      const velo = getComputedStyle(document.getElementById('trovato-velo')).backgroundImage;
      dice(/15%/.test(velo) && /70%/.test(velo) && /30,\\s*36,\\s*35/.test(velo),
        'e va dal 15% al 70% partendo dal basso', velo.slice(0, 110));

      // ── 4. PRIMA DI RISPONDERE ────────────────────────────────────────────
      const acc = document.getElementById('trovato-accetta');
      const att = document.getElementById('trovato-attesa');
      const rif = document.getElementById('trovato-rifiuta');
      const et = (b)=>b.querySelector('.hxb-label').textContent.trim();
      dice(getComputedStyle(acc).display !== 'none' && getComputedStyle(att).display === 'none',
        'si vede "Accept", non l-attesa');
      dice(et(rif) === 'Decline', 'e il rosso dice "Decline"', et(rif));
      dice(rif.classList.contains('hx-btn-opaco'), 'ed e- opaco');
      // Il rosso e- piu- piccolo del grigio: dire di no non deve costare quanto
      // dire di si-.
      // Si misura QUEL CHE SI VEDE e non lo stile calcolato: il rosso e-
      // rimpicciolito con zoom, e lo stile calcolato continua a dire la misura
      // di prima. Direbbe "uguali" e avrebbe torto — la stessa lezione degli
      // avatar, da un-altra porta.
      const wa = acc.getBoundingClientRect().width, wr = rif.getBoundingClientRect().width;
      dice(wr < wa * 0.85, 'e il "no" e- piu- piccolo del "si-"',
        Math.round(wr) + ' contro ' + Math.round(wa) + ' — il ' + Math.round(wr/wa*100) + '%.'
        + '\\n        Rimpicciolito in tutte le direzioni, non schiacciato in una sola.');
      const ha = acc.getBoundingClientRect().height, hr = rif.getBoundingClientRect().height;
      dice(hr < ha * 0.85 && hr > ha * 0.5, 'e lo e- anche in altezza, nella stessa misura',
        Math.round(hr) + ' contro ' + Math.round(ha) + ' — il ' + Math.round(hr/ha*100) + '%.');

      // ── 5. LA BARRA SCORRE A RITROSO ──────────────────────────────────────
      const mask = document.getElementById('trovato-timer-mask');
      const largo = ()=>mask.getBoundingClientRect().width;
      const prima = largo();
      await attendi(2500);
      const dopo = largo();
      dice(dopo < prima - 2, 'la barra scorre a ritroso',
        Math.round(prima) + ' -> ' + Math.round(dopo) + ' pixel'
        + ' (larghezza scritta: "' + (mask.style.width || 'nessuna') + '").'
        + '\\n        Se la larghezza scritta e- vuota, il browser ha rifiutato il valore'
        + '\\n        e la barra e- rimasta quella del foglio: piena e ferma.');

      // ── 6. ACCETTARE E- ENTRARE ───────────────────────────────────────────
      mandati.length = 0;
      trovatoAccetta();
      await attendi(400);
      dice(mandati.length === 1 && mandati[0].match_join
           && mandati[0].match_join.match_id === 'match-finto-1',
        'accettare vuol dire ENTRARE in partita',
        JSON.stringify(mandati[0] || null) +
        '.\\n        Non c-e- un messaggio di "accetto": la partita comincia quando il\\n' +
        '        server vede dentro tutti e due.');
      dice(getComputedStyle(acc).display === 'none' && getComputedStyle(att).display !== 'none',
        'e "Accept" lascia il posto all-attesa',
        'Se restasse premibile si manderebbe un secondo match_join.');
      dice(att.textContent.indexOf('Waiting for your opponent') >= 0,
        'che dice cosa si sta aspettando', att.textContent.trim());
      dice(Math.round(parseFloat(getComputedStyle(att).width)) === 360,
        'ed e- larga 360', Math.round(parseFloat(getComputedStyle(att).width)) + 'px');
      dice(et(rif) === 'Cancel match' && !rif.classList.contains('hx-btn-opaco'),
        'e il rosso diventa "Cancel match", trasparente', et(rif));
      mandati.length = 0;
      trovatoAccetta();
      await attendi(200);
      dice(mandati.length === 0, 'e premerlo due volte non entra due volte');

      // ── 7. RIFIUTARE ──────────────────────────────────────────────────────
      rpc.length = 0;
      trovatoRifiuta();
      await attendi(500);
      dice(!ov.classList.contains('show'), 'rifiutando lo splash si chiude');
      dice(rpc.filter(r=>r.nome === 'hx_rifiuta').length === 1,
        'e il server lo sa subito',
        'Senza, l-altro resterebbe dieci secondi davanti a "Waiting for your\\n' +
        '        opponent..." con la risposta gia- arrivata.');
      dice(rpc[0] && rpc[0].corpo && rpc[0].corpo.matchId === 'match-finto-1',
        'e sa di quale partita', JSON.stringify(rpc[0] && rpc[0].corpo));

      // ── 8. IL PULSANTE DELLA RICERCA ──────────────────────────────────────
      // I secondi finche- non ci passi sopra, "Cancel" sotto al dito. Prima
      // diceva tutte e due le cose insieme, e il cronometro si leggeva come
      // parte del comando.
      _mm2Cercando = true;
      mmAvviaCronometro();
      await attendi(300);
      const lab = document.querySelector('#mm2-find .hxb-label');
      dice(/^\\(\\d+s\\)$/.test(lab.textContent.trim()), 'il pulsante della ricerca dice i secondi',
        '"' + lab.textContent.trim() + '"');
      document.getElementById('mm2-find').dispatchEvent(new MouseEvent('mouseenter'));
      await attendi(150);
      dice(lab.textContent.trim() === 'Cancel', 'e sotto al dito dice "Cancel"',
        '"' + lab.textContent.trim() + '" — subito, non al tic dopo.');
      document.getElementById('mm2-find').dispatchEvent(new MouseEvent('mouseleave'));
      await attendi(150);
      dice(/^\\(\\d+s\\)$/.test(lab.textContent.trim()), 'e tolto il dito torna il cronometro',
        '"' + lab.textContent.trim() + '"');
      _mm2Cercando = false;
      mmFermaCronometro();
      window.playSfxFile = veroSfx;
      return { d };
    }catch(e){ return { guasto:(e&&e.message)+' '+String((e&&e.stack)||'').split(String.fromCharCode(10))[1], d }; }
    })();
    const _guardia = new Promise(r=>setTimeout(()=>r({ d, scaduto:true }), 120000));
    return await Promise.race([_corpo, _guardia]);
  })()`);

  if (esito && esito.scaduto) {
    const fatti = esito.d || [];
    console.error('IL BANCO NON HA FINITO IN DUE MINUTI. Ultimo controllo: '
      + (fatti.length ? fatti[fatti.length-1].che : 'nessuno'));
    app.exit(1); return;
  }
  if (esito.guasto) {
    console.error('GUASTO: ' + esito.guasto);
    for (const x of (esito.d||[])) console.log((x.ok?'  ok   ':'  NO   ') + x.che);
    app.exit(1); return;
  }

  if (SCATTO) {
    await win.webContents.insertCSS('#splash,#patch-notes-overlay{display:none!important}');
    win.setPosition(-3200, 0); win.showInactive();
    const foto = async (nome, prima) => {
      await win.webContents.executeJavaScript(prima);
      await new Promise(r => setTimeout(r, 2400));
      const b = await win.webContents.executeJavaScript(`(function(){
        const k=document.getElementById('trovato-cornice').getBoundingClientRect();
        const h=document.getElementById('trovato-hook').getBoundingClientRect();
        const l=document.getElementById('trovato-lrrh').getBoundingClientRect();
        const x=Math.max(0,Math.round(Math.min(k.left,h.left,l.left))-14);
        const y=Math.max(0,Math.round(Math.min(k.top,h.top,l.top))-14);
        return { x, y, width:Math.round(Math.max(k.right,h.right,l.right)-x)+14,
                 height:Math.round(k.bottom-y)+14 };
      })()`);
      fs.writeFileSync(SCATTO.replace(/\.png$/, '-' + nome + '.png'),
        (await win.webContents.capturePage(b)).toPNG());
      console.log('scritto ' + nome);
    };
    await foto('scelta', `(async function(){ apriTrovato('foto'); 1 })()`);
    await foto('attesa', `(function(){ trovatoMostraAttesa(); 1 })()`);
    await win.webContents.executeJavaScript(`trovatoChiudi(); 1`);
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
