// Il banco del pallino delle novita'.
//
//   $ELECTRON strumenti/prova-novita.js
//
// Il pallino accanto a "Library & decks" c'e' finche' resta una carta da
// guardare. Il difetto che questo banco esiste per non far tornare: la carta si
// accendeva, guardarla non la spegneva, e il pallino restava per sempre.
//
// LA CAUSA, ed e' il caso che si prova qui sotto. Nel gioco convivono DUE forme
// per nominare una carta: lo slug e l'id. _eCartaNuova le accetta tutte e due —
// giustamente, chi legge non deve sapere quale gli e' arrivata — ma
// _chiaveCartaNuova ne restituiva UNA sola, sempre lo slug. Basta che l'elenco
// conosca la carta per ID e che quella carta abbia anche uno slug, e le due si
// separano: una la trova, l'altra risponde con una chiave che nell'elenco non
// c'e', e chi doveva toglierla esce senza fare niente.
// Il banco costruisce esattamente quella situazione. E' un caso che non si
// riproduce guardando il codice di una funzione sola: si vede solo mettendo le
// due una accanto all'altra.
const { app, BrowserWindow } = require('electron');
const path = require('path');

const RADICE = 'file:///' + path.resolve(__dirname, '..').split(path.sep).join('/');
const PAGINA = RADICE + '/play/index.html';

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1600, height: 1000,
    webPreferences: { contextIsolation: false, webSecurity: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 4000));

  const dette = await win.webContents.executeJavaScript(`(function(){
    const dette = [];
    const dice = (ok, nome, extra)=> dette.push({ok:!!ok, nome:nome, extra:(extra===undefined?'':String(extra))});
    // Prepara la Collezione con tutte le carte possedute e UNA sola nuova,
    // segnata con la chiave chiesta. Torna la casella accesa.
    const prepara = (chiave)=>{
      const carte = (FINAL_CARDS||[]);
      CARTE_POSSEDUTE = {};
      carte.forEach(c => { CARTE_POSSEDUTE[c.slug] = 4; });
      _possessoNoto = true;
      carteNuoveDalServer([chiave]);
      showPage('mainmenu');
      try{ montaMenuPrincipale(); }catch(e){}
      aggiornaPallinoNovita();
      const pallino = !!document.querySelector('.mm2-pallino-novita');
      showPage('collection');
      const ov = document.getElementById('card-db-overlay');
      if(ov) ov.classList.add('show');
      cardDbRenderRoster();
      const casella = [...document.querySelectorAll('.card-db-card-slot')]
        .filter(s => s.classList.contains('carta-nuova'))[0];
      return { casella: casella, pallino: pallino };
    };
    // Il pallino vive nel MENU, e le pagine sono ermetiche: dalla Collezione
    // non e' nel documento, quindi cercarlo li- direbbe sempre 'non c-e-'.
    const tornaAlMenuEGuarda = ()=>{
      showPage('mainmenu');
      try{ montaMenuPrincipale(); }catch(e){}
      aggiornaPallinoNovita();
      return !!document.querySelector('.mm2-pallino-novita');
    };
    try{
      const sp = document.getElementById('splash'); if(sp) sp.remove();
      const carte = (FINAL_CARDS||[]);
      dice(carte.length > 0, 'ci sono carte con cui provare', carte.length);
      const bersaglio = carte[0];

      // ── CASO 1: l'elenco conosce la carta per SLUG ─────────────────────
      const slug = String(bersaglio.slug || '');
      dice(!!slug, 'la carta ha uno slug', slug);
      let r = prepara(slug);
      dice(!!r.casella, 'la carta risulta nuova');
      dice(r.pallino, 'e nel menu il pallino c-e-');
      r.casella.dispatchEvent(new PointerEvent('pointerenter', {bubbles:false}));
      dice(CARTE_NUOVE.size === 0, 'guardandola, esce dall-elenco', CARTE_NUOVE.size);
      dice(!tornaAlMenuEGuarda(), 'e nel menu il pallino si spegne');

      // ── CASO 2: l'elenco la conosce per ID, ma la carta ha anche uno slug ──
      // E' il difetto: _eCartaNuova la trovava per id e la accendeva,
      // _chiaveCartaNuova rispondeva lo slug, e chi doveva toglierla cercava
      // una chiave che nell'elenco non c'era.
      const id = String(bersaglio.id || '');
      dice(!!id, 'la stessa carta ha anche un id', id);
      dice(id !== slug, 'e le due forme sono diverse', id + ' contro ' + slug);
      r = prepara(id);
      dice(!!r.casella, 'segnata per ID, la carta risulta nuova lo stesso');
      dice(r.pallino, 'e nel menu il pallino c-e-');
      dice(r.casella && r.casella._chiaveNovita === id,
        'e la casella porta la chiave che l-elenco conosce, non l-altra',
        r.casella && r.casella._chiaveNovita);
      r.casella.dispatchEvent(new PointerEvent('pointerenter', {bubbles:false}));
      dice(CARTE_NUOVE.size === 0, 'guardandola, esce dall-elenco anche cosi-', CARTE_NUOVE.size);
      dice(!tornaAlMenuEGuarda(), 'e nel menu il pallino si spegne anche cosi-');
    }catch(e){
      dette.push({ok:false, nome:'PIANTATA', extra:(e && e.message) + ' @ ' + ((e && e.stack)||'').split('\\n')[1]});
    }
    return dette;
  })()`);

  let male = 0;
  for (const d of dette){
    if(!d.ok) male++;
    console.log((d.ok ? '  ok  ' : '  NO  ') + d.nome + (d.extra ? '   [' + d.extra + ']' : ''));
  }
  console.log('\n' + dette.length + ' controlli, ' + male + ' falliti');
  app.exit(male ? 1 : 0);
});
