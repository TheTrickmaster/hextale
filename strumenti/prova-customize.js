// LE DUE VOCI CHE HANNO TRASLOCATO DENTRO CUSTOMIZE.
//
//     $ELECTRON strumenti/prova-customize.js
//
// Dalla v0.79.76 "Play as" e "Show hexagon helper" non stanno piu' in mezzo ai
// cursori del volume: stanno dentro a Customize, sotto al nome del giocatore.
//
// Un trasloco di markup e' il genere di modifica che sembra riuscita perche' le
// due voci SI VEDONO nel posto nuovo. Quel che si rompe in silenzio e' tutto il
// resto:
//
//   - il VESTITO. La casella di spunta non ha un'immagine sua: la prende da due
//     variabili scritte sul pannello che la contiene, e quel pannello adesso e'
//     un altro. Una casella senza immagine e' un quadrato vuoto che sembra
//     "spento" anche quando e' acceso.
//   - le REGOLE DI STILE intestate al vecchio indirizzo. Erano scritte
//     #settings-pannello .settings-opzione: nel pannello nuovo non valgono, e
//     la riga perde la forma senza che nessuno lo dica.
//   - chi le PREPARA. La tendina la costruiva chi apriva le impostazioni. Se
//     nessuno la costruisce piu', si apre vuota — e una tendina vuota si scopre
//     solo cliccandoci.
//   - la TENDINA APERTA che finisce DIETRO a quel che ha sotto, cioe' dietro
//     alla casella e a "Delete account".
//
// E infine la cosa che Lorenzo ha chiesto per nome: l'avatar sta due dita sopra
// alla tendina, quindi scegliendo un colore lo si sta guardando. Se non cambia
// li' per li', cambia mentre nessuno guarda — che e' come non cambiare.
//
// v0.79.77 — l'esagono torna raggiungibile anche a meta' partita, e le caselle
// diventano DUE: quella di Customize e quella delle impostazioni, che si vede
// solo mentre si gioca. La preferenza resta una sola, e il difetto da cercare
// e' che una casella racconti lo stato di prima — a scoprirlo sarebbe chi apre
// la seconda e la trova al contrario. Il banco preme una per volta, da tutte e
// due le parti: un toggle che legge sempre la prima casella del documento
// passerebbe meta' della prova.
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
  await new Promise(r => setTimeout(r, 13000));

  const esito = await win.webContents.executeJavaScript(`(async function(){
    const d = [];
    const dice = (ok, che, perche) => d.push({ ok:!!ok, che, perche: perche||'' });
    const attendi = (ms)=>new Promise(r=>setTimeout(r,ms));
    const $ = (s)=>document.querySelector(s);
    try{
      ['splash','start-screen'].forEach(id=>{ const e=document.getElementById(id); if(e) e.style.display='none'; });

      // ── 1. DOVE SONO FINITE ───────────────────────────────────────────────
      const cust = document.getElementById('customize-pannello');
      const imp  = document.getElementById('settings-pannello');
      const tend = document.getElementById('fazione-dropdown');
      const casella = document.getElementById('hex-helper-check');
      dice(cust && tend && cust.contains(tend), '"Play as" sta dentro a Customize');
      dice(cust && casella && cust.contains(casella), 'e anche "Show hexagon helper"');
      dice(imp && tend && !imp.contains(tend) && !imp.contains(casella),
        'e nessuna delle due e- rimasta nelle impostazioni');

      // Sotto al nome, non sopra all-avatar: l-ordine e- quello chiesto.
      const dentro = Array.prototype.slice.call(cust.children);
      const iNome = dentro.indexOf(document.getElementById('customize-username'));
      const iTend = dentro.indexOf(tend);
      const iCas  = dentro.indexOf(casella.closest('.settings-opzione'));
      const iCanc = dentro.indexOf(document.getElementById('customize-elimina'));
      dice(iNome >= 0 && iNome < iTend && iTend < iCas && iCas < iCanc,
        'e l-ordine e- nome, fazione, esagono, cancella',
        'nome ' + iNome + ', fazione ' + iTend + ', esagono ' + iCas + ', cancella ' + iCanc);

      // ── 2. LE RIGHE DI SEPARAZIONE ────────────────────────────────────────
      // Una fra un gruppo e l-altro, e nessuna doppia: due righe attaccate sono
      // il segno che qualcosa se n-e- andato lasciando il suo separatore.
      const righeAttaccate = (pan)=>{
        const f = Array.prototype.slice.call(pan.children);
        for(let i=1;i<f.length;i++)
          if(f[i].classList.contains('filters-riga') && f[i-1].classList.contains('filters-riga')) return true;
        return false;
      };
      dice(!righeAttaccate(cust), 'dentro Customize non ci sono due righe attaccate');
      dice(!righeAttaccate(imp), 'e nemmeno nelle impostazioni',
        'Le due voci se ne sono andate portandosi via i propri separatori.');
      // Prima di "Close" ci vuole ancora una riga. Fra le due, dalla v0.79.77,
      // puo- esserci il gruppo dell-esagono, che dal menu e- fuori scena e che
      // la propria riga se la porta dentro: si guarda indietro saltando i
      // gruppi, o si direbbe "manca" per una riga che c-e- ma sta piu- su.
      const figliImp = Array.prototype.slice.call(imp.children);
      let j = figliImp.length - 2;
      while(j >= 0 && figliImp[j].classList.contains('settings-voci')) j--;
      dice(j >= 0 && figliImp[j].classList.contains('filters-riga'),
        'e prima di "Close" ce n-e- ancora una',
        figliImp.slice(Math.max(0,j)).map(e=>e.className.split(' ')[0]).join(' -> '));

      // ── 3. IL VESTITO ─────────────────────────────────────────────────────
      openSettingsModal('menu');
      await attendi(600);
      apriCustomize();
      await attendi(600);
      const st = getComputedStyle(cust);
      const off = st.getPropertyValue('--hx-casella-off').trim();
      const on  = st.getPropertyValue('--hx-casella-on').trim();
      dice(off && on && off !== 'none' && on !== 'none',
        'la casella ha le sue due facce anche nel pannello nuovo',
        'Senza, sarebbe un quadrato vuoto acceso o spento allo stesso modo.');
      const riga = casella.closest('.settings-opzione');
      const sr = getComputedStyle(riga);
      dice(sr.display === 'flex', 'e la riga dell-opzione ha ancora la sua forma',
        'display: ' + sr.display + ' — la regola non e- piu- intestata al vecchio pannello.');
      const freccia = tend.querySelector('.hx-dropdown-freccia');
      dice(freccia && freccia.getAttribute('src'), 'e la freccetta della tendina e- vestita');

      // ── 4. CHI LE PREPARA ─────────────────────────────────────────────────
      const valore = document.getElementById('fazione-dropdown-valore');
      dice(valore && valore.textContent.trim().length > 0,
        'la tendina si apre gia- sapendo cosa dire', '"' + (valore&&valore.textContent) + '"');
      dice(document.querySelectorAll('#fazione-dropdown-voci .hx-dropdown-voce').length === 3,
        'e con le sue tre voci dentro',
        'A costruirla adesso e- chi apre Customize, non chi apre le impostazioni.');
      dice(casella.checked === !!_aiutoEsagono,
        'e la casella dice quello che il gioco fa davvero',
        'casella ' + casella.checked + ', gioco ' + !!_aiutoEsagono);

      // ── 5. LA TENDINA APERTA STA SOPRA ────────────────────────────────────
      apriChiudiTendinaFazione(null);
      await attendi(200);
      const voci = document.getElementById('fazione-dropdown-voci');
      const r = voci.getBoundingClientRect();
      dice(r.width > 0 && r.height > 0, 'la tendina aperta si vede',
        Math.round(r.width) + 'x' + Math.round(r.height));
      // Il punto sotto la testa della tendina: chi risponde li- e- chi sta sopra.
      const sopra = document.elementFromPoint(Math.round(r.left + r.width/2), Math.round(r.top + 12));
      dice(sopra && voci.contains(sopra),
        'e sta SOPRA alla casella e a "Delete account"',
        'in quel punto risponde: ' + (sopra ? (sopra.className || sopra.tagName) : 'nessuno'));
      chiudiTendinaFazione();
      await attendi(150);

      // ── 6. L-AVATAR CAMBIA MENTRE LO SI GUARDA ────────────────────────────
      // E- la cosa chiesta per nome. La faccia dell-avatar dipende dalla
      // fazione (vedi mostraAvatarSu, che chiede fazioneUmano): scegliendo un
      // colore, l-immagine due dita piu- su deve cambiare da sola.
      const foto = $('#customize-avatar .player-avatar-photo');
      const prima = preferenzaFazione();
      // Un avatar ci vuole: senza account MIO_AVATAR e- vuoto, e due immagini
      // vuote sarebbero "uguali" per il motivo sbagliato. Fox e- l-avatar che
      // il server da- a chi comincia, e ha le sue due facce sul disco.
      MIO_AVATAR = 'fox';
      dice((avatarCandidati('fox','dark')[0]||'') !== (avatarCandidati('fox','light')[0]||''),
        'un avatar ha due facce, una per fazione',
        'Se non fosse cosi- il controllo qui sotto passerebbe sempre.');
      scegliPreferenzaFazione('dark');
      await attendi(700);
      const scuro = foto.getAttribute('src') || '';
      scegliPreferenzaFazione('light');
      await attendi(700);
      const chiaro = foto.getAttribute('src') || '';
      dice(scuro && chiaro && scuro !== chiaro,
        'cambiando fazione l-avatar di Customize cambia subito',
        'scuro: ' + scuro.split('/').pop() + String.fromCharCode(10) +
        '        chiaro: ' + chiaro.split('/').pop());
      dice(document.getElementById('fazione-dropdown-valore').textContent.trim() === 'Light',
        'e la tendina dice quello che si e- appena scelto');
      // Random non e- una faccia: quella che si vede resta l-ultima uscita.
      scegliPreferenzaFazione('random');
      await attendi(700);
      dice((foto.getAttribute('src')||'') === chiaro,
        'e con "Random" la faccia resta l-ultima uscita',
        'Random non e- un colore: e- il modo in cui si decide quale sara-.');
      scegliPreferenzaFazione(prima);
      await attendi(300);

      chiudiCustomize();
      await attendi(400);
      closeSettingsModal();
      await attendi(300);

      // ── 7. L-ESAGONO SI RAGGIUNGE ANCHE DA META- PARTITA ──────────────────
      // v0.79.77. Alla v0.79.76 era traslocato dentro Customize, e Customize
      // dal tavolo non si raggiunge: chi voleva spegnerlo mentre giocava non
      // poteva piu-. Adesso le caselle sono due e la preferenza resta UNA.
      const caselle = document.querySelectorAll('.hex-helper-check');
      dice(caselle.length === 2, 'le caselle dell-esagono sono due', caselle.length + '');
      const inCust = document.getElementById('customize-pannello');
      const inImp = document.getElementById('settings-esagono');
      // Senza dare per scontato l-ordine: nel documento le impostazioni vengono
      // PRIMA di Customize, e un banco che conta sull-ordine dice "sbagliato"
      // per un motivo che non riguarda nessuno.
      const quanteIn = (padre)=>Array.prototype.filter.call(caselle, c=>padre && padre.contains(c)).length;
      dice(quanteIn(inCust) === 1 && quanteIn(inImp) === 1,
        'una in Customize e una nelle impostazioni',
        'Customize ' + quanteIn(inCust) + ', impostazioni ' + quanteIn(inImp));
      dice(inImp && inImp.getAttribute('data-quando') === 'partita',
        'e quella delle impostazioni si vede SOLO in partita',
        'Nel menu c-e- gia- quella di Customize, e due caselle a un passo\\n' +
        '        l-una dall-altra sono due modi di fare la stessa cosa.');

      // Nel menu la seconda resta fuori scena; in partita entra.
      openSettingsModal('menu');
      await attendi(400);
      dice(!inImp.classList.contains('mostra'), 'dal menu la seconda non c-e-');
      closeSettingsModal();
      await attendi(300);
      openSettingsModal('partita');
      await attendi(400);
      dice(inImp.classList.contains('mostra'), 'e a meta- partita c-e-');
      // Le righe attaccate: il gruppo si porta dietro la propria, o dal menu ne
      // resterebbero due appiccicate sopra a "Close".
      const figli = Array.prototype.slice.call(document.getElementById('settings-pannello').children);
      let doppie = false;
      for(let i=1;i<figli.length;i++){
        if(figli[i].classList.contains('filters-riga') && figli[i-1].classList.contains('filters-riga')) doppie = true;
      }
      dice(!doppie, 'e nessuna riga di separazione resta doppia');

      // La preferenza e- una: chi ne muove una muove anche l-altra.
      const eraAcceso = !!_aiutoEsagono;
      const daPartita = Array.prototype.filter.call(caselle, c=>inImp.contains(c))[0];
      const daCustomize = Array.prototype.filter.call(caselle, c=>inCust.contains(c))[0];
      daPartita.checked = !eraAcceso;
      toggleAiutoEsagono(daPartita);
      await attendi(200);
      dice(_aiutoEsagono === !eraAcceso, 'premendo quella in partita la preferenza cambia',
        'era ' + eraAcceso + ', adesso ' + _aiutoEsagono);
      dice(daCustomize.checked === _aiutoEsagono,
        'e anche la casella di Customize lo sa gia-',
        'Una sola verita- scritta su tutte le facce: chi apre l-altra non la\\n' +
        '        deve trovare al contrario.');
      // E dall-altra parte funziona uguale — e- il controllo che smaschera un
      // toggle che legge sempre la prima casella del documento.
      daCustomize.checked = eraAcceso;
      toggleAiutoEsagono(daCustomize);
      await attendi(200);
      dice(_aiutoEsagono === eraAcceso && daPartita.checked === eraAcceso,
        'e premendo quella di Customize succede lo stesso',
        'adesso ' + _aiutoEsagono + ', quella in partita dice ' + daPartita.checked);
      closeSettingsModal();
      await attendi(300);

      // ── 8. LA FINESTRA DEGLI AVATAR STA NELLO SCHERMO ─────────────────────
      // v0.79.80. Era troppo alta, e il perche- e- il difetto da non rifare: il
      // tetto stava sulla GRIGLIA (64vh) e l-altezza della finestra era quel
      // numero piu- la barra del titolo, piu- il pulsante, piu- i bordi. Un
      // totale che nessuno aveva scritto, e che infatti arrivava in fondo allo
      // schermo. Adesso il numero sta dove si misura.
      //
      // Senza carte in mano la griglia e- vuota e la finestra sta comoda: si
      // riempie di gente, o si proverebbe il caso che non ha mai dato problemi.
      const _carteVere = window.carteDelGiocatore;
      const finte = [];
      for(const n of ['alice','aladdin','ant','baba-yaga','bagheera','baloo','banshee',
                      'basilisk','big-bad-wolf','carabosse','centaur','cheshire-cat',
                      'chimera','cinderella','crow','cyclop','dragon','dorothy-gale',
                      'ali-baba','catoblepas','chupacabra','cockatrice','captain-hook',
                      'cowardly-lion','badr-al-budur','dark-strigoi','12-dancing-princesses'])
        finte.push({ slug:n, name:n.replace(/-/g,' ') });
      window.carteDelGiocatore = ()=>finte;
      try{
        openSettingsModal('menu');
        await attendi(400);
        apriCustomize();
        await attendi(400);
        apriSceltaAvatar();
        await attendi(2500);
        const scatola = document.getElementById('avatar-box');
        const griglia = document.getElementById('avatar-griglia');
        const alto = scatola.getBoundingClientRect().height;
        const tetto = window.innerHeight * 0.8;
        dice(alto <= tetto + 1, 'la finestra degli avatar sta in otto decimi di schermo',
          Math.round(alto) + ' contro un tetto di ' + Math.round(tetto) +
          ' su uno schermo da ' + window.innerHeight);
        // Quattro per riga: si contano quelli che stanno alla stessa altezza,
        // non le colonne dichiarate nel CSS. E- la stessa differenza di sempre
        // fra cio- che e- scritto e cio- che si vede.
        const perRiga = {};
        griglia.querySelectorAll('.avatar-scelta').forEach(e=>{
          const y = Math.round(e.getBoundingClientRect().top);
          perRiga[y] = (perRiga[y] || 0) + 1;
        });
        const righe = Object.keys(perRiga).map(k=>perRiga[k]);
        dice(righe.length > 1 && righe.slice(0,-1).every(v=>v===4),
          'e ne mette quattro per riga', righe.join(','));
        // La misura si prende dallo STILE CALCOLATO e non dal rettangolo sullo
        // schermo: il gioco scala tutta la scena per stare nella finestra, e a
        // 1400 di larghezza un avatar da 240 ne misura 173. Quel numero dice
        // quanto e- grande la finestra del banco, non quanto e- grande
        // l-avatar — e cambierebbe da solo cambiando le misure qui sopra.
        const primo = griglia.querySelector('.avatar-scelta');
        const largo = primo ? Math.round(parseFloat(getComputedStyle(primo).width)) : 0;
        dice(largo === 240, 'gli avatar sono larghi 240 (erano 300)',
          largo + 'px in CSS, ' + (primo ? Math.round(primo.getBoundingClientRect().width) : 0) +
          ' sullo schermo di questo banco (la scena e- scalata).');
        // E a stringersi e- la griglia, che e- l-unico pezzo che puo- farlo
        // senza perdere niente: scorre gia-.
        dice(griglia.scrollHeight > griglia.clientHeight,
          'e a stringersi e- la griglia, che scorre',
          'contenuto ' + griglia.scrollHeight + ' dentro ' + griglia.clientHeight +
          '.\\n        Se a cedere fosse il pannello, il tetto della finestra non varrebbe.');
        chiudiSceltaAvatar();
        await attendi(300);
        chiudiCustomize();
        await attendi(300);
        closeSettingsModal();
      } finally {
        if(_carteVere) window.carteDelGiocatore = _carteVere;
      }
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
