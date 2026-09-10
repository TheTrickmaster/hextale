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
      const ultimoImp = imp.children[imp.children.length-1];
      const penultimoImp = imp.children[imp.children.length-2];
      dice(penultimoImp && penultimoImp.classList.contains('filters-riga'),
        'e prima di "Close" ce n-e- ancora una',
        (penultimoImp && penultimoImp.className) + ' -> ' + (ultimoImp && ultimoImp.className));

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
