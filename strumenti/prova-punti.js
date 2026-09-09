// I PUNTI: COME SI CONTANO.
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
//   - le carte proprie in campo, a ogni fine turno. v0.79.56: non piu' un
//     punto a testa, ma AL CONTRARIO della rarita' — common 3, rare 2,
//     mythic 1, timeless 0.
//
// Si guarda il CALCOLO, non il punteggio a schermo. G.hp lo scrive la bolla in
// fondo alla sua animazione, e in una finestra nascosta le animazioni non
// arrivano mai in fondo: aspettare quel numero vorrebbe dire misurare se
// l'animazione gira, non se il conto e' giusto. Qui si intercettano invece le
// due porte da cui i punti passano — assegnaPunti e incrementaBollaPunti — e
// si guarda con che numeri vengono chiamate.
//
// PERCHE' NON BASTA PROVARE puntiDiCarta. Quella funzione direbbe che i numeri
// sono giusti anche il giorno in cui l'onda smettesse di consegnarli, ed e'
// esattamente il genere di scollamento che in questo file e' gia' costato caro.
// Si contano gli INCREMENTI davvero chiesti e il totale con cui la bolla si
// chiude: sono le due cose che il giocatore vede.
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
     'apriBollaPunti','incrementaBollaPunti','chiudiBollaPunti','puntiDiCarta']
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

    // ── LA TABELLA DELLA RARITA' (v0.79.56) ────────────────────────────────
    dice(puntiDiCarta({rarity:'common'})   === 3, 'una common vale 3',   puntiDiCarta({rarity:'common'}));
    dice(puntiDiCarta({rarity:'rare'})     === 2, 'una rare vale 2',     puntiDiCarta({rarity:'rare'}));
    dice(puntiDiCarta({rarity:'mythic'})   === 1, 'una mythic vale 1',   puntiDiCarta({rarity:'mythic'}));
    dice(puntiDiCarta({rarity:'timeless'}) === 0, 'una timeless vale 0', puntiDiCarta({rarity:'timeless'}));
    dice(puntiDiCarta({rarity:'COMMON'})   === 3, 'e la maiuscola non cambia niente', puntiDiCarta({rarity:'COMMON'}));
    // Una rarita' che non esiste vale come una common, NON zero: zero vorrebbe
    // dire che un dato scritto male sparisce dal conto senza dirlo.
    dice(puntiDiCarta({rarity:'sbagliata'}) === 3, 'una rarita- ignota vale come una common',
      puntiDiCarta({rarity:'sbagliata'}));
    dice(puntiDiCarta({}) === 3, 'e una carta senza rarita- pure', puntiDiCarta({}));

    // ── L'ESEMPIO DI LORENZO, DALL'ONDA VERA ───────────────────────────────
    // ondataDanno accende una carta alla volta e a ogni accensione chiama
    // incrementaBollaPunti(proprietario, quanto vale QUELLA carta). Il conto e'
    // quello, non la bolla.
    const carta = (rar) => ({ rarity:rar, name:rar, id:rar + Math.random() });
    window._conta = { 1:0, 2:0 };
    window._accese = { 1:0, 2:0 };
    window._chiusure = {};
    window._veroIncrementa = window.incrementaBollaPunti;
    window._veroApri = window.apriBollaPunti;
    window._veroChiudi = window.chiudiBollaPunti;
    window.incrementaBollaPunti = function(p, n){ window._conta[p] += n; window._accese[p]++; };
    window.apriBollaPunti = function(){};      // la bolla non serve: serve il conto
    window.chiudiBollaPunti = function(p, punti, poi){ window._chiusure[p] = punti; if(poi) poi(); };
    G.gameOver = false;
    G.board = {
      '0,0':{ owner:1, card:carta('common')   },
      '1,0':{ owner:1, card:carta('common')   },
      '0,1':{ owner:1, card:carta('mythic')   },
      '1,1':{ owner:1, card:carta('timeless') },
      '2,0':{ owner:2, card:carta('rare')     }
    };
    window._finito1 = false;
    try{ dannoDiFineTurno(function(){ window._finito1 = true; }); }catch(e){ window._rotta = String(e); }
    return dette;
  }catch(e){ return [{ok:false, che:'la prova si e- rotta', perche:String((e && e.stack) || e)}]; } })()`);

  // Le carte si accendono a 90ms l'una dall'altra: si aspetta in tempo vero.
  await new Promise(r => setTimeout(r, 3000));

  const secondo = await win.webContents.executeJavaScript(`(function(){
    const dette = [];
    const dice = (ok, che, perche) => dette.push({ ok:!!ok, che:che, perche:perche||'' });
    dice(!window._rotta, 'l-ondata di fine turno parte senza rompersi', window._rotta || '');
    dice(window._finito1 === true, 'il turno prosegue quando l-onda ha finito');
    dice(window._conta[1] === 7, '2 common + 1 mythic + 1 timeless fanno 7',
      'ne ho contati ' + window._conta[1]);
    dice(window._chiusure[1] === 7, 'e la bolla si chiude sullo stesso totale',
      'si e- chiusa su ' + window._chiusure[1]);
    dice(window._accese[1] === 3, 'la timeless non consegna niente e non entra nell-onda',
      window._accese[1] + ' carte accese su 4');
    dice(window._conta[2] === 2, 'e l-avversario prende i 2 della sua rare',
      'ne ho contati ' + window._conta[2]);

    // Tabellone vuoto: nessun punto, e soprattutto la chiamata di fine deve
    // arrivare lo stesso — e' lei a far ripartire il turno.
    window._conta = { 1:0, 2:0 }; window._finito = false;
    G.board = {};
    dannoDiFineTurno(function(){ window._finito = true; });
    dice(window._conta[1] === 0 && window._conta[2] === 0, 'tabellone vuoto: nessun punto');
    dice(window._finito === true, 'e il turno riparte lo stesso');

    // E il caso che si dimentica: un tabellone di sole timeless vale zero
    // esattamente come uno vuoto, e come quello deve far proseguire il turno.
    // Senza questo controllo, una partita fra due mazzi di leggendarie si
    // fermerebbe al primo cambio di turno.
    window._finito2 = false;
    G.board = { 'a':{ owner:1, card:{rarity:'timeless'} }, 'b':{ owner:2, card:{rarity:'timeless'} } };
    dannoDiFineTurno(function(){ window._finito2 = true; });
    dice(window._finito2 === true, 'solo timeless in campo: il turno prosegue lo stesso');

    window.incrementaBollaPunti = window._veroIncrementa;
    window.apriBollaPunti = window._veroApri;
    window.chiudiBollaPunti = window._veroChiudi;
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
