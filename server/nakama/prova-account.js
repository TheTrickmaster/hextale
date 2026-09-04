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
  let inizio = testo.indexOf('\nfunction ' + nome + '(');
  // Alcune sono asincrone, e la parola in piu' davanti basta a non trovarle:
  // e' il modo in cui questo banco poteva dire "ROTTO" su codice giusto.
  if (inizio < 0) inizio = testo.indexOf('\nasync function ' + nome + '(');
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
// v0.79.1 — e il client NON ha un avatar di ripiego suo. Ne aveva uno, ed era
// sbagliato: entrando in gioco si vedeva per un secondo la volpe di tutti prima
// del proprio avatar. Un valore di ripiego che si vede e' un'informazione
// falsa, non un'attesa.
const sigla = corpo(gioco, 'miaSiglaAvatar');
dice(!!sigla && sigla.indexOf('AVATAR_DI_PARTENZA') < 0,
  'e il client non ci ripiega sopra finche- non sa',
  "Con un ripiego, all'ingresso lampeggia la volpe di tutti e poi arriva il\n" +
  '        proprio avatar: si vede una faccia che non e- la tua.');
dice(gioco.indexOf('const AVATAR_DI_PARTENZA') < 0,
  'e non se ne tiene una copia da questa parte',
  "Chi assegna l'avatar iniziale e- il server: e- un fatto dell'account.");

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

console.log('\nUN ACCOUNT, UN POSTO SOLO\n');

for (const [nome, funzione] of [['hx_entro', 'rpcEntro'], ['hx_esco', 'rpcEsco']]) {
  dice(server.indexOf("registerRpc('" + nome + "', " + funzione + ")") >= 0,
    nome + ' e- registrata');
  dice(gioco.indexOf("nakamaRpc('" + nome + "'") >= 0, 'e il client la chiama');
}

const entro = corpo(server, 'rpcEntro');
dice(!!entro && entro.indexOf('_sediaOccupataDaAltri') >= 0,
  'il posto lo controlla il SERVER',
  'Un controllo fatto dal client e- un controllo che il secondo client puo-\n' +
  '        saltare.');

const battito = corpo(server, 'rpcGiocatoriOnline');
dice(!!battito && battito.indexOf('_sediaOccupataDaAltri') >= 0,
  'e il battito non ruba la sedia a nessuno',
  'Senza, al secondo client basterebbe battere per prendersi il posto senza\n' +
  '        essere mai passato da rpcEntro.');

const sedia = corpo(gioco, 'prendiLaSedia');
dice(!!sedia && /return true/.test(sedia.slice(sedia.indexOf('catch'))),
  'e se il server tace non si chiude fuori nessuno',
  'Il danno di due finestre e- piccolo e raro; quello di non poter entrare\n' +
  '        quando il server ha un singhiozzo lo si prende in faccia subito.');

const ingresso = corpo(gioco, 'accessoEntra');
const iSedia = ingresso ? ingresso.indexOf('prendiLaSedia') : -1;
const iMenu = ingresso ? ingresso.indexOf('apriMenuPrincipale') : -1;
dice(iSedia >= 0 && iMenu >= 0 && iSedia < iMenu,
  'si chiede il posto PRIMA di aprire il menu',
  'Rifiutare dopo vorrebbe dire buttare fuori qualcuno che e- gia- dentro.');

const uscita = corpo(gioco, '_fuoriDalGioco');
dice(!!uscita && uscita.indexOf('await lasciaLaSedia') >= 0,
  'e chi se ne va dalla porta libera il posto, aspettando',
  'Senza l-attesa la richiesta muore con la ricarica, e si resta chiusi fuori\n' +
  '        dal proprio account per tre quarti di minuto.');

// ── v0.79.11 — I DUE NUMERI DEL POSTO VANNO IN COPPIA ────────────────────
// Il client batte ogni ONLINE_OGNI_MS, il server considera libera una sedia
// dopo SEDIA_LIBERA_MS. Se il secondo scendesse sotto il primo, il posto si
// libererebbe sotto ai piedi di chi sta ancora giocando — e la prossima cosa
// che vedrebbe e' "questo account e' gia' in gioco", riferito a se stesso.
// Vivono in due file diversi, quindi nessuno dei due sa dell'altro: e' il
// motivo per cui questa prova esiste.
const mBattito = /const ONLINE_OGNI_MS = (\d+)/.exec(gioco);
const mSedia = /var SEDIA_LIBERA_MS = (\d+) \* 1000/.exec(server);
const msBattito = mBattito ? Number(mBattito[1]) : 0;
const msSedia = mSedia ? Number(mSedia[1]) * 1000 : 0;
dice(!!msBattito && !!msSedia, 'i due numeri del posto si leggono');
dice(msSedia > msBattito * 1.4,
  'la sedia dura piu- di un battito, col margine (' + (msBattito / 1000) + 's -> ' + (msSedia / 1000) + 's)',
  'Una sedia piu- corta del battito la perde chi sta ancora giocando: al primo\n' +
  '        battito in ritardo il gioco gli direbbe che e- gia- in gioco lui stesso.');
dice(msSedia <= 40000,
  'e non fa aspettare piu- di quaranta secondi chi e- rimasto fuori',
  "E- il momento in cui una persona smette di riprovare. La strada normale e'\n" +
  '        che chi se ne va lo dica (rpcEsco, e il saluto alla chiusura della\n' +
  '        finestra): questa attesa e- solo per chi non ha potuto dire niente.');
const saluto = corpo(gioco, 'salutaChiudendo');
dice(!!saluto && saluto.indexOf('pagehide') >= 0 && saluto.indexOf('persisted') >= 0,
  'chiudere la finestra libera il posto, ma metterla da parte no',
  'Sul telefono pagehide arriva a ogni cambio di applicazione: senza guardare\n' +
  '        `persisted`, guardare una notifica costerebbe il proprio posto.');
dice(!!saluto && saluto.indexOf('lasciaLaSedia(true)') >= 0,
  'e il saluto e- persistente',
  'Una fetch normale muore con la pagina che la manda: il messaggio non\n' +
  '        arriverebbe mai, ed e- il difetto che si sta correggendo.');

console.log('\nLE COPIE DI UNA CARTA\n');

// v0.79.7 — la pagina dello sbusto scrive "3 owned" sopra a una carta che si ha
// gia'. Un numero mostrato dev'essere un numero vero, e prima non esisteva:
// sbustare un doppione non lasciava traccia da nessuna parte.
const copieDi = corpo(server, '_copieDi');
dice(!!copieDi, 'il server sa contare le copie');
dice(!!copieDi && copieDi.indexOf('? n : 1') >= 0,
  'e chi c-era prima parte da una',
  "E- l'unica cosa vera che si puo- dire di una storia che non e- stata\n" +
  '        scritta. Meglio un numero onesto e basso che uno inventato.');

const raccogli = corpo(server, 'rpcBustinaRaccogli');
dice(!!raccogli && raccogli.indexOf('possesso.copie[tieni[j]] = gia + 1') >= 0,
  'il conto sale nella STESSA scrittura che consegna le carte',
  "Contarle altrove vorrebbe dire un istante in cui la carta e- arrivata e il\n" +
  '        conto no.');

for (const [rpc, dove] of [['rpcAvvio', "all'avvio"], ['rpcBustinaRaccogli', 'dopo la raccolta']]) {
  const c = corpo(server, rpc);
  dice(!!c && c.indexOf('copie:') >= 0, 'e il client le riceve ' + dove);
}
dice(gioco.indexOf('let CARTE_COPIE') >= 0 && gioco.indexOf('risposta.copie') >= 0,
  'il client le legge e non le somma da se-',
  'Un conto tenuto anche di qua sarebbe una nostra opinione, non un dato.');

const quante = corpo(gioco, 'copiePossedute');
dice(!!quante && quante.indexOf('CARTE_POSSEDUTE') >= 0,
  'e scollegati ripiega sul possesso',
  'Se il server non ha risposto si sa almeno se la carta ce l-hai: una copia.');

console.log('\nL-ATTESA DELLA BUSTINA\n');

// v0.79.8 — il pulsante del menu di debug cancellava una chiave di
// localStorage, e dalla v0.77.90 l'attesa non sta piu' li'. Diceva "fatto" e
// non era successo niente: il difetto piu' scomodo, perche' da fuori sembra
// che funzioni.
dice(server.indexOf("registerRpc('hx_bustina_azzera', rpcBustinaAzzera)") >= 0,
  'hx_bustina_azzera e- registrata');
dice(gioco.indexOf("nakamaRpc('hx_bustina_azzera'") >= 0, 'e il client la chiama');
const azzera = corpo(server, 'rpcBustinaAzzera');
dice(!!azzera && azzera.indexOf('possesso.admin') >= 0,
  'e solo un admin puo- azzerarla',
  "Senza quel controllo questa e- la strada che la v0.77.90 aveva chiuso:\n" +
  '        chiunque potrebbe avere una bustina ogni volta che vuole.');
dice(gioco.indexOf('BUSTINA_CHIAVE') < 0 || gioco.split('BUSTINA_CHIAVE').length - 1 === 1,
  'e la chiave morta nel browser non si usa piu-',
  'Restava il nome di una chiave che nessuno legge.');

console.log('\n' + (ko ? 'FALLITO: ' + ko : 'OK: client e server dicono la stessa cosa'));
process.exit(ko ? 1 : 0);
