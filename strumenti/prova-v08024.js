// LA CARTA SOTTO AL PUNTATORE DELL'AVVERSARIO, E LE DUE RIGHE DEL MENU (v0.80.24).
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-v08024.js
//
//   1. Lorenzo: "se un giocatore avversario fa hover su una carta quando si
//      gioca online, quella carta dovrebbe alzarsi anche al giocatore in
//      locale". Da questa parte: passando sopra a una carta della propria mano
//      parte op 19 con l'id della carta; uscendo, o premendola, null; tre carte
//      di fila in pochi millisecondi mandano solo l'ultima. Dall'altra: op 20
//      alza il dorso di quella carta (senza passare davanti alle vicine), la
//      carta dopo rimette giu' quella di prima, null le rimette giu' tutte, un
//      ventaglio rifatto da capo la rialza, e una carta "mia" non si tocca.
//   2. Lorenzo: #mm2-online a top 400px e #mm2-cercano a top 430px.
//   3. La quest Mythic si conta sulle Mythic (e non piu' sulle Timeless).
const { app, BrowserWindow } = require('electron');
require('./dal-disco');   // v0.80.22 — gli asset di hextalegame.com dal disco, non dal sito
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
  var q = function(s){ return document.querySelector(s); };
  try {
    // ── 2. le due righe del menu ────────────────────────────────────────────
    showPage('mainmenu');
    var finoA = performance.now();
    await respira(200);
    while(transizioneInCorso() && performance.now() - finoA < 4000) await respira(50);
    await respira(300);
    mm2Vista('matchmaking');
    await respira(600);
    var top = function(s){ return getComputedStyle(q(s)).top; };
    // v0.80.25 — tre righe: 370, 400, 430 (vedi prova-v08025)
    dice(top('#mm2-online') === '370px', '#mm2-online a top 370px (v0.80.25)', top('#mm2-online'));
    dice(top('#mm2-cercano') === '400px', '#mm2-cercano a top 400px (v0.80.25)', top('#mm2-cercano'));
    // offsetTop e non il rettangolo a schermo: #game-root e' scalato alla finestra
    dice(q('#mm2-cercano').offsetTop - q('#mm2-online').offsetTop === 30, 'trenta pixel l-una dall-altra', q('#mm2-cercano').offsetTop - q('#mm2-online').offsetTop);

    // ── 4. il riavvio annunciato ────────────────────────────────────────────
    var ov = q('#riavvio-overlay');
    var testoR = function(){ return q('#riavvio-testo').textContent; };
    var visto = function(){ return ov.classList.contains('show') && getComputedStyle(ov).display !== 'none'; };
    var adesso = Date.now();
    riavvioDalServer({ alle: adesso + 300000, ora: adesso });
    dice(visto() && testoR() === 'Servers will restart in 5 minutes', 'annunciato: Servers will restart in 5 minutes', testoR());
    dice(q('#riavvio-ok .hxb-label').textContent === 'Understood', 'col pulsante Understood');
    dice(Number(getComputedStyle(ov).zIndex) > 4560, 'sopra alle altre finestre', getComputedStyle(ov).zIndex);
    q('#riavvio-ok').click();
    dice(!visto(), 'Understood la chiude');
    riavvioDalServer({ alle: adesso + 300000, ora: adesso + 20 });
    dice(!visto(), 'il battito dopo, con lo stesso annuncio, non la riapre');
    // l'orologio del server due minuti avanti: conta il tempo che resta, non l'ora
    riavvioAnnulla();
    var server = Date.now() + 120000;
    riavvioDalServer({ alle: server + 61500, ora: server });
    dice(visto() && testoR() === 'Servers will restart in 1 minute', 'a un minuto e mezzo secondo: 1 minute (l-orologio del server non conta)', testoR());
    q('#riavvio-ok').click();
    await respira(2200);
    dice(visto() && /^Servers will restart in (59|60) seconds$/.test(testoR()), 'chiusa, a un minuto si riapre col conto alla rovescia', testoR());
    await respira(1100);
    dice(/^Servers will restart in (57|58|59) seconds$/.test(testoR()), 'e il conto scende', testoR());
    q('#riavvio-ok').click();
    await respira(1000);
    dice(!visto(), 'chiusa di nuovo durante il conto, non si riapre piu-');
    riavvioAnnulla();
    adesso = Date.now();
    riavvioDalServer({ alle: adesso + 1200, ora: adesso });
    dice(visto() && /seconds?$/.test(testoR()), 'annunciato a meno di un minuto: subito il conto', testoR());
    await respira(1600);
    dice(visto() && testoR() === 'Servers are restarting now', 'a zero dice che si sta riavviando, e resta aperta', testoR());
    riavvioDalServer(null);
    dice(!visto() && _riavvio === null, 'il server ripartito (niente annuncio) la chiude');
    var rpcVeroR = nakamaRpc, sessVeraR = sessioneAccount, rispostaR = null;
    nakamaRpc = function(){ return Promise.resolve(rispostaR); };
    sessioneAccount = { token: 'prova' };
    adesso = Date.now();
    rispostaR = { giocatori: 3, cercano: 0, riavvio: { alle: adesso + 300000, ora: adesso } };
    await aggiornaGiocatoriOnline();
    dice(visto() && testoR() === 'Servers will restart in 5 minutes', 'arriva col battito di hx_giocatori');
    rispostaR = { giocatori: 3 };
    await aggiornaGiocatoriOnline();
    dice(visto() && _riavvio !== null, 'un server di prima (senza il campo) non tocca niente');
    rispostaR = { giocatori: 3, cercano: 0, riavvio: null };
    await aggiornaGiocatoriOnline();
    dice(!visto() && _riavvio === null, 'e il battito senza annuncio la chiude');
    nakamaRpc = rpcVeroR; sessioneAccount = sessVeraR;

    // ── 3. la quest Mythic ──────────────────────────────────────────────────
    questAzzeraConto();
    dice('flip_mythic' in QUEST_CONTO && !('flip_timeless' in QUEST_CONTO), 'il conto ha flip_mythic e non flip_timeless', JSON.stringify(QUEST_CONTO));
    questSegnaConquiste(1, ['0,0', '1,0', '2,0'], { '0,0': { card: { rarity:'mythic' } }, '1,0': { card: { rarity:'timeless' } }, '2,0': { card: { rarity:'common' } } });
    dice(QUEST_CONTO.flip_mythic === 1 && QUEST_CONTO.flip === 3, 'girate una Mythic, una Timeless e una Common: una sola conta per la Mythic', JSON.stringify(QUEST_CONTO));
    dice(QUEST_CONTA_IN_PARTITA.flipmythic === 'flip_mythic' && !QUEST_CONTA_IN_PARTITA.fliptimeless, 'e il popup in partita la riconosce');
    questAzzeraConto();

    // ── 1. la carta sotto al puntatore ──────────────────────────────────────
    var modello = FINAL_CARDS.find(function(e){ return e && e.values && !Array.isArray(e.values); });
    var tutti = function(v){ return {NE:v,E:v,SE:v,SW:v,W:v,NW:v}; };
    var finta = function(id, n, v){ return Object.assign(JSON.parse(JSON.stringify(modello)), { id:id, slug:id, numero:n, name:id, rarity:'common', cardAbility:'', abilita:null, traits:[], traitNames:[], values:tutti(v), valuesBase:tutti(v), groupSides:[['NE','E','SE','SW','W','NW']] }); };
    var UNO = finta('prova-uno-h', 9801, 1);
    FINAL_CARDS.push(UNO);
    var n = 0;
    var fai = function(o, mazzo){ var c = _makeCardDbCard(UNO, o); c.id = 'prova-h-' + o + '-' + (n++); c.baseId = UNO.id; c.idDelMazzo = mazzo; return c; };

    showPage('game'); startGame(true); await respira(16000);
    try{ fermaIlConto(); }catch(_){}
    try{ stopAiThinkingHover(); }catch(_){}
    var mandati = [], mmVero = mmManda;
    mmManda = function(m){ mandati.push(m); };
    var op19 = function(){ return mandati.filter(function(m){ return m.match_data_send && m.match_data_send.op_code === 19; }).map(function(m){ return JSON.parse(atob(m.match_data_send.data)).indice; }); };
    PARTITA_RETE = { matchId:'prova', io:1, numeroTurno:3, turno:1, scadenza: Date.now() + 60000 };
    G.gameOver = false; G.currentPlayer = 1; G.turnPlayLocked = false; G.turnBannerActive = false; G.sceltaBersaglio = null;
    G.p1Hand = [fai(1, 'final-mia-a'), fai(1, 'final-mia-b'), fai(1, 'final-mia-c')];
    // v0.80.25 — come in rete: le carte dell'avversario sono finte, tutte uguali
    G.p2Hand = [fai(2, 'coperta'), fai(2, 'coperta'), fai(2, 'coperta'), fai(2, 'coperta')];
    _firmaManoPrecedente['p1-hand-fan'] = null; _firmaManoPrecedente['p2-hand-fan'] = null;
    renderHand('p1-hand-fan', G.p1Hand, 0); renderHand('p2-hand-fan', G.p2Hand, 1);
    await respira(300);

    // da questa parte
    var zone = Array.from(document.querySelectorAll('#p1-hand-fan .hand-card-hitzone'));
    var sue = Array.from(document.querySelectorAll('#p2-hand-fan .hand-card-hitzone'));
    dice(zone.length === 3, 'la mia mano ha le sue tre zone sensibili', zone.length + ' (le sue: ' + sue.length + ')');
    await respira(120);
    zone[0].dispatchEvent(new MouseEvent('mouseenter'));
    var primo = op19();
    dice(primo.length === 1 && primo[0] === 0, 'passando sopra a una mia carta parte op 19 col suo posto nella mano (v0.80.25: non la carta)', JSON.stringify(primo));
    zone[0].dispatchEvent(new MouseEvent('mouseleave'));
    zone[1].dispatchEvent(new MouseEvent('mouseenter'));
    zone[1].dispatchEvent(new MouseEvent('mouseleave'));
    zone[2].dispatchEvent(new MouseEvent('mouseenter'));
    dice(op19().length === 1, 'tre carte di fila subito dopo: per ora niente');
    await respira(150);
    var dopo = op19();
    dice(dopo.length === 2 && typeof dopo[1] === 'number' && dopo[1] !== primo[0], 'e poi parte solo l-ultima', JSON.stringify(dopo));
    await respira(120);
    zone[2].setPointerCapture = function(){};   // un pointerdown finto non ha un puntatore da catturare
    zone[2].dispatchEvent(new MouseEvent('pointerdown', { bubbles:true }));
    await respira(20);
    dice(op19().length === 3 && op19()[2] === null, 'premendola (si trascina) parte null', JSON.stringify(op19()));
    zone[2].dispatchEvent(new MouseEvent('mouseleave'));
    await respira(150);
    dice(op19().length === 3, 'e uscendo dopo non si ripete (era gia- null)', JSON.stringify(op19()));
    var reteVera = PARTITA_RETE;
    PARTITA_RETE = null;
    zone[0].dispatchEvent(new MouseEvent('mouseenter'));
    await respira(150);
    dice(op19().length === 3, 'fuori rete non parte niente');
    zone[0].dispatchEvent(new MouseEvent('mouseleave'));
    PARTITA_RETE = reteVera;

    // dall'altra
    var wrapSua = function(i){ var c = G.p2Hand[i]; return q('#p2-hand-fan .hand-card-wrap[data-carta="' + c.id + '"]'); };
    var alzata = function(w){ return !!w && w.classList.contains('hover-lift') && /translateY\\(-\\d+px\\)/.test(w.style.transform); };
    var b = wrapSua(1);
    var zPrima = b.style.zIndex, tPrima = b.style.transform;
    reteMessaggio({ op_code:20, data: btoa(JSON.stringify({ di:2, indice:1, quante:4 })) });
    dice(alzata(b), 'op 20: il dorso di quella carta si alza', b.style.transform);
    dice(b.style.zIndex === zPrima, 'senza passare davanti alle vicine (come il bot)', zPrima + ' -> ' + b.style.zIndex);
    dice(!alzata(wrapSua(0)) && !alzata(wrapSua(2)), 'le altre restano giu-');
    var c = wrapSua(2);
    reteMessaggio({ op_code:20, data: btoa(JSON.stringify({ di:2, indice:2, quante:4 })) });
    dice(alzata(c) && !alzata(b) && b.style.transform === tPrima, 'la carta dopo rimette giu- quella di prima, com-era', b.style.transform);
    _firmaManoPrecedente['p2-hand-fan'] = null;
    renderHand('p2-hand-fan', G.p2Hand, 1);
    var c2 = wrapSua(2);
    dice(c2 !== c && alzata(c2), 'un ventaglio rifatto da capo la rialza');
    reteMessaggio({ op_code:20, data: btoa(JSON.stringify({ di:2, indice:null, quante:4 })) });
    dice(!Array.from(document.querySelectorAll('#p2-hand-fan .hand-card-wrap')).some(alzata), 'null le rimette giu- tutte');
    reteMessaggio({ op_code:20, data: btoa(JSON.stringify({ di:1, indice:0, quante:3 })) });
    dice(!Array.from(document.querySelectorAll('#p1-hand-fan .hand-card-wrap')).some(alzata), 'un op 20 che parla della mia mano non tocca niente');
    reteMessaggio({ op_code:20, data: btoa(JSON.stringify({ di:2, indice:9, quante:4 })) });
    dice(!Array.from(document.querySelectorAll('#p2-hand-fan .hand-card-wrap')).some(alzata), 'una carta che non ha in mano non alza niente');
    reteMessaggio({ op_code:20, data: btoa(JSON.stringify({ di:2, indice:3, quante:4 })) });
    dice(_manoSopraAvversario !== null, '(prima della partita nuova ce n-e- una)');
    mmManda = mmVero; PARTITA_RETE = null;
    startGame(true); await respira(2500);
    dice(_manoSopraAvversario === null && _manoSopraAlzata === null && _manoSopraDetta === null, 'una partita nuova dimentica tutto');
  } catch(err){ dice(false, 'il banco e- arrivato in fondo', err.message + ' ' + String(err.stack || '').split('\\n').slice(1,3).join(' | ')); }
  return d.join('\\n');
})()`;

app.whenReady().then(async () => {
  setTimeout(() => { console.log('  NO  il banco non ha finito in tempo'); app.exit(2); }, 120000);
  let carte = null;
  try { const c = JSON.parse(fs.readFileSync(FILE_CATALOGO, 'utf8')); carte = Array.isArray(c) ? c : (c.carte || null); } catch (e) { carte = null; }
  if (!carte) { console.log('  NO  catalogo non letto: ' + FILE_CATALOGO); app.exit(1); return; }
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, frame: false, useContentSize: true,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  win.webContents.on('console-message', (e, livello, msg) => { if (livello >= 3) console.log('[console] ' + msg); });
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
