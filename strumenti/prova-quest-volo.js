// IL PREMIO DI UNA QUEST VOLA DOVE VA (v0.80.19).
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-quest-volo.js
//
// Lorenzo: riscosso un premio, la sua icona vola sopra all'elemento a cui
// appartiene, con una traiettoria curva che accelera e una scia.
//   - magic ink: arriva al contatore in cima e sparisce; l'icona del contatore
//     lampeggia e pulsa una volta, il saldo si aggiorna, suona kaching.mp3;
//   - card pack: arriva sul pulsante "Card packs", che lampeggia, pulsa e suona
//     card-draw.mp3.
// Qui il server e' finto (nakamaRpc): si clicca una scheda e "Collect all", e si
// campiona il volo: partenza dalla scheda, curva, accelerazione, scia sulla
// tela, numero fermo finche' non arriva, arrivo sul bersaglio, lampo e suono.
const { app, BrowserWindow } = require('electron');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  setTimeout(() => { console.log('  NO  il banco non ha finito in tempo'); app.exit(2); }, 120000);
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, frame: false, useContentSize: true,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await win.loadURL(PAGINA);
  win.setPosition(-3200, 0); win.showInactive();
  await new Promise(r => setTimeout(r, 14000));
  await win.webContents.insertCSS('#splash{display:none!important} #tutorial-overlay{display:none!important}');

  const esito = await win.webContents.executeJavaScript(`(async function(){
    var d = [];
    var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
    var attendi = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
    var tondo = function(v){ return Math.round(v * 10) / 10; };
    try {
      apriMenuPrincipale();
      await attendi(1500);
      var radice = document.getElementById('game-root').getBoundingClientRect(), k = radice.width / 1920;
      var riq = function(el){ var b = el.getBoundingClientRect(); return { x:(b.left-radice.left)/k, y:(b.top-radice.top)/k, w:b.width/k, h:b.height/k }; };
      var centro = function(el){ var q = riq(el); return { x:q.x + q.w/2, y:q.y + q.h/2 }; };
      var suoni = [];
      var sfxVero = playSfxFile;
      playSfxFile = function(f){ suoni.push({ f:f, t:performance.now() }); };
      sessioneAccount = { token:'prova', userId:'u-prova' };
      var rispostaFinta = null;
      nakamaRpc = async function(nome, dati){ await attendi(5); return JSON.parse(JSON.stringify(rispostaFinta(dati))); };
      var inkAVideo = function(){ return document.getElementById('mm2-ink-value').textContent; };
      // Dove arriva ogni volo, letto all-ultimo fotogramma: il campionamento a
      // setTimeout perde il tratto finale, che accelerando e- il piu- lungo.
      var arrivi = [];
      var arrivaVero = questVoloArriva;
      questVoloArriva = function(v){ if(!v.arrivato) arrivi.push({ premio:v.premio, x:v.x, y:v.y, u:v.u }); return arrivaVero(v); };
      var quest = function(presaA, presaB, presaC){ return [
        { id:'a', nome:'Flip 20 cards', fatto:20, quanto:20, premio:'ink',  presa:presaA },
        { id:'b', nome:'Win 3 PvP matches', fatto:3, quanto:3, premio:'pack', presa:presaB },
        { id:'c', nome:'Flip a Timeless card', fatto:1, quanto:1, premio:'ink', presa:presaC }
      ]; };
      // Campiona l-icona in volo (il suo centro, in coordinate del disegno) e il
      // numero dell-inchiostro, finche' non passano ms.
      var campiona = async function(ms, t0){
        var fuori = [];
        while(performance.now() - t0 < ms){
          var im = document.querySelector('#quest-volo .quest-volo-icona');
          var m = im && /translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)/.exec(im.style.transform);
          fuori.push({ t: performance.now() - t0, c: m ? { x: parseFloat(m[1]) + parseFloat(im.style.width)/2, y: parseFloat(m[2]) + parseFloat(im.style.height)/2 } : null,
            src: im ? im.src : '', ink: inkAVideo(), n: document.querySelectorAll('#quest-volo .quest-volo-icona').length });
          await attendi(8);
        }
        return fuori;
      };

      // ── 1. UN INCHIOSTRO, DALLA SCHEDA ──
      MENU_GIOCATORE.magicInk = 100; aggiornaValuteAVideo();
      mm2DisegnaQuest(quest(false, false, false));
      await attendi(300);
      var scheda = document.querySelectorAll('#mm2-quest-corpo .quest-scheda')[0];
      var da = centro(scheda.querySelector('.quest-premio'));
      var bersaglioInk = centro(document.querySelector('#mm-ink .mm-cur-icon'));
      rispostaFinta = function(){ return { presi:[{ id:'a', premio:'ink', quanto:50 }], quest: quest(true, false, false), valute:{ magicInk:150, fairyDust: MENU_GIOCATORE.fairyDust }, bustineExtra: BUSTINE_VINTE }; };
      suoni = [];
      var t0 = performance.now();
      scheda.click();
      var s = await campiona(1700, t0);
      var inVolo = s.filter(function(x){ return x.c; });
      dice(inVolo.length > 20, 'l-icona vola (campioni col volo in corso)', inVolo.length);
      dice(inVolo.length && /magic-ink-icon\\.png/.test(inVolo[0].src), 'ed e- l-icona del magic ink', inVolo.length && inVolo[0].src.split('/').pop());
      var primo = inVolo[0] ? inVolo[0].c : { x:0, y:0 };
      dice(Math.hypot(primo.x - da.x, primo.y - da.y) < 24, 'parte dall-icona della sua scheda', tondo(primo.x) + ',' + tondo(primo.y) + ' vs ' + tondo(da.x) + ',' + tondo(da.y));
      var ultimo = inVolo.length ? inVolo[inVolo.length - 1] : { c:{ x:0, y:0 }, t:0 };
      var aInk = arrivi.filter(function(a){ return a.premio === 'ink'; })[0];
      dice(aInk && aInk.u === 1 && Math.hypot(aInk.x - bersaglioInk.x, aInk.y - bersaglioInk.y) < 6, 'e arriva, a fine volo, sull-icona del contatore in cima', aInk && (tondo(aInk.x) + ',' + tondo(aInk.y) + ' u=' + aInk.u + ' vs ' + tondo(bersaglioInk.x) + ',' + tondo(bersaglioInk.y)));
      // curva: quanto si allontana dalla retta partenza-arrivo
      var volo = inVolo.filter(function(x){ return x.t > 200; });
      var lx = bersaglioInk.x - primo.x, ly = bersaglioInk.y - primo.y, ll = Math.hypot(lx, ly) || 1;
      var scarto = volo.reduce(function(m, x){ return Math.max(m, Math.abs((x.c.x - primo.x) * ly - (x.c.y - primo.y) * lx) / ll); }, 0);
      dice(scarto > 40, 'con una traiettoria curva (scarto massimo dalla retta)', tondo(scarto) + 'px');
      // accelerazione: la seconda meta- del tempo copre molta piu- strada della prima
      if(volo.length > 6){
        var tA = volo[0].t, tB = volo[volo.length - 1].t, meta = (tA + tB) / 2;
        var strada = function(a, b){ var m = 0; for(var i = 1; i < volo.length; i++){ if(volo[i].t > a && volo[i].t <= b) m += Math.hypot(volo[i].c.x - volo[i-1].c.x, volo[i].c.y - volo[i-1].c.y); } return m; };
        var prima = strada(tA, meta), seconda = strada(meta, tB);
        dice(seconda > prima * 2, 'che accelera verso l-arrivo (strada nella prima e nella seconda meta-)', tondo(prima) + ' / ' + tondo(seconda));
      } else dice(false, 'che accelera verso l-arrivo', 'troppo pochi campioni');
      dice(inVolo.every(function(x){ return x.ink === '100'; }), 'mentre vola il saldo a video resta quello di prima', inVolo.map(function(x){ return x.ink; }).filter(function(v, i, a){ return a.indexOf(v) === i; }).join(','));
      dice(MENU_GIOCATORE.magicInk === 150, 'ma il saldo vero e- gia- quello del server', MENU_GIOCATORE.magicInk);
      var arrivo = s.find(function(x){ return x.t > ultimo.t && !x.c; });
      dice(arrivo && arrivo.ink === '150' && arrivo.n === 0, 'arrivata sparisce e il saldo si aggiorna', arrivo && (arrivo.ink + ' icone:' + arrivo.n));
      dice(ultimo.t > 650 && ultimo.t < 1300, 'il volo dura meno di un secondo e mezzo', Math.round(ultimo.t) + 'ms');
      var kaching = suoni.filter(function(x){ return x.f === 'kaching.mp3'; });
      dice(kaching.length === 1 && kaching[0].t - t0 > 650, 'suona kaching.mp3 all-arrivo, una volta', suoni.map(function(x){ return x.f + '@' + Math.round(x.t - t0); }).join(' '));
      dice(suoni.some(function(x){ return x.f === 'quest-collected.mp3' && x.t - t0 < 200; }), 'la riscossione suona ancora quest-collected al clic');
      await attendi(1);
      document.getElementById('mm-ink').classList.remove('premio-arrivato');
      // il lampo lo si rifa- per vederne l-animazione
      _questPulsa(document.getElementById('mm-ink'));
      var anim = document.querySelector('#mm-ink .mm-cur-icon').getAnimations().map(function(a){ return a.animationName; });
      dice(anim.indexOf('premioArrivato') >= 0, 'l-icona del contatore lampeggia e pulsa (premioArrivato)', anim.join(','));
      var kf = document.querySelector('#mm-ink .mm-cur-icon').getAnimations()[0];
      var fotogrammi = kf ? kf.effect.getKeyframes() : [];
      dice(fotogrammi.some(function(f){ return parseFloat(f.scale) > 1.2; }) && fotogrammi.some(function(f){ return /brightness/.test(f.filter); }), 'con una pulsazione in grandezza e un lampo', JSON.stringify(fotogrammi.map(function(f){ return f.scale; })));

      // ── 2. LA SCIA ──
      // si rilancia un volo e si guarda la tela a meta- strada
      MENU_GIOCATORE.magicInk = 100; aggiornaValuteAVideo();
      mm2DisegnaQuest(quest(false, false, false));
      await attendi(200);
      var scheda2 = document.querySelectorAll('#mm2-quest-corpo .quest-scheda')[0];
      scheda2.click();
      await attendi(620);
      var tela = document.querySelector('#quest-volo canvas');
      var pieni = 0;
      if(tela && tela.width){ var px = tela.getContext('2d').getImageData(0, 0, tela.width, tela.height).data; for(var i = 3; i < px.length; i += 16) if(px[i] > 20) pieni++; }
      dice(pieni > 200, 'lascia una scia (pixel accesi sulla tela a meta- volo)', pieni);
      await attendi(1800);
      dice(!document.getElementById('quest-volo'), 'finito tutto, lo strato del volo se ne va');

      // ── 3. COLLECT ALL: DUE INCHIOSTRI E UNA BUSTA ──
      MENU_GIOCATORE.magicInk = 100; aggiornaValuteAVideo();
      mm2DisegnaQuest(quest(false, false, false));
      await attendi(200);
      var sotto = document.getElementById('mm2-packs-sotto');
      sotto.textContent = 'SENTINELLA';
      var bersaglioBusta = centro(document.querySelector('#mm2-sc-packs .hx-btn'));
      var daBusta = centro(document.querySelectorAll('#mm2-quest-corpo .quest-scheda')[1].querySelector('.quest-premio'));
      rispostaFinta = function(){ return { presi:[{ id:'a', premio:'ink', quanto:50 }, { id:'b', premio:'pack', quanto:1 }, { id:'c', premio:'ink', quanto:30 }], quest: quest(true, true, true), valute:{ magicInk:180, fairyDust: MENU_GIOCATORE.fairyDust }, bustineExtra: BUSTINE_VINTE }; };
      suoni = [];
      var tracce = {};
      arrivi = [];
      var t1 = performance.now();
      document.getElementById('mm2-quest-btn').style.pointerEvents = '';
      mm2RiscuotiQuest(document.getElementById('mm2-quest-btn'));
      var inkVisti = [], sottoVisto = [], quanteInsieme = 0, bustaUltimo = null, bustaPrimo = null;
      while(performance.now() - t1 < 2200){
        var icone = document.querySelectorAll('#quest-volo .quest-volo-icona');
        quanteInsieme = Math.max(quanteInsieme, icone.length);
        for(var j = 0; j < icone.length; j++){
          if(/pack-icon\\.png/.test(icone[j].src)){
            var mm = /translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)/.exec(icone[j].style.transform);
            if(mm){ var c = { x: parseFloat(mm[1]) + parseFloat(icone[j].style.width)/2, y: parseFloat(mm[2]) + parseFloat(icone[j].style.height)/2 }; if(!bustaPrimo) bustaPrimo = c; bustaUltimo = c; }
          }
        }
        var v = inkAVideo(); if(inkVisti[inkVisti.length - 1] !== v) inkVisti.push(v);
        var st = sotto.textContent === 'SENTINELLA' ? 'ferma' : 'aggiornata'; if(sottoVisto[sottoVisto.length - 1] !== st) sottoVisto.push(st);
        await attendi(8);
      }
      dice(quanteInsieme === 3, 'tre premi, tre icone in volo (una dopo l-altra)', quanteInsieme);
      dice(inkVisti.join('>') === '100>150>180', 'il saldo sale a ogni inchiostro che arriva, e alla fine e- quello del server', inkVisti.join(' > '));
      dice(bustaPrimo && Math.hypot(bustaPrimo.x - daBusta.x, bustaPrimo.y - daBusta.y) < 24, 'la busta parte dalla sua scheda', bustaPrimo && (tondo(bustaPrimo.x) + ',' + tondo(bustaPrimo.y) + ' vs ' + tondo(daBusta.x) + ',' + tondo(daBusta.y)));
      var aBusta = arrivi.filter(function(a){ return a.premio === 'pack'; })[0];
      dice(aBusta && aBusta.u === 1 && Math.hypot(aBusta.x - bersaglioBusta.x, aBusta.y - bersaglioBusta.y) < 6, 'e arriva, a fine volo, sul pulsante Card packs', aBusta && (tondo(aBusta.x) + ',' + tondo(aBusta.y) + ' u=' + aBusta.u + ' vs ' + tondo(bersaglioBusta.x) + ',' + tondo(bersaglioBusta.y)));
      dice(arrivi.length === 3 && arrivi.every(function(a){ return a.u === 1; }), 'tutti e tre arrivano volando (non per il tempo di riserva)', JSON.stringify(arrivi.map(function(a){ return a.premio + ':' + a.u; })));
      dice(sottoVisto.join('>') === 'ferma>aggiornata', 'la riga del pulsante aspetta la busta, poi si aggiorna', sottoVisto.join(' > '));
      var nomi = suoni.map(function(x){ return x.f; });
      dice(nomi.filter(function(f){ return f === 'kaching.mp3'; }).length === 2 && nomi.filter(function(f){ return f === 'card-draw.mp3'; }).length === 1, 'kaching per ogni inchiostro, card-draw per la busta', nomi.join(' '));
      var cd = suoni.find(function(x){ return x.f === 'card-draw.mp3'; });
      dice(cd && cd.t - t1 > 700, 'card-draw suona quando la busta arriva, non al clic', cd && Math.round(cd.t - t1) + 'ms');
      var bottone = document.querySelector('#mm2-sc-packs .hx-btn');
      _questPulsa(bottone);
      var animB = bottone.getAnimations().map(function(a){ return a.animationName; });
      dice(animB.indexOf('premioArrivatoPulsante') >= 0, 'il pulsante lampeggia e pulsa', animB.join(','));

      // ── 4. SENZA MENU DA CUI PARTIRE ──
      MENU_GIOCATORE.magicInk = 100; _questInkFermo = 100; aggiornaValuteAVideo();
      MENU_GIOCATORE.magicInk = 140;
      suoni = [];
      questVolaPremi([{ id:'z', premio:'ink', quanto:40 }], [null]);
      await attendi(60);
      dice(inkAVideo() === '140' && _questInkFermo === null && !document.querySelector('#quest-volo .quest-volo-icona'), 'senza la scheda da cui partire il premio arriva subito (il saldo non resta indietro)', inkAVideo());
      playSfxFile = sfxVero;
    } catch(err){ dice(false, 'il banco e- arrivato in fondo', err.message + ' ' + String(err.stack || '').split('\\n')[1]); }
    return d.join('\\n');
  })()`);
  console.log(esito);
  const no = (esito.match(/^  NO  /gm) || []).length;
  const ok = (esito.match(/^  ok  /gm) || []).length;
  console.log('\n' + ok + ' ok, ' + no + ' NO');
  app.exit(no ? 1 : 0);
});
