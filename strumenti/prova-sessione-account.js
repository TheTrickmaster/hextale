// CIO' CHE SI SA DI UN ACCOUNT RESTA DI QUELL'ACCOUNT (v0.80.17).
//
//   desktop/node_modules/electron/dist/electron.exe strumenti/prova-sessione-account.js
//
// Il 13 set 2026 un giocatore si e' ritrovato tutte e 107 le carte e il menu di
// debug aperto, mentre per il server era un giocatore normale: in quella pagina
// era arrivata la risposta di un account admin quando la sessione era gia' di un
// altro. La rete qui e' finta (fetch risponde da qui, coi tempi che servono) e
// i token sono JWT finti con dentro l'uid. Si guarda che:
//   1. una risposta partita per l'account A e arrivata quando la sessione e' di
//      B venga scartata, e che passando a B lo stato di A sparisca;
//   2. un rinnovo del token dello STESSO account non butti via niente;
//   3. uscendo, una risposta in volo non si applichi e lo stato si azzeri;
//   4. la verifica del codice usi la sessione appena nata, non quella vecchia.
const { app, BrowserWindow } = require('electron');
require('./dal-disco');   // v0.80.22 — gli asset di hextalegame.com dal disco, non dal sito
const path = require('path');
const { pathToFileURL } = require('url');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

const CORPO = `(async function(){
  var d = [];
  var dice = function(ok, n, x){ d.push((ok ? '  ok  ' : '  NO  ') + n + (x !== undefined ? '   [' + x + ']' : '')); };
  var respira = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var b64 = function(o){ return btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\\+/g, '-').replace(/\\//g, '_'); };
  var token = function(uid, n){ return b64({ alg:'HS256' }) + '.' + b64({ uid:uid, exp:Math.floor(Date.now()/1000) + 3600, n:n || 0 }) + '.firma'; };
  try {
    var sp = document.getElementById('splash'); if(sp) sp.remove();
    var tutte = {};
    (FINAL_CARDS || []).forEach(function(c){ tutte[c.slug] = 4; });

    // La rete finta: ogni chiamata dice cosa risponde e dopo quanto.
    var piano = {};
    var viste = [];
    fetch = function(url, opzioni){
      var nome = String(url).split('/v2/rpc/')[1] || String(url);
      nome = nome.split('?')[0];
      viste.push({ nome:nome, auth:(opzioni && opzioni.headers && opzioni.headers.Authorization) || '' });
      var p = piano[nome] || { dopo:0, corpo:{} };
      return new Promise(function(r){ setTimeout(function(){
        r({ ok:true, status:200, text: async function(){ return JSON.stringify(typeof p.corpo === 'function' ? p.corpo() : p.corpo); } });
      }, p.dopo); });
    };

    // ── 1. la risposta di A arriva quando c'e' B ─────────────────────────
    nakamaSalvaSessione({ token: token('A') }, 'a@x');
    piano.hx_avvio = { dopo:300, corpo:{ possedute:tutte, copie:{}, admin:true, invariato:true } };
    var esito1 = null;
    var inVolo = caricaCarteDalServer().then(function(){ esito1 = 'applicata'; }, function(e){ esito1 = 'scartata ' + e.codice; });
    await respira(60);
    MAZZI = [{ id:'mA', nome:'Di A', carte:[] }]; MAZZO_SCELTO = 'mA'; BUSTINE_VINTE = 3; BUSTINE_TESORO = 2;
    nakamaSalvaSessione({ token: token('B') }, 'b@x');
    dice(!GIOCATORE_ADMIN && !Object.keys(CARTE_POSSEDUTE).length && !_possessoNoto, 'passando a un altro account, carte e admin del precedente spariscono subito');
    dice(MAZZI.length === 0 && MAZZO_SCELTO === null && BUSTINE_VINTE === 0 && BUSTINE_TESORO === 0, 'e con loro mazzi e pacchetti');
    await inVolo;
    dice(esito1 === 'scartata 409', 'la risposta partita per A e arrivata con B viene scartata', esito1);
    dice(!GIOCATORE_ADMIN && !Object.keys(CARTE_POSSEDUTE).length, 'e B non si ritrova ne- l-admin ne- le carte di A', 'admin ' + GIOCATORE_ADMIN + ', ' + Object.keys(CARTE_POSSEDUTE).length + ' carte');
    dice(!debugPermesso(), 'il menu di debug resta chiuso');

    // ── 2. il rinnovo dello stesso account ───────────────────────────────
    piano.hx_avvio = { dopo:200, corpo:{ possedute:{ 'una':1 }, copie:{}, admin:false, invariato:true } };
    var esito2 = null;
    var inVolo2 = caricaCarteDalServer().then(function(){ esito2 = 'applicata'; }, function(e){ esito2 = 'scartata ' + (e.codice || e.message); });
    await respira(50);
    nakamaSalvaSessione({ token: token('B', 2), refresh_token:'r' }, '', sessioneAccount);
    await inVolo2;
    dice(CARTE_POSSEDUTE.una === 1, 'un token rinnovato dello stesso account non butta via la risposta', esito2);

    // ── 3. si esce mentre una risposta e' in volo ───────────────────────
    piano.hx_avvio = { dopo:200, corpo:{ possedute:tutte, copie:{}, admin:true, invariato:true } };
    var esito3 = null;
    var inVolo3 = caricaCarteDalServer().then(function(){ esito3 = 'applicata'; }, function(e){ esito3 = 'scartata ' + e.codice; });
    await respira(50);
    nakamaDimenticaSessione();
    await inVolo3;
    dice(esito3 === 'scartata 409' && !GIOCATORE_ADMIN && !_possessoNoto && !Object.keys(CARTE_POSSEDUTE).length, 'uscendo, la risposta in volo non si applica e lo stato torna vuoto', esito3);

    // ── 4. la verifica del codice ────────────────────────────────────────
    nakamaSalvaSessione({ token: token('VECCHIO') }, 'v@x');
    var vecchia = sessioneAccount;
    _verificaSessione = { token: token('NUOVO'), email:'n@x' };
    _codiceScritto = function(){ return '123456'; };
    accessoOccupato = function(){}; accessoMessaggio = function(){}; _svuotaCodice = function(){};
    var entrato = null;
    accessoEntra = async function(s){ entrato = s; };
    piano.hx_verifica_prova = { dopo:10, corpo:{ ok:true } };
    viste.length = 0;
    await completaRegistrazione(null);
    await respira(50);
    var prova = viste.filter(function(v){ return v.nome === 'hx_verifica_prova'; })[0];
    dice(prova && prova.auth.indexOf(token('NUOVO')) >= 0, 'il codice si prova con la sessione appena nata, non con quella che c-era');
    dice(entrato && nakamaUtenteDaToken(entrato.token) === 'NUOVO' && nakamaUtenteDaToken(sessioneAccount.token) === 'NUOVO', 'e si entra col nuovo account');
    dice(vecchia !== sessioneAccount, 'la sessione vecchia non e- piu- quella attiva');
  } catch(e){
    dice(false, 'il banco e- arrivato in fondo', e.message + ' ' + (e.stack || '').split('\\n')[1]);
  }
  return d.join('\\n');
})()`;

app.whenReady().then(async () => {
  setTimeout(() => { console.log('  NO  il banco non ha finito in tempo'); app.exit(2); }, 120000);
  const win = new BrowserWindow({ show:false, width:1920, height:1080, frame:false, useContentSize:true,
    webPreferences:{ contextIsolation:false, webSecurity:false, backgroundThrottling:false } });
  await win.loadURL(pathToFileURL(path.join(__dirname, '..', 'play', 'index.html')).href);
  win.setPosition(-3200, 0); win.showInactive();
  await new Promise(r => setTimeout(r, 12000));
  await win.webContents.insertCSS('#splash{display:none!important} #tutorial-overlay{display:none!important}');
  const esito = await win.webContents.executeJavaScript(CORPO);
  console.log(esito);
  const no = (esito.match(/^  NO  /gm) || []).length;
  const ok = (esito.match(/^  ok  /gm) || []).length;
  console.log('\n' + ok + ' ok, ' + no + ' NO');
  app.exit(no ? 1 : 0);
});
