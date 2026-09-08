// IL CANCELLO.
//
//     $ELECTRON strumenti/prova-cancello.js <la parola d ordine>
//
// Si prova che il cancello sia chiuso arrivando, che rifiuti una parola
// sbagliata e che si apra con quella giusta.
//
// LA PAROLA SI PASSA, NON SI SCRIVE. Il deposito e- pubblico: una parola
// d ordine scritta in un file di questo deposito e- una parola d ordine
// pubblicata. Nella pagina c e la sua IMPRONTA (SHA-256 di un sale piu- la
// parola) e mai la parola, e questo banco controlla anche quello — che nel
// sorgente servito la parola non compaia da nessuna parte.
//
// Si serve la pagina da 127.0.0.1 e non dal file: crypto.subtle esiste solo in
// un contesto sicuro (https, o localhost), e aprendo il file a mano il
// cancello resterebbe chiuso comunque — che e- il verso giusto in cui
// sbagliare, ma non permette di provare l apertura.
const { app, BrowserWindow } = require('electron');
const http = require('http'); const path = require('path'); const fs = require('fs');
const RADICE = 'C:/Users/masil/Desktop/Hextale/game-assets';
const PAROLA = process.argv[2];
if(!PAROLA){ console.error("serve la parola d ordine: $ELECTRON strumenti/prova-cancello.js <parola>"); process.exit(2); }
const TIPI = { '.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf' };
const server = http.createServer((req,res)=>{ const via=decodeURIComponent(req.url.split('?')[0]);
  const dove = path.join(RADICE, via==='/'?'index.html':via.replace(/^\/+/,''));
  if(fs.existsSync(dove)&&fs.statSync(dove).isFile()){ res.writeHead(200,{'Content-Type':TIPI[path.extname(dove).toLowerCase()]||'application/octet-stream'}); return res.end(fs.readFileSync(dove)); }
  res.writeHead(404); res.end('no'); });
app.commandLine.appendSwitch('disable-gpu'); app.disableHardwareAcceleration();
setTimeout(()=>{ console.error('PIANTATA'); app.exit(2); }, 120000);
app.whenReady().then(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  // 127.0.0.1 e' un contesto sicuro: crypto.subtle c'e', come su https.
  const win = new BrowserWindow({show:false,width:1400,height:900,webPreferences:{contextIsolation:false}});
  await win.loadURL('http://127.0.0.1:'+server.address().port+'/');
  await new Promise(r=>setTimeout(r,2500));
  const dette = [];
  const dice = (ok, che, perche) => dette.push({ok:!!ok, che, perche: perche===undefined?'':String(perche)});

  const chiuso = await win.webContents.executeJavaScript(`(function(){
    const c = document.getElementById('cancello');
    return { c: !!c, copre: c ? getComputedStyle(c).visibility : '',
      z: c ? getComputedStyle(c).zIndex : '',
      fermo: document.body.classList.contains('chiuso'),
      scorre: getComputedStyle(document.body).overflow,
      // La parola non deve comparire da nessuna parte nel sorgente servito.
      inChiaro: document.documentElement.outerHTML.indexOf(${JSON.stringify(PAROLA)}) >= 0 };
  })()`);
  dice(chiuso.c && chiuso.copre === 'visible', 'il cancello e- chiuso appena si arriva', chiuso.copre);
  dice(parseInt(chiuso.z,10) >= 1000, 'e sta sopra a tutto, barra compresa', chiuso.z);
  dice(chiuso.fermo && chiuso.scorre === 'hidden', 'e sotto non si scorre', chiuso.scorre);
  dice(!chiuso.inChiaro, 'la parola non e- nel sorgente della pagina');

  const sbagliata = await win.webContents.executeJavaScript(`(function(){
    document.getElementById('cancello-parola').value = 'apriti sesamo';
    document.getElementById('modulo-cancello').dispatchEvent(new Event('submit',{cancelable:true}));
    return new Promise(r=>setTimeout(()=>r({
      ancora: !!document.getElementById('cancello'),
      detto: document.getElementById('cancello-esito').textContent }), 500));
  })()`);
  dice(sbagliata.ancora, 'una parola sbagliata non lo apre');
  dice(sbagliata.detto.length > 4, 'e lo dice', sbagliata.detto);

  const giusta = await win.webContents.executeJavaScript(`(function(){
    document.getElementById('cancello-parola').value = ${JSON.stringify(PAROLA)};
    document.getElementById('modulo-cancello').dispatchEvent(new Event('submit',{cancelable:true}));
    return new Promise(r=>setTimeout(()=>r({
      via: !document.getElementById('cancello'),
      scorre: getComputedStyle(document.body).overflow }), 1200));
  })()`);
  dice(giusta.via, 'quella giusta lo apre, e il cancello se ne va');
  dice(giusta.scorre !== 'hidden', 'e la pagina torna a scorrere', giusta.scorre);

  let male = 0;
  for(const d of dette){ if(!d.ok) male++;
    console.log((d.ok?'  ok  ':'  NO  ') + d.che + (d.perche && !d.ok ? '  —  ' + d.perche : '')); }
  console.log('\n' + (dette.length-male) + ' su ' + dette.length + (male ? '  — ' + male + ' da sistemare' : '  — tutto a posto'));
  app.exit(male?1:0);
});
