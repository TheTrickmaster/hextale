// I LIVELLI DELLE CARTE, A SCHERMO.
//
//     $ELECTRON strumenti/prova-livelli.js [foto.png]
//
// Le regole le prova prova-livelli-server.js. Qui si guarda cio' che il
// giocatore vede, e le cose che si rompono in silenzio sono queste:
//
//   LA BARRA A TACCHE. Mostra il tratto verso il prossimo livello, non le copie
//     totali: al livello 1 due tacche, al 2 tre, al 3 quattro. Una barra che
//     conta dall'inizio sembra giusta e dice un numero sbagliato.
//   IL NASTRO "Lv up". Solo sulle carte pronte, a destra, alla stessa altezza
//     di "New" e sporgente di due pixel.
//   IL RIQUADRO SOTTO ALLA CARTA APERTA. Solo in Libreria; largo quanto la
//     finestra; il pulsante spento finche' le copie non bastano, via del tutto
//     al massimo ("MAX").
//   LA SALITA. Passa per le sue fasi in ordine, il lampo arriva durante il
//     secondo giro, i pezzi cambiano uno per volta, e alla fine "Level N!", i
//     bonus e la barra dicono i numeri NUOVI.
//   IL CARTELLINO DELLO SBUSTO. "Owned" o il nastro New! che sporge di due
//     pixel, il livello a destra, e la tacca che si riempie tenendo la carta.
//   IN RETE. Le carte dell'avversario al LORO livello, carta per carta.
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
    const st = (el)=>getComputedStyle(el);
    const _corpo = (async function(){
    try{
      ['splash','start-screen'].forEach(id=>{ const e=document.getElementById(id); if(e) e.style.display='none'; });
      if(!sessioneAccount || !sessioneAccount.token) sessioneAccount = { token: 'finto' };
      TUTORIAL_VISTI = { principale:1, pacchetti:1, libreria:1 };
      window.playSfxFile = function(){};
      const rpc = [];
      let rispostaLivello = null;
      window.nakamaRpc = (nome, corpo)=>{ rpc.push({nome, corpo}); return Promise.resolve(nome === 'hx_carta_livella' ? rispostaLivello : {}); };

      // ── IL MONDO ──────────────────────────────────────────────────────────
      // Quattro carte possedute (senza server il catalogo ne ha quattro), e una
      // voce finta per quella che non si ha. b e- l-unica pronta a salire.
      //   a: livello 1, 1 copia   -> 1 tacca su 2
      //   b: livello 1, 2 copie   -> pronta
      //   c: livello 2, 4 copie   -> 2 tacche su 3
      //   d: livello 4, 9 copie   -> MAX
      const buone = (FINAL_CARDS||[]).filter(e => e && e.slug && !soloEvocabile(e) && !e.soloAdmin);
      const sceltaSlug = [];
      for(const e of buone){ if(sceltaSlug.indexOf(e.slug) < 0) sceltaSlug.push(e.slug); if(sceltaSlug.length >= 4) break; }
      dice(sceltaSlug.length === 4, 'nel catalogo ci sono quattro carte da usare', sceltaSlug.join(', '));
      const voce = s => buone.find(e => e.slug === s);
      const [A, B, C, D] = sceltaSlug.map(voce);
      const N = { id: 'finta', slug: 'carta-che-non-si-ha', rarity: 'common' };
      GIOCATORE_ADMIN = false;
      // Senza server il possesso non e- mai 'noto', e la Libreria resta vuota.
      _possessoNoto = true;
      CARTE_POSSEDUTE = {}; CARTE_POSSEDUTE[A.slug] = 1; CARTE_POSSEDUTE[B.slug] = 1; CARTE_POSSEDUTE[C.slug] = 2; CARTE_POSSEDUTE[D.slug] = 4;
      CARTE_COPIE = {}; CARTE_COPIE[A.slug] = 1; CARTE_COPIE[B.slug] = 2; CARTE_COPIE[C.slug] = 4; CARTE_COPIE[D.slug] = 9;

      // ── 0. I SUONI ────────────────────────────────────────────────────────
      // v0.79.95 — playSfxFile suona solo cio- che e- stato registrato (in
      // SUONI_SFX_EXTRA, in AUDIO_DATA_URLS o fra i SUONI_EXTRA delle voci). Un
      // nome che non c-e- resta muto con un avviso in console, e leggendo il
      // codice sembra tutto a posto: e- successo ai fuochi della salita.
      const copione = [...document.scripts].map(s => s.text).join(' ');
      const suonati = new Set();
      let da = 0;
      while((da = copione.indexOf("playSfxFile('", da)) >= 0){
        da += 13;
        suonati.add(copione.slice(da, copione.indexOf("'", da)).split('.')[0]);
      }
      const registrati = new Set([].concat(
        SUONI_SFX_EXTRA.map(n => String(n).split('.')[0]),
        Object.keys(AUDIO_DATA_URLS),
        (typeof SUONI_EXTRA !== 'undefined' ? SUONI_EXTRA : []).map(n => String(n).split('.')[0])));
      const muti = [...suonati].filter(n => !registrati.has(n));
      dice(suonati.size > 10 && muti.length === 0, 'ogni suono che il gioco chiama e- registrato, e quindi si sente',
        muti.length ? 'muti: ' + muti.join(', ') : suonati.size + ' suoni, tutti registrati');
      dice(['fireworks', 'score', 'card-flip', 'quest-collected', 'kaching'].every(n => registrati.has(n)), 'compresi quelli della salita di livello');

      // ── 1. A CHE PUNTO E- UNA CARTA ───────────────────────────────────────
      const sa = statoLivelloCarta(A), sb = statoLivelloCarta(B), sc = statoLivelloCarta(C), sd = statoLivelloCarta(D), sn = statoLivelloCarta(N);
      dice(sa.livello === 1 && sa.segmenti === 2 && sa.pieni === 1 && !sa.pronto && sa.mancano === 1,
        'livello 1 con una copia: una tacca su due', JSON.stringify(sa));
      dice(sb.segmenti === 2 && sb.pieni === 2 && sb.pronto, 'con due copie e- pronta', JSON.stringify(sb));
      dice(sc.livello === 2 && sc.segmenti === 3 && sc.pieni === 2 && sc.mancano === 1,
        'livello 2 con quattro copie: due tacche su tre', 'La barra conta il tratto verso il 3 (da 2 a 5 copie), non le copie totali.');
      dice(sd.max && !sd.pronto, 'al livello 4 e- al massimo', JSON.stringify(sd));
      dice(sn.livello === 1 && sn.pieni === 0 && sn.segmenti === 2 && !sn.pronto, 'una carta che non si ha: livello 1, nessuna tacca', JSON.stringify(sn));
      const tab = LIVELLI_CARTE_REGOLE.inchiostro[String(B.rarity).toLowerCase()];
      dice(sb.costo === tab[2], 'e salire costa quello della tabella per la sua rarita-', B.rarity + ': ' + sb.costo);

      // ── 2. IL NASTRO IN LIBRERIA ──────────────────────────────────────────
      openCardDbOverlay();
      await attendi(1200);
      // La griglia si e- costruita col possesso di prima: si rifa- con quello del banco.
      cardDbRenderRoster();
      await attendi(900);
      dice(_activePage === 'collection', 'la Libreria e- aperta', String(_activePage));
      const slotDi = e => document.querySelector('.card-db-card-slot[data-entry-id="' + e.id + '"]');
      const sB = slotDi(B);
      dice(!!sB, 'la carta pronta e- in griglia', [...document.querySelectorAll('.card-db-card-slot')].map(x => x.dataset.entryId || '(senza id)').join(', '));
      const nastri = [...document.querySelectorAll('.card-db-card-slot .lvup-nastro')];
      dice(nastri.length === 1 && sB && sB.contains(nastri[0]), 'il nastro Lv up c-e- solo sulla carta pronta',
        nastri.length + ' nastri');
      if(nastri[0]){
        const sn0 = st(nastri[0]);
        dice(sn0.right === '-2px' && sn0.top === '65px' && sn0.height === '40px',
          'a destra, sporgente di due pixel, alto quaranta', 'right ' + sn0.right + ', top ' + sn0.top + ', height ' + sn0.height);
        dice(/lv-up-banner\\.png/.test(nastri[0].src || ''), 'ed e- lv-up-banner.png', nastri[0].src);
      }
      const regole = [].concat.apply([], [].slice.call(document.styleSheets).map(function(s){ try{ return [].slice.call(s.cssRules); }catch(_){ return []; } }));
      const rNew = regole.filter(r => r.selectorText === '.card-db-card-slot .nuova-nastro')[0];
      dice(rNew && rNew.style.top === '65px' && rNew.style.height === '40px', 'alla stessa altezza del nastro New', rNew && (rNew.style.top + ' / ' + rNew.style.height));

      // ── 3. IL RIQUADRO SOTTO ALLA CARTA APERTA ────────────────────────────
      const striscia = document.getElementById('card-modal-livello');
      const sali = document.getElementById('card-modal-sali');
      const apri = async (e) => { closeCardModal(); await attendi(200); const s = slotDi(e); if(s) s.click(); await attendi(700); };
      MENU_GIOCATORE.magicInk = 5000;
      await apri(B);
      dice(document.getElementById('card-modal-overlay').classList.contains('show'), 'cliccando la carta si apre la finestra');
      dice(!striscia.hidden && st(striscia).display === 'flex', 'e sotto c-e- il riquadro del livello', 'hidden ' + striscia.hidden + ', display ' + st(striscia).display);
      const m = document.getElementById('card-modal');
      dice(Math.abs(striscia.offsetWidth - m.offsetWidth) <= 1, 'largo quanto la finestra', striscia.offsetWidth + ' contro ' + m.offsetWidth);
      dice(st(document.getElementById('card-modal-overlay')).rowGap === '16px', 'a sedici pixel da lei e dal Close', st(document.getElementById('card-modal-overlay')).rowGap);
      dice(st(striscia).paddingLeft === '30px' && st(striscia).columnGap === '40px', 'col padding 30 e 40 fra barra e pulsante', st(striscia).paddingLeft + ' / ' + st(striscia).columnGap);
      dice(striscia.querySelector('.cml-liv').textContent === 'Level 1' && striscia.querySelector('.cml-testo').textContent === 'Ready to level up!',
        'pronta: Level 1 e Ready to level up!', striscia.querySelector('.cml-liv').textContent + ' / ' + striscia.querySelector('.cml-testo').textContent);
      dice(striscia.querySelectorAll('.lv-seg').length === 2 && striscia.querySelectorAll('.lv-seg.pieno').length === 2, 'con le due tacche piene');
      dice(!sali.disabled && st(sali).display !== 'none', 'e il pulsante acceso');
      dice(sali.querySelector('.cml-costo').textContent === String(sb.costo), 'che dice il prezzo', sali.querySelector('.hxb-label').textContent.trim());
      dice(st(sali).width === '355px', 'largo 355', st(sali).width);
      const lvScheda = document.querySelector('#card-modal-info .cm-lv-val');
      dice(lvScheda && lvScheda.textContent === 'Level 1' && st(lvScheda).fontSize === '22px', 'e nella scheda la riga dice solo Level 1', lvScheda && lvScheda.textContent);
      dice(!document.querySelector('#card-modal-info .cm-livello.hx-campo'), 'e non e- piu- una casella');
      const rTesto = st(striscia.querySelector('.cml-testo'));
      dice(rTesto.fontSize === '20px' && rTesto.color === 'rgb(181, 197, 199)', 'il testo delle copie e- Rosarivo 20 in B5C5C7', rTesto.fontSize + ' ' + rTesto.color);
      await apri(A);
      dice(striscia.querySelector('.cml-testo').textContent === '1 more for level up' && sali.disabled,
        'non pronta: 1 more for level up, e il pulsante spento', striscia.querySelector('.cml-testo').textContent + ', disabled ' + sali.disabled);
      await apri(C);
      dice(striscia.querySelector('.cml-liv').textContent === 'Level 2' && striscia.querySelectorAll('.lv-seg').length === 3 && striscia.querySelectorAll('.lv-seg.pieno').length === 2,
        'al livello 2: tre tacche, due piene');
      await apri(D);
      dice(striscia.querySelector('.cml-testo').textContent === 'MAX' && st(sali).display === 'none' && !!striscia.querySelector('.lv-max'),
        'al massimo: MAX, niente pulsante, una barra sola', striscia.querySelector('.cml-testo').textContent + ', display ' + st(sali).display);
      closeCardModal();
      // In partita il riquadro non c-e-.
      const paginaVera = _activePage;
      _activePage = 'game';
      openCardModal(_makeCardDbCard(B, 1), 0);
      await attendi(300);
      dice(striscia.hidden, 'in partita il riquadro non c-e-');
      closeCardModal();
      _activePage = paginaVera;

      // ── 4. SENZA INCHIOSTRO ───────────────────────────────────────────────
      MENU_GIOCATORE.magicInk = 0;
      await apri(B);
      rpc.length = 0;
      sali.click();
      await attendi(400);
      dice(document.getElementById('avviso-overlay').classList.contains('show') && rpc.length === 0,
        'senza inchiostro lo dice, e non chiede niente al server', document.getElementById('avviso-titolo').textContent);
      chiudiAvviso();
      await attendi(300);

      // ── 5. LA SALITA ──────────────────────────────────────────────────────
      MENU_GIOCATORE.magicInk = 5000;
      const posDopo = Object.assign({}, CARTE_POSSEDUTE); posDopo[B.slug] = 2;
      rispostaLivello = { slug: B.slug, da: 1, livello: 2, speso: sb.costo,
        valute: { magicInk: 5000 - sb.costo, fairyDust: 0 }, possedute: posDopo, copie: Object.assign({}, CARTE_COPIE) };
      await apri(B);
      rpc.length = 0;
      const suoniS = [], tempiScore = [];
      window.playSfxFile = function(f){ suoniS.push(f); if(f === 'score.mp3') tempiScore.push(performance.now()); };
      // v0.79.94 — i pezzi erano cloni della carta nuova, e i loro url(#id)
      // finivano sulle maschere della carta di riferimento, nascosta: il clone
      // veniva ritagliato via tutto e i numeri cambiavano solo alla fine. Il
      // banco contava suoni e fasi e non se n-era accorto. Adesso guarda ogni
      // riferimento per id dentro ai pezzi: deve esistere una volta sola, e
      // dentro allo stesso pezzo.
      const verificaId = () => {
        const svgPezzi = [...document.querySelectorAll('#livello-carta .lvc-cambio svg')];
        let rif = 0, rotti = [];
        for(const s of svgPezzi){
          s.querySelectorAll('*').forEach(el => {
            for(const a of el.attributes){
              const v = a.value.split('"').join('').split("'").join('');
              const i = v.indexOf('url(#');
              if(i < 0) continue;
              const id = v.slice(i + 5, v.indexOf(')', i));
              rif++;
              const tutti = document.querySelectorAll('[id="' + id + '"]');
              if(tutti.length !== 1 || !s.contains(tutti[0])) rotti.push(id + ' x' + tutti.length);
            }
          });
        }
        const r = document.querySelector('#livello-carta svg.lvc-riferimento');
        return { pezzi: svgPezzi.length, rif, rotti, riferimento: r ? getComputedStyle(r).visibility : 'assente' };
      };
      let controlloId = null;
      sali.click();
      const ov = document.getElementById('livello-overlay');
      const fasi = [];
      let lampoInFase = '';
      const t0 = Date.now();
      while(Date.now() - t0 < 20000){
        const f = ov.dataset.fase || '';
        if(f && fasi[fasi.length-1] !== f) fasi.push(f);
        if(ov.dataset.lampo && !lampoInFase) lampoInFase = ov.dataset.lampo;
        if(f === 'cambi' && !controlloId) controlloId = verificaId();
        if(f === 'fine') break;
        await attendi(40);
      }
      dice(rpc.length === 1 && rpc[0].nome === 'hx_carta_livella' && rpc[0].corpo.slug === B.slug,
        'il pulsante chiede al server di far salire QUELLA carta', JSON.stringify(rpc));
      dice(!document.getElementById('card-modal-overlay').classList.contains('show'), 'e la finestra della carta si chiude');
      dice(fasi.join(' > ') === 'arrivo > giro > cambi > finestra > fine', 'la salita passa per le sue fasi in ordine, con un giro solo', fasi.join(' > '));
      // L-angolo e non la fase: in una finestra nascosta i fotogrammi arrivano radi, e il
      // banco puo- leggere il lampo quando la fase e- gia- quella dopo.
      const angolo = parseInt(lampoInFase, 10);
      dice(angolo >= 180 && angolo <= 360, 'il lampo arriva a meta- giro, col dorso', 'a ' + lampoInFase + ' gradi');
      const conta = n => suoniS.filter(f => f === n).length;
      dice(conta('card-flip.mp3') === 1, 'un giro, un fruscio', suoniS.join(', '));
      dice(conta('fireworks.mp3') === 1 && conta('card-ding.mp3') === 0, 'i fuochi suonano fireworks.mp3, una volta', suoniS.join(', '));
      dice(conta('score.mp3') === parseInt(ov.dataset.zone || '0', 10), 'e ogni pezzo che cambia suona score.mp3', conta('score.mp3') + ' su ' + ov.dataset.zone + ' pezzi');
      dice(controlloId && controlloId.pezzi === parseInt(ov.dataset.zone || '0', 10) && controlloId.rif > 0 && !controlloId.rotti.length,
        'ogni pezzo ha le sue maschere: i suoi url(#id) esistono una volta sola, dentro di lui',
        controlloId ? (controlloId.pezzi + ' pezzi, ' + controlloId.rif + ' riferimenti, rotti: ' + (controlloId.rotti.join(', ') || 'nessuno')) : 'mai arrivato ai cambi');
      dice(controlloId && controlloId.riferimento === 'visible', 'e la carta di riferimento non e- nascosta con visibility', controlloId && controlloId.riferimento);
      const passi = tempiScore.slice(1).map((t, i) => Math.round(t - tempiScore[i]));
      dice(passi.length >= 1 && passi.every(p => p >= 70 && p <= 170), 'fra un lampo e l-altro passano 100ms', passi.join(', ') + ' ms');
      window.playSfxFile = function(){};
      // Il pezzo cambia nell-istante del lampo: i due fotogrammi-chiave devono essere lo stesso.
      const chiavi = nome => { const k = regole.filter(r => r.type === CSSRule.KEYFRAMES_RULE && r.name === nome)[0]; return k ? [].slice.call(k.cssRules) : []; };
      const compare = chiavi('lvcCambio').filter(k => k.style.opacity === '1')[0];
      const picco = chiavi('lvcBagliore').filter(k => k.style.opacity === '1')[0];
      dice(compare && picco && compare.keyText === picco.keyText && compare.keyText === '12%' && LV_CAMBIO_PICCO_MS === Math.round(LV_CAMBIO_MS * 0.12),
        'il pezzo compare nel fotogramma in cui il lampo e- al massimo, e score.mp3 suona li-',
        (compare && compare.keyText) + ' / ' + (picco && picco.keyText) + ', picco a ' + LV_CAMBIO_PICCO_MS + 'ms');
      const rCambio = regole.filter(r => r.selectorText === '.lvc-cambio.va')[0], rBagl = regole.filter(r => r.selectorText === '.lvc-bagliore.va')[0];
      dice(rCambio && rBagl && rCambio.style.animationDuration === (LV_CAMBIO_MS/1000) + 's' && rBagl.style.animationDuration === (LV_CAMBIO_MS/1000) + 's',
        'e le due animazioni durano quanto il codice aspetta', rCambio && (rCambio.style.animationDuration + ' / ' + rBagl.style.animationDuration + ' contro ' + LV_CAMBIO_MS + 'ms'));
      dice(LV_FUOCHI_SCALA === 1.5 && LV_FUOCHI_SPINTA > 0, 'i fuochi sono grandi una volta e mezza, e spinti verso i lati');
      dice(parseInt(ov.dataset.zone || '0', 10) >= 2, 'e cambiano almeno i valori e le gemme del livello', 'pezzi: ' + ov.dataset.zone);
      dice(MENU_GIOCATORE.magicInk === 5000 - sb.costo, 'il saldo e- quello della risposta', String(MENU_GIOCATORE.magicInk));
      dice(document.getElementById('livello-titolo').textContent === 'Level 2!', 'il titolo dice Level 2!', document.getElementById('livello-titolo').textContent);
      const bonus = document.getElementById('livello-bonus').textContent;
      const piatta = !(B.valuesPerLivello && Object.keys(B.valuesPerLivello).length);
      dice(!piatta || bonus === '+1 Power on ALL sides', 'e il bonus +1 Power on ALL sides', bonus);
      const barra = document.getElementById('livello-barra');
      dice(barra.querySelector('.lv-liv').textContent === 'Level 2' && barra.querySelector('.lv-testo').textContent === '3 more for level 3',
        'la barra in fondo e- quella del livello NUOVO', barra.querySelector('.lv-liv').textContent + ' / ' + barra.querySelector('.lv-testo').textContent);
      const cornice = document.getElementById('livello-cornice');
      dice(st(cornice).width === '846px' && st(cornice).height === '561px', 'la finestra finale e- 846x561', st(cornice).width + 'x' + st(cornice).height);
      const carta = document.getElementById('livello-carta'), posto = document.getElementById('livello-posto-carta');
      const atteso = cornice.offsetLeft + cornice.clientLeft + posto.offsetLeft;
      dice(carta.style.transform.indexOf('translate(') === 0 && Math.abs(carta.offsetLeft + parseFloat(carta.style.transform.slice(10)) - atteso) < 1.5,
        'e la carta va al suo posto dentro la finestra', carta.style.transform + ' da ' + carta.offsetLeft + ' verso ' + atteso);
      const baseB = _makeCardDbCard(B, 2);
      const siApre = !!(cartaAlLivello(baseB, 1).abilityLocked && !cartaAlLivello(baseB, 2).abilityLocked && testiAbilitaDi(cartaAlLivello(baseB, 2)));
      dice(document.getElementById('livello-sblocco').hidden === !siApre,
        'l-abilita- sbloccata compare solo se si apre a questo livello', 'si apre al 2: ' + siApre);
      dice(document.getElementById('livello-chiudi').classList.contains('dentro'), 'e alla fine compare Close');
      const slotB2 = slotDi(B);
      dice(slotB2 && !slotB2.querySelector('.lvup-nastro'), 'e in Libreria il nastro Lv up e- gia- andato via');
      document.getElementById('livello-chiudi').click();
      await attendi(300);
      dice(!ov.classList.contains('show') && _lvChiusura === null, 'Close chiude la salita');

      // ── 6. UN-ABILITA- CHE SI APRE ────────────────────────────────────────
      const conAb = buone.find(e => (e.abilityUnlockLevel === 2 || e.abilityUnlockLevel === 3) && testiAbilitaDi(cartaAlLivello(_makeCardDbCard(e,2), 4)));
      if(conAb){
        const a2 = conAb.abilityUnlockLevel;
        CARTE_POSSEDUTE[conAb.slug] = a2; CARTE_COPIE[conAb.slug] = a2 === 2 ? 2 : 5;
        animaSalitaDiLivello(conAb, a2 - 1, a2);
        const t1 = Date.now();
        while(Date.now() - t1 < 20000 && ov.dataset.fase !== 'fine') await attendi(50);
        dice(!document.getElementById('livello-sblocco').hidden, 'una carta che al livello ' + a2 + ' apre l-abilita- la mostra', conAb.name);
        dice(document.querySelector('#livello-abilita .la-nome').textContent.length > 0, 'col nome dell-abilita-', document.querySelector('#livello-abilita .la-nome').textContent);
        dice(parseInt(ov.dataset.zone || '0', 10) >= 3, 'e fra i pezzi che cambiano c-e- anche lei', 'pezzi: ' + ov.dataset.zone);
        chiudiSalitaDiLivello();
        await attendi(200);
      } else dice(true, 'nessuna carta apre l-abilita- al 2 o al 3: controllo saltato');

      // ── 7. I BONUS PER GRUPPI ─────────────────────────────────────────────
      const v1 = { values:{ NW:9, NE:9, E:9, SE:2, SW:2, W:2 }, groupSides:[['NW','NE','E'],['SE','SW','W']] };
      const v2 = { values:{ NW:11, NE:11, E:11, SE:3, SW:3, W:3 } };
      const righe = righeBonusLivello(v1, v2);
      dice(righe.length === 2 && righe[0] === '+2 Power: 9 → 11' && righe[1] === '+1 Power: 2 → 3',
        'se i lati salgono di numeri diversi, una riga per gruppo', righe.join(' | '));

      // ── 8. IL CARTELLINO DELLO SBUSTO ─────────────────────────────────────
      // C diventa una carta che non si ha: e- la nuova dello sbusto.
      delete CARTE_POSSEDUTE[C.slug]; delete CARTE_COPIE[C.slug];
      CARTE_POSSEDUTE[A.slug] = 1; CARTE_COPIE[A.slug] = 1; CARTE_POSSEDUTE[D.slug] = 4; CARTE_COPIE[D.slug] = 9;
      openPackOverlay();
      await attendi(800);
      const reveal = document.getElementById('pack-reveal');
      reveal.innerHTML = '';
      const cN = _costruisciCartaBustina(C, -1, 0), cA = _costruisciCartaBustina(A, 0, 1), cD = _costruisciCartaBustina(D, 1, 2);
      [cN, cA, cD].forEach(c => { reveal.appendChild(c); vestiEtichettaBustina(c); });
      await attendi(500);
      const eN = cN.querySelector('.pack-etichetta'), eA = cA.querySelector('.pack-etichetta'), eD = cD.querySelector('.pack-etichetta');
      const nastro = eN.querySelector('.pk-nastro');
      dice(!!nastro && /new-card-banner-wide\\.png/.test(nastro.src || ''), 'la carta nuova ha il nastro new-card-banner-wide', nastro && nastro.src);
      if(nastro){
        const rn = nastro.getBoundingClientRect(), re = eN.getBoundingClientRect();
        const k = re.width / eN.offsetWidth;
        dice(Math.abs((re.left - rn.left) / k - 2) < 0.75, 'che sporge di due pixel a sinistra', ((re.left - rn.left)/k).toFixed(2) + 'px');
        dice(st(nastro).width === '109px' && st(nastro).height === '41px', 'ed e- 109x41', st(nastro).width + 'x' + st(nastro).height);
      }
      dice(eN.querySelector('.pk-lv').textContent === 'Lvl 1' && eN.querySelectorAll('.lv-seg').length === 2 && !eN.querySelector('.lv-seg.pieno'),
        'e dice Lvl 1 con due tacche vuote');
      dice(eA.textContent.indexOf('Owned') === 0 && eA.querySelector('.pk-lv').textContent === 'Lvl 1' && eA.querySelectorAll('.lv-seg.pieno').length === 1,
        'una posseduta dice Owned, Lvl 1, una tacca piena', eA.textContent);
      dice(eD.querySelector('.pk-lv').textContent === 'Lvl 4' && !!eD.querySelector('.lv-max'), 'al massimo Lvl 4 e la barra grigia');
      // Allo sbusto New! vuol dire "non e- ancora in Libreria", e basta. Una carta ancora
      // da guardare in Libreria e una che si ha solo dal mazzo starter (nessuna copia
      // contata) dicono Owned.
      CARTE_NUOVE.add(A.slug);
      delete CARTE_COPIE[B.slug]; CARTE_POSSEDUTE[B.slug] = 1;
      const cA2 = _costruisciCartaBustina(A, 0, 1), cB2 = _costruisciCartaBustina(B, 1, 2);
      [cA2, cB2].forEach(c => { reveal.appendChild(c); vestiEtichettaBustina(c); });
      dice(!cA2.querySelector('.pk-nastro') && cA2.querySelector('.pack-etichetta').textContent.indexOf('Owned') === 0,
        'allo sbusto una carta ancora New in Libreria dice Owned: in Libreria c-e- gia-');
      dice(!cB2.querySelector('.pk-nastro') && cB2.querySelector('.pack-etichetta').textContent.indexOf('Owned') === 0,
        'e anche una che si ha solo dal mazzo starter');
      CARTE_NUOVE.delete(A.slug); cA2.remove(); cB2.remove();
      const sE = st(eA);
      dice(sE.paddingTop === '12px' && sE.paddingLeft === '20px' && sE.borderTopLeftRadius === '16px' && sE.rowGap === '12px',
        'padding 12/20, angoli 16, dodici fra riga e barra', sE.paddingTop + '/' + sE.paddingLeft + ' ' + sE.borderTopLeftRadius + ' ' + sE.rowGap);
      dice(sE.fontSize === '22px' && sE.color === 'rgb(237, 224, 198)' && sE.marginBottom === '20px', 'Marcellus 22 in EDE0C6, venti pixel sopra alla carta', sE.fontSize + ' ' + sE.color + ' ' + sE.marginBottom);
      dice(Math.abs(eA.offsetWidth - cA.offsetWidth - 1) <= 1, 'largo quanto la carta', eA.offsetWidth + ' contro ' + cA.offsetWidth);
      dice(riempiCopiaBustina([cN, cA], []) === 2 && cN.querySelectorAll('.lv-seg.pieno').length === 1 && cA.querySelectorAll('.lv-seg.pieno').length === 2,
        'tenendole, ognuna riempie una tacca');
      dice(riempiCopiaBustina([cD], [D.slug]) === 0, 'e una copia rimborsata non riempie niente');
      reveal.innerHTML = '';

      // ── 8b. VENDERE ───────────────────────────────────────────────────────
      // v0.79.91 — una carta con tutte le copie non si tiene: si vende. Il suo
      // pulsante dice Sell for, e non fa pagare l-altra carta presa.
      MENU_GIOCATORE.magicInk = 5000;
      const vC = _costruisciCartaBustina(C, -1, 0), vA = _costruisciCartaBustina(A, 0, 1), vD = _costruisciCartaBustina(D, 1, 2);
      [vC, vA, vD].forEach(c => reveal.appendChild(c));
      aggiornaSceltaBustina();
      // L-icona dell-inchiostro sta fra la parola e il numero: gli spazi si compattano.
      const eti = c => c.__sceltaBtn ? c.__sceltaBtn.querySelector('.hxb-label').textContent.replace(/\\s+/g, ' ').trim() : '';
      const collect = () => document.querySelector('#pack-collect .hxb-label').textContent.trim();
      dice(eti(vD) === 'Sell for ' + costoDiCarta(vD), 'una carta con nove copie dice Sell for e quanto rende', eti(vD));
      dice(eti(vA) === 'Keep (Free)' && eti(vC) === 'Keep (Free)', 'le altre, finche- non si sceglie, Keep (Free)', eti(vA) + ' / ' + eti(vC));
      scegliCartaBustina(vD);
      dice(eti(vA) === 'Keep (Free)', 'venduta quella, l-altra resta gratis', eti(vA));
      scegliCartaBustina(vA);
      dice(eti(vC) === 'Discarded' && costoCoppiaTenuta() === 0 && collect() === 'Collect',
        'e presa anche lei non si paga niente: la terza si scarta, e Collect non dice un prezzo', eti(vC) + ' / ' + collect());
      scegliCartaBustina(vD); scegliCartaBustina(vA);
      scegliCartaBustina(vA);
      dice(eti(vC).indexOf('Keep for ') === 0 && eti(vD).indexOf('Sell for ') === 0,
        'con una tenuta, la seconda normale si paga e quella da vendere no', eti(vC) + ' / ' + eti(vD));
      // Il saldo che rientra: scende per quel che si paga, poi sale per quel che si vende.
      const suoniV = [];
      window.playSfxFile = function(f){ suoniV.push(f); };
      reveal.innerHTML = '';
      const wC = _costruisciCartaBustina(C, -1, 0), wA = _costruisciCartaBustina(A, 0, 1), wD = _costruisciCartaBustina(D, 1, 2);
      [wC, wA, wD].forEach(c => reveal.appendChild(c));
      MENU_GIOCATORE.magicInk = 300; aggiornaValuteAVideo();
      _bustinaInCorso = false; _bustinaDaGirare = 0; _raccoltaInCorso = false; _bustinaDalServer = true;
      const rpcVera = nakamaRpc;
      nakamaRpc = function(nome, dati){
        if(nome !== 'hx_bustina_raccogli') return Promise.resolve({});
        return Promise.resolve({ tenute: dati.tieni, speso: 50, rimborso: 200, rimborsate: [D.slug], valute: { magicInk: 450, fairyDust: 0 } });
      };
      wD.classList.add('tenuta'); wA.classList.add('tenuta');
      // I conti si registrano quando partono: il numero a video si aggiorna a ogni
      // fotogramma, e in una finestra nascosta i fotogrammi sono radi — il 250 di
      // mezzo puo- essere sovrascritto dal secondo conto prima che il banco lo legga.
      const conti = [];
      const contaVera = contaValutaAllIndietro;
      contaValutaAllIndietro = function(q, da, a){ conti.push(da + '>' + a); return contaVera.apply(this, arguments); };
      raccogliCarte();
      const numero = document.querySelector('#pack-ink-fisso .mm-cur-value');
      const visti = [];
      let rientrato = false;
      const t2 = Date.now();
      while(Date.now() - t2 < 3500){
        if(document.getElementById('pack-overlay').classList.contains('paga')) rientrato = true;
        const tx = numero ? numero.textContent : '';
        if(visti[visti.length-1] !== tx) visti.push(tx);
        await attendi(30);
      }
      nakamaRpc = rpcVera; _bustinaDalServer = false; contaValutaAllIndietro = contaVera;
      dice(rientrato, 'il saldo rientra dal bordo dello schermo');
      dice(conti.join(' ') === '300>250 250>450' && visti[0] === '300' && visti[visti.length-1] === '450',
        'parte dal saldo di prima, scende di quel che si paga e poi sale di quel che si vende', 'conti: ' + conti.join(', ') + '; a video da ' + visti[0] + ' a ' + visti[visti.length-1]);
      dice(suoniV.filter(f => /kaching/.test(f)).length === 2, 'col suono dei soldi due volte, una per verso', suoniV.join(', '));
      window.playSfxFile = function(){};
      try{ tornaAllaBustina(); }catch(_){ }
      reveal.innerHTML = '';

      // ── 8c. CHI HA FRETTA, DOPO I LIVELLI ─────────────────────────────────
      // v0.79.98 — contro l-IA White Rabbit partiva in mano solo per caso: la cima
      // del mazzo si decideva coi livelli del catalogo (Coniglio al 1, abilita-
      // chiusa), e pareggiaILivelli lo portava al 2 DOPO. Qui una carta con
      // rush_hour chiusa in mezzo al mazzo, che poi si apre: rifatta la cima, e- prima.
      const finte = [0,1,2,3,4,5].map(i => ({ id:'f'+i, name:'F'+i, cardAbility:null }));
      const coniglio = { id:'coniglio', name:'White Rabbit', cardAbility:'rush_hour', abilityLocked:true, level:1, abilityUnlockLevel:2 };
      finte.splice(3, 0, coniglio);
      dice(_inCimaChiHaFretta(finte)[0] !== coniglio, 'con l-abilita- chiusa il Coniglio non va in cima');
      coniglio.abilityLocked = false; coniglio.level = 2;
      dice(_inCimaChiHaFretta(finte)[0] === coniglio, 'aperta, si')
      const sorg = makeBalancedDecks.toString();
      const iPar = sorg.indexOf('pareggiaILivelli(d1, migliore)'), iCima = sorg.indexOf('migliore = _inCimaChiHaFretta(migliore)');
      dice(iPar > 0 && iCima > iPar, 'e contro l-IA la cima si rifa- DOPO aver dato i livelli alle sue carte',
        'pareggiaILivelli a ' + iPar + ', la cima a ' + iCima);

      // ── 9. IN RETE ────────────────────────────────────────────────────────
      const reteVera = PARTITA_RETE;
      PARTITA_RETE = { io: 1, livelloAvversario: 1, livelliAvversario: {} };
      PARTITA_RETE.livelliAvversario[C.slug] = 3;
      dice(_livelloDiRete(2, C) === 3, 'in rete una carta dell-avversario va al SUO livello', String(_livelloDiRete(2, C)));
      dice(_livelloDiRete(2, A) === 1, 'e una che il server non dice ricade sul numero unico', String(_livelloDiRete(2, A)));
      dice(_livelloDiRete(1, C) === null, 'e le mie le decide il mio possesso');
      PARTITA_RETE = reteVera;

      return { d };
    }catch(e){ return { d, guasto: (e && e.message) + ' @ ' + ((e && e.stack)||'').split('\\n')[1] }; }
    })();
    const _guardia = new Promise(r=>setTimeout(()=>r({ d, scaduto:true }), 150000));
    return await Promise.race([_corpo, _guardia]);
  })()`);

  if (esito && esito.scaduto) {
    const fatti = esito.d || [];
    console.error('IL BANCO NON HA FINITO. Ultimo controllo: ' + (fatti.length ? fatti[fatti.length-1].che : 'nessuno'));
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
    const foto = async (nome, prima, attesa, selettori) => {
      await win.webContents.executeJavaScript(prima);
      await new Promise(r => setTimeout(r, attesa));
      const b = await win.webContents.executeJavaScript('(function(){ var s=' + JSON.stringify(selettori) + ';'
        + 'var r=s.map(function(x){ return document.querySelector(x).getBoundingClientRect(); });'
        + 'var x=Math.max(0,Math.min.apply(null,r.map(function(q){return q.left;}))-30), y=Math.max(0,Math.min.apply(null,r.map(function(q){return q.top;}))-30);'
        + 'var x2=Math.max.apply(null,r.map(function(q){return q.right;}))+30, y2=Math.max.apply(null,r.map(function(q){return q.bottom;}))+30;'
        + 'return { x:x, y:y, width:x2-x, height:y2-y, vw: window.innerWidth }; })()');
      const intera = await win.webContents.capturePage();
      const dim = intera.getSize();
      const s = dim.width / b.vw;
      const rx = Math.max(0, Math.round(b.x * s)), ry = Math.max(0, Math.round(b.y * s));
      const ritaglio = intera.crop({ x: rx, y: ry,
        width: Math.min(Math.round(b.width * s), dim.width - rx), height: Math.min(Math.round(b.height * s), dim.height - ry) });
      fs.writeFileSync(SCATTO.replace(/\.png$/, '-' + nome + '.png'), ritaglio.toPNG());
      console.log('scritto ' + nome);
    };
    const pronta = "var e=(FINAL_CARDS||[]).filter(function(x){ return x && x.slug && !soloEvocabile(x) && !x.soloAdmin; })[1];";
    await foto('scheda', '(async function(){ ' + pronta + ' GIOCATORE_ADMIN=false; CARTE_POSSEDUTE[e.slug]=1; CARTE_COPIE[e.slug]=2; MENU_GIOCATORE.magicInk=5000;'
      + ' openCardDbOverlay(); await new Promise(function(r){setTimeout(r,900);}); cardDbRenderRoster(); await new Promise(function(r){setTimeout(r,600);});'
      + ' var s=document.querySelector(".card-db-card-slot[data-entry-id=\\"" + e.id + "\\"]"); if(s) s.click(); return 1; })()', 1800,
      ['#card-modal', '#card-modal-livello', '#card-modal-chiudi']);
    await foto('nastro', '(function(){ closeCardModal(); return 1; })()', 900, ['#card-db-grid']);
    await foto('salita', '(function(){ ' + pronta + ' CARTE_POSSEDUTE[e.slug]=2; animaSalitaDiLivello(e, 1, 2); return 1; })()', 7500,
      ['#livello-cornice', '#livello-chiudi']);
    await foto('cambio', '(async function(){ chiudiSalitaDiLivello(); ' + pronta + ' CARTE_POSSEDUTE[e.slug]=2; animaSalitaDiLivello(e, 1, 2);'
      + ' var ov=document.getElementById("livello-overlay"); var t=Date.now();'
      + ' while(ov.dataset.cambio !== "1" && Date.now()-t < 9000) await new Promise(function(r){setTimeout(r,5);});'
      + ' _lvGen++; await new Promise(function(r){setTimeout(r,20);});'
      + ' document.getAnimations().forEach(function(a){ a.pause(); a.currentTime = 160; }); return 1; })()', 400,
      ['#livello-carta']);
    await foto('lampo', '(function(){ chiudiSalitaDiLivello(); ' + pronta + ' animaSalitaDiLivello(e, 1, 2); return 1; })()', 1500,
      ['#livello-carta']);
    await win.webContents.executeJavaScript('chiudiSalitaDiLivello(); closeCardModal && 1');
    await foto('sbusto', '(async function(){ var b=(FINAL_CARDS||[]).filter(function(x){ return x && x.slug && !soloEvocabile(x) && !x.soloAdmin; });'
      + ' CARTE_POSSEDUTE[b[0].slug]=1; CARTE_COPIE[b[0].slug]=1; delete CARTE_POSSEDUTE[b[2].slug]; delete CARTE_COPIE[b[2].slug];'
      + ' openPackOverlay(); document.getElementById("pack-overlay").classList.add("sbustando"); await new Promise(function(r){setTimeout(r,600);});'
      + ' var rv=document.getElementById("pack-reveal"); rv.innerHTML="";'
      + ' [b[2],b[0],b[3]].forEach(function(x,i){ var c=_costruisciCartaBustina(x,[-1,0,1][i],i); rv.appendChild(c); c.classList.remove("emerging"); c.classList.add("floating","revealed"); vestiEtichettaBustina(c); });'
      + ' return 1; })()', 2200, ['#pack-overlay']);
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
