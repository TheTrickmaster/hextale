// LE SEGNALAZIONI DELLA v0.80.20: SCARECROW, LA RESA E I BANNER, BUFF E DEBUFF.
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-segnalazioni-v08020.js
//
// Lorenzo:
//   1. "le carte buffate da scarecrow non hanno conquistato, come se il potere di
//      attacco venisse calcolato prima del buff (7 vs 7, con buff 9 vs 7)";
//   2. "quando qualcuno in partita si arrende devono sparire immediatamente tutti
//      gli altri banner in gioco (time up, cambio turno) e non apparire piu' fino
//      alla prossima partita";
//   3. Cowardly Lion col +1 di Little John: "il -1 iniziale e' sparito dal tip
//      [...] buff e debuff devono risultare tutti, sempre. Un nuovo buff/debuff
//      non ne deve sovrascrivere uno vecchio".
// Le carte sono quelle vere del catalogo (server/importazione/.lavoro/catalogo.json).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';
const FILE_CATALOGO = path.join(RADICE, 'server', 'importazione', '.lavoro', 'catalogo.json');

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  try {
    var entry = function(nome){ return FINAL_CARDS.find(function(e){ return e && e.name === nome; }); };
    var modello = FINAL_CARDS.find(function(e){ return e && e.values && !Array.isArray(e.values); });
    var tutti = function(v){ return {NE:v,E:v,SE:v,SW:v,W:v,NW:v}; };
    var copia = function(extra){ return Object.assign(JSON.parse(JSON.stringify(modello)), extra); };
    var UNGRUPPO = [['NE','E','SE','SW','W','NW']];
    var SETTE = copia({ id:'final-prova-sette', slug:'prova-sette', numero:9401, name:'Prova Sette', cardAbility:'', abilita:null, traits:[], traitNames:[], values:tutti(7), valuesBase:tutti(7), groupSides:UNGRUPPO });
    var NOVE = copia({ id:'final-prova-nove', slug:'prova-nove', numero:9402, name:'Prova Nove', cardAbility:'', abilita:null, traits:[], traitNames:[], values:tutti(9), valuesBase:tutti(9), groupSides:UNGRUPPO });
    FINAL_CARDS.push(SETTE, NOVE);
    _sinergieDaFoglioNoto = null;
    var n = 0;
    var fai = function(v, o){ var c = _makeCardDbCard(v, o); c.id = v.id + '-' + o + '-v' + (n++); c.baseId = v.id; return c; };
    var riquadro = function(c){ var t = document.createElement('div'); t.innerHTML = bloccoModificatoriHTML(c); return [].slice.call(t.querySelectorAll('.ct-mod')).map(function(x){ return x.textContent; }); };
    var suoni = [];
    var sfxVero = playSfxFile;
    playSfxFile = function(f){ suoni.push(f); };
    nakamaRpc = async function(){ return null; };

    showPage('game'); startGame(true); await respira(16000);
    var prepara = function(g){ try{ fermaIlConto(); }catch(_){} G.board = {}; G.holes = new Set(); G.destroyedHoles = new Set(); G.gelo = {};
      G.gameOver = false; G.currentPlayer = g; G.turnPlayLocked = false; G.sceltaBersaglio = null; G.vsAI = false; G.premioProssimaGiocata = {1:null, 2:null}; };
    var gioca = async function(carta, giocatore, q, r){ try{ fermaIlConto(); }catch(_){} G.currentPlayer = giocatore; G.turnPlayLocked = false; G.turnBannerActive = false; G.gameOver = false;
      G.p1Hand = (giocatore === 1 ? [carta] : []).concat([fai(SETTE, 1), fai(SETTE, 1)]);
      G.p2Hand = (giocatore === 2 ? [carta] : []).concat([fai(SETTE, 2), fai(SETTE, 2)]);
      _firmaTabellonePrecedente = null; renderBoard(); render(); await respira(250);
      doPlace(carta, giocatore - 1, q, r); await respira(4200); };
    var padrone = function(k){ return G.board[k] ? G.board[k].owner : 0; };

    // ── 1. SCARECROW ────────────────────────────────────────────────────────
    prepara(1);
    dice(!!entry('Scarecrow'), 'Scarecrow c-e- nel catalogo');
    await gioca(fai(entry('Scarecrow'), 1), 1, 0, 0);
    var premio = G.premioProssimaGiocata[1];
    dice(premio && premio.quanto === 2 && premio.ambito === 'HIGHEST' && !premio.soloSeNonConquista, 'giocato Scarecrow, la prossima carta aspetta +2 sul piu- alto', JSON.stringify(premio));
    G.board[key(2,0)] = { card: fai(SETTE, 2), owner: 2 };
    var att = fai(SETTE, 1);
    await gioca(att, 1, 1, 0);
    dice(att.values.E === 9, 'la carta dopo ha il +2 (7 diventa 9)', JSON.stringify(att.values));
    dice(padrone(key(2,0)) === 1, 'e col 9 conquista il 7 (prima combatteva col 7 e non prendeva niente)', 'padrone ' + padrone(key(2,0)));
    dice(!G.premioProssimaGiocata[1], 'il premio e- consumato');
    // Il Grillo invece aspetta l-esito: se la carta conquista, niente premio.
    prepara(1);
    G.premioProssimaGiocata[1] = { quanto:2, ambito:'ALL', da:'Prova Grillo', chiave:'premio_prossima:grillo', postoDa:'grillo', soloSeNonConquista:true };
    G.board[key(2,0)] = { card: fai(SETTE, 2), owner: 2 };
    var forte = fai(NOVE, 1);
    await gioca(forte, 1, 1, 0);
    dice(padrone(key(2,0)) === 1 && forte.values.E === 9 && !G.premioProssimaGiocata[1], 'un premio "solo se non conquista" resta dopo lo scontro: chi conquista non lo prende', JSON.stringify(forte.values));
    prepara(1);
    G.premioProssimaGiocata[1] = { quanto:2, ambito:'ALL', da:'Prova Grillo', chiave:'premio_prossima:grillo', postoDa:'grillo', soloSeNonConquista:true };
    var calmo = fai(SETTE, 1);
    await gioca(calmo, 1, 0, 0);
    dice(calmo.values.E === 9, 'e chi non conquista lo prende', JSON.stringify(calmo.values));

    // ── 2. LA RESA SPEGNE I BANNER ──────────────────────────────────────────
    var acceso = function(id){ var el = document.getElementById(id); return !!(el && el.classList.contains('show')); };
    var qualcunoAcceso = function(){ return ['turn-banner','turn-banner-text','timesup-banner','timesup-content','banner-dim-overlay'].filter(acceso); };
    prepara(1);
    showTurnBanner(1);
    mostraTempoScaduto();
    await respira(80);
    dice(acceso('turn-banner') && acceso('timesup-banner'), 'prima della resa i banner si accendono', qualcunoAcceso().join(','));
    G.currentPlayer = 1; G.gameOver = false;
    surrenderGame();
    dice(qualcunoAcceso().length === 0, 'arrendendosi spariscono subito tutti (cambio turno, tempo scaduto, velo)', qualcunoAcceso().join(','));
    dice(!document.getElementById('game-area').classList.contains('turn-locked') && G.bannerSpenti === true, 'e il tavolo non resta bloccato dal banner');
    suoni = [];
    showTurnBanner(2);
    mostraTempoScaduto();
    await respira(80);
    dice(qualcunoAcceso().length === 0, 'dopo la resa non tornano (showTurnBanner e mostraTempoScaduto non mostrano niente)', qualcunoAcceso().join(','));
    dice(suoni.indexOf('bell.mp3') < 0 && suoni.indexOf('change-turn.mp3') < 0, 'e non suonano', suoni.join(','));

    // in rete: chi preme
    try{ document.getElementById('gameover').classList.remove('show'); }catch(_){}
    var mandati = [];
    var mmVero = mmManda;
    mmManda = function(x){ mandati.push(x); };
    G.bannerSpenti = false; G.gameOver = false; G.currentPlayer = 2;
    PARTITA_RETE = { matchId:'prova', io:1 };
    showTurnBanner(2);
    await respira(60);
    dice(acceso('turn-banner'), 'in rete il banner c-e-');
    surrenderGame();
    var resa = mandati[0] && mandati[0].match_data_send;
    dice(resa && resa.op_code === 12 && qualcunoAcceso().length === 0, 'in rete la resa parte al server e i banner spariscono subito, senza aspettare la risposta', resa && resa.op_code);
    showTurnBanner(1);
    dice(qualcunoAcceso().length === 0, 'e intanto non ne compaiono altri');
    reteMessaggio({ op_code:6, data: btoa(JSON.stringify({ motivo:'resa', chi:1, vincitore:2 })) });
    await respira(60);
    dice(qualcunoAcceso().length === 0, 'arrivata la fine dal server, niente banner', qualcunoAcceso().join(','));
    // in rete: chi riceve la resa dell-altro
    try{ document.getElementById('gameover').classList.remove('show'); }catch(_){}
    G.bannerSpenti = false; G.gameOver = false; G.currentPlayer = 2;
    PARTITA_RETE = { matchId:'prova', io:2 };
    showTurnBanner(1);
    mostraTempoScaduto();
    await respira(60);
    dice(acceso('turn-banner'), 'dall-altra parte il banner c-e-');
    reteMessaggio({ op_code:6, data: btoa(JSON.stringify({ motivo:'resa', chi:1, vincitore:2 })) });
    dice(qualcunoAcceso().length === 0 && G.bannerSpenti === true, 'la resa dell-avversario li spegne subito', qualcunoAcceso().join(','));
    mostraTempoScaduto();
    dice(qualcunoAcceso().length === 0, 'e non tornano');
    mmManda = mmVero; PARTITA_RETE = null;
    try{ document.getElementById('gameover').classList.remove('show'); }catch(_){}

    // ── 3. BUFF E DEBUFF, TUTTI ─────────────────────────────────────────────
    prepara(1);
    var lj = fai(entry('Little John'), 1);
    await gioca(lj, 1, 0, 0);
    var leone = fai(entry('Cowardly Lion'), 1);
    await gioca(leone, 1, 1, 0);
    var righe = riquadro(leone);
    dice(righe.indexOf('+1 ALL from Little John') >= 0 && righe.indexOf('\\u22121 Self') >= 0, 'il Leone accanto a Little John mostra il suo +1 e il suo -1', righe.join(' | '));
    await gioca(fai(NOVE, 2), 2, 2, 0);
    righe = riquadro(leone);
    dice(padrone(key(1,0)) === 2 && righe.indexOf('\\u22121 Self') >= 0 && righe.indexOf('+1 ALL from Little John') < 0, 'conquistato perde il +1 di Little John e tiene il -1', righe.join(' | '));
    // Se il registro non lo racconta (una strada che non lo scrive), il -1 si
    // vede lo stesso, anche con la riga di Little John accanto.
    prepara(1);
    var lj2 = fai(entry('Little John'), 1);
    await gioca(lj2, 1, 0, 0);
    var leone2 = fai(entry('Cowardly Lion'), 1);
    await gioca(leone2, 1, 1, 0);
    leone2.modificatori = {};
    righe = riquadro(leone2);
    dice(righe.indexOf('+1 ALL from Little John') >= 0 && righe.some(function(r){ return /^\\u22121( ALL)? Self$/.test(r); }), 'senza la riga nel registro il -1 compare lo stesso accanto al +1 di Little John', righe.join(' | '));
    // Un buff nuovo non cancella un debuff vecchio della stessa fonte.
    var cavia = fai(SETTE, 1);
    sommaModificatore(cavia, 'foglio:fonte-prova', 'Prova Fonte', -1, '', 'fonte-prova');
    sommaModificatore(cavia, 'foglio:fonte-prova', 'Prova Fonte', +1, '', 'fonte-prova');
    var elenco = elencoModificatori(cavia).map(function(r){ return r.testo; });
    dice(elenco.length === 2 && elenco.indexOf('\\u22121 from Prova Fonte') >= 0 && elenco.indexOf('+1 from Prova Fonte') >= 0, 'un +1 dopo un -1 della stessa fonte: due righe, nessuna cancellata', elenco.join(' | '));
    var cavia2 = fai(SETTE, 1);
    sommaModificatore(cavia2, 'foglio:ladro', 'Robin Hood', -1, 'ALL', 'ladro');
    sommaModificatore(cavia2, 'foglio:ladro', 'Robin Hood', -1, 'ALL', 'ladro');
    elenco = elencoModificatori(cavia2).map(function(r){ return r.testo; });
    dice(elenco.length === 1 && elenco[0] === '\\u22122 ALL from Robin Hood', 'due colpi dello stesso segno restano una riga sola', elenco.join(' | '));
    playSfxFile = sfxVero;
  } catch(err){ dice(false, 'il banco e- arrivato in fondo', err.message + ' ' + String(err.stack || '').split('\\n')[1]); }
  return d.join('\\n');
})()`;

app.whenReady().then(async () => {
  setTimeout(() => { console.log('  NO  il banco non ha finito in tempo'); app.exit(2); }, 240000);
  let carte = null;
  try { const c = JSON.parse(fs.readFileSync(FILE_CATALOGO, 'utf8')); carte = Array.isArray(c) ? c : (c.carte || null); } catch (e) { carte = null; }
  if (!carte) { console.log('  NO  catalogo non letto: ' + FILE_CATALOGO); app.exit(1); return; }
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, frame: false, useContentSize: true,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await win.loadURL(PAGINA);
  win.setPosition(-3200, 0); win.showInactive();
  await new Promise(r => setTimeout(r, 14000));
  await win.webContents.insertCSS('#splash{display:none!important} #tutorial-overlay{display:none!important}');
  await win.webContents.executeJavaScript('_applicaCatalogo(' + JSON.stringify(carte) + '); "ok"');
  const esito = await win.webContents.executeJavaScript(CORPO);
  console.log(esito);
  const no = (esito.match(/^  NO  /gm) || []).length;
  const ok = (esito.match(/^  ok  /gm) || []).length;
  console.log('\n' + ok + ' ok, ' + no + ' NO');
  app.exit(no ? 1 : 0);
});
