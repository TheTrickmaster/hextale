// L'AVVISO "C'E' UNA VERSIONE NUOVA".
//
//     $ELECTRON strumenti/prova-aggiornamento.js
//
// Il 07/09/2026 il gioco ha annunciato "A newer version is available:
// 404.html". Non era colpa di quel file: era che per il controllo bastava
// essere un .html in radice per essere una versione, e in radice di .html non
// ce n'era nessuno. Taceva perche' guardava uno scaffale vuoto, non perche'
// fosse d'accordo — e il primo oggetto appoggiato li' e' diventato "l'ultima
// versione".
//
// Un guasto cosi' non si riprova a mano: dipende da cosa c'e' nel repository,
// e per vederlo bisognerebbe metterci davvero un file sbagliato. Qui invece la
// risposta di GitHub si finge, e si guarda cosa il gioco decide di dire.
const { app, BrowserWindow } = require('electron');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 900, frame: false,
    webPreferences: { contextIsolation: false, webSecurity: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 2500));

  const dette = await win.webContents.executeJavaScript(`(async function(){
    const dette = [];
    const dice = (ok, che, perche) => dette.push({ ok:!!ok, che:che, perche:perche||'' });

    const mia = versioneDiQuestoClient();
    dice(/^v?\\d+\\.\\d+/.test(mia), 'la pagina sa che versione e-', mia);

    // GitHub, finto. Ogni prova gli mette in mano un elenco di file e guarda
    // cosa esce: nessuna richiesta parte davvero.
    const veroJsonp = window._githubJsonp;
    const file = (nome) => ({ type:'file', name:nome, path:nome,
                              download_url:'https://esempio/' + nome, sha:'x' });
    let elenco = [];
    window._githubJsonp = async (url) => {
      if(url.indexOf('/contents/') > 0 && url.indexOf('patch-notes') < 0) return { dati: elenco };
      return { errore: 'non chiesto' };
    };

    // Cosa dice il riquadro dopo un giro del controllo. Si rimette a zero
    // ogni volta, o la prova dopo leggerebbe l'avviso della prova prima.
    const guarda = async () => {
      const riq = document.getElementById('patch-notes-update');
      const ov = document.getElementById('patch-notes-overlay');
      riq.classList.remove('mostra'); ov.classList.remove('show');
      _ultimaVersioneTrovata = null;
      try{ await controllaAggiornamentoAllAvvio(); }catch(_){ }
      await new Promise(r=>setTimeout(r, 120));
      return riq.classList.contains('mostra')
        ? ((_ultimaVersioneTrovata && _ultimaVersioneTrovata.nome) || '???')
        : null;
    };

    // ── 1. IL GUASTO DEL 07/09/2026 ────────────────────────────────────────
    // Un .html in radice che non e' il gioco. E' il caso vero.
    elenco = [ file('404.html') ];
    dice(await guarda() === null, 'la pagina 404 non viene scambiata per una versione',
      'e- il guasto del 07/09/2026: in radice c-era un solo .html e bastava\\n' +
      '        essere un .html per essere "l-ultima versione"');

    // E qualunque altra cosa possa finire in radice domani.
    elenco = [ file('index.html'), file('privacy.html'), file('404.html') ];
    dice(await guarda() === null, 'nessun file senza numero viene proposto');

    // ── 2. MA UNA VERSIONE VERA E PIU- NUOVA SI DEVE ANCORA VEDERE ─────────
    // Se questo passa a "niente", l'avviso e- morto e nessuno se ne accorge:
    // un controllo che tace sempre sembra un controllo che funziona.
    const su = mia.replace(/^v/i,'').split('.').map(Number);
    const piuNuova = 'Hextale_' + su[0] + '.' + su[1] + '.' + (su[2]+1) + '.html';
    const piuVecchia = 'Hextale_' + su[0] + '.' + su[1] + '.' + Math.max(0, su[2]-1) + '.html';
    elenco = [ file(piuNuova) ];
    dice(await guarda() === piuNuova, 'una versione piu- nuova viene ancora annunciata', piuNuova);

    // ── 3. E MAI UNA PIU- VECCHIA ──────────────────────────────────────────
    // Il confronto girava solo quando ENTRAMBI i nomi portavano un numero, e
    // all'indirizzo stabile il nome e' "index.html": su /play/ era spento.
    elenco = [ file(piuVecchia) ];
    dice(await guarda() === null, 'una versione piu- vecchia non viene mai proposta', piuVecchia);

    // Fra tante, la piu' alta — e per numero, non per ordine d'elenco.
    elenco = [ file(piuNuova), file('Hextale_0.1.1.html'), file('Hextale_9.9.9.html'), file('404.html') ];
    dice(await guarda() === 'Hextale_9.9.9.html', 'fra tante sceglie la piu- alta');

    // ── 4. E SE GITHUB NON RISPONDE, SILENZIO ──────────────────────────────
    window._githubJsonp = async () => ({ errore: 'GitHub ha risposto 403' });
    dice(await guarda() === null, 'GitHub muto: non si allarma nessuno');

    window._githubJsonp = veroJsonp;
    return dette;
  })()`);

  let male = 0;
  for (const d of dette) {
    console.log((d.ok ? '  ok  ' : '  NO  ') + d.che + (d.ok || !d.perche ? '' : '\n        ' + d.perche));
    if (!d.ok) male++;
  }
  console.log('\n' + dette.length + ' controlli, ' + male + ' storti');
  app.exit(male ? 1 : 0);
});
