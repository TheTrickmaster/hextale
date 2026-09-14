// LA PAGINA /stats/ (v0.80.25).
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-stats.js
//
// Lorenzo: una pagina sotto /stats/ con le statistiche di gioco, che si apre
// solo con la password del sito. Qui la pagina vera, dal disco, con le chiamate
// ad api.hextalegame.com servite da questo banco (nessuna richiesta vera):
//   1. una password sbagliata si ferma nella pagina: nessuna chiamata al server;
//   2. quella giusta apre la sessione (autenticazione custom, chiave del server
//      in Basic) e chiede hx_stats col Bearer, mandando la password;
//   3. le sei sezioni del file di Lorenzo, coi numeri calcolati dal server vero
//      (calcolaStatistiche su dati inventati), e la tendina delle carte;
//   4. Refresh richiede, e un errore del server si dice;
//   5. a 400px la pagina non scorre di lato.
// Il banco non usa dal-disco: le https le serve tutte lui.
const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/stats/index.html';

// le statistiche, fatte dal codice del server
const mondo = { console, Date, Math, JSON, parseInt, parseFloat, isFinite, String, Object, Array, Error, Number, RegExp };
mondo.global = mondo;
vm.createContext(mondo);
new vm.Script(fs.readFileSync(path.join(RADICE, 'server', 'nakama', 'index.js'), 'utf8')).runInContext(mondo);
const T0 = Date.UTC(2026, 8, 10, 8, 0, 0);
const STATS = JSON.parse(JSON.stringify(mondo.calcolaStatistiche({
  sessioni: [
    { u: 'u1', s: 'a', inizio: T0, fine: T0 + 600000, piattaforma: 'browser', caricamentoMs: 3000, pagine: { mainmenu: 60000, game: 300000 }, errori: 2, erroriTesti: ['boom'], erroriRete: 1 },
    { u: 'u2', s: 'b', inizio: T0, fine: T0 + 1200000, piattaforma: 'electron', caricamentoMs: 5000, pagine: { mainmenu: 120000 }, errori: 0, erroriTesti: [], erroriRete: 0 }
  ],
  partiteServer: [{ pvp: true, id: 'M1', inizio: T0 + 10000, fine: T0 + 310000, durataMs: 300000, modo: 'finita', vincitore: 1,
    giocatori: [{ u: 'u1', rank: 2, mazzo: ['final-alice', 'final-baloo'] }, { u: 'u2', rank: 5, mazzo: ['final-baloo', 'final-crow'] }],
    mosse: [[1, 1, 'final-alice', '0,0', 4000], [2, 2, 'final-crow', '1,0', 6000], [3, 1, 'final-baloo', '-1,0', 2000]] }],
  logPartite: [],
  possessi: [], stagioni: [], creati: {},
  catalogo: [{ id: 'final-alice', name: 'Alice' }, { id: 'final-baloo', name: 'Baloo' }, { id: 'final-crow', name: 'Crow' }],
  esclusi: []
}, T0 + 86400000)));

const richieste = [];
let rpcRompi = false;
app.whenReady().then(async () => {
  setTimeout(() => { console.log('  NO  il banco non ha finito in tempo'); app.exit(2); }, 90000);
  session.defaultSession.protocol.handle('https', async (req) => {
    const u = new URL(req.url);
    const corpo = req.method === 'POST' ? await req.text() : '';
    richieste.push({ url: req.url, auth: req.headers.get('authorization') || '', corpo: corpo });
    const json = (stato, dati) => new Response(JSON.stringify(dati), { status: stato, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    if (u.host !== 'api.hextalegame.com') return new Response('', { status: 404 });
    if (u.pathname === '/v2/account/authenticate/custom') return json(200, { token: 'gettone-di-prova', created: false });
    if (u.pathname === '/v2/rpc/hx_stats') {
      if (rpcRompi) return json(500, { code: 13, message: 'server giu' });
      let d = {};
      try { d = JSON.parse(corpo); } catch (e) { d = {}; }
      if (d.parola !== 'prova') return json(500, { code: 13, message: 'That is not the password.' });
      return json(200, STATS);
    }
    return new Response('', { status: 404 });
  });

  const win = new BrowserWindow({ show: false, width: 1400, height: 900, useContentSize: true,
    webPreferences: { contextIsolation: false, backgroundThrottling: false } });
  win.webContents.on('console-message', (e, livello, msg) => { if (livello >= 3) console.log('[console] ' + msg); });
  await win.loadURL(PAGINA);
  win.setPosition(-3200, 0); win.showInactive();
  const js = (codice) => win.webContents.executeJavaScript(codice);
  const d = [];
  const dice = (ok, n, x) => d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : ''));
  const respira = (ms) => new Promise(r => setTimeout(r, ms));
  try {
    dice(await js('window.isSecureContext && !!(crypto && crypto.subtle)'), 'la pagina ha crypto.subtle (come su https)');
    dice(await js('!document.getElementById("cancello").hidden && document.getElementById("pagina").hidden'), 'si apre sul cancello');
    // la password "giusta" del banco: l'impronta la calcola la pagina stessa
    await js('impronta("prova").then(function(h){ STATS_IMPRONTA = h; return h; })');
    await js('document.getElementById("parola").value = "nope"; document.getElementById("modulo").requestSubmit(); 1');
    await respira(400);
    dice(await js('document.getElementById("cancello-esito").textContent') === 'That is not the password.' && richieste.length === 0, 'password sbagliata: la pagina lo dice e non chiama il server', richieste.length);
    await js('document.getElementById("parola").value = "prova"; document.getElementById("modulo").requestSubmit(); 1');
    await respira(1200);
    const auth = richieste.filter(r => /authenticate\/custom/.test(r.url))[0];
    const rpc = richieste.filter(r => /hx_stats/.test(r.url))[0];
    dice(auth && /create=true/.test(auth.url) && auth.auth === 'Basic ' + Buffer.from('8db52c53b62e208eebb8cb59dfbf159c85855683:').toString('base64') && JSON.parse(auth.corpo).id === 'hextale-stats-page', 'la sessione si apre con l-account della pagina e la chiave del server', auth && auth.url);
    dice(rpc && rpc.auth === 'Bearer gettone-di-prova' && JSON.parse(rpc.corpo).parola === 'prova' && /\?unwrap/.test(rpc.url), 'hx_stats col Bearer, e la password viaggia per il server', rpc && rpc.url);
    dice(await js('document.getElementById("cancello").hidden && !document.getElementById("pagina").hidden'), 'aperta: il cancello sparisce');
    const sezioni = await js('Array.from(document.querySelectorAll(".sezione")).map(function(s){ return s.id + ":" + s.querySelector("h2").textContent; }).join("|")');
    dice(sezioni === 'tecniche:Technicals|design:Game design|strategia:Strategy|carte:Cards|tabellone:Board analytics|progressione:Progression and retention', 'le sei sezioni del file', sezioni);
    const testo = await js('document.getElementById("griglia").innerText');
    const voci = ['Sessions', 'Average session duration', 'Abandoned matches', 'Crashes / JS errors', 'Users on browser', 'Users on Electron', 'Total connection errors', 'Average loading time',
      'Total matches played', 'Average matches played in a day', 'Average match duration', 'Average time per turn', 'Deck composition', 'Win rate of players with lower ranking', 'Win rate of players with higher ranking', 'Time spent on each page',
      '20 most used cards', '20 least used cards', 'Top 10 cards in winning decks', '3 top opener cards', 'Top 5 first moves', 'Top 5 combinations',
      'Favorite starting tiles', 'Comeback frequency', 'Avg number of comebacks during a single match',
      'Avg duration of first session', 'N° of matches during first session', 'Average sessions total', 'Login after 1 day', 'Login after 3 days', 'Login after 7 days',
      'Average level reached', 'Average rank reached', 'Average number of packs obtained', 'Average number of packs opened', 'Average number of cards obtained', 'Average number of upgrades done', 'Daily quests completion'];
    const mancano = voci.filter(v => testo.toLowerCase().indexOf(v.toLowerCase()) < 0);
    dice(mancano.length === 0, 'ci sono tutte le voci del file', mancano.join(', '));
    const valore = (nome) => js('(function(){ var r = Array.from(document.querySelectorAll(".riga")).filter(function(x){ var n = x.querySelector(".nome"); return n && n.textContent === ' + JSON.stringify(nome) + '; })[0]; return r ? r.querySelector(".valore").childNodes[0].textContent : null; })()');
    dice(await valore('Sessions') === '2' && await valore('Average session duration') === '15m 00s' && await valore('Average loading time') === '4.0 s', 'i numeri: sessioni, durata, caricamento', [await valore('Sessions'), await valore('Average session duration'), await valore('Average loading time')].join(' / '));
    dice(await valore('Win rate of players with lower ranking') === '100%' && await valore('Average time per turn') === '4.0 s', 'win rate e tempo del turno', await valore('Average time per turn'));
    dice(/Alice/.test(testo) && /Collecting since/.test(await js('document.getElementById("da-quando").textContent')), 'i nomi delle carte, e da quando si raccoglie');
    const opzioni = await js('document.getElementById("carta-scelta").options.length');
    dice(opzioni === 3, 'la tendina delle carte', opzioni);
    await js('var s = document.getElementById("carta-scelta"); s.value = "final-crow"; s.dispatchEvent(new Event("change")); 1');
    const dettaglio = await js('document.getElementById("carta-dettaglio").innerText');
    dice(/Usage/.test(dettaglio) && /Performance/.test(dettaglio) && /Most used position\s*1,0/.test(dettaglio) && /Win rate when played\s*0%/.test(dettaglio), 'scelta una carta, la sua scheda', dettaglio.replace(/\s+/g, ' ').slice(0, 160));
    const prima = richieste.length;
    await js('document.getElementById("aggiorna").click(); 1');
    await respira(800);
    dice(richieste.length === prima + 1 && /hx_stats/.test(richieste[richieste.length - 1].url), 'Refresh richiede (con la sessione gia- aperta)', richieste.length - prima);
    rpcRompi = true;
    await js('document.getElementById("aggiorna").click(); 1');
    await respira(800);
    dice(/Could not load the stats: server giu/.test(await js('document.getElementById("errore-dati").textContent')), 'un errore del server si dice', await js('document.getElementById("errore-dati").textContent'));
    dice(!/localStorage|sessionStorage|document\.cookie/.test(fs.readFileSync(path.join(RADICE, 'stats', 'index.html'), 'utf8')), 'niente nel browser (storage e cookie)');
    win.setContentSize(400, 800);
    await respira(500);
    const larghezza = await js('[document.documentElement.scrollWidth, window.innerWidth]');
    dice(larghezza[0] <= larghezza[1], 'a 400px non scorre di lato', larghezza.join(' su '));
  } catch (err) { dice(false, 'il banco e- arrivato in fondo', err.message); }
  console.log(d.join('\n'));
  const no = d.filter(x => /^  NO/.test(x)).length;
  console.log('\n' + (d.length - no) + ' ok, ' + no + ' NO');
  app.exit(no ? 1 : 0);
});
