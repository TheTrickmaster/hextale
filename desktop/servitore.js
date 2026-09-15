// ═══════════════════════════════════════════════════════════════════════════
// HEXTALE — IL SERVITORE LOCALE DEL GIOCO (app desktop 1.0.1)
// ═══════════════════════════════════════════════════════════════════════════
// PERCHE' C'E'. Fino alla 1.0.0 il guscio intercettava OGNI richiesta https
// (protocol.handle): quelle a hextalegame.com le serviva dal disco, tutte le
// altre le rifaceva lui con net.fetch. Rifatte cosi' partivano senza Origin e
// senza Referer, e con Sec-Fetch-Site "none": Google, che controlla proprio
// quelle intestazioni, rispondeva 400 all'accesso (misurato il 15 set 2026 con
// un server locale: stessa richiesta, con e senza guscio).
//
// COME FUNZIONA ADESSO. Il guscio non tocca piu' niente di cio' che non e' il
// sito: Chromium manda il SOLO nome hextalegame.com a 127.0.0.1 (regola
// host-resolver-rules in main.js), dove risponde questo servitore coi file
// sul disco. Google, PayPal, il server di gioco: tutto il resto va in rete
// com'e', con le intestazioni del browser vero.
//
// Risponde solo a GET e HEAD, solo per hextalegame.com, solo a 127.0.0.1.
// Il contenuto lo decide chi lo avvia (`cerca`): qui c'e' solo il mestiere
// dell'HTTP — tipi, 404, ETag per non rileggere cio' che non e' cambiato, e
// Range per audio e video.
'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');

const SITO = new Set(['hextalegame.com', 'www.hextalegame.com']);

const TIPI = {
  '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
};
const tipo = (p) => TIPI[path.extname(p).toLowerCase()] || 'application/octet-stream';

// opzioni: { chiave, certificato (PEM), porta, cerca: async (percorso) => ({ file, impronta } | null) }
// Restituisce il server gia' in ascolto, o rifiuta (per esempio porta occupata).
function avviaServitore(opzioni) {
  return new Promise((ok, ko) => {
    const server = https.createServer({ key: opzioni.chiave, cert: opzioni.certificato }, (req, res) => {
      rispondi(req, res, opzioni.cerca).catch(() => {
        try { if (!res.headersSent) res.writeHead(500); res.end(); } catch (_) { }
      });
    });
    server.once('error', ko);
    server.listen(opzioni.porta, '127.0.0.1', () => { server.removeListener('error', ko); ok(server); });
  });
}

async function rispondi(req, res, cerca) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
  const host = String(req.headers.host || '').replace(/:\d+$/, '').toLowerCase();
  if (!SITO.has(host)) { res.writeHead(421); return res.end(); }
  let p = null;
  try { p = decodeURIComponent(new URL(req.url, 'https://hextalegame.com').pathname).replace(/^\/+/, ''); } catch (_) { p = null; }
  if (p === null) { res.writeHead(400); return res.end(); }
  if (p === '') p = 'play/index.html';
  else if (p.endsWith('/')) p += 'index.html';

  const trovato = await cerca(p);
  if (!trovato) { res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-cache' }); return res.end(); }
  const stat = await fs.promises.stat(trovato.file);
  // "no-cache" non vuol dire "non tenere": vuol dire "chiedi se e' cambiato".
  // L'ETag e' l'impronta del manifesto, quindi un file aggiornato non si
  // rilegge mai dalla copia vecchia, e uno uguale costa un 304.
  const etag = '"' + (trovato.impronta || (stat.size + '-' + Math.round(stat.mtimeMs))) + '"';
  const intestazioni = { 'Content-Type': tipo(p), 'Cache-Control': 'no-cache', ETag: etag, 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff' };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, intestazioni); return res.end(); }

  let inizio = 0, fine = stat.size - 1, stato = 200;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
  if (m && (m[1] !== '' || m[2] !== '')) {
    if (m[1] === '') inizio = Math.max(0, stat.size - Number(m[2]));
    else { inizio = Number(m[1]); if (m[2] !== '') fine = Math.min(fine, Number(m[2])); }
    if (inizio > fine || inizio >= stat.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size }); return res.end(); }
    stato = 206;
    intestazioni['Content-Range'] = 'bytes ' + inizio + '-' + fine + '/' + stat.size;
  }
  intestazioni['Content-Length'] = stat.size === 0 ? 0 : fine - inizio + 1;
  res.writeHead(stato, intestazioni);
  if (req.method === 'HEAD' || stat.size === 0) return res.end();
  fs.createReadStream(trovato.file, { start: inizio, end: fine }).on('error', () => res.destroy()).pipe(res);
}

module.exports = { avviaServitore, SITO, TIPI, tipo };
