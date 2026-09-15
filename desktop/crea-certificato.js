// IL CERTIFICATO DEL SERVITORE LOCALE (app desktop 1.0.1).
//
//     node desktop/crea-certificato.js
//
// Dentro all'app il gioco si chiede a https://hextalegame.com, ma quel nome va a
// un servitore sul computer stesso (vedi servitore.js e main.js). Una
// connessione https vuole un certificato: e' questo, fatto qui. Lo accetta SOLO
// l'app, SOLO per hextalegame.com e SOLO se e' proprio lui (main.js confronta il
// certificato intero): per un browser o per qualunque altro nome non vale niente.
//
// Si crea una volta sola sul computer che costruisce l'installatore (npm run
// build lo chiama) e NON va nel repository: la chiave privata finisce dentro
// all'installatore, e un file di chiave in un deposito pubblico e' un allarme
// che non serve a nessuno. Serve openssl, che c'e' con Git per Windows.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CARTELLA = path.join(__dirname, 'certificato');
const CHIAVE = path.join(CARTELLA, 'chiave.pem');
const CERTIFICATO = path.join(CARTELLA, 'certificato.pem');

function assicura() {
  if (fs.existsSync(CHIAVE) && fs.existsSync(CERTIFICATO)) return { chiave: CHIAVE, certificato: CERTIFICATO, nuovo: false };
  fs.mkdirSync(CARTELLA, { recursive: true });
  try {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '7300',
      '-keyout', CHIAVE, '-out', CERTIFICATO, '-subj', '/CN=hextalegame.com',
      '-addext', 'subjectAltName=DNS:hextalegame.com,DNS:www.hextalegame.com'], { stdio: 'ignore' });
  } catch (e) {
    throw new Error('non riesco a creare il certificato con openssl (c-e- con Git per Windows): ' + e.message);
  }
  return { chiave: CHIAVE, certificato: CERTIFICATO, nuovo: true };
}

if (require.main === module) {
  try {
    const r = assicura();
    console.log((r.nuovo ? 'certificato creato' : 'certificato gia- presente') + ' -> desktop/certificato');
  } catch (e) {
    console.error('FERMO: ' + e.message);
    process.exitCode = 1;
  }
}

module.exports = { assicura, CARTELLA, CHIAVE, CERTIFICATO };
