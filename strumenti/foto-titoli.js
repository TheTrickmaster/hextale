// LE BARRE DEL TITOLO DELLE FINESTRE, UNA FOTO PER FINESTRA.
//
//     $ELECTRON strumenti/foto-titoli.js <cartella>
//
// v0.79.96 — le finestre hanno lo stendardo nuovo (.hx-titolo). Questo
// strumento apre ogni finestra con la sua funzione vera, la fotografa e ne
// misura la barra:
//   - attaccata al bordo superiore del riquadro (distanza dal bordo interno: 0);
//   - centrata nel riquadro;
//   - il titolo sta dentro allo stendardo (297px) o ne esce.
// Le foto servono a Lorenzo per dire quali titoli vanno accorciati; le misure
// dicono se la barra e' montata bene.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const RADICE = path.resolve(__dirname, '..');
const PAGINA = 'file:///' + RADICE.split(path.sep).join('/') + '/play/index.html';
const CARTELLA = process.argv[2] || path.join(RADICE, 'foto-titoli');
fs.mkdirSync(CARTELLA, { recursive: true });

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

// nome, codice che la apre, riquadro che contiene la barra
const FINESTRE = [
  ['login',         "var ss=document.getElementById('start-screen'); if(ss) ss.style.display=''; showPage('start'); var sa=document.getElementById('start-accesso'); if(sa) sa.classList.add('show'); mostraModuloAccesso('login')",          '#modulo-login .hx-pannello'],
  ['registrazione', "var ss=document.getElementById('start-screen'); if(ss) ss.style.display=''; showPage('start'); var sa=document.getElementById('start-accesso'); if(sa) sa.classList.add('show'); mostraModuloAccesso('registrazione')",  '#modulo-registrazione .hx-pannello'],
  ['recupero',      "var ss=document.getElementById('start-screen'); if(ss) ss.style.display=''; showPage('start'); var sa=document.getElementById('start-accesso'); if(sa) sa.classList.add('show'); mostraModuloAccesso('recupero')",       '#modulo-recupero .hx-pannello'],
  ['nuovapwd',      "var ss=document.getElementById('start-screen'); if(ss) ss.style.display=''; showPage('start'); var sa=document.getElementById('start-accesso'); if(sa) sa.classList.add('show'); mostraModuloAccesso('nuovapwd')",       '#modulo-nuovapwd .hx-pannello'],
  ['verifica',      "var ss=document.getElementById('start-screen'); if(ss) ss.style.display=''; showPage('start'); var sa=document.getElementById('start-accesso'); if(sa) sa.classList.add('show'); mostraModuloAccesso('verifica')",       '#modulo-verifica .hx-pannello'],
  ['username',      "var ss=document.getElementById('start-screen'); if(ss) ss.style.display='none'; showPage('mainmenu'); apriModaleUsername(false)",          '#username-box .hx-pannello'],
  ['nca',           "apriAccordo(function(){})",                                 '#nca-box .hx-pannello'],
  ['disclaimer',    "apriDisclaimer(function(){})",                              '#disclaimer-box .hx-pannello'],
  ['starter',       "apriSceltaStarter()",                                        '#starter-pannello'],
  ['mm2-deck',      "showPage('mainmenu'); mm2ApriSceltaMazzo()",                '#mm2-deck-pannello'],
  ['avviso',        "apriAvviso('Notice', 'This is a notice.', false)",          '#avviso-box .hx-pannello'],
  ['avviso-errore', "apriAvviso('Can\\'t collect', 'The cards could not be collected. Check your connection and try again.', true)", '#avviso-box .hx-pannello'],
  ['aggiorna',      "vestiTitoli(); document.getElementById('aggiorna-overlay').classList.add('show')", '#aggiorna-box .hx-pannello'],
  ['rank',          "apriModaleNuovoRank('silver-1')",                            '#rank-box .hx-pannello'],
  ['patch-notes',   "mostraPatchNotes([{ versione:'v0.79.96', voci:['Minor bug fixes and improvements'] }], {})", '#patch-notes-pannello'],
  ['settings',      "showPage('mainmenu'); openSettingsModal()",                 '#settings-pannello'],
  ['customize',     "showPage('mainmenu'); openSettingsModal(); apriCustomize()", '#customize-pannello'],
  ['avatar',        "apriSceltaAvatar()",                                         '#avatar-box .hx-pannello'],
  ['elimina',       "apriEliminaAccount()",                                       '#elimina-box .hx-pannello'],
  ['bug',           "apriSegnalazione()",                                         '#bug-pannello'],
  ['report',        "apriReport()",                                               '#report-pannello'],
  ['debug',         "openDebugModal()",                                           '#debug-pannello'],
  ['filters',       "openCardDbOverlay(); apriFiltri()",                          '#filters-pannello'],
  ['delete',        "openCardDbOverlay(); vestiTitoli(); document.getElementById('delete-testo').textContent = 'Are you sure you want to delete this deck?'; document.getElementById('delete-overlay').classList.add('show')", '#delete-box'],
];

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, frame: false,
    webPreferences: { contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 14000));
  await win.webContents.insertCSS('#splash,#patch-notes-overlay:not(.show){display:none!important}');
  win.setPosition(-3200, 0); win.showInactive();
  await win.webContents.executeJavaScript("(function(){ ['splash','start-screen'].forEach(function(id){ var e=document.getElementById(id); if(e) e.style.display='none'; });"
    + " if(!sessioneAccount || !sessioneAccount.token) sessioneAccount = { token:'finto' }; TUTORIAL_VISTI = { principale:1, pacchetti:1, libreria:1 };"
    + " window.nakamaRpc = function(){ return Promise.resolve({}); }; window.playSfxFile = function(){}; return 1; })()");

  const righe = [];
  let n = 0;
  for (const [nome, apri, sel] of FINESTRE) {
    n++;
    const chiudi = "(function(){ document.querySelectorAll('.show').forEach(function(e){ if(/overlay/i.test(e.id) || e.classList.contains('hx-overlay') || e.classList.contains('hx-modal-overlay')) e.classList.remove('show'); }); return 1; })()";
    await win.webContents.executeJavaScript(chiudi);
    await new Promise(r => setTimeout(r, 250));
    let errore = '';
    try { await win.webContents.executeJavaScript('(function(){ ' + apri + '; return 1; })()'); }
    catch (e) { errore = String(e.message || e).split('\n')[0]; }
    await new Promise(r => setTimeout(r, 1100));
    const m = await win.webContents.executeJavaScript('(function(){'
      + ' var pan = document.querySelector(' + JSON.stringify(sel) + ');'
      + ' if(!pan) return { manca:"riquadro" };'
      + ' var bar = pan.querySelector(":scope > .hx-titolo-riga > .hx-titolo");'
      + ' if(!bar) return { manca:"barra" };'
      + ' var rp = pan.getBoundingClientRect(), rb = bar.getBoundingClientRect(), h2 = bar.querySelector("h2"), rh = h2.getBoundingClientRect();'
      + ' var k = rp.width / (pan.offsetWidth || 1);'
      + ' return { visibile: rp.width > 0 && rp.height > 0,'
      + '   dalBordo: Math.round(((rb.top - rp.top) / k - pan.clientTop) * 10) / 10,'
      + '   centro: Math.round(((rb.left + rb.width/2) - (rp.left + rp.width/2)) / k * 10) / 10,'
      + '   larga: Math.round(rb.width / k), alta: Math.round(rb.height / k), testo: Math.round(rh.width / k),'
      + '   titolo: h2.textContent.trim(), warning: bar.classList.contains("hx-titolo-warning"),'
      + '   x: rp.left, y: rp.top, w: rp.width, h: rp.height, vw: window.innerWidth }; })()');
    if (m.manca || !m.visibile) {
      righe.push(n + '. ' + nome + ': NON FOTOGRAFATA (' + (m.manca ? 'manca ' + m.manca : 'riquadro non visibile') + (errore ? ', ' + errore : '') + ')');
      continue;
    }
    const intera = await win.webContents.capturePage();
    const dim = intera.getSize();
    const s = dim.width / m.vw;
    const pad = 24;
    const rx = Math.max(0, Math.round((m.x - pad) * s)), ry = Math.max(0, Math.round((m.y - pad) * s));
    const ritaglio = intera.crop({ x: rx, y: ry,
      width: Math.min(Math.round((m.w + pad * 2) * s), dim.width - rx),
      height: Math.min(Math.round((Math.min(m.h, 1000) + pad * 2) * s), dim.height - ry) });
    const file = path.join(CARTELLA, String(n).padStart(2, '0') + '-' + nome + '.png');
    fs.writeFileSync(file, ritaglio.toPNG());
    const esce = m.testo > m.larga - 20;
    righe.push(n + '. ' + nome + ': "' + m.titolo + '"' + (m.warning ? ' [warning]' : '')
      + ' | dal bordo ' + m.dalBordo + 'px, centro ' + m.centro + 'px, stendardo ' + m.larga + 'x' + m.alta
      + ', testo ' + m.testo + 'px' + (esce ? '  <-- NON CI STA' : '') + (errore ? ' | errore: ' + errore : ''));
  }
  // I titoli che il codice scrive da se' (gli avvisi, e i due che cambiano a
  // seconda del momento): non hanno una finestra loro da fotografare, ma devono
  // stare nello stendardo lo stesso. Si misurano dentro alla barra dell'avviso.
  const daCodice = await win.webContents.executeJavaScript('(function(){'
    + ' var testo = [].slice.call(document.scripts).map(function(s){ return s.text; }).join(" ");'
    + ' var titoli = ["Change name", "New deck!", "Can\'t level up"], da = 0, chiave = "apriAvviso", i;'
    + ' while((i = testo.indexOf(chiave, da)) >= 0){ da = i + chiave.length; var q = testo.indexOf("(", da); if(q < 0 || q - da > 10) continue; var c = testo.charAt(q + 1); if(c !== "\x27") continue; var f = q + 2, t = ""; while(f < testo.length && testo.charAt(f) !== "\x27"){ if(testo.charAt(f) === "\\\\"){ f++; } t += testo.charAt(f); f++; } if(titoli.indexOf(t) < 0) titoli.push(t); }'
    + ' var ov = document.getElementById("avviso-overlay"); ov.classList.add("show");'
    + ' var h2 = document.getElementById("avviso-titolo"), bar = document.getElementById("avviso-barra"), fuori = [];'
    + ' var k = bar.getBoundingClientRect().width / bar.offsetWidth;'
    + ' titoli.forEach(function(t){ h2.textContent = t; var w = Math.round(h2.getBoundingClientRect().width / k); if(w > bar.offsetWidth - 20) fuori.push(t + " (" + w + "px)"); });'
    + ' ov.classList.remove("show");'
    + ' return { quanti: titoli.length, fuori: fuori }; })()');
  righe.push('');
  righe.push('titoli scritti dal codice: ' + daCodice.quanti + ', non ci stanno: ' + (daCodice.fuori.join(', ') || 'nessuno'));
  console.log(righe.join('\n'));
  app.exit(0);
}).catch(e => { console.error(e); app.exit(1); });
