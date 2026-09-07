// OGNI FINESTRA COMPARE E SPARISCE IN DISSOLVENZA.
//
//     $ELECTRON strumenti/prova-dissolvenze.js [scatto.png]
//
// Fino alla v0.79.33 ogni finestra appariva di colpo: `display:none` che
// diventa `display:flex`, e in mezzo niente. Non si poteva rimediare con una
// transizione, perche' `display` non e' un numero e fra "non c'e'" e "c'e'" non
// esistono valori in mezzo — e in chiusura era anche peggio, perche'
// `display:none` fa sparire l'elemento nell'istante stesso e non resta niente
// da dissolvere.
//
// Il banco NON prova le finestre che conosce: le CERCA nel documento. E' la
// differenza fra un controllo che vale oggi e uno che vale anche per la
// finestra che verra' aggiunta il mese prossimo — la quale, se nascera' col
// vecchio `display:none`, apparira' di colpo e nessuno se ne accorgera' finche'
// non la si guarda aprire.
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
  await new Promise(r => setTimeout(r, 2500));

  const dette = await win.webContents.executeJavaScript(`(function(){ try{
    const dette = [];
    const dice = (ok, che, perche) => dette.push({ ok:!!ok, che:che, perche:perche||'' });
    const s=document.getElementById('splash'); if(s) s.remove();

    // ── QUALI SONO LE FINESTRE ─────────────────────────────────────────────
    // Si cercano, non si elencano. Chi porta un id che finisce in "-overlay" o
    // una delle due classi condivise e' una finestra.
    const FUORI = {
      // Non e' una finestra: e' il velo scuro che va sotto ai banner, e non ha
      // niente da dissolvere per conto suo.
      'banner-dim-overlay': 'e- un velo, non una finestra',
      // Ha una dissolvenza sua da prima, piu' lenta apposta: non e' una
      // finestra ma il ventaglio della mano che si allarga.
      'hand-expand-overlay': 'ha una dissolvenza sua, piu- lenta',
      // Il tavolo da gioco: appare col resto della partita.
      'mm-play-overlay': 'segue la partita'
    };
    const finestre = [...new Set([
      ...document.querySelectorAll('[id$="-overlay"], .hx-overlay, .hx-modal-overlay')
    ])].filter(el => !FUORI[el.id]);
    dice(finestre.length >= 15, 'ci sono finestre da guardare', 'ne ho trovate ' + finestre.length);

    // ── OGNUNA SI DISSOLVE, IN TUTTI E DUE I VERSI ─────────────────────────
    const senza = [], nonSparisce = [], sbagliate = [];
    finestre.forEach(el=>{
      const nome = el.id || ('.' + el.className.split(' ')[0]);
      const era = el.classList.contains('show');
      // Le due misure vogliono due condizioni opposte, e mescolarle e' il modo
      // piu' facile di leggere un numero che non e' nessuno dei due:
      //   - gli STATI FERMI si leggono a transizioni SPENTE. Con la transizione
      //     accesa, l'opacita' letta subito dopo il cambio di classe e' quella
      //     di PARTENZA — la corsa e' appena cominciata — e una finestra che si
      //     sta aprendo risponde "opacita' zero". Che e' giusto, ed e' anche il
      //     motivo per cui la dissolvenza si vede.
      //   - la TRANSIZIONE dichiarata si legge invece a transizioni accese,
      //     perche' e' proprio lei l'oggetto della domanda.
      const fermo = (dentro)=>{
        el.style.transition = 'none';
        if(dentro) el.classList.add('show'); else el.classList.remove('show');
        const s = getComputedStyle(el);
        const v = { opacity:s.opacity, visibility:s.visibility, display:s.display };
        el.style.transition = '';
        return v;
      };
      const fermaChiusa = fermo(false);
      const fermaAperta = fermo(true);
      // Chiusa.
      el.classList.remove('show');
      const chiusa = getComputedStyle(el);
      if(fermaChiusa.display === 'none'){ senza.push(nome + ' (display:none da chiusa)'); }
      else {
        if(fermaChiusa.opacity !== '0') sbagliate.push(nome + ' chiusa a opacita- ' + fermaChiusa.opacity);
        if(fermaChiusa.visibility !== 'hidden') sbagliate.push(nome + ' chiusa ma visibile');
        // Il ritardo sulla visibility in USCITA e' il punto della regola:
        // senza, la finestra sparisce subito e la dissolvenza non si vede.
        if(!/visibility 0s linear 0\\.15s/.test(chiusa.transition)) nonSparisce.push(nome + ': ' + chiusa.transition);
      }
      // Aperta.
      el.classList.add('show');
      const aperta = getComputedStyle(el);
      if(fermaAperta.opacity !== '1') sbagliate.push(nome + ' aperta a opacita- ' + fermaAperta.opacity);
      if(fermaAperta.visibility !== 'visible') sbagliate.push(nome + ' aperta ma nascosta');
      if(!/opacity 0\\.15s/.test(aperta.transition)) sbagliate.push(nome + ' senza i 150ms: ' + aperta.transition);
      if(!era) el.classList.remove('show');
    });
    dice(senza.length === 0, 'nessuna finestra sparisce con display:none',
      senza.join('\\n        ') + '\\n        (display non si dissolve: chi ce l-ha appare e sparisce di colpo)');
    dice(nonSparisce.length === 0, 'e ognuna aspetta la fine della dissolvenza prima di nascondersi',
      nonSparisce.slice(0,4).join('\\n        '));
    dice(sbagliate.length === 0, 'e i due stati sono quelli giusti, a 150ms',
      sbagliate.slice(0,6).join('\\n        '));

    // ── LA BARRA DI "PICK A LETTER" ────────────────────────────────────────
    const barra = document.getElementById('starter-titlebar');
    dice(!!barra, 'c-e- la barra del titolo di Pick a letter');
    if(barra){
      const ov = document.getElementById('starter-overlay');
      ov.classList.add('show');
      dice(Math.round(barra.offsetWidth) === 600, 'larga 600',
        'ne misura ' + Math.round(barra.offsetWidth) + ' — prima era larga quanto le tre colonne');
      // E ALTA quanto una barra del titolo. Sembra una domanda oziosa e non lo
      // e': il riquadro e' una colonna, e in una colonna "flex-basis" e'
      // l'altezza — scrivendo la larghezza li' dentro la barra viene larga
      // giusta e ALTA seicento, e un controllo che guarda solo la larghezza
      // dice di si' mentre le tre lettere sono finite fuori dallo schermo.
      // E' successo scrivendo questa riga.
      dice(Math.round(barra.offsetHeight) === 68, 'e alta 68, come ogni altra barra',
        'ne misura ' + Math.round(barra.offsetHeight));
      const centro = barra.querySelector('.hx-titlebar-center');
      dice(getComputedStyle(centro).justifyContent === 'center', 'e il titolo sta in mezzo',
        getComputedStyle(centro).justifyContent);
      // In mezzo alle colonne, non appoggiata a un bordo.
      const colonne = document.getElementById('starter-colonne');
      if(colonne && colonne.offsetWidth){
        const rb = barra.getBoundingClientRect(), rc = colonne.getBoundingClientRect();
        dice(Math.abs((rb.left+rb.right)/2 - (rc.left+rc.right)/2) <= 1,
          'e centrata sulle tre colonne',
          'fuori asse di ' + Math.abs((rb.left+rb.right)/2 - (rc.left+rc.right)/2).toFixed(1));
      }
      ov.classList.remove('show');
    }

    // ── E LE TRE COLONNE ENTRANO UNA DIETRO L'ALTRA ────────────────────────
    const ov = document.getElementById('starter-overlay');
    ov.classList.add('starter-apre');
    const cols = [...document.querySelectorAll('.starter-col')];
    const ritardi = cols.map(c=>getComputedStyle(c).animationDelay);
    dice(ritardi.join(' ') === '0s 0.11s 0.22s', 'le tre lettere entrano a scalare',
      'ritardi: ' + ritardi.join(' '));
    dice(cols.every(c=>/starterColonnaEntra/.test(getComputedStyle(c).animationName)),
      'con un-animazione e non con la transizione che gia- hanno',
      'due cose sulla stessa proprieta- non convivono: la transizione serve a\\n' +
      '        farle sparire quando se ne sceglie una');
    ov.classList.remove('starter-apre');
    dice(getComputedStyle(cols[0]).animationName === 'none',
      'e a corsa finita l-animazione se ne va',
      'con \\'both\\' terrebbe il suo valore finale anche da ferma, e si\\n' +
      '        batterebbe con la transizione che deve venire dopo');

    return dette;
  }catch(e){ return [{ok:false, che:'la prova si e- rotta', perche:String((e && e.stack) || e)}]; } })()`);

  if (SCATTO) {
    await win.webContents.executeJavaScript(`(function(){
      const ov = document.getElementById('starter-overlay');
      ov.classList.add('show');
      // Ferma: in una finestra nascosta le animazioni non avanzano, e senza
      // spegnerle si fotograferebbe un fotogramma qualunque della loro corsa.
      const st=document.createElement('style');
      st.textContent='#starter-overlay, #starter-overlay *{transition:none!important;animation:none!important}';
      document.head.appendChild(st);
      return true;
    })()`);
    win.setPosition(-3200, 0); win.showInactive();
    await new Promise(r => setTimeout(r, 900));
    fs.writeFileSync(SCATTO, (await win.webContents.capturePage()).toPNG());
    console.log('scatto  ' + SCATTO);
  }

  let male = 0;
  for (const d of dette) {
    console.log((d.ok ? '  ok  ' : '  NO  ') + d.che + (d.ok || !d.perche ? '' : '\n        ' + d.perche));
    if (!d.ok) male++;
  }
  console.log('\n' + dette.length + ' controlli, ' + male + ' storti');
  app.exit(male ? 1 : 0);
});
