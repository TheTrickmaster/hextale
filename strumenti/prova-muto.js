// MUTO VUOL DIRE MUTO.
//
//     $ELECTRON strumenti/prova-muto.js
//
// Col cursore "General volume" a zero non si deve sentire NIENTE. Sembra
// ovvio e non lo e': il volume generale non e' un interruttore, e' un numero
// che ogni strada dell'audio deve ricordarsi di moltiplicare. Una strada che
// se ne dimentica non da' nessun errore — da' un suono, e chi lo sente pensa
// che il muto sia rotto.
//
// Nel gioco le strade sono cinque, e non si somigliano:
//   playSfxFile   il grosso degli effetti, su Web Audio (un GainNode) o, se il
//                 suono non e' ancora decodificato, su un <audio> di ripiego;
//   il VOLUME FISSO dentro playSfxFile, che serve al clic dei pulsanti e che
//                 fino alla v0.79.83 saltava OGNI cursore, generale compreso:
//                 il gioco restava muto tranne i pulsanti, che rispondevano;
//   playSfx       i tre <audio> del tavolo (pesca, presa, posa);
//   la MUSICA     su #bgm e #bgm-loop, che hanno un cursore loro ma passano
//                 comunque dal generale;
//   i VIDEO del tutorial, che sono muti per attributo e devono restarlo.
//
// Il banco non ricalcola le formule — ricalcolarle proverebbe solo che so
// copiare una moltiplicazione. INTERCETTA: mette una mano su createGain e una
// su HTMLMediaElement.play, fa suonare tutto per davvero col generale a zero,
// e guarda che ogni volume passato sia zero.
const { app, BrowserWindow } = require('electron');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1400, height: 900,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 14000));

  const esito = await win.webContents.executeJavaScript(`(async function(){
    const d = [];
    const dice = (ok, che, perche) => d.push({ ok:!!ok, che, perche: perche||'' });
    const attendi = (ms)=>new Promise(r=>setTimeout(r,ms));
    try{
      ['splash','start-screen'].forEach(id=>{ const e=document.getElementById(id); if(e) e.style.display='none'; });

      // ── LE DUE MANI ───────────────────────────────────────────────────────
      // Ogni volume che passa di qui finisce in un elenco, con scritto da dove
      // viene. Cosi- quando qualcosa suona a muto si sa gia- CHI e- stato.
      const sentiti = [];
      const ctxProto = (window.AudioContext || window.webkitAudioContext).prototype;
      const veroGain = ctxProto.createGain;
      ctxProto.createGain = function(){
        const g = veroGain.apply(this, arguments);
        const par = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(g.gain), 'value')
                 || { set(){}, get(){} };
        let ultimo = g.gain.value;
        try{
          Object.defineProperty(g, 'gain', { value: new Proxy(g.gain, {
            set(o, k, v){ if(k === 'value'){ ultimo = v; sentiti.push({da:'web-audio', v:v}); } o[k] = v; return true; },
            get(o, k){ const x = o[k]; return (typeof x === 'function') ? x.bind(o) : x; }
          }) });
        }catch(_){ }
        return g;
      };
      const veroPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function(){
        // Un <video> muto non fa rumore per definizione: si annota a parte, o
        // il video di sfondo del tutorial farebbe fallire tutto.
        sentiti.push({ da: this.tagName.toLowerCase() + (this.id ? '#' + this.id : ''),
                       v: this.muted ? 0 : this.volume, muto: !!this.muted });
        try{ return veroPlay.apply(this, arguments); }catch(e){ return Promise.resolve(); }
      };

      // ── SI SPEGNE IL GENERALE ─────────────────────────────────────────────
      applyVolume(1); applyMusicVolume(1); applySfxVolume(1);
      await attendi(200);
      const prima = getMasterVolume();
      applyVolume(0);
      await attendi(200);
      dice(getMasterVolume() === 0, 'il generale si spegne davvero',
        'era ' + prima + ', adesso ' + getMasterVolume());
      // Gli altri due cursori restano ALTI: il punto e- che il generale da solo
      // basti. Con tutti e tre a zero il banco passerebbe anche se il generale
      // non contasse niente.
      dice(getSfxVolume() === 1 && getMusicVolume() === 1,
        'e gli altri due cursori restano al massimo',
        'effetti ' + getSfxVolume() + ', musica ' + getMusicVolume() +
        '.\\n        Spegnendo tutto, il banco passerebbe anche se il generale non contasse niente.');

      // ── SI FA SUONARE TUTTO ───────────────────────────────────────────────
      sentiti.length = 0;
      // 1. un effetto normale
      try{ playSfxFile('quest-collected.mp3'); }catch(_){ }
      // 2. il clic dei pulsanti, che ha un volume suo
      try{ playSfxFile('click.mp3', 0.3); }catch(_){ }
      // 3. e lo stesso clic per la strada vera: un clic su un pulsante.
      const bott = document.querySelector('.hx-btn') || document.body;
      try{ bott.dispatchEvent(new MouseEvent('click', {bubbles:true})); }catch(_){ }
      // 4. i tre <audio> del tavolo
      for(const id of ['sfx-draw','sfx-pick','sfx-drop']) { try{ playSfx(id); }catch(_){ } }
      // 5. la musica
      try{ playRandomBgmTrack(); }catch(_){ }
      const bgm = document.getElementById('bgm'), lp = document.getElementById('bgm-loop');
      if(bgm){ try{ bgm.play(); }catch(_){ } }
      if(lp){ try{ lp.play(); }catch(_){ } }
      await attendi(1200);

      dice(sentiti.length > 0, 'qualcosa ha davvero provato a suonare',
        sentiti.length + ' riproduzioni intercettate.' +
        '\\n        Senza questa riga, un banco che non sente niente direbbe "tutto a posto"' +
        '\\n        anche se l-audio fosse rotto e non partisse nulla.');
      const rumorosi = sentiti.filter(s => !(s.v === 0 || s.v < 0.0001));
      dice(rumorosi.length === 0, 'col generale a zero non suona NIENTE',
        rumorosi.length
          ? rumorosi.map(s => s.da + ' a ' + s.v).join(', ')
          : sentiti.map(s => s.da).filter((x,i,a)=>a.indexOf(x)===i).join(', ') + ' — tutte a zero.');

      // ── E IL PERCORSO WEB AUDIO, CHE IN PARTITA E- QUELLO VERO ────────────
      // Qui sopra ha risposto solo il ripiego a <audio>: i suoni non erano
      // ancora decodificati, e senza un buffer playSfxFile non passa mai dal
      // GainNode. In partita e- il contrario — i buffer ci sono e il ripiego
      // non si vede mai — quindi il ramo che conta di piu- sarebbe rimasto
      // fuori dalla prova. Gli si mette un buffer finto e lo si costringe.
      sentiti.length = 0;
      applyVolume(0);
      await attendi(150);
      let webAudioProvato = false;
      try{
        const AC = window.AudioContext || window.webkitAudioContext;
        if(!_sfxCtx) _sfxCtx = new AC();
        // Un decimo di secondo di silenzio: serve la STRADA, non il suono.
        _sfxBuffers['prova-muto'] = _sfxCtx.createBuffer(1, Math.round(_sfxCtx.sampleRate/10), _sfxCtx.sampleRate);
        playSfxFile('prova-muto.mp3');
        playSfxFile('prova-muto.mp3', 0.3);
        webAudioProvato = true;
      }catch(e){ }
      await attendi(500);
      const daWeb = sentiti.filter(s => s.da === 'web-audio');
      dice(webAudioProvato && daWeb.length >= 2,
        'anche il percorso Web Audio si fa provare',
        daWeb.length + ' guadagni intercettati (uno normale, uno a volume fisso).');
      dice(daWeb.every(s => s.v === 0), 'e col generale a zero da- zero anche lui',
        daWeb.map(s=>s.v).join(', ') +
        '.\\n        E- il ramo che vale in partita: il ripiego a <audio> quasi non si vede.');

      // ── E IL VIDEO DEL TUTORIAL ───────────────────────────────────────────
      // Sono video di sfondo e non hanno voce: se un domani ne arrivasse uno
      // sonoro, si sentirebbe anche a gioco muto — il volume di un <video> non
      // passa da nessuno dei tre cursori.
      sentiti.length = 0;
      TUTORIAL_VISTI = {};
      try{ apriTutorial('principale'); }catch(_){ }
      await attendi(1500);
      const vid = document.getElementById('tutorial-video');
      dice(!!vid && vid.muted, 'il video del tutorial e- muto per attributo',
        'Non passa da nessuno dei tre cursori: se avesse voce, si sentirebbe\\n' +
        '        anche a gioco muto.');
      const videoRumorosi = sentiti.filter(s => s.da.indexOf('video') === 0 && !s.muto);
      dice(videoRumorosi.length === 0, 'e non prova a suonare',
        sentiti.filter(s=>s.da.indexOf('video')===0).length + ' riproduzioni del video, tutte mute');
      try{ chiudiTutorial(); }catch(_){ }
      await attendi(300);

      // ── RIACCESO, SI TORNA A SENTIRE ──────────────────────────────────────
      // La prova specchiata: senza, "non suona niente" passerebbe anche se
      // l-audio fosse rotto del tutto.
      sentiti.length = 0;
      applyVolume(1);
      await attendi(200);
      try{ playSfxFile('quest-collected.mp3'); }catch(_){ }
      try{ playSfxFile('click.mp3', 0.3); }catch(_){ }
      await attendi(600);
      const vivi = sentiti.filter(s => s.v > 0.0001);
      dice(vivi.length > 0, 'e rialzando il generale si torna a sentire',
        vivi.map(s => s.da + ' a ' + (Math.round(s.v*1000)/1000)).join(', '));
      // Il clic dei pulsanti tiene il suo 30% quando il generale e- al massimo:
      // il patto era "non lo tocca il cursore degli EFFETTI", e quello vale.
      const clic = vivi.filter(s => Math.abs(s.v - 0.3) < 0.001);
      dice(clic.length > 0, 'e il clic dei pulsanti tiene il suo 30%',
        'Il generale lo spegne, il cursore degli effetti no: e- un ritorno del\\n' +
        '        dito, non un suono di gioco.');
      applyVolume(1);
      return { d };
    }catch(e){ return { guasto:(e&&e.message)+' '+String((e&&e.stack)||'').split(String.fromCharCode(10))[1], d }; }
  })()`);

  if (esito.guasto) {
    console.error('GUASTO: ' + esito.guasto);
    for (const x of (esito.d||[])) console.log((x.ok?'  ok   ':'  NO   ') + x.che);
    app.exit(1); return;
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
