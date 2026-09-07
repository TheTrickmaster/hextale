// IL CODICE A SEI CIFRE: LA SCHERMATA, E LE SEI CASELLE.
//
//     $ELECTRON strumenti/prova-codice.js [scatto.png]
//
// Si vede una volta sola per account, come "Pick a letter", e per la stessa
// ragione e' la piu' difficile da riprovare a mano: sbagliarla vuol dire
// sbagliarla per tutti quelli che si registreranno. Qui il server si finge, e
// si guarda cosa fa la schermata.
//
// Il pezzo piu' facile da rompere senza accorgersene sono le sei caselle. Non
// sono sei campi: sono UN campo diviso in sei, e la differenza si vede solo
// usandolo — si scrive e si va avanti, si cancella e si torna indietro, si
// incolla il codice preso dall'email e si riempiono tutte. Ognuna di queste e'
// una riga di codice che si puo' perdere in un rimaneggiamento, e nessuna di
// loro fa rumore quando sparisce.
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

  const dette = await win.webContents.executeJavaScript(`(async function(){ try{
    const dette = [];
    const dice = (ok, che, perche) => dette.push({ ok:!!ok, che:che, perche:perche||'' });
    const attendi = (ms)=>new Promise(r=>setTimeout(r,ms));
    const s=document.getElementById('splash'); if(s) s.remove();

    // ── IL SERVER, FINTO ───────────────────────────────────────────────────
    const chiesto = [];
    let vero = '013553';
    let verificato = false;
    let sbagli = 0;
    sessioneAccount = { token:'finto', userId:'u1', username:'Prova', email:'lorenzo@esempio.it' };
    window.nakamaRpc = async (nome, corpo)=>{
      chiesto.push(nome);
      if(nome === 'hx_verifica_stato') return { verificato: verificato, mai:false };
      if(nome === 'hx_verifica_invia'){ vero = '424242'; return { inviato:true, aspetta:60 }; }
      if(nome === 'hx_verifica_prova'){
        if(String(corpo.codice) !== vero){ sbagli++; throw new Error('codice sbagliato: ti restano ' + (8-sbagli) + ' tentativi'); }
        verificato = true; return { ok:true };
      }
      return {};
    };
    window.nakamaDimenticaSessione = ()=>{};

    // ── 1. LA SCHERMATA SI APRE ────────────────────────────────────────────
    showPage('start');
    await apriVerifica(sessioneAccount, { email:'lorenzo@esempio.it' });
    await attendi(500);
    const mod = document.getElementById('modulo-verifica');
    dice(!!mod && mod.classList.contains('mostra'), 'la schermata del codice si apre');
    dice((document.getElementById('verifica-dove')||{}).textContent === 'lorenzo@esempio.it',
      'e dice a quale casella e- stato mandato');
    const caselle = [...document.querySelectorAll('#verifica-codice .hx-codice-casella')];
    dice(caselle.length === 6, 'sei caselle', caselle.length + '');

    // ── 2. LE MISURE SONO QUELLE DEL DISEGNO ───────────────────────────────
    // Le stesse dell'email: chi arriva qui ha appena guardato quelle nella
    // posta, e riconoscerle e- il modo piu- corto di capire cosa gli si chiede.
    const c0 = caselle[0], st = getComputedStyle(c0);
    dice(Math.round(c0.offsetWidth) === 49 && Math.round(c0.offsetHeight) === 66,
      'larghe 49 e alte 66, come nel disegno',
      Math.round(c0.offsetWidth)+'x'+Math.round(c0.offsetHeight));
    dice(st.borderRadius === '16px', 'raggio 16', st.borderRadius);
    dice(st.fontSize === '40px', 'la cifra a 40', st.fontSize);
    dice(/^["']?Rosarivo/.test(st.fontFamily), 'in Rosarivo', st.fontFamily);
    dice(st.color === 'rgb(237, 224, 198)', 'colore EDE0C6', st.color);
    dice(getComputedStyle(document.getElementById('verifica-codice')).gap === '10px',
      'e dieci di distanza fra una e l-altra');
    // L'ombra e' INTERNA: la casella e' un incavo, non un rilievo.
    dice(st.boxShadow.indexOf('inset') >= 0, 'l-ombra e- interna', st.boxShadow);

    // ── 3. SEI CASELLE CHE SI COMPORTANO COME UN CAMPO SOLO ────────────────
    const scrivi = (i, ch)=>{ caselle[i].focus(); caselle[i].value = ch;
                              caselle[i].dispatchEvent(new Event('input', {bubbles:true})); };
    const tasto = (i, k)=>{ caselle[i].focus();
      caselle[i].dispatchEvent(new KeyboardEvent('keydown', {key:k, bubbles:true, cancelable:true})); };
    caselle.forEach(c=>c.value='');
    scrivi(0, '1');
    dice(document.activeElement === caselle[1], 'scrivendo una cifra il fuoco va avanti da solo');
    scrivi(1, 'x');
    dice(caselle[1].value === '', 'una lettera non entra', 'ho letto "' + caselle[1].value + '"');
    scrivi(1, '2');
    tasto(2, 'Backspace');
    dice(document.activeElement === caselle[1] && caselle[1].value === '',
      'cancellando in una casella vuota si torna indietro e si svuota quella prima');

    // ── 4. E IL CODICE INCOLLATO LE RIEMPIE TUTTE ──────────────────────────
    // Il codice arriva da una email, e da una email si copia: senza questo, sei
    // caselle sarebbero un modo di impedire l-unica cosa che si prova a fare.
    caselle.forEach(c=>c.value='');
    caselle[0].focus();
    const ev = new Event('paste', {bubbles:true, cancelable:true});
    ev.clipboardData = { getData: ()=>'013553' };
    caselle[0].dispatchEvent(ev);
    // Si legge SUBITO, prima di aspettare: alla sesta cifra la schermata prova
    // il codice da sola, e un codice giusto svuota le caselle. Aspettando, il
    // banco misurerebbe la pulizia che segue il successo e leggerebbe sei
    // caselle vuote — cioe' direbbe "non ha incollato" proprio quando ha
    // incollato e ha anche funzionato.
    const incollato = caselle.map(c=>c.value).join('');
    dice(incollato === '013553', 'incollando il codice si riempiono tutte e sei',
      'ho letto "' + incollato + '"');
    await attendi(400);
    // E arrivato a sei si prova da solo, senza premere niente.
    dice(chiesto.indexOf('hx_verifica_prova') >= 0, 'e alla sesta cifra si prova da solo');
    dice(verificato === true, 'il codice giusto verifica l-account');
    await attendi(600);
    dice(document.getElementById('modulo-login').classList.contains('mostra'),
      'e si torna alla schermata di accesso', 'E- quello che ha chiesto Lorenzo.');

    // ── 5. IL CODICE SBAGLIATO ─────────────────────────────────────────────
    verificato = false; vero = '999999';
    await apriVerifica(sessioneAccount, { email:'lorenzo@esempio.it' });
    await attendi(400);
    const caselle2 = [...document.querySelectorAll('#verifica-codice .hx-codice-casella')];
    caselle2.forEach((c,i)=>{ c.value = '11111 1'.charAt(i); });
    caselle2[5].value = '1';
    await completaRegistrazione(document.querySelector('#modulo-verifica .hx-btn:not(#verifica-rimanda)'));
    await attendi(300);
    const msg = document.getElementById('verifica-messaggio');
    dice(/tries left/.test(msg.textContent), 'un codice sbagliato dice quanti tentativi restano',
      'ho letto "' + msg.textContent + '"');
    dice(caselle2.map(c=>c.value).join('') === '', 'e le caselle si svuotano per riprovare');
    dice(document.getElementById('modulo-verifica').classList.contains('mostra'),
      'e si resta sulla schermata del codice');

    // ── 6. IL CODICE NUOVO ─────────────────────────────────────────────────
    await rimandaIlCodice(document.getElementById('verifica-rimanda'));
    await attendi(200);
    dice(chiesto.indexOf('hx_verifica_invia') >= 0, 'si puo- chiedere un codice nuovo');

    // ── 7. E CHI NON HA VERIFICATO NON ENTRA, TORNA QUI ────────────────────
    // E- la meta- che evita di lasciare gente incastrata: chi chiude la
    // finestra a meta- rientra e ritrova la domanda, non una porta chiusa.
    verificato = false;
    dice(await serveIlCodice() === true, 'un account non verificato viene riconosciuto');
    verificato = true;
    dice(await serveIlCodice() === false, 'e uno verificato passa');
    // Server muto: si lascia passare. Il prezzo dell-errore non e- lo stesso
    // nei due versi — chi ha fatto tutto giusto non deve restare chiuso fuori
    // perche- una lettura non e- andata a buon fine.
    window.nakamaRpc = async ()=>{ throw new Error('niente rete'); };
    dice(await serveIlCodice() === false, 'e se il server non risponde si lascia passare');

    // ── 8. LA CODA RIFIUTATA ───────────────────────────────────────────────
    // Il server da oggi rifiuta il biglietto a chi non ha verificato. Il ramo
    // che ascolta quel no non c'era, e la sua mancanza non sbagliava niente:
    // non faceva niente. La rotella restava a girare su una coda in cui non si
    // era entrati, per sempre, senza dire perche'.
    dice(typeof mmRifiutato === 'function', 'il gioco sa cosa fare se la coda lo rifiuta');
    let fermata = 0, avviso = null;
    const veroFerma = window.mm2FermaRicerca, veroAvviso = window.apriAvviso;
    window.mm2FermaRicerca = ()=>{ fermata++; };
    window.apriAvviso = (t, c)=>{ avviso = { titolo:t, corpo:c }; };
    mmRifiutato({ message: 'verifica la tua email prima di giocare in rete' });
    dice(fermata === 1, 'la ricerca si ferma', 'fermate: ' + fermata);
    dice(!!avviso && /Activate your account/.test(avviso.titolo),
      'e si dice che manca il codice, non un errore qualunque',
      avviso ? avviso.titolo : 'nessun avviso');
    dice(!!avviso && /6 digit code/.test(avviso.corpo), 'e si dice cosa fare per averlo');
    avviso = null;
    mmRifiutato({ message: 'qualcos altro' });
    dice(!!avviso && /Cannot search/.test(avviso.titolo),
      'e un rifiuto per un altro motivo si racconta come tale', avviso ? avviso.titolo : '?');
    window.mm2FermaRicerca = veroFerma; window.apriAvviso = veroAvviso;

    // ── 9. "FORGOT PASSWORD" ───────────────────────────────────────────────
    // Non passa da nakamaRpc: chi ha perso la password non ha una sessione, e
    // le due chiamate vanno alla porta pubblica che Caddy riscrive. Qui si
    // finge quella.
    const chieste = [];
    const veroFetch = window.fetch;
    let esitoFinto = { inviato:true };
    let rispostaOk = true;
    window.fetch = async (url, opz)=>{
      chieste.push({ url:String(url), corpo: JSON.parse((opz && opz.body) || '{}') });
      return { ok: rispostaOk, text: async ()=>JSON.stringify(esitoFinto) };
    };

    apriRecupero();
    await attendi(420);
    dice(document.getElementById('modulo-recupero').classList.contains('mostra'),
      '"Forgot password" apre il suo modulo');
    document.getElementById('login-user').value = 'lorenzo@esempio.it';
    apriRecupero();
    await attendi(420);
    dice(document.getElementById('recupero-email').value === 'lorenzo@esempio.it',
      'e si porta dietro l-indirizzo gia- scritto nell-accesso',
      'chi ha sbagliato la password l-ha appena battuto');

    await chiediCodiceRecupero(document.querySelector('#modulo-recupero .hx-btn'));
    await attendi(420);
    dice(chieste.length === 1 && chieste[0].url.endsWith('/recupero/chiedi'),
      'chiedendo il codice si bussa alla porta pubblica',
      chieste.length ? chieste[0].url : 'nessuna chiamata');
    dice(chieste.length && chieste[0].corpo.email === 'lorenzo@esempio.it', 'con l-indirizzo giusto');
    dice(document.getElementById('modulo-nuovapwd').classList.contains('mostra'),
      'e si passa alla schermata della password nuova');
    dice((document.getElementById('recupero-dove')||{}).textContent === 'lorenzo@esempio.it',
      'che dice a quale casella e- stato mandato');

    // Le sei caselle sono le stesse, e si comportano come la- dentro.
    const rc = [...document.querySelectorAll('#recupero-codice .hx-codice-casella')];
    dice(rc.length === 6, 'sei caselle anche qui', rc.length + '');
    const st2 = getComputedStyle(rc[0]);
    dice(Math.round(rc[0].offsetWidth) === 49 && st2.fontSize === '40px',
      'con le stesse misure del disegno');
    rc[0].focus(); rc[0].value = '4';
    rc[0].dispatchEvent(new Event('input', {bubbles:true}));
    dice(document.activeElement === rc[1], 'e lo stesso comportamento: il fuoco va avanti');
    // Alla sesta cifra NON si prova: manca ancora la password, e il fuoco
    // passa a lei.
    rc.forEach((c,i)=>{ c.value = '424242'.charAt(i); });
    rc[5].dispatchEvent(new Event('input', {bubbles:true}));
    await attendi(120);
    dice(document.activeElement === document.getElementById('recupero-pwd'),
      'e alla sesta cifra il fuoco passa alla password, non si prova niente',
      'nella verifica si prova da soli perche- non manca altro; qui manca la password');
    dice(chieste.length === 1, 'e infatti non e- partita nessuna chiamata');

    // I controlli prima di partire.
    document.getElementById('recupero-pwd').value = 'corta';
    document.getElementById('recupero-pwd2').value = 'corta';
    await cambiaLaPassword(document.querySelector('#modulo-nuovapwd .hx-btn:not(#recupero-rimanda)'));
    dice(/at least 8/.test(document.getElementById('nuovapwd-messaggio').textContent),
      'una password corta si ferma qui, senza un giro di rete');
    document.getElementById('recupero-pwd').value = 'PasswordLunga1';
    document.getElementById('recupero-pwd2').value = 'PasswordLunga2';
    await cambiaLaPassword(document.querySelector('#modulo-nuovapwd .hx-btn:not(#recupero-rimanda)'));
    dice(/do not match/.test(document.getElementById('nuovapwd-messaggio').textContent),
      'e due password diverse pure');
    dice(chieste.length === 1, 'e nessuna delle due ha bussato al server');

    // E il cambio vero.
    document.getElementById('recupero-pwd2').value = 'PasswordLunga1';
    esitoFinto = { ok:true };
    await cambiaLaPassword(document.querySelector('#modulo-nuovapwd .hx-btn:not(#recupero-rimanda)'));
    await attendi(420);
    dice(chieste.length === 2 && chieste[1].url.endsWith('/recupero/cambia'),
      'il cambio bussa alla seconda porta', chieste.length > 1 ? chieste[1].url : '?');
    dice(chieste.length > 1 && chieste[1].corpo.codice === '424242', 'col codice scritto');
    dice(document.getElementById('modulo-login').classList.contains('mostra'),
      'e si torna all-accesso');
    dice(document.getElementById('login-user').value === 'lorenzo@esempio.it',
      'con l-indirizzo gia- scritto: la cosa che si fa dopo aver cambiato una password e- entrare');
    dice(/password has been changed/i.test(document.getElementById('login-messaggio').textContent),
      'e lo si dice');

    window.fetch = veroFetch;

    return dette;
  }catch(e){ return [{ok:false, che:'la prova si e- rotta', perche:String((e && e.stack) || e)}]; } })()`);

  if (SCATTO) {
    await win.webContents.executeJavaScript(`(async function(){
      const st=document.createElement('style');
      st.textContent='.hx-modulo{transition:none!important}';
      document.head.appendChild(st);
      // La colonna dell'accesso nasce a opacita' zero e si accende quando il
      // caricamento finisce (.start-fade / .show). In una finestra nascosta
      // quel momento non arriva mai: la si accende a mano, o si fotograferebbe
      // la schermata di caricamento credendo di aver fotografato il codice.
      const col = document.getElementById('start-accesso');
      if(col) col.classList.add('show');
      const car = document.getElementById('loading-overlay') || document.querySelector('.loading-overlay');
      if(car) car.classList.remove('show');
      await apriVerifica(sessioneAccount, { email:'lorenzo@esempio.it' });
      await new Promise(r=>setTimeout(r,400));
      [...document.querySelectorAll('#verifica-codice .hx-codice-casella')]
        .forEach((c,i)=>{ c.value = '013553'.charAt(i); });
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
