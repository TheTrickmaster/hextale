// "MATCH FOUND!" — DIECI SECONDI PER DIRE DI SI'.
//
//     $ELECTRON strumenti/prova-trovato.js [foto.png]
//
// Prima, trovato l'avversario, si entrava in partita da soli. Adesso i due si
// devono dire di si' tutti e due, e questo splash e' l'unico posto in cui la
// partita puo' non cominciare senza che sia successo niente di male.
//
// Le cose che si rompono in silenzio:
//
//   I PERSONAGGI CHE ESCONO DAI LATI. Possono uscire solo dal bordo alto
//     (nel disegno il cappello del pirata sta sopra al riquadro). Lati e
//     fondo li taglia il palco che li contiene, non il riquadro: se un domani
//     qualcuno toglie il palco o il suo overflow, le figure tornano a
//     sbordare e nessun errore lo dice.
//   IL SUONO CHE ARRIVA PRIMA DI CIO' CHE ANNUNCIA. Suonava all'accoppiamento;
//     adesso deve suonare quando lo splash si vede.
//   I DUE VOLTI. Prima di accettare: Accept e Decline. Dopo: la scritta
//     d'attesa al posto di Accept, e il rosso che diventa "Cancel match". Se
//     "Accept" restasse premibile dopo aver accettato, si manderebbe un
//     secondo match_join.
//   LA BARRA CHE NON SCENDE, o che scende dalla parte sbagliata. Scorre a
//     ritroso: piena all'inizio, vuota alla scadenza.
//   IL PULSANTE DELLA RICERCA che dice il cronometro e il comando insieme.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';
const SCATTO = process.argv[2] || '';

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, frame: false,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  win.webContents.on('console-message', (...args) => {
    const a0 = args[0];
    const msg = (a0 && typeof a0 === 'object' && a0.message !== undefined) ? a0.message : args[2];
    if (String(msg).indexOf('[passo] ') === 0) console.log('  ..   ' + String(msg).slice(8));
  });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 14000));

  const esito = await win.webContents.executeJavaScript(`(async function(){
    const d = [];
    const dice = (ok, che, perche) => { console.log('[passo] ' + che); d.push({ ok:!!ok, che, perche: perche||'' }); };
    const attendi = (ms)=>new Promise(r=>setTimeout(r,ms));
    const _corpo = (async function(){
    try{
      ['splash','start-screen'].forEach(id=>{ const e=document.getElementById(id); if(e) e.style.display='none'; });

      // Il menu principale deve essere in scena: le pagine sono ermetiche, e
      // dal tavolo il pulsante della ricerca non e- nel documento. Un banco
      // che non lo trova direbbe "manca" per il motivo sbagliato.
      showPage('mainmenu');
      await attendi(600);
      // Una sessione finta: chi rifiuta lo dice al server solo se e- entrato,
      // e senza questa riga quel pezzo non verrebbe mai provato.
      // Si assegna la VARIABILE e non window.sessioneAccount: e- dichiarata
      // nel copione della pagina, e scrivere sulla finestra crea una seconda
      // cosa con lo stesso nome che il codice non guarda mai.
      if(!sessioneAccount || !sessioneAccount.token) sessioneAccount = { token: 'finto' };

      // Nessun server: si zittiscono le due strade che ci parlano, o lo splash
      // proverebbe a entrare in una partita che non c'e-.
      const mandati = [];
      window.mmManda = (m)=>{ mandati.push(m); };
      const rpc = [];
      window.nakamaRpc = (nome, corpo)=>{ rpc.push({nome, corpo}); return Promise.resolve({}); };
      const suoni = [];
      const veroSfx = window.playSfxFile;
      window.playSfxFile = function(f){ suoni.push(f); };

      // ── 1. I PEZZI ────────────────────────────────────────────────────────
      const ov = document.getElementById('trovato-overlay');
      dice(!!ov, 'lo splash esiste');
      for(const id of ['trovato-cornice','trovato-palco','trovato-hook','trovato-lrrh','trovato-velo',
                       'trovato-titolo','trovato-accetta','trovato-attesa','trovato-rifiuta',
                       'trovato-timer','trovato-timer-mask','trovato-timer-pin']){
        if(!document.getElementById(id)) dice(false, 'manca il pezzo #' + id);
      }

      // ── 2. SI APRE, E IL SUONO ARRIVA CON LUI ─────────────────────────────
      suoni.length = 0;
      apriTrovato('match-finto-1');
      await attendi(1200);
      dice(ov.classList.contains('show'), 'si apre quando si trova un avversario');
      dice(suoni.filter(s=>/match-found/.test(s)).length === 1,
        'e il suono arriva insieme a lui, una volta sola',
        suoni.join(', ') + '.\\n        Prima suonava all-accoppiamento, cioe- prima di cio- che annuncia.');
      dice(mandati.length === 0, 'e NON si entra in partita da soli',
        'Prima si entrava. Adesso accettare e- entrare, e nessuno ha ancora accettato.');

      // ── 3. IL RIQUADRO E I DUE PERSONAGGI ─────────────────────────────────
      const k = document.getElementById('trovato-cornice');
      const sk = getComputedStyle(k);
      dice(Math.round(parseFloat(sk.width)) === 650 && Math.round(parseFloat(sk.height)) === 400,
        'il riquadro e- 650x400',
        Math.round(parseFloat(sk.width)) + 'x' + Math.round(parseFloat(sk.height)));
      dice(sk.overflow === 'visible', 'il riquadro lascia libero il bordo alto',
        'overflow: ' + sk.overflow + ' - lati e fondo li taglia il palco dei personaggi, non il riquadro.');
      // v0.79.86 — lati e fondo mascherati, bordo alto libero.
      const palco = document.getElementById('trovato-palco');
      const sp = getComputedStyle(palco);
      const pr = palco.getBoundingClientRect();
      const kr0 = k.getBoundingClientRect();
      dice(!!palco && sp.overflow === 'hidden', 'il palco dei personaggi ritaglia', 'overflow: ' + sp.overflow);
      dice(Math.abs(pr.left - kr0.left) < 1 && Math.abs(pr.right - kr0.right) < 1 && Math.abs(pr.bottom - kr0.bottom) < 1,
        'e i suoi lati e il suo fondo sono quelli del riquadro',
        'sinistra ' + Math.round(pr.left - kr0.left) + ', destra ' + Math.round(pr.right - kr0.right) + ', fondo ' + Math.round(pr.bottom - kr0.bottom));
      dice(palco.contains(document.getElementById('trovato-hook')) && palco.contains(document.getElementById('trovato-lrrh')),
        'e dentro ci sono tutti e due i personaggi');
      dice(sp.borderBottomLeftRadius === '28px' && sp.borderBottomRightRadius === '28px',
        'e il taglio in basso segue gli angoli arrotondati', sp.borderBottomLeftRadius + ' / ' + sp.borderBottomRightRadius);
      const hr0 = document.getElementById('trovato-hook').getBoundingClientRect();
      dice(pr.top < hr0.top - hr0.height * 0.05,
        'e sopra lascia spazio a tutto l-uncino, battito compreso',
        Math.round(hr0.top - pr.top) + ' pixel di margine sopra al cappello');
      // Le figure sono ancora piu- larghe del riquadro: e- il palco a
      // nasconderne i lati. Se non lo fossero, questo controllo non
      // proverebbe niente.
      dice(hr0.left < pr.left, 'e l-uncino sborderebbe a sinistra, se il palco non lo tagliasse',
        Math.round(pr.left - hr0.left) + ' pixel tagliati');
      const kr = k.getBoundingClientRect();
      const scala = kr.width / parseFloat(sk.width);
      for(const [id, nome] of [['trovato-hook','hook'],['trovato-lrrh','lrrh']]){
        const r = document.getElementById(id).getBoundingClientRect();
        dice(r.bottom <= kr.bottom + 1, nome + ' non sbuca da sotto',
          Math.round((r.bottom - kr.bottom)/scala) + 'px oltre il bordo basso (deve essere <= 0)');
        dice(r.top < kr.top, 'e sbuca da sopra, come nel disegno',
          Math.round((kr.top - r.top)/scala) + 'px sopra il bordo');
      }
      // Il gradiente sta SOPRA ai due e SOTTO al testo.
      const zv = +getComputedStyle(document.getElementById('trovato-velo')).zIndex;
      const za = +getComputedStyle(document.getElementById('trovato-hook')).zIndex;
      const zt = +getComputedStyle(document.getElementById('trovato-dentro')).zIndex;
      dice(za < zv && zv < zt, 'il gradiente copre i personaggi e sta sotto al testo',
        'personaggi ' + za + ' < gradiente ' + zv + ' < testo ' + zt);
      const velo = getComputedStyle(document.getElementById('trovato-velo')).backgroundImage;
      dice(/15%/.test(velo) && /70%/.test(velo) && /30,\\s*36,\\s*35/.test(velo),
        'e va dal 15% al 70% partendo dal basso', velo.slice(0, 110));

      // ── 3b. LE CORREZIONI DI LORENZO (v0.79.85) ──────────────────────────
      const hook = document.getElementById('trovato-hook');
      const lrrh = document.getElementById('trovato-lrrh');
      dice(getComputedStyle(hook).left === '-30px' && getComputedStyle(lrrh).right === '-30px',
        'i due stanno centoventi pixel piu- vicini al centro',
        'uncino a ' + getComputedStyle(hook).left + ', Cappuccetto a ' + getComputedStyle(lrrh).right);
      dice(Math.round(parseFloat(getComputedStyle(hook).height)) === 530,
        'l-uncino e- alto 530', getComputedStyle(hook).height);
      dice(Math.round(parseFloat(getComputedStyle(lrrh).height)) === 430,
        'e Cappuccetto 430', getComputedStyle(lrrh).height);
      // Si ASPETTA la classe invece di contare un tempo fisso. Nella finestra
      // fuori schermo del banco il primo fotogramma arriva dopo un secondo e
      // mezzo e le transizioni non finiscono mai: il lampo parte dalla rete di
      // sicurezza, verso i due secondi e mezzo. Un attesa fissa da novecento
      // diceva "non arriva" per il motivo sbagliato.
      for(let i = 0; i < 40 && !ov.classList.contains('arrivati'); i++) await attendi(100);
      dice(ov.classList.contains('arrivati'), 'finita la corsa, arrivano il lampo e il battito',
        'La classe parte a transizione finita, o allo scadere della rete di sicurezza.');
      dice(getComputedStyle(hook).animationName === 'trovatoArrivo',
        'e il battito e- un-animazione sola, sulla proprieta- scale',
        getComputedStyle(hook).animationName + ', ' + getComputedStyle(hook).animationIterationCount + ' volta');

      // Il fondo del timer e- slider-bar-bg tagliato in tre, e i tappi hanno la
      // proporzione dell-immagine: larghi quanto meta- dell-altezza.
      const binario = document.getElementById('trovato-timer-bg');
      const sb = getComputedStyle(binario);
      dice(sb.borderImageSource.indexOf('slider-bar-bg') >= 0, 'il fondo del timer e- slider-bar-bg',
        sb.borderImageSource.slice(0, 90));
      dice(sb.borderImageSource.indexOf('timer-bg') < 0 && binario.tagName !== 'IMG',
        'e non e- piu- timer-bg steso come immagine');
      const imgBinario = new Image();
      imgBinario.src = uiFileCandidati('slider-bar-bg.png')[0];
      for(let i = 0; i < 30 && !imgBinario.naturalHeight; i++) await attendi(100);
      const tappo = parseFloat(String(sb.borderImageWidth).split(' ')[1] || sb.borderImageWidth);
      const alto = parseFloat(sb.height);
      const taglio = parseFloat(String(sb.borderImageSlice).split(' ')[1] || sb.borderImageSlice);
      dice(imgBinario.naturalHeight > 0 && Math.abs(tappo / alto - taglio / imgBinario.naturalHeight) < 0.01,
        'e i tappi non sono schiacciati',
        'tappo ' + tappo + ' su ' + alto + ' di altezza, nell-immagine ' + taglio + ' su ' + imgBinario.naturalHeight + ': stessa proporzione.');
      dice(sb.borderImageRepeat.indexOf('round') >= 0, 'e il tratto di mezzo si ripete invece di allungarsi',
        sb.borderImageRepeat);
      const riemp = document.getElementById('trovato-timer-fill');
      for(let i = 0; i < 30 && !riemp.naturalWidth; i++) await attendi(100);
      const sr = getComputedStyle(riemp);
      dice(riemp.naturalWidth > 0 && Math.abs(parseFloat(sr.width) / parseFloat(sr.height) - riemp.naturalWidth / riemp.naturalHeight) < 0.5,
        'e il riempimento e- alla sua proporzione vera',
        sr.width + ' x ' + sr.height + ', immagine ' + riemp.naturalWidth + ' x ' + riemp.naturalHeight);

      // I pulsanti trenta pixel piu- in basso: si toglie lo spostamento e si
      // misura quanto risalgono. Il rosso ha lo zoom, e trenta scritti li- ne
      // diventerebbero ventuno: il banco guarda lo schermo, non il foglio.
      const scende = (el)=>{
        const a = el.getBoundingClientRect().top;
        const prima = el.style.top;
        el.style.top = '0px';
        const b = el.getBoundingClientRect().top;
        el.style.top = prima;
        return Math.round((a - b) / scala);
      };
      const sAcc = scende(document.getElementById('trovato-accetta'));
      const sRif = scende(document.getElementById('trovato-rifiuta'));
      dice(Math.abs(sAcc - 30) <= 1 && Math.abs(sRif - 30) <= 1,
        'i due pulsanti stanno trenta pixel piu- in basso, tutti e due',
        'Accept ' + sAcc + ', Decline ' + sRif + ' pixel sullo schermo.');

      // ── 4. PRIMA DI RISPONDERE ────────────────────────────────────────────
      const acc = document.getElementById('trovato-accetta');
      const att = document.getElementById('trovato-attesa');
      const rif = document.getElementById('trovato-rifiuta');
      const et = (b)=>b.querySelector('.hxb-label').textContent.trim();
      dice(getComputedStyle(acc).display !== 'none' && getComputedStyle(att).display === 'none',
        'si vede "Accept", non l-attesa');
      dice(et(rif) === 'Decline', 'e il rosso dice "Decline"', et(rif));
      dice(rif.classList.contains('hx-btn-opaco'), 'ed e- opaco');
      // Il rosso e- piu- piccolo del grigio: dire di no non deve costare quanto
      // dire di si-.
      // Si misura QUEL CHE SI VEDE e non lo stile calcolato: il rosso e-
      // rimpicciolito con zoom, e lo stile calcolato continua a dire la misura
      // di prima. Direbbe "uguali" e avrebbe torto — la stessa lezione degli
      // avatar, da un-altra porta.
      const wa = acc.getBoundingClientRect().width, wr = rif.getBoundingClientRect().width;
      dice(wr < wa * 0.85, 'e il "no" e- piu- piccolo del "si-"',
        Math.round(wr) + ' contro ' + Math.round(wa) + ' — il ' + Math.round(wr/wa*100) + '%.'
        + '\\n        Rimpicciolito in tutte le direzioni, non schiacciato in una sola.');
      const ha = acc.getBoundingClientRect().height, hr = rif.getBoundingClientRect().height;
      dice(hr < ha * 0.85 && hr > ha * 0.5, 'e lo e- anche in altezza, nella stessa misura',
        Math.round(hr) + ' contro ' + Math.round(ha) + ' — il ' + Math.round(hr/ha*100) + '%.');

      // ── 5. LA BARRA SCORRE A RITROSO ──────────────────────────────────────
      const mask = document.getElementById('trovato-timer-mask');
      const largo = ()=>mask.getBoundingClientRect().width;
      const prima = largo();
      await attendi(2500);
      const dopo = largo();
      dice(dopo < prima - 2, 'la barra scorre a ritroso',
        Math.round(prima) + ' -> ' + Math.round(dopo) + ' pixel'
        + ' (larghezza scritta: "' + (mask.style.width || 'nessuna') + '").'
        + '\\n        Se la larghezza scritta e- vuota, il browser ha rifiutato il valore'
        + '\\n        e la barra e- rimasta quella del foglio: piena e ferma.');

      // ── 6. ACCETTARE E- ENTRARE ───────────────────────────────────────────
      mandati.length = 0;
      trovatoAccetta();
      await attendi(400);
      dice(mandati.length === 1 && mandati[0].match_join
           && mandati[0].match_join.match_id === 'match-finto-1',
        'accettare vuol dire ENTRARE in partita',
        JSON.stringify(mandati[0] || null) +
        '.\\n        Non c-e- un messaggio di "accetto": la partita comincia quando il\\n' +
        '        server vede dentro tutti e due.');
      dice(getComputedStyle(acc).display === 'none' && getComputedStyle(att).display !== 'none',
        'e "Accept" lascia il posto all-attesa',
        'Se restasse premibile si manderebbe un secondo match_join.');
      dice(att.textContent.indexOf('Waiting for your opponent') >= 0,
        'che dice cosa si sta aspettando', att.textContent.trim());
      dice(Math.round(parseFloat(getComputedStyle(att).width)) === 360,
        'ed e- larga 360', Math.round(parseFloat(getComputedStyle(att).width)) + 'px');
      dice(et(rif) === 'Cancel match' && !rif.classList.contains('hx-btn-opaco'),
        'e il rosso diventa "Cancel match", trasparente', et(rif));
      mandati.length = 0;
      trovatoAccetta();
      await attendi(200);
      dice(mandati.length === 0, 'e premerlo due volte non entra due volte');

      // ── 7. RIFIUTARE ──────────────────────────────────────────────────────
      rpc.length = 0;
      trovatoRifiuta();
      await attendi(500);
      dice(!ov.classList.contains('show'), 'rifiutando lo splash si chiude');
      dice(rpc.filter(r=>r.nome === 'hx_rifiuta').length === 1,
        'e il server lo sa subito',
        'Senza, l-altro resterebbe dieci secondi davanti a "Waiting for your\\n' +
        '        opponent..." con la risposta gia- arrivata.');
      dice(rpc[0] && rpc[0].corpo && rpc[0].corpo.matchId === 'match-finto-1',
        'e sa di quale partita', JSON.stringify(rpc[0] && rpc[0].corpo));

      // ── 7b. SE L-ALTRO DICE DI NO, QUI SI CHIUDE SUBITO (v0.79.85) ───────
      // Il caso che si vedeva rotto: l-altro rifiuta e io non ho ancora premuto
      // niente. Non sono dentro alla partita, quindi la notizia arriva come
      // NOTIFICA sul socket.
      const avvisi = [];
      const veroAvviso = window.apriAvviso;
      window.apriAvviso = function(){ avvisi.push([].slice.call(arguments)); };
      let cerche = 0;
      const veraCerca = window.mm2CercaAvversario;
      window.mm2CercaAvversario = function(){ cerche++; };
      apriTrovato('m-altro');
      await attendi(400);
      trovatoNotifiche({ notifications: [ { code: 101, content: JSON.stringify({ matchId: 'm-altro' }) } ] });
      await attendi(100);
      dice(!ov.classList.contains('show'), 'se l-altro rifiuta, qui lo splash si chiude subito',
        'Anche senza aver premuto niente.');
      // Chi era gia- entrato la riceve due volte: dalla partita e come notifica.
      trovatoNotifiche({ notifications: [ { code: 101, content: JSON.stringify({ matchId: 'm-altro' }) } ] });
      try{ reteMessaggio({ op_code: 13, data: '' }); }catch(_){ }
      await attendi(1000);
      dice(cerche === 1, 'e si torna in cerca, una volta sola',
        cerche + ' ricerche ripartite: ripartire due volte vorrebbe dire due code.');
      dice(avvisi.length === 0, 'e non compare nessun errore',
        avvisi.map(a => a[0]).join(', ') || 'nessun avviso');
      // Una notifica rimasta indietro da un accoppiamento di prima non chiude
      // quello nuovo.
      apriTrovato('m-nuovo');
      await attendi(300);
      trovatoNotifiche({ notifications: [ { code: 101, content: JSON.stringify({ matchId: 'm-vecchio' }) } ] });
      await attendi(150);
      dice(ov.classList.contains('show'), 'e una notifica di una partita di prima non chiude quella nuova');
      trovatoChiudi();
      // Il caso sul filo: premo Accept mentre l-altro rifiuta, e il server
      // risponde che il tavolo non c-e- piu-.
      apriTrovato('m-filo');
      await attendi(300);
      trovatoAccetta();
      mmErroreDalSocket({ cid: 'j-filo', error: { code: 4, message: 'Match not found' } });
      await attendi(1000);
      dice(!ov.classList.contains('show') && avvisi.length === 0,
        'e premendo Accept su un tavolo appena chiuso, nessun errore',
        avvisi.map(a => a[0]).join(', ') || 'nessun avviso');
      dice(cerche === 2, 'ma di nuovo in cerca', cerche + ' ricerche in tutto');
      // Un errore vero, fuori dallo splash, deve vedersi ancora: zittirli tutti
      // sarebbe il difetto opposto.
      mmErroreDalSocket({ cid: 'x1', error: { message: 'guasto vero' } });
      await attendi(200);
      dice(avvisi.length === 1, 'mentre un errore vero, fuori dallo splash, si vede ancora',
        avvisi.map(a => a[0]).join(', ') || 'nessun avviso');
      window.apriAvviso = veroAvviso;
      window.mm2CercaAvversario = veraCerca;

      // ── 7c. LE CORREZIONI DELLA v0.79.87 ───────────────────────────────
      // Il rosso: un pulsante intero, delle sue misure e della sua famiglia.
      const pezziRosso = ()=>[...document.querySelectorAll('#trovato-rifiuta .hxb-strip > span')];
      const famiglie = ()=>pezziRosso().map(p => getComputedStyle(p).backgroundImage);
      apriTrovato('m-rosso');
      for(let i = 0; i < 30 && famiglie().some(f => f === 'none'); i++) await attendi(100);
      await attendi(300);
      const rossoEl = document.getElementById('trovato-rifiuta');
      dice(getComputedStyle(rossoEl).zoom === '1' || getComputedStyle(rossoEl).zoom === '',
        'il rosso non e- piu- rimpicciolito con lo zoom', 'zoom: ' + getComputedStyle(rossoEl).zoom);
      dice(getComputedStyle(document.querySelector('#trovato-rifiuta .hxb-fill')).backgroundSize === '1px 100%',
        'e il suo riempitivo prende tessere larghe un pixel intero',
        getComputedStyle(document.querySelector('#trovato-rifiuta .hxb-fill')).backgroundSize + ' - sotto il pixel il browser mescola i toni e compaiono le strisce.');
      const tuttiOpachi = famiglie().every(f => f.indexOf('button-opaque-') >= 0 && f.indexOf('-warning') >= 0);
      dice(pezziRosso().length === 5 && tuttiOpachi, 'Decline e- fatto di cinque pezzi, tutti della famiglia rossa opaca',
        famiglie().map(f => (f.match(/button-[a-z]+-[a-z]+/) || ['?'])[0]).join(', '));
      trovatoMostraAttesa();
      for(let i = 0; i < 30 && famiglie().some(f => f.indexOf('button-transparent-') < 0); i++) await attendi(100);
      const tuttiTrasparenti = famiglie().every(f => f.indexOf('button-transparent-') >= 0 && f.indexOf('-warning') >= 0);
      dice(tuttiTrasparenti, 'e Cancel match e- fatto di cinque pezzi, tutti della famiglia rossa trasparente',
        famiglie().map(f => (f.match(/button-[a-z]+-[a-z]+/) || ['?'])[0]).join(', '));
      trovatoMostraScelta();
      for(let i = 0; i < 30 && famiglie().some(f => f.indexOf('button-opaque-') < 0); i++) await attendi(100);
      dice(famiglie().every(f => f.indexOf('button-opaque-') >= 0),
        'e tornando alla scelta, di nuovo tutti opachi', 'Vestito prima del cambio, restava coi pezzi dell-altra famiglia.');
      trovatoChiudi();

      // Chi non ha accettato in tempo non rientra, mai.
      let rientri = 0;
      const veraCerca2 = window.mm2CercaAvversario;
      window.mm2CercaAvversario = function(){ rientri++; };
      apriTrovato('m-scaduta');
      await attendi(200);
      trovatoNotifiche({ notifications: [ { code: 101, content: JSON.stringify({ matchId: 'm-scaduta', torna: false }) } ] });
      await attendi(900);
      dice(!ov.classList.contains('show') && rientri === 0,
        'se il server dice di non tornare, lo splash si chiude e non si rientra in coda',
        rientri + ' rientri. Nessuno dei due aveva accettato: nessuno dei due rientra.');
      apriTrovato('m-filo-tempo');
      await attendi(200);
      _trovatoFine = Date.now() - 1;
      trovatoNotifiche({ notifications: [ { code: 101, content: JSON.stringify({ matchId: 'm-filo-tempo' }) } ] });
      await attendi(900);
      dice(rientri === 0, 'e chi ha il tempo finito senza aver accettato non rientra nemmeno se la notizia arriva senza verdetto',
        'La rete di sicurezza dalla parte del client.');
      apriTrovato('m-accettata');
      await attendi(200);
      trovatoAccetta();
      _trovatoFine = Date.now() - 1;
      trovatoNotifiche({ notifications: [ { code: 101, content: JSON.stringify({ matchId: 'm-accettata', torna: true }) } ] });
      await attendi(900);
      dice(rientri === 1, 'mentre chi aveva accettato torna in cerca, anche a tempo finito', rientri + ' rientri');
      window.mm2CercaAvversario = veraCerca2;

      // Le schede VS escono proseguendo nella direzione da cui sono entrate.
      // Gli spostamenti si leggono dalle REGOLE e non dallo schermo: la scena
      // sta in display:none finche- non e- in partita, e un elemento senza
      // scatola non ha una trasformazione da leggere.
      const regola = (sel)=>{
        for(const foglio of [...document.styleSheets]){
          let regole = [];
          try{ regole = [...foglio.cssRules]; }catch(_){ continue; }
          for(const r of regole) if(r.selectorText === sel && r.style && r.style.transform) return r.style.transform;
        }
        return '';
      };
      // Il numero di pixel dopo il -50%: con segno, zero se non c-e-.
      const scarto = (tr)=>{
        const s = String(tr).split(' ').join('');
        const i = s.indexOf('%');
        if(i < 0) return NaN;
        const segno = s.charAt(i + 1);
        if(segno !== '+' && segno !== '-') return 0;
        return (segno === '-' ? -1 : 1) * parseFloat(s.slice(i + 2));
      };
      const vsParte = { sx: scarto(regola('.vs-scheda-sx')), dx: scarto(regola('.vs-scheda-dx')) };
      const vsSta = scarto(regola('.vs-scheda.dentro'));
      const vsVa = { sx: scarto(regola('.vs-scheda-sx.via')), dx: scarto(regola('.vs-scheda-dx.via')) };
      const verso = (a, b)=>Math.sign(b - a);
      dice(verso(vsParte.sx, vsSta) === 1 && verso(vsSta, vsVa.sx) === 1,
        'la scheda di sinistra entra scendendo ed esce continuando a scendere',
        'parte ' + vsParte.sx + ', sta ' + vsSta + ', va ' + vsVa.sx + ' pixel');
      dice(verso(vsParte.dx, vsSta) === -1 && verso(vsSta, vsVa.dx) === -1,
        'e quella di destra entra salendo ed esce continuando a salire',
        'parte ' + vsParte.dx + ', sta ' + vsSta + ', va ' + vsVa.dx + ' pixel');

      // Il pallino della Libreria conta solo le carte che la Libreria mostra.
      const pallino = ()=>!!document.querySelector('#mm2-sc-library .hx-btn .mm2-pallino-novita');
      // Prima di tutto il pulsante deve esserci: senza, aggiornaPallinoNovita
      // esce subito e ogni controllo in negativo passerebbe a vuoto.
      dice(!!document.querySelector('#mm2-sc-library .hx-btn'), 'il pulsante Library and decks e- in scena');
      // Senza un account l-elenco della Libreria e- vuoto: se ne mette uno
      // finto, con una carta che si vede. La regola provata e- che il pallino
      // conta QUELL-elenco, qualunque cosa ci sia dentro.
      const nuovePrima = CARTE_NUOVE;
      const veroElenco = window.carteDelGiocatore;
      const vista = { slug: 'carta-finta-in-libreria', id: 'final-carta-finta-in-libreria', name: 'Finta', dropRate: 10 };
      window.carteDelGiocatore = function(){ return [vista]; };
      CARTE_NUOVE = new Set(['carta-che-in-libreria-non-c-e']);
      aggiornaPallinoNovita();
      dice(!pallino(), 'una carta nuova che la Libreria non mostra non accende il pallino',
        'Non c-e- modo di guardarla, quindi non si spegnerebbe mai.');
      const evocata = { slug: 'excalibur-finta', dropRate: 0 };
      dice(soloEvocabile(evocata) && String(carteGiocabili).indexOf('soloEvocabile') >= 0,
        'la Libreria esclude per regola le carte a drop rate zero',
        'carteGiocabili filtra con soloEvocabile: e- la stessa regola di mazzi e bustine.');
      CARTE_NUOVE = new Set([evocata.slug]);
      aggiornaPallinoNovita();
      dice(!pallino(), 'e una di quelle, anche se il server la manda come nuova, non accende il pallino');
      CARTE_NUOVE = new Set([vista.slug]);
      aggiornaPallinoNovita();
      dice(pallino(), 'mentre una carta nuova che si vede lo accende', vista.name);
      CARTE_NUOVE = new Set([vista.id]);
      aggiornaPallinoNovita();
      dice(pallino(), 'anche se il server la conosce per id invece che per slug', vista.id);
      window.carteDelGiocatore = veroElenco;
      CARTE_NUOVE = nuovePrima;
      aggiornaPallinoNovita();

      // Tutti e due accettano: lo splash svanisce e il suo orologio si ferma.
      dice(String(reteMessaggio).indexOf('trovatoEsciPerPartita') >= 0,
        'l-avvio della partita chiude lo splash', 'Prima non lo chiudeva nessuno e restava sopra alla partita.');
      rpc.length = 0;
      apriTrovato('m-cominciata');
      // Si aspetta che le figure siano entrate: qui il primo fotogramma arriva
      // dopo un secondo e mezzo, e senza questa attesa lo splash si chiuderebbe
      // prima che ci sia qualcosa da tenere fermo.
      for(let i = 0; i < 40 && !ov.classList.contains('attori'); i++) await attendi(100);
      trovatoAccetta();
      trovatoEsciPerPartita();
      dice(!ov.classList.contains('show'), 'quando la partita comincia lo splash se ne va');
      dice(getComputedStyle(ov).transitionDuration.indexOf('0.15s') >= 0,
        'in dissolvenza, come ogni finestra del gioco', getComputedStyle(ov).transitionDuration);
      dice(ov.classList.contains('attori'), 'e le figure restano ferme mentre svanisce',
        'Tolte subito, tornerebbero indietro durante la dissolvenza.');
      _trovatoFine = Date.now() - 1;
      await attendi(700);
      dice(rpc.filter(r => r.nome === 'hx_rifiuta').length === 0,
        'e il suo orologio non fa scattare nessun rifiuto a partita cominciata',
        'Scattando, avrebbe chiuso il socket: il giocatore staccato dalla partita in corso.');
      dice(!ov.classList.contains('attori'), 'e a dissolvenza finita le animazioni interne si spengono');

      // ── 8. IL PULSANTE DELLA RICERCA ──────────────────────────────────────
      // I secondi finche- non ci passi sopra, "Cancel" sotto al dito. Prima
      // diceva tutte e due le cose insieme, e il cronometro si leggeva come
      // parte del comando.
      _mm2Cercando = true;
      mmAvviaCronometro();
      await attendi(300);
      const lab = document.querySelector('#mm2-find .hxb-label');
      dice(/^\\(\\d+s\\)$/.test(lab.textContent.trim()), 'il pulsante della ricerca dice i secondi',
        '"' + lab.textContent.trim() + '"');
      document.getElementById('mm2-find').dispatchEvent(new MouseEvent('mouseenter'));
      await attendi(150);
      dice(lab.textContent.trim() === 'Cancel', 'e sotto al dito dice "Cancel"',
        '"' + lab.textContent.trim() + '" — subito, non al tic dopo.');
      document.getElementById('mm2-find').dispatchEvent(new MouseEvent('mouseleave'));
      await attendi(150);
      dice(/^\\(\\d+s\\)$/.test(lab.textContent.trim()), 'e tolto il dito torna il cronometro',
        '"' + lab.textContent.trim() + '"');
      _mm2Cercando = false;
      mmFermaCronometro();
      window.playSfxFile = veroSfx;
      return { d };
    }catch(e){ return { guasto:(e&&e.message)+' '+String((e&&e.stack)||'').split(String.fromCharCode(10))[1], d }; }
    })();
    const _guardia = new Promise(r=>setTimeout(()=>r({ d, scaduto:true }), 120000));
    return await Promise.race([_corpo, _guardia]);
  })()`);

  if (esito && esito.scaduto) {
    const fatti = esito.d || [];
    console.error('IL BANCO NON HA FINITO IN DUE MINUTI. Ultimo controllo: '
      + (fatti.length ? fatti[fatti.length-1].che : 'nessuno'));
    app.exit(1); return;
  }
  if (esito.guasto) {
    console.error('GUASTO: ' + esito.guasto);
    for (const x of (esito.d||[])) console.log((x.ok?'  ok   ':'  NO   ') + x.che);
    app.exit(1); return;
  }

  if (SCATTO) {
    await win.webContents.insertCSS('#splash,#patch-notes-overlay{display:none!important}');
    win.setPosition(-3200, 0); win.showInactive();
    const foto = async (nome, prima) => {
      await win.webContents.executeJavaScript(prima);
      await new Promise(r => setTimeout(r, 2400));
      const b = await win.webContents.executeJavaScript(`(function(){
        const k=document.getElementById('trovato-cornice').getBoundingClientRect();
        const h=document.getElementById('trovato-hook').getBoundingClientRect();
        const l=document.getElementById('trovato-lrrh').getBoundingClientRect();
        const x=Math.max(0,Math.round(k.left)-40);
        const y=Math.max(0,Math.round(Math.min(k.top,h.top,l.top))-14);
        return { x, y, width:Math.round(k.right-x)+40,
                 height:Math.round(k.bottom-y)+14, vw: window.innerWidth };
      })()`);
      // Si fotografa la finestra INTERA e si ritaglia dopo, in pixel
      // dell'immagine. capturePage con un rettangolo lavora nelle unita' della
      // finestra, e se la finestra spostata fuori schermo finisce su un monitor
      // con un'altra scala il ritaglio cade altrove: e' successo, le foto
      // mostravano un pezzo di menu accanto al riquadro invece del riquadro.
      const intera = await win.webContents.capturePage();
      const dim = intera.getSize();
      const s = dim.width / b.vw;
      const rx = Math.max(0, Math.round(b.x * s)), ry = Math.max(0, Math.round(b.y * s));
      const ritaglio = intera.crop({ x: rx, y: ry,
        width: Math.min(Math.round(b.width * s), dim.width - rx),
        height: Math.min(Math.round(b.height * s), dim.height - ry) });
      fs.writeFileSync(SCATTO.replace(/\.png$/, '-' + nome + '.png'), ritaglio.toPNG());
      console.log('scritto ' + nome);
    };
    await foto('scelta', `(async function(){ apriTrovato('foto'); 1 })()`);
    await foto('attesa', `(function(){ trovatoMostraAttesa(); 1 })()`);
    await win.webContents.executeJavaScript(`trovatoChiudi(); 1`);
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
