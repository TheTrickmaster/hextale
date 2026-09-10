// I BANCHI SI LEGGONO? — la spia da accendere prima di lanciarne uno.
//
//     node strumenti/controlla-banchi.js
//
// Quasi tutti i banchi di questo gioco mandano il proprio corpo dentro alla
// pagina come una stringa: `executeJavaScript(...)` con dentro un template
// literal lungo qualche centinaio di righe. E' comodo e ha una trappola sola,
// ma profonda: un apice inclinato scritto DENTRO a quel corpo — attorno al
// nome di una regola CSS in un commento, per dire — chiude il template a
// meta'. Il file smette di partire, e l'errore che si legge indica la riga
// della CHIAMATA, non quella del commento:
//
//     prova-trovato.js:48
//       const esito = await win.webContents.executeJavaScript(`(async ...
//     SyntaxError: missing ) after argument list
//
// Chi lo legge va a guardare la riga 48, dove non c'e' niente di sbagliato.
// La seconda trappola e' gemella: per andare a capo dentro a una spiegazione
// servono DUE caratteri, non uno — scritto con uno solo, il template esterno
// lo trasforma subito in un a-capo vero e spezza la stringa interna.
//
// In un giorno solo mi hanno fermato quattro volte, e due banchi sono rimasti
// illeggibili senza che nessuno se ne accorgesse: non fallivano, proprio non
// partivano, e un banco che non parte assomiglia molto a un banco che passa.
//
// Questa spia li legge tutti e dice quali non si compilano e perche'.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DOVE = __dirname;
const APICE = String.fromCharCode(96);

const file = fs.readdirSync(DOVE)
  .filter(f => /^prova-.*\.js$/.test(f) || /^(estrai|misura|controlla|senza|traccia|fotogrammi|movimento|provino)/.test(f))
  .filter(f => f !== path.basename(__filename))
  .sort();

let male = 0;
const sospetti = [];

for (const f of file) {
  const pieno = path.join(DOVE, f);
  let errore = '';
  try {
    execFileSync(process.execPath, ['-c', pieno], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    errore = String((e.stderr || '') + '').split('\n').filter(r => /Error/.test(r))[0] || 'non si compila';
  }

  // E indipendentemente dalla sintassi: un apice inclinato dentro al corpo
  // iniettato e' sempre un difetto in attesa, anche quando per caso sono in
  // numero pari e il file si compila lo stesso.
  const testo = fs.readFileSync(pieno, 'utf8');
  const apre = testo.indexOf('executeJavaScript(' + APICE);
  let dentro = 0;
  if (apre >= 0) {
    const corpo = testo.slice(apre + ('executeJavaScript(' + APICE).length);
    const chiude = corpo.indexOf(APICE + ');');
    const soloCorpo = chiude >= 0 ? corpo.slice(0, chiude) : corpo;
    for (let i = 0; i < soloCorpo.length; i++) {
      if (soloCorpo[i] === APICE && soloCorpo[i - 1] !== '\\') dentro++;
    }
  }

  if (errore) {
    male++;
    console.log('  NO   ' + f);
    console.log('       ' + errore);
    if (dentro) console.log('       ' + dentro + ' apici inclinati dentro al corpo: quasi certamente sono loro.');
  } else if (dentro) {
    sospetti.push(f + ' (' + dentro + ')');
    console.log('  ??   ' + f + ' — si compila, ma ha ' + dentro + ' apici inclinati nel corpo');
  } else {
    console.log('  ok   ' + f);
  }
}

console.log('');
if (male) {
  console.log(male + ' banchi su ' + file.length + ' NON si leggono.');
  console.log('Un banco che non parte assomiglia molto a un banco che passa: non');
  console.log('stampa niente, e chi lo lancia dentro a un filtro non vede nemmeno');
  console.log('l\'errore. Si sistemano prima di fidarsi di qualunque altro esito.');
} else if (sospetti.length) {
  console.log('Tutti leggibili, ma da guardare: ' + sospetti.join(', '));
} else {
  console.log('Tutti e ' + file.length + ' i banchi si leggono.');
}
process.exit(male ? 1 : 0);
