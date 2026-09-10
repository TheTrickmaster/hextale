// LE NOTE DI RILASCIO, E NESSUNA RICHIESTA A GITHUB.
//
//     $ELECTRON strumenti/prova-note.js
//
// Fino alla v0.79.61 il gioco leggeva patch-notes.txt attraverso l'API di
// GitHub, in JSONP. Funzionava, ma quell'API a chi non si autentica concede
// SESSANTA richieste all'ora per indirizzo IP, e il gioco ne spendeva cinque
// appena aperto piu' trenta all'ora per sempre (la sorveglianza della versione,
// ogni due minuti). Una scheda sola arrivava a trentacinque nella prima ora:
// due schede, o un paio di ricaricamenti mentre si lavora, e il tetto era
// superato — e superato il tetto le note e il controllo di versione si
// spengono senza dire niente.
//
// Dalla v0.79.62 il file arriva dalla NOSTRA origine: sta nella radice del
// sito, quindi da /play/ e' a un passo. Questo banco tiene ferme due cose che
// non si vedono guardando la finestra:
//
//   1. NESSUNA richiesta parte verso api.github.com. E' la cosa che si
//      romperebbe per prima e in silenzio, perche' un giro da GitHub
//      rimesso dentro continuerebbe a funzionare finche' la quota regge.
//   2. Le note si leggono davvero, e dal server che ha servito la pagina —
//      non da hextalegame.com. Serve un server vero: da file:// il percorso
//      relativo non risponde, ed e' proprio il ripiego che si vuole vedere
//      scattare separatamente.
//
// Poi che il controllo di versione, quello che blocca un client rimasto
// indietro, regga sulle note lette cosi'.
const { app, BrowserWindow } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');

const RADICE = path.resolve(__dirname, '..');
const TIPI = { '.html':'text/html', '.txt':'text/plain; charset=utf-8', '.png':'image/png',
               '.jpg':'image/jpeg', '.ttf':'font/ttf', '.js':'text/javascript', '.css':'text/css' };

const chieste = [];
const server = http.createServer((req, res) => {
  const via = decodeURIComponent(req.url.split('?')[0]);
  chieste.push(via);
  const dove = path.join(RADICE, via.replace(/^\/+/, ''));
  if (via !== '/' && fs.existsSync(dove) && fs.statSync(dove).isFile()) {
    res.writeHead(200, { 'Content-Type': TIPI[path.extname(dove).toLowerCase()] || 'application/octet-stream' });
    return res.end(fs.readFileSync(dove));
  }
  res.writeHead(404, { 'Content-Type':'text/plain' });
  res.end('no');
});

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

const dette = [];
const dice = (ok, che, perche) => dette.push({ ok: !!ok, che, perche: perche || '' });

app.whenReady().then(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const porta = server.address().port;

  // Ogni richiesta verso GitHub viene ANNOTATA e BLOCCATA: annotata perche' e'
  // quello che si sta misurando, bloccata perche' un banco non deve spendere
  // la quota vera di chi lo esegue.
  const aGithub = [];
  const ses = require('electron').session.defaultSession;
  ses.webRequest.onBeforeRequest({ urls: ['https://api.github.com/*', 'https://*.githubusercontent.com/*'] },
    (d, cb) => { aGithub.push(d.url); cb({ cancel: true }); });

  // v0.79.71 — il testo VERO, letto dal disco. Serve al controllo
  // sull'encoding: vedi piu' sotto.
  const SUL_DISCO = fs.readFileSync(path.join(RADICE, 'patch-notes.txt'), 'utf8');
  const win = new BrowserWindow({ show: false, width: 1400, height: 900,
    webPreferences: { contextIsolation: false } });
  await win.loadURL('http://127.0.0.1:' + porta + '/play/index.html');
  await new Promise(r => setTimeout(r, 14000));

  // ── 1. NIENTE GITHUB ────────────────────────────────────────────────────
  dice(aGithub.length === 0, 'aprendo la pagina non parte nessuna richiesta a GitHub',
    aGithub.length ? aGithub.join('\n        ') : '');

  // ── 2. LE NOTE ARRIVANO DAL SERVER CHE HA SERVITO LA PAGINA ─────────────
  const nostre = chieste.filter(v => v === '/patch-notes.txt');
  dice(nostre.length >= 1, 'e le note si chiedono a chi ha servito la pagina',
    'ho contato ' + nostre.length + ' richieste a /patch-notes.txt');

  const esito = await win.webContents.executeJavaScript(`(async function(){ try{
    const attendi = (ms)=>new Promise(r=>setTimeout(r,ms));
    // Le funzioni tolte non devono tornare dalla finestra di servizio.
    const morte = ['_githubJsonp','trovaUltimaVersione','controllaAggiornamentoAllAvvio',
                   'scaricaAggiornamentoDalRiquadro','scaricaVersione'].filter(n=>typeof window[n]==='function');
    // Il testo, letto adesso.
    const testo = await _leggiNote();
    const versioni = analizzaPatchNotes(testo);
    // E riempito nel riquadro.
    riempiPatchNotes(versioni);
    const corpo = document.getElementById('patch-notes-body');
    // Il controllo che blocca un client rimasto indietro: si finge di essere
    // dentro e si passano note che dichiarano una versione piu' alta.
    _giocatoreDentro = true;
    const mia = versioneDiQuestoClient();
    const pezzi = numeroVersioneDa(mia).slice();
    pezzi[pezzi.length-1] += 1;
    controllaVersioneDaNote([{ versione:'v'+pezzi.join('.'), voci:['prova'] }]);
    const bloccato = !!document.getElementById('aggiorna-overlay').classList.contains('show');
    document.getElementById('aggiorna-overlay').classList.remove('show');
    return {
      morte: morte,
      quante: versioni.length,
      prima: versioni.length ? versioni[0].versione : '',
      voci: versioni.length ? versioni[0].voci.length : 0,
      // v0.79.71 — non piu' "c'e' un accento?": dalla riscrittura delle note
      // (10/09/2026) il file e' inglese secco e di accenti non ne ha uno,
      // quindi quel controllo aveva smesso di guardare qualcosa. Adesso si
      // confronta il testo ARRIVATO con quello sul disco, carattere per
      // carattere: e' la stessa domanda — "e' arrivato intatto?" — fatta in
      // modo che valga qualunque cosa ci sia scritto dentro.
      testo: testo,
      blocchi: corpo ? corpo.querySelectorAll('.patch-versione').length : -1,
      riquadro: !!document.getElementById('patch-notes-update'),
      mia: mia,
      bloccato: bloccato
    };
  }catch(e){ return { guasto:(e&&e.message)+' '+String((e&&e.stack)||'').slice(0,240) }; } })()`);

  if (esito.guasto) { console.error('GUASTO: ' + esito.guasto); server.close(); app.exit(1); return; }

  dice(esito.morte.length === 0, 'e le funzioni che ci andavano non ci sono piu-',
    esito.morte.length ? 'sono ancora qui: ' + esito.morte.join(', ') : '');
  dice(!esito.riquadro, 'via anche il riquadro che proponeva di scaricare una versione',
    esito.riquadro ? '#patch-notes-update e- ancora nel documento' : '');

  // ── 3. IL TESTO SI LEGGE DAVVERO ────────────────────────────────────────
  dice(esito.quante > 0 && esito.quante <= 10, 'il file si legge e porta le sue versioni',
    esito.quante + ' blocchi (il file ne tiene al massimo dieci)');
  dice(esito.voci > 0, 'e la piu- recente ha le sue voci', esito.prima + ': ' + esito.voci + ' voci');
  dice(esito.testo === SUL_DISCO, 'e arriva IDENTICO a quello sul disco',
    (esito.testo === SUL_DISCO ? '' : 'arrivati ' + (esito.testo||'').length +
      ' caratteri, sul disco ce ne sono ' + SUL_DISCO.length + '.\n        ') +
    'Prima il testo era base64 dentro a una risposta dell-API e andava ricomposto\n' +
    '        a mano come UTF-8; una fetch quella fatica la fa da se-, ma solo se\n' +
    '        nessuno la aiuta.');
  dice(esito.blocchi === esito.quante, 'e il riquadro si riempie con tutte',
    esito.blocchi + ' nel riquadro, ' + esito.quante + ' lette');

  // La prima voce del file e' la versione di questo client: e' la regola che
  // tiene insieme la targhetta e le note (vedi patch-notes-a-ogni-versione).
  dice(esito.prima.replace(/^#*\s*/, '') === esito.mia,
    'e la prima voce del file e- la versione di questo client',
    'note: "' + esito.prima + '"   targhetta: "' + esito.mia + '"');

  // ── 4. IL CONTROLLO DI VERSIONE REGGE ───────────────────────────────────
  dice(esito.bloccato, 'e un client rimasto indietro viene ancora fermato',
    'Era l-unica cosa che il giro da GitHub faceva davvero, e adesso non costa\n' +
    '        piu- niente: si legge dallo stesso file, dalla nostra origine.');

  // ── 5. E NEMMENO STANDO APERTO ──────────────────────────────────────────
  // La sorveglianza guarda ogni due minuti; qui si chiama a mano piu' volte,
  // che e' la stessa cosa senza aspettare.
  const primaDelGiro = chieste.filter(v => v === '/patch-notes.txt').length;
  for (let i = 0; i < 3; i++) {
    await win.webContents.executeJavaScript('caricaPatchNotes({soloVersione:true}); 1');
    await new Promise(r => setTimeout(r, 700));
  }
  const dopoIlGiro = chieste.filter(v => v === '/patch-notes.txt').length;
  dice(aGithub.length === 0, 'e stando aperto non ne parte comunque nessuna verso GitHub',
    aGithub.length ? aGithub.join('\n        ') : '');
  dice(dopoIlGiro - primaDelGiro === 3, 'ogni sguardo e- una lettura vera, non la cache',
    (dopoIlGiro - primaDelGiro) + ' richieste per 3 sguardi. Il sito serve questo file\n' +
    '        con dieci minuti di cache: senza il ?t= la sorveglianza rileggerebbe\n' +
    '        cinque volte di fila la stessa copia vecchia.');

  server.close();
  let male = 0;
  for (const d of dette) {
    if (!d.ok) male++;
    console.log((d.ok ? '  ok   ' : '  NO   ') + d.che);
    if (d.perche) console.log('        ' + d.perche);
  }
  console.log(male ? '\n' + male + ' cose non tornano' : '\ntutto a posto (' + dette.length + ' controlli)');
  app.exit(male ? 1 : 0);
}).catch(e => { console.error(e); app.exit(1); });
