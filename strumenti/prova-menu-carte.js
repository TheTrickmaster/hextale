// IL PALLINO DELLE NOVITA', IL GAP DEI PACCHETTI E LA SPECULAR PER LIVELLO.
//
//     $ELECTRON strumenti/prova-menu-carte.js [scatto.png]
//
// Tre cose che hanno in comune il modo di rompersi: una regola CSS che ne
// cancella un'altra senza che si veda, o un dato preso al livello sbagliato.
// Nessuna delle tre da' errore quando si rompe — si vede soltanto, e solo se
// si sta guardando quel pezzo di schermo.
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
    webPreferences: { contextIsolation: false, webSecurity: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 3000));

  const dette = await win.webContents.executeJavaScript(`(function(){ try{
    const dette = [];
    const dice = (ok, che, perche) => dette.push({ ok:!!ok, che:che, perche:perche||'' });
    const s=document.getElementById('splash'); if(s) s.remove();
    showPage('mainmenu');
    return dette;
  }catch(e){ return [{ok:false,che:'il menu non si apre',perche:String((e&&e.stack)||e)}]; } })()`);

  await new Promise(r => setTimeout(r, 1200));

  const menu = await win.webContents.executeJavaScript(`(function(){ try{
    const dette = [];
    const dice = (ok, che, perche) => dette.push({ ok:!!ok, che:che, perche:perche||'' });

    // ── IL GAP DELLE DUE RIGHE DI "CARD PACKS" ─────────────────────────────
    // Si legge il valore CALCOLATO, non quello scritto: fra le due c'era una
    // regola piu' forte, e la regola piu' forte e' quella che si vede.
    const et = document.querySelector('#mm2-sc-packs .hxb-label');
    dice(!!et, 'c-e- l-etichetta a due righe di Card packs');
    if(et){
      const g = getComputedStyle(et).rowGap;
      dice(g === '2px', 'le due righe stanno a due pixel', 'ho letto ' + g);
      dice(getComputedStyle(et).flexDirection === 'column', 'e sono incolonnate');
    }

    // ── IL PALLINO ─────────────────────────────────────────────────────────
    CARTE_NUOVE = new Set(['baba-yaga','alice']);
    aggiornaPallinoNovita();
    const btn = document.querySelector('#mm2-sc-library .hx-btn');
    const pal = document.querySelector('.mm2-pallino-novita');
    const lab = document.querySelector('#mm2-sc-library .hxb-label');
    dice(!!pal, 'il pallino compare quando ci sono carte nuove');
    if(pal && btn && lab){
      dice(pal.parentElement === btn, 'sta appeso al pulsante, non all-etichetta',
        'suo padre e- ' + (pal.parentElement && pal.parentElement.className));
      dice(getComputedStyle(pal).position === 'absolute', 'sta fuori dal flusso',
        getComputedStyle(pal).position);
      const rb = btn.getBoundingClientRect();
      const rp = pal.getBoundingClientRect();
      const rl = lab.getBoundingClientRect();
      // Dentro alla cornice del pulsante.
      dice(rp.right <= rb.right && rp.left >= rb.left, 'sta dentro al pulsante',
        Math.round(rp.left)+'-'+Math.round(rp.right)+' dentro a '+Math.round(rb.left)+'-'+Math.round(rb.right));
      // A destra del testo, e senza toccarlo.
      dice(rp.left >= rl.right, 'sta a destra della scritta e non la copre',
        'pallino a ' + Math.round(rp.left) + ', scritta finisce a ' + Math.round(rl.right));
      // E il TESTO resta in mezzo al pulsante. Si misura il testo vero con un
      // Range e non il riquadro dell'etichetta: col pallino dentro, l'etichetta
      // restava centrata lo stesso — era larga testo + pallino — e a spostarsi
      // era solo la scritta dentro di lei. Misurare l'etichetta avrebbe detto
      // "centrato" proprio nel caso rotto.
      // Solo il NODO DI TESTO, non tutto il contenuto dell'etichetta: col
      // pallino dentro, "tutto il contenuto" comprendeva anche lui e tornava a
      // misurare l'etichetta intera.
      const nodo = [...lab.childNodes].find(n=>n.nodeType===3 && n.textContent.trim());
      const rg = document.createRange();
      if(nodo) rg.setStart(nodo,0), rg.setEnd(nodo, nodo.textContent.length);
      else rg.selectNodeContents(lab);
      const rt = rg.getBoundingClientRect();
      const scarto = Math.abs((rt.left+rt.right)/2 - (rb.left+rb.right)/2);
      dice(scarto <= 1, 'e la scritta resta centrata nel pulsante',
        'fuori asse di ' + scarto.toFixed(1) + 'px');
      // Verticalmente in mezzo.
      dice(Math.abs((rp.top+rp.bottom)/2 - (rb.top+rb.bottom)/2) <= 1, 'e in mezzo in altezza');
    }

    // ── IL PALLINO SE NE VA ────────────────────────────────────────────────
    // E' il bug: restava sempre. Adesso a carta vista il conto scende, e a
    // conto zero il pallino sparisce.
    segnaCartaGuardata('baba-yaga');
    dice(CARTE_NUOVE.size === 1, 'una carta vista esce dal conto', 'ne restano ' + CARTE_NUOVE.size);
    dice(!!document.querySelector('.mm2-pallino-novita'), 'e col resto da vedere il pallino c-e- ancora');
    segnaCartaGuardata('alice');
    dice(CARTE_NUOVE.size === 0, 'viste tutte, il conto e- a zero', 'ne restano ' + CARTE_NUOVE.size);
    dice(!document.querySelector('.mm2-pallino-novita'), 'e il pallino se ne va');

    // L'osservatore c'e' e la griglia lo sa usare.
    const c1 = typeof osservaNovitaInGriglia === 'function';
    dice(c1, 'c-e- l-osservatore delle novita-');
    dice(c1 && !!osservaNovitaInGriglia(), 'e si accende');

    return dette;
  }catch(e){ dette.push({ok:false,che:'la prova del menu si e- rotta',perche:String((e&&e.stack)||e)}); return dette; } })()`);

  // ── LA SPECULAR SEGUE IL SELETTORE DEI LIVELLI ───────────────────────────
  const spec = await win.webContents.executeJavaScript(`(function(){ try{
    const dette = [];
    const dice = (ok, che, perche) => dette.push({ ok:!!ok, che:che, perche:perche||'' });
    const carta = JSON.parse(JSON.stringify(FINAL_CARDS[0]));
    carta.level = 1;   // la carta VERA e' di livello 1: e' il caso che sbagliava
    const host = document.getElementById('card-modal-card');
    dice(!!host, 'c-e- la finestra della carta a tutto schermo');
    const visto = {};
    for(let liv=1; liv<=4; liv++){
      _cmLivello = liv; _cmConSelettore = true;
      disegnaCardModal(carta, 1);
      visto[liv] = !!host.querySelector('.card-db-gloss-layer');
    }
    // Livello 1: solo il glare, niente lucentezza.
    dice(visto[1] === false, 'al livello 1 la specular non c-e-');
    // Dal 2 in su c'e', ed e' il pezzo che mancava: il disegno seguiva il
    // selettore, la lucentezza no — guardava il livello VERO della carta.
    dice(visto[2] === true, 'al livello 2 la specular c-e-',
      'e- il guasto del 07/09/2026: la carta veniva disegnata al livello scelto\\n' +
      '        ma la lucentezza chiedeva il livello vero, che qui e- 1');
    dice(visto[3] === true, 'al livello 3 c-e- ancora');
    dice(visto[4] === true, 'e al livello 4 pure');
    // E il glare c'e' sempre, a ogni livello: e' la base di ogni carta.
    _cmLivello = 1; disegnaCardModal(carta, 1);
    dice(!!host.querySelector('.card-db-foil-glare'), 'il glare c-e- anche al livello 1');
    closeCardModal();
    return dette;
  }catch(e){ dette.push({ok:false,che:'la prova della specular si e- rotta',perche:String((e&&e.stack)||e)}); return dette; } })()`);

  if (SCATTO) {
    await win.webContents.executeJavaScript(
      `(function(){ CARTE_NUOVE = new Set(['x']); aggiornaPallinoNovita(); return true; })()`);
    win.setPosition(-3200, 0); win.showInactive();
    await new Promise(r => setTimeout(r, 700));
    fs.writeFileSync(SCATTO, (await win.webContents.capturePage()).toPNG());
    console.log('scatto  ' + SCATTO);
  }

  const tutte = dette.concat(menu, spec);
  let male = 0;
  for (const d of tutte) {
    console.log((d.ok ? '  ok  ' : '  NO  ') + d.che + (d.ok || !d.perche ? '' : '\n        ' + d.perche));
    if (!d.ok) male++;
  }
  console.log('\n' + tutte.length + ' controlli, ' + male + ' storti');
  app.exit(male ? 1 : 0);
});
