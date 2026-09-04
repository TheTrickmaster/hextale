// Il nastro "New" segue la carta? Si costruisce la stessa impalcatura che
// costruisce la pagina dello sbusto, con le classi vere e il foglio di stile
// vero, e si guarda cosa succede al nastro quando la carta si inclina e quando
// cresce. Le due sistemazioni — vecchia (figlio della carta) e nuova (dentro
// al livello che si inclina) — stanno fianco a fianco: il confronto e' la
// prova.
const { app, BrowserWindow } = require('electron');

const path = require('path');
const RADICE = 'file:///' + path.resolve(__dirname, '..').split(path.sep).join('/');
const PAGINA = RADICE + '/play/index.html';
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080,
    webPreferences: { contextIsolation: false, webSecurity: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 2000));

  const esito = await win.webContents.executeJavaScript(`(async function(){
    const fai = ()=>{
      const carta = document.createElement('div');
      carta.className = 'pack-card';
      carta.style.cssText = 'position:absolute;left:200px;top:200px;width:242px;height:414px;animation:none';
      const pop = document.createElement('div'); pop.className = 'pack-card-pop';
      const swap = document.createElement('div'); swap.className = 'pack-card-swap';
      const tilt = document.createElement('div'); tilt.className = 'pack-card-tilt';
      const piano = document.createElement('div'); piano.className = 'pack-card-flip';
      tilt.appendChild(piano); swap.appendChild(tilt); pop.appendChild(swap); carta.appendChild(pop);
      const n = document.createElement('img');
      n.className = 'nuova-nastro';
      n.src = '${RADICE}/ui/new-card-banner.png';
      return { carta:carta, tilt:tilt, nastro:n };
    };

    // Vecchia sistemazione: il nastro figlio della carta.
    const A = fai(); A.carta.appendChild(A.nastro);
    // Nuova: dentro al livello che si inclina.
    const B = fai(); B.tilt.appendChild(B.nastro);
    document.body.appendChild(A.carta); document.body.appendChild(B.carta);
    // Le transizioni qui sono nemiche della misura: il gioco le spegne gia' da
    // se' mentre il puntatore insegue la carta (data-tilt="1"), e si fa lo
    // stesso. Per il resto si aspetta che l-immagine ci sia davvero: un img
    // non ancora caricata e' larga zero, e zero non si piega.
    A.carta.dataset.tilt = "1"; B.carta.dataset.tilt = "1";
    await Promise.all([A,B].map(o=>o.nastro.decode().catch(()=>{})));
    const attendi = (ms)=>new Promise(r=>setTimeout(r,ms));
    await attendi(50);
    A.carta.classList.add('mostra-etichetta'); B.carta.classList.add('mostra-etichetta');
    document.body.getBoundingClientRect();

    const leggi = (o)=>{ const r = o.nastro.getBoundingClientRect();
      return { l:+r.left.toFixed(1), t:+r.top.toFixed(1), w:+r.width.toFixed(1), h:+r.height.toFixed(1) }; };
    const fermo = { A: leggi(A), B: leggi(B) };

    // Si inclina la carta, come fa il puntatore.
    [A,B].forEach(o=>{ o.carta.style.setProperty('--foil-rx','1'); o.carta.style.setProperty('--foil-ry','0.6'); });
    await attendi(400);
    const piegato = { A: leggi(A), B: leggi(B) };

    // E la si tiene, che e' quando cresce. La transizione va spenta a mano:
    // questa finestra non e' sullo schermo e le transizioni non avanzano, cosi'
    // l-ingrandimento resterebbe per sempre al primo fotogramma.
    [A,B].forEach(o=>{ o.carta.style.removeProperty('--foil-rx'); o.carta.style.removeProperty('--foil-ry');
                       o.carta.querySelector('.pack-card-pop').style.transition = 'none';
                       o.carta.classList.add('tenuta'); });
    await attendi(400);
    const cresciuto = { A: leggi(A), B: leggi(B) };

    const padre = B.nastro.parentElement.className;
    const popB = getComputedStyle(B.carta.querySelector(".pack-card-pop")).transform;
    const classi = B.carta.className;
    A.carta.remove(); B.carta.remove();
    return { fermo:fermo, piegato:piegato, cresciuto:cresciuto, padre:padre, popB:popB, classi:classi };
  })()`);

  const d = (a, b) => Math.abs(a.l - b.l) + Math.abs(a.t - b.t) + Math.abs(a.w - b.w) + Math.abs(a.h - b.h);
  const e = esito;
  const righe = [
    ['il nastro sta dentro al livello che si inclina', /pack-card-tilt/.test(e.padre)],
    ['quando la carta si piega, il nastro si piega con lei', d(e.fermo.B, e.piegato.B) > 1],
    ['quando la carta cresce, il nastro cresce con lei', e.cresciuto.B.w > e.fermo.B.w + 0.5],
    ['(e prima nessuna delle due cose succedeva)', d(e.fermo.A, e.piegato.A) < 0.2 && Math.abs(e.cresciuto.A.w - e.fermo.A.w) < 0.2],
    // Fermo i due devono stare nello stesso punto. Non allo stesso identico
    // decimale: il nastro nuovo e' sollevato di 1px dentro a una prospettiva di
    // 1400, e 1401/1400 si vede sulla seconda cifra. E' quello il conto.
    ['fermo, sta dov-e- sempre stato', d(e.fermo.A, e.fermo.B) < 0.5]
  ];
  let male = 0;
  righe.forEach(([n, ok]) => { if (!ok) male++; console.log((ok ? '  ok   ' : '  NO   ') + n); });
  console.log('\n  fermo    A ' + JSON.stringify(e.fermo.A) + '\n           B ' + JSON.stringify(e.fermo.B));
  console.log('  piegato  A ' + JSON.stringify(e.piegato.A) + '\n           B ' + JSON.stringify(e.piegato.B));
  console.log('  cresciuto A ' + JSON.stringify(e.cresciuto.A) + '\n            B ' + JSON.stringify(e.cresciuto.B));
  console.log('  pop: ' + e.popB + '   classi: ' + e.classi);
  console.log(male ? '\n' + male + ' cose non tornano' : '\ntutto a posto');
  app.quit();
}).catch(x => { console.error(x); app.quit(); });
