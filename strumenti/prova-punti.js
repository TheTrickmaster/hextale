// I PUNTI SI CONTANO ANCORA COME PRIMA.
//
//     $ELECTRON strumenti/prova-punti.js
//
// Nato nella v0.79.28, quando sono state tolte le bolle di danno: i disegni
// che le vestivano erano stati cancellati e chiedevano un 404 a ogni partita.
// Erano 541 righe da togliere in un file da 44.000, tutte intrecciate col
// punteggio, e il punteggio e' la sola cosa che non doveva cambiare.
//
// Le due regole, dette da Lorenzo:
//   - i punti per la DIFFERENZA fra attaccante e difensore;
//   - un punto per OGNI carta propria in campo, a ogni fine turno.
//
// Si guarda il CALCOLO, non il punteggio a schermo. G.hp lo scrive la bolla in
// fondo alla sua animazione, e in una finestra nascosta le animazioni non
// arrivano mai in fondo: aspettare quel numero vorrebbe dire misurare se
// l'animazione gira, non se il conto e' giusto. Qui si intercettano invece le
// due porte da cui i punti passano — assegnaPunti e incrementaBollaPunti — e
// si guarda con che numeri vengono chiamate.
const { app, BrowserWindow } = require('electron');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
setTimeout(() => { console.error('PIANTATA: nessuna risposta in 90s'); app.exit(2); }, 90000);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 800, frame: false,
    webPreferences: { contextIsolation: false, webSecurity: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 2500));

  const primo = await win.webContents.executeJavaScript(`(function(){ try{
    const dette = [];
    const dice = (ok, che, perche) => dette.push({ ok:!!ok, che:che, perche:perche||'' });

    // ── quello che deve esserci ────────────────────────────────────────────
    ['applyHpDamage','assegnaPunti','dannoDiFineTurno','ondataDanno',
     'apriBollaPunti','incrementaBollaPunti','chiudiBollaPunti']
      .forEach(n => dice(typeof window[n] === 'function', 'c-e- ancora ' + n, 'ho letto ' + typeof window[n]));

    // ── e quello che non deve esserci piu' ─────────────────────────────────
    // Se una di queste torna a esistere, e' tornato anche il disegno che
    // chiedeva: damage-bubble-dark/light.png, healing-bubble.png,
    // damage-anim.mp4. Quei file sono stati cancellati da Lorenzo.
    ['createDamageBubbleVisual','spawnDamageProjectile','spawnHealProjectile',
     'applyHpHeal','applyDannoOndata','createSuddenDeathCollector',
     'growSuddenDeathCollector','launchSuddenDeathFinalBubble',
     'flySuddenDeathBubble','flyArcedBounceBubble']
      .forEach(n => dice(typeof window[n] === 'undefined', 'se n-e- andata ' + n, 'ho letto ' + typeof window[n]));

    // ── LA DIFFERENZA FRA ATTACCANTE E DIFENSORE ───────────────────────────
    // applyHpDamage(difensore, attacco, difesa) -> assegnaPunti(vincitore, N).
    // Il vincitore e' l'ALTRO giocatore, e N e' max(0, attacco - difesa).
    const dati = [];
    const vero = window.assegnaPunti;
    window.assegnaPunti = function(p, n){ dati.push([p, n]); };
    const prova = (dif, atk, def) => { dati.length = 0; applyHpDamage(dif, atk, def, null);
                                       return dati.length ? dati[0] : null; };
    let r;
    r = prova(1, 7, 3);
    dice(r && r[0] === 2 && r[1] === 4, 'sette contro tre fa quattro punti a chi attacca',
      r ? ('giocatore ' + r[0] + ', ' + r[1] + ' punti') : 'non ha assegnato niente');
    r = prova(2, 7, 3);
    dice(r && r[0] === 1 && r[1] === 4, 'e li prende chi attacca, chiunque sia',
      r ? ('giocatore ' + r[0] + ', ' + r[1] + ' punti') : 'non ha assegnato niente');
    r = prova(1, 2, 5);
    dice(r === null, 'attaccare piu- debole non toglie punti a nessuno',
      r ? ('ha assegnato ' + r[1] + ' al giocatore ' + r[0]) : '');
    r = prova(1, 5, 5);
    dice(r === null, 'pari non fa punti', r ? ('ha assegnato ' + r[1]) : '');
    r = prova(1, 9, 0);
    dice(r && r[1] === 9, 'nove contro zero fa nove', r ? String(r[1]) : 'niente');
    r = prova(1, 4, 3);
    dice(r && r[1] === 1, 'uno di scarto fa un punto', r ? String(r[1]) : 'niente');
    window.assegnaPunti = vero;

    // ── UN PUNTO PER OGNI CARTA PROPRIA IN CAMPO ───────────────────────────
    // ondataDanno accende una carta alla volta e a ogni accensione chiama
    // incrementaBollaPunti(proprietario, 1). Il conto e' quello, non la bolla.
    window._conta = { 1:0, 2:0 };
    window._veroIncrementa = window.incrementaBollaPunti;
    window.incrementaBollaPunti = function(p, n){ window._conta[p] = (window._conta[p]||0) + n; };
    window._veroApri = window.apriBollaPunti;
    window.apriBollaPunti = function(){};      // la bolla non serve: serve il conto
    G.gameOver = false;
    G.board = { '0,0':{owner:1}, '1,0':{owner:1}, '0,1':{owner:1}, '2,0':{owner:2} };
    try{ dannoDiFineTurno(function(){}); }catch(e){ window._rotta = String(e); }
    return dette;
  }catch(e){ return [{ok:false, che:'la prova si e- rotta', perche:String((e && e.stack) || e)}]; } })()`);

  // Le carte si accendono a 90ms l'una dall'altra: si aspetta in tempo vero.
  await new Promise(r => setTimeout(r, 3000));

  const secondo = await win.webContents.executeJavaScript(`(function(){
    const dette = [];
    const dice = (ok, che, perche) => dette.push({ ok:!!ok, che:che, perche:perche||'' });
    dice(!window._rotta, 'l-ondata di fine turno parte senza rompersi', window._rotta || '');
    dice(window._conta[1] === 3, 'tre carte in campo fanno tre punti al loro proprietario',
      'ne ho contati ' + window._conta[1]);
    dice(window._conta[2] === 1, 'e la carta avversaria ne fa uno a lui',
      'ne ho contati ' + window._conta[2]);
    // Tabellone vuoto: nessun punto, e soprattutto la chiamata di fine deve
    // arrivare lo stesso — e' lei a far ripartire il turno.
    window._conta = { 1:0, 2:0 }; window._finito = false;
    G.board = {};
    dannoDiFineTurno(function(){ window._finito = true; });
    dice(window._conta[1] === 0 && window._conta[2] === 0, 'tabellone vuoto: nessun punto');
    dice(window._finito === true, 'e il turno riparte lo stesso');
    window.incrementaBollaPunti = window._veroIncrementa;
    window.apriBollaPunti = window._veroApri;
    return dette;
  })()`);

  const dette = primo.concat(secondo);
  let male = 0;
  for (const d of dette) {
    console.log((d.ok ? '  ok  ' : '  NO  ') + d.che + (d.ok || !d.perche ? '' : '\n        ' + d.perche));
    if (!d.ok) male++;
  }
  console.log('\n' + dette.length + ' controlli, ' + male + ' storti');
  app.exit(male ? 1 : 0);
});
