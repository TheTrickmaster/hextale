// I MURI DEL TABELLONE: cinque disegni, e mai due uguali nella stessa partita.
//
//     $ELECTRON strumenti/prova-muri.js
//
// Le caselle bloccate di una partita sono da due a cinque, e le varianti sono
// cinque: dentro a una partita due muri uguali non si devono vedere MAI. Non
// e' garantito da un caso fortunato — chi le assegna pesca da un mazzo
// mescolato e non ne rimette in gioco nessuna finche' il mazzo non e' finito —
// ma e' esattamente il genere di regola che si rompe in silenzio: due muri
// uguali su un tabellone non sembrano un guasto, sembrano una coincidenza, e
// chi gioca non ha modo di sapere che non doveva succedere.
//
// E i cinque file devono ESISTERE. Dalla v0.79.65 si chiamano tile-blocked-N
// (erano tile-broken-N): un indirizzo sbagliato non da' nessun errore che si
// veda giocando — la casella resta semplicemente vuota, e il tabellone sembra
// disegnato male invece che rotto.
const { app, BrowserWindow, net } = require('electron');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

const dette = [];
const dice = (ok, che, perche) => dette.push({ ok: !!ok, che, perche: perche || '' });

function stato(url){
  return new Promise(r => {
    const q = net.request({ url, method: 'HEAD' });
    q.on('response', o => { r(o.statusCode); o.resume(); });
    q.on('error', () => r(0));
    q.end();
  });
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1400, height: 900,
    webPreferences: { contextIsolation: false, webSecurity: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 13000));

  const esito = await win.webContents.executeJavaScript(`(function(){ try{
    const d = [];
    const dice = (ok, che, perche) => d.push({ ok:!!ok, che, perche: perche||'' });

    // ── 1. I CINQUE INDIRIZZI ─────────────────────────────────────────────
    const nomi = TILE_BLOCKED.map(u => u.split('/').pop());
    dice(nomi.join(',') === 'tile-blocked-1.png,tile-blocked-2.png,tile-blocked-3.png,tile-blocked-4.png,tile-blocked-5.png',
      'i muri sono tile-blocked, da 1 a 5', nomi.join('  '));
    dice(!TILE_BLOCKED.some(u => /tile-broken/.test(u)),
      'e di tile-broken non e- rimasta traccia');

    // ── 2. MAI DUE UGUALI ─────────────────────────────────────────────────
    // Le caselle bloccate sono da due a cinque (vedi initGame). Si prova ogni
    // numero, molte volte: la mescolata e- a sorte, e un giro solo non dice
    // niente.
    let ripetuti = 0, giri = 0;
    for(let quante = 2; quante <= 5; quante++){
      for(let n = 0; n < 300; n++){
        const celle = []; for(let i=0;i<quante;i++) celle.push('c'+i);
        const dati = assegnaMuriDellaPartita(celle);
        const usati = Object.keys(dati).map(k=>dati[k]);
        if(new Set(usati).size !== usati.length) ripetuti++;
        giri++;
      }
    }
    dice(ripetuti === 0, 'e in una partita non se ne ripete mai uno',
      giri + ' partite finte da 2 a 5 muri, ' + ripetuti + ' con un doppione');

    // Piu- muri che varianti non puo' succedere oggi, ma se un domani
    // succedesse il mazzo si rimescola invece di lasciare buchi.
    const tanti = assegnaMuriDellaPartita(['a','b','c','d','e','f','g']);
    dice(Object.keys(tanti).length === 7 && Object.keys(tanti).every(k=>!!tanti[k]),
      'e con piu- muri che varianti nessuno resta senza',
      Object.keys(tanti).length + ' assegnati');
    const primi = ['a','b','c','d','e'].map(k=>tanti[k]);
    dice(new Set(primi).size === 5, 'i primi cinque restano tutti diversi', primi.map(u=>u.split('/').pop()).join(' '));

    // ── 3. E NON CAMBIANO FACCIA ──────────────────────────────────────────
    // Un muro assegnato a inizio partita resta quello: muroDellaCella legge
    // l'assegnazione e non ricalcola niente.
    // initGame vuole la pagina di gioco MONTATA: le pagine sono ermetiche, e
    // fuori da quella i suoi getElementById tornano nulli.
    const sp = document.getElementById('splash'); if(sp) sp.remove();
    showPage('game');
    PARTITA_RETE = null;
    initGame(true);
    const bloccate = [...G.holes];
    dice(bloccate.length >= 2 && bloccate.length <= 5,
      'una partita ha da due a cinque caselle bloccate', bloccate.length + ' caselle');
    const disegni = bloccate.map(k=>{ const [q,r]=k.split(',').map(Number); return muroDellaCella(k,q,r); });
    dice(new Set(disegni).size === disegni.length,
      'e in una partita vera i loro muri sono tutti diversi',
      disegni.map(u=>u.split('/').pop()).join('  '));
    const ancora = bloccate.map(k=>{ const [q,r]=k.split(',').map(Number); return muroDellaCella(k,q,r); });
    dice(ancora.join('|') === disegni.join('|'),
      'e richiesti di nuovo sono gli stessi: un muro non cambia faccia fra un disegno e l-altro');
    return { d, urls: TILE_BLOCKED.slice() };
  }catch(e){ return { guasto:(e&&e.message)+' '+String((e&&e.stack)||'').split(String.fromCharCode(10))[1] }; } })()`);

  if (esito.guasto) { console.error('GUASTO: ' + esito.guasto); app.exit(1); return; }
  for (const x of esito.d) dette.push(x);

  // ── 4. I CINQUE FILE CI SONO DAVVERO ────────────────────────────────────
  const stati = [];
  for (const u of esito.urls) stati.push(await stato(u));
  dice(stati.every(s => s === 200), 'e i cinque file sono serviti dal sito',
    esito.urls.map((u, i) => u.split('/').pop() + ':' + stati[i]).join('  '));

  let male = 0;
  for (const x of dette) {
    if (!x.ok) male++;
    console.log((x.ok ? '  ok   ' : '  NO   ') + x.che);
    if (x.perche) console.log('        ' + x.perche);
  }
  console.log(male ? '\n' + male + ' cose non tornano' : '\ntutto a posto (' + dette.length + ' controlli)');
  app.exit(male ? 1 : 0);
}).catch(e => { console.error(e); app.exit(1); });
