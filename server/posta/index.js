// ══════════════════════════════════════════════════════════════════════════
// IL SERVIZIO DI INOLTRO — da una chiamata HTTP a una email
// ══════════════════════════════════════════════════════════════════════════
// Perche' esiste, in una riga: le caselle di Hextale stanno da un registrar e
// parlano SMTP, e Nakama non parla SMTP. Sa fare chiamate HTTP e basta.
//
// Fa una cosa sola: riceve una segnalazione da Nakama e la imbuca. Niente
// altro — non ha un database, non ricorda niente, non risponde a nessuno che
// non arrivi dalla rete interna di docker.
//
//   POST /invia
//   X-Hextale-Chiave: <la parola d'ordine>
//   { "a":"...", "oggetto":"...", "testo":"...", "allegato":"data:image/..." }
//
// LE CREDENZIALI NON STANNO QUI. Questo repository e' pubblico. Stanno
// nell'ambiente del processo, in un file che sul server non entra in git:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, POSTA_CHIAVE
// La stessa POSTA_CHIAVE va detta a Nakama una volta sola, con hx_posta_config.
'use strict';
const http = require('http');
const nodemailer = require('nodemailer');

const CFG = {
  host: process.env.SMTP_HOST || '',
  porta: Number(process.env.SMTP_PORT || 465),
  utente: process.env.SMTP_USER || '',
  password: process.env.SMTP_PASS || '',
  chiave: process.env.POSTA_CHIAVE || '',
  porta_http: Number(process.env.POSTA_PORTA || 8081)
};

// Si controlla all'avvio e non alla prima email: un servizio configurato a
// meta' deve rifiutarsi di partire, non accorgersene la prima volta che
// qualcuno ha qualcosa da raccontare.
for (const [nome, valore] of [['SMTP_HOST', CFG.host], ['SMTP_USER', CFG.utente],
                              ['SMTP_PASS', CFG.password], ['POSTA_CHIAVE', CFG.chiave]]) {
  if (!valore) { console.error('[posta] manca ' + nome + ': non parto.'); process.exit(1); }
}

// La porta 465 e' SMTP dentro a TLS dal primo byte (secure), la 587 comincia in
// chiaro e sale dopo (STARTTLS). Sbagliare questo e' il modo piu' comune di
// vedere una connessione che resta appesa senza dire niente.
const postino = nodemailer.createTransport({
  host: CFG.host,
  port: CFG.porta,
  secure: CFG.porta === 465,
  auth: { user: CFG.utente, pass: CFG.password }
});

function rispondi(res, codice, oggetto) {
  const corpo = JSON.stringify(oggetto);
  res.writeHead(codice, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corpo) });
  res.end(corpo);
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/salute') return rispondi(res, 200, { vivo: true });
  if (req.method !== 'POST' || req.url !== '/invia') return rispondi(res, 404, { errore: 'non esiste' });
  // La parola d'ordine non e' una difesa contro il mondo — questo servizio il
  // mondo non lo vede — ma contro il vicino di casa: qualunque altro processo
  // sulla stessa rete di docker potrebbe altrimenti spedire posta a nome
  // nostro.
  if (req.headers['x-hextale-chiave'] !== CFG.chiave) return rispondi(res, 401, { errore: 'chiave sbagliata' });

  let pezzi = [], quanto = 0;
  req.on('data', (c) => {
    quanto += c.length;
    // Un corpo senza limite e' un modo di riempire la memoria di qualcun
    // altro. Un megabyte e' molto piu' di quanto serva: la schermata arriva
    // gia' rimpicciolita, e sotto i 400KB.
    if (quanto > 1024 * 1024) { req.destroy(); return; }
    pezzi.push(c);
  });
  req.on('end', async () => {
    let d;
    try { d = JSON.parse(Buffer.concat(pezzi).toString('utf8')); }
    catch (e) { return rispondi(res, 400, { errore: 'corpo illeggibile' }); }
    if (!d || !d.a || !d.oggetto) return rispondi(res, 400, { errore: 'manca il destinatario o l oggetto' });

    const messaggio = {
      from: 'Hextale <' + CFG.utente + '>',
      to: String(d.a),
      subject: String(d.oggetto).slice(0, 200),
      text: String(d.testo || '')
    };
    // La schermata arriva come "data:image/jpeg;base64,...": si spedisce come
    // allegato vero, non incollata nel testo.
    const foto = String(d.allegato || '');
    const virgola = foto.indexOf(',');
    if (foto.startsWith('data:image/') && virgola > 0) {
      messaggio.attachments = [{
        filename: 'schermata.jpg',
        content: Buffer.from(foto.slice(virgola + 1), 'base64')
      }];
    }
    try {
      const esito = await postino.sendMail(messaggio);
      console.log('[posta] spedita: ' + (esito && esito.messageId));
      rispondi(res, 200, { spedita: true });
    } catch (e) {
      // Si dice cos'e' andato storto, ma solo qui nel registro: chi ha
      // chiamato sa gia' che non e' partita, e il dettaglio non gli serve.
      console.error('[posta] non spedita: ' + (e && e.message));
      rispondi(res, 502, { spedita: false });
    }
  });
});

// Solo la rete interna: da fuori questo servizio non deve esistere.
server.listen(CFG.porta_http, '0.0.0.0', () => {
  console.log('[posta] in ascolto sulla porta ' + CFG.porta_http + ', imbuca via ' + CFG.host + ':' + CFG.porta);
});
