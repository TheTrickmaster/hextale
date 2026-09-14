// I BANCHI NON TOCCANO IL SITO (v0.80.22).
//
//   require('./dal-disco');   // in cima a ogni banco Electron, dopo require('electron')
//
// Ogni banco apre play/index.html dal disco, ma molti asset hanno l'indirizzo
// scritto per intero (https://hextalegame.com/ui/..., /cards/card-parts/...,
// /audio/...): ogni apertura faceva 200-450 richieste al sito, e una giornata di
// banchi dallo stesso indirizzo IP ha fatto scattare il limite di GitHub Pages
// ("Rate limit exceeded"). Qui ogni richiesta a hextalegame.com si serve dalla
// copia di lavoro (game-assets/<percorso>): stessi file, zero richieste. Un file
// che sul disco non c'e' risponde 404, come farebbe il sito; tutto il resto
// (Nakama, Google Fonts, ...) passa com'e'.
// La registrazione sta dentro a app.whenReady ed e' la PRIMA: il banco richiede
// questo file prima di registrare la sua, quindi il gestore c'e' gia' quando la
// pagina parte.
const { app, session, net } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const RADICE = path.resolve(__dirname, '..');
const DEL_SITO = new Set(['hextalegame.com', 'www.hextalegame.com']);

// Con HEXTALE_CONTA_SITO=1 alla fine si stampa quante richieste al sito sono
// state servite dal disco e quante sono passate davvero in rete (devono essere zero).
const conto = { disco: 0, mancanti: 0, altrove: 0 };
const mancanti = new Map();   // con HEXTALE_CONTA_SITO=2 si stampano anche i file che mancano
app.whenReady().then(() => {
  session.defaultSession.protocol.handle('https', (richiesta) => {
    let u = null;
    try { u = new URL(richiesta.url); } catch (e) { u = null; }
    if (!u || !DEL_SITO.has(u.host)) { conto.altrove++; return net.fetch(richiesta, { bypassCustomProtocolHandlers: true }); }
    const locale = path.normalize(path.join(RADICE, decodeURIComponent(u.pathname)));
    if (locale.startsWith(RADICE) && fs.existsSync(locale) && fs.statSync(locale).isFile()) {
      conto.disco++;
      return net.fetch(pathToFileURL(locale).toString());
    }
    conto.mancanti++;
    mancanti.set(u.pathname, (mancanti.get(u.pathname) || 0) + 1);
    return new Response('', { status: 404 });
  });
});
if (process.env.HEXTALE_CONTA_SITO) {
  process.on('exit', () => {
    console.log('[dal-disco] dal disco: ' + conto.disco + ', mancanti (404): ' + conto.mancanti + ', altri siti: ' + conto.altrove);
    if (process.env.HEXTALE_CONTA_SITO === '2') {
      [...mancanti.entries()].sort((a, b) => b[1] - a[1]).forEach(([p, n]) => console.log('[dal-disco]   404 ' + n + 'x ' + p));
    }
  });
}
