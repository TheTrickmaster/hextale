// LA TARGHETTA DELLA VERSIONE: cosa succede a premerla.
//
//     $ELECTRON strumenti/prova-targhetta.js
//
// Dalla v0.79.68 fa una cosa per uno: agli admin apre il menu di debug, a tutti
// gli altri le note di rilascio. E' il posto giusto per metterle, perche' e'
// esattamente la domanda che uno si fa guardando un numero di versione — "e
// questa cosa ha cambiato?" — ma e' anche un bivio che si puo' sbagliare in due
// modi opposti, e nessuno dei due si vede provando il gioco da admin:
//
//   - un giocatore che preme e non succede niente (com'era prima: la targhetta
//     era spenta per chi non e' admin, cioe' per tutti);
//   - un giocatore che preme e si ritrova il MENU DI DEBUG, che e' la porta che
//     non deve nemmeno vedere.
//
// Chi sviluppa e' admin, quindi la strada che prova ogni giorno e' l'unica
// delle due che non si rompe in silenzio.
const { app, BrowserWindow } = require('electron');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1600, height: 1000,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 13000));

  const esito = await win.webContents.executeJavaScript(`(async function(){
    const d = [];
    const dice = (ok, che, perche) => d.push({ ok:!!ok, che, perche: perche||'' });
    const attendi = (ms)=>new Promise(r=>setTimeout(r,ms));
    const note  = ()=>document.getElementById('patch-notes-overlay').classList.contains('show');
    const debug = ()=>document.getElementById('debug-modal-overlay').classList.contains('show');
    const chiudi = ()=>{
      document.getElementById('patch-notes-overlay').classList.remove('show');
      document.getElementById('debug-modal-overlay').classList.remove('show');
    };
    try{
      const t = document.getElementById('build-version-badge');
      dice(!!t, 'la targhetta c-e-');
      if(!t) return { d };
      dice((t.getAttribute('onclick')||'').indexOf('targhettaPremuta') >= 0,
        'e premendola si passa dal bivio, non piu- dritti al menu di debug',
        t.getAttribute('onclick'));

      // ── 1. UN GIOCATORE NORMALE ───────────────────────────────────────────
      GIOCATORE_ADMIN = false;
      aggiornaAccessoDebug();
      const s = getComputedStyle(t);
      dice(s.pointerEvents === 'auto', 'per un giocatore la targhetta e- premibile',
        'Prima era spenta: un numero in un angolo che non fa niente. (pointer-events: ' + s.pointerEvents + ')');
      dice(s.cursor !== 'default', 'e si vede che lo e-', s.cursor.slice(0, 40));
      chiudi();
      targhettaPremuta();
      await attendi(200);
      dice(note(), 'premendola si aprono le note di rilascio');
      dice(!debug(), 'e NON il menu di debug',
        'E- la porta che un giocatore non deve nemmeno vedere.');
      // E dentro c'e' qualcosa da leggere: le note si caricano all'avvio, e se
      // il riquadro fosse vuoto la targhetta aprirebbe una finestra vuota.
      const corpo = document.getElementById('patch-notes-body');
      dice(corpo && corpo.querySelectorAll('.patch-versione').length > 0,
        'e dentro c-e- davvero qualcosa da leggere',
        (corpo ? corpo.querySelectorAll('.patch-versione').length : 0) + ' versioni nel riquadro');
      chiudi();

      // ── 2. UN ADMIN ───────────────────────────────────────────────────────
      GIOCATORE_ADMIN = true;
      aggiornaAccessoDebug();
      targhettaPremuta();
      await attendi(200);
      dice(debug(), 'per un admin si apre il menu di debug');
      dice(!note(), 'e non le note');
      chiudi();

      // ── 3. E IL PERMESSO PUO- CAMBIARE MENTRE SI E- DENTRO ────────────────
      // Arriva dal server insieme al profilo: chi lo perde non deve restare col
      // menu aperto davanti.
      document.getElementById('debug-modal-overlay').classList.add('show');
      GIOCATORE_ADMIN = false;
      aggiornaAccessoDebug();
      dice(!debug(), 'e chi smette di essere admin si vede chiudere il menu');
      chiudi();
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
