// BANCO DI PROVA — L'ACCOUNT: FAZIONE, AVATAR, NOME, CANCELLAZIONE
//
// Quattro cose nuove, e tutte e quattro hanno lo stesso punto debole: sono
// d'accordo fra CLIENT e SERVER, e i due file non si parlano. Una preferenza
// che il client manda e il server non riconosce non fallisce: viene scartata in
// silenzio, e il giocatore la ritrova cambiata al prossimo accesso.
//
//     node server/nakama/prova-account.js
//
// Le domande:
//   1) il server accetta 'random' come fazione, e ricorda l'ultimo colore?
//   2) il client salva la PREFERENZA e il RICORDO in due campi diversi?
//      (se impostaFazioneUmano salvasse 'fazione', il primo sorteggio
//       riscriverebbe "random" in "dark" e non ci sarebbero piu' sorteggi)
//   3) le due chiamate nuove sono registrate?
//   4) l'avatar viaggia come SIGLA, non come indirizzo?
const fs = require('fs');
const path = require('path');

const gioco = fs.readFileSync(path.join(__dirname, '..', '..', 'play', 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

// Il corpo di una funzione, dalla dichiarazione in colonna zero alla graffa
// che la chiude, anch'essa in colonna zero.
function corpo(testo, nome) {
  const inizio = testo.indexOf('\nfunction ' + nome + '(');
  if (inizio < 0) return null;
  const righe = testo.slice(inizio + 1).split('\n');
  const out = [];
  for (const r of righe) { out.push(r); if (r === '}') break; }
  return out.join('\n');
}

let ko = 0;
function dice(buono, testo, spiega) {
  if (!buono) ko++;
  console.log('  ' + (buono ? 'ok    ' : 'ROTTO ') + testo);
  if (!buono && spiega) console.log('        ' + spiega);
}

console.log('LA FAZIONE\n');

const pulite = corpo(server, '_preferenzePulite');
dice(!!pulite && pulite.indexOf("'random'") >= 0,
  "il server accetta 'random'",
  "Il client lo manda, il server lo scarta: la scelta tornerebbe indietro da\n" +
  '        sola al prossimo accesso, senza un errore da nessuna parte.');
dice(!!pulite && pulite.indexOf('fazioneUltima') >= 0,
  'e ricorda l-ultimo colore uscito (fazioneUltima)',
  'Senza, il menu di chi gioca a caso sarebbe sempre scuro.');

const imposta = corpo(gioco, 'impostaFazioneUmano');
dice(!!imposta && imposta.indexOf('fazioneUltima') >= 0,
  'il client salva il RICORDO quando comincia una partita',
  'Deve scrivere fazioneUltima: e- cio- che il menu mostrera- dopo.');
dice(!!imposta && imposta.indexOf('fazione:') < 0,
  'e NON tocca la preferenza',
  'Se salvasse "fazione", il primo sorteggio riscriverebbe random in dark e\n' +
  '        il giocatore non vedrebbe piu- un sorteggio in vita sua.');

const sceglie = corpo(gioco, 'scegliPreferenzaFazione');
dice(!!sceglie && sceglie.indexOf('fazione: s') >= 0,
  'la tendina invece scrive la preferenza',
  "E- l'unica porta da cui la scelta del giocatore entra.");

const daGiocare = corpo(gioco, 'fazioneDaGiocare');
dice(!!daGiocare && daGiocare.indexOf('Math.random') >= 0,
  'il sorteggio esiste e sta in un posto solo',
  'Chi comincia una partita chiede questa, non tira il dado per conto suo.');
dice((gioco.split('impostaFazioneUmano(fazioneDaGiocare())').length - 1) === 1,
  'e lo chiede solo chi comincia una partita',
  "Deve essere chiamato esattamente una volta, nell'unico imbuto\n" +
  '        (requestNewGame). Due chiamate vorrebbero dire due sorteggi diversi\n' +
  '        nella stessa partita.');

console.log('\nL-AVATAR\n');

dice(server.indexOf("var AVATAR_DI_PARTENZA = 'fox';") >= 0,
  'il server da- Fox a chi comincia',
  "E- l'unica carta che tutti e tre i mazzi starter hanno.");
dice(gioco.indexOf("const AVATAR_DI_PARTENZA = 'fox';") >= 0,
  'e il client sa che e- Fox anche prima della risposta',
  'Altrimenti si vedrebbe il ritratto di ripiego finche- il server non parla.');

const cand = corpo(gioco, 'avatarCandidati');
dice(!!cand && cand.indexOf('artUrlVariante') >= 0,
  'la sigla diventa arte, nella variante chiesta',
  "L'avatar e- una carta e la carta ha due facce: quale si veda lo decide chi\n" +
  '        guarda, non cio- che e- stato salvato.');
dice(!!cand && cand.indexOf('hextalegame') >= 0,
  'e un indirizzo di un altro sito non passa',
  'Un avatar preso da un profilo Google deve restare fuori.');

const rpcAvatar = corpo(server, 'rpcAvatar');
dice(!!rpcAvatar && rpcAvatar.indexOf('_possedute') >= 0,
  'il server controlla che la carta sia tua',
  'Senza, gli avatar sarebbero la lista completa delle carte del gioco e\n' +
  '        "si sbloccano ottenendo la carta" non vorrebbe dire niente.');

console.log('\nLE CHIAMATE NUOVE\n');

for (const [nome, funzione] of [['hx_avatar', 'rpcAvatar'], ['hx_elimina_account', 'rpcEliminaAccount']]) {
  dice(server.indexOf("registerRpc('" + nome + "', " + funzione + ")") >= 0,
    nome + ' e- registrata',
    'Una funzione che nessuno registra non la chiama nessuno.');
  dice(gioco.indexOf("nakamaRpc('" + nome + "'") >= 0,
    'e il client la chiama',
    'Il contrario: una porta aperta su cui non bussa nessuno.');
}

const elimina = corpo(server, 'rpcEliminaAccount');
dice(!!elimina && elimina.indexOf('authenticateEmail') >= 0,
  'la password la ricontrolla il SERVER',
  'Una finestra la si salta; una sessione aperta la si trova su un computer\n' +
  '        lasciato acceso.');
dice(!!elimina && elimina.indexOf('accountDeleteId') >= 0,
  "e l'account viene cancellato davvero",
  'La mail deve tornare libera: chi se ne va deve potersi riscrivere.');

console.log('\n' + (ko ? 'FALLITO: ' + ko : 'OK: client e server dicono la stessa cosa'));
process.exit(ko ? 1 : 0);
