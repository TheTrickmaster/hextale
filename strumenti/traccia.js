// INSEGUE UNA CARTA e dice di quanti pixel si e' spostata, istante per istante.
//
//   electron strumenti/traccia.js <video> <da> <a> <passo> <x> <y> <larg> <alt> [tRiposo]
//
// Il riquadro va messo su qualcosa di riconoscibile della carta da seguire.
// Per ogni fotogramma si cerca, entro un intorno, la posizione in cui quel
// ritaglio somiglia di piu' a com'era a riposo: lo scarto trovato E' lo
// spostamento. Stampa distanza e direzione, con un istogramma.
//
// Perche' non basta guardare "quanto cambia" un riquadro: le carte del gioco
// oscillano sempre un poco, e quell'oscillazione copre il movimento vero. Uno
// spostamento invece si misura, e un colpo da 44 pixel non si confonde con un
// dondolio da 3.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const [, , VIDEO_IN, DA, A, PASSO, X, Y, W, H, TRIP] = process.argv;
const VIDEO = path.resolve(VIDEO_IN);

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(() => {
  const win = new BrowserWindow({ show: false, width: 800, height: 600,
    webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false } });
  ipcMain.on('riga', (e, m) => console.log(m));
  ipcMain.on('fine', () => app.quit());
  ipcMain.on('guasto', (e, m) => { console.error('GUASTO: ' + m); app.quit(); });

  const pagina = `<!doctype html><body style="margin:0">
<video id="v" src="file:///${VIDEO.replace(/\\/g, '/')}" muted></video>
<script>
const { ipcRenderer } = require('electron');
const v = document.getElementById('v');
const DA=${Number(DA)}, A=${Number(A)}, PASSO=${Number(PASSO)};
const R={x:${Number(X)},y:${Number(Y)},w:${Number(W)},h:${Number(H)}};
const TRIP = ${TRIP !== undefined ? Number(TRIP) : 'null'};
const SCALA = 4;                 // si cerca su un quarto: piu' veloce, e basta
const RAGGIO = 16;               // +-16 sul ridotto = +-64 pixel veri
v.addEventListener('error', ()=> ipcRenderer.send('guasto','il video non si apre'));
v.addEventListener('loadedmetadata', async ()=>{
  const pw = Math.round(R.w/SCALA), ph = Math.round(R.h/SCALA);
  // tela larga: contiene il ritaglio piu' il margine di ricerca
  const mw = pw + RAGGIO*2, mh = ph + RAGGIO*2;
  const cM = document.createElement('canvas'); cM.width=mw; cM.height=mh;
  const gM = cM.getContext('2d', {willReadFrequently:true});
  const cP = document.createElement('canvas'); cP.width=pw; cP.height=ph;
  const gP = cP.getContext('2d', {willReadFrequently:true});

  const vai = (t)=> new Promise(ok=>{ const f=()=>{ v.removeEventListener('seeked',f); ok(); }; v.addEventListener('seeked',f); v.currentTime=t; });

  await vai(TRIP === null ? DA : TRIP);
  gP.drawImage(v, R.x, R.y, R.w, R.h, 0, 0, pw, ph);
  const modello = gP.getImageData(0,0,pw,ph).data;

  ipcRenderer.send('riga', 'inseguo ' + R.w + 'x' + R.h + ' da (' + R.x + ',' + R.y + '), riposo a ' + (TRIP===null?DA:TRIP).toFixed(2) + 's');
  ipcRenderer.send('riga', '');
  for(let t=DA; t<=A+1e-6; t+=PASSO){
    await vai(t);
    gM.drawImage(v, R.x - RAGGIO*SCALA, R.y - RAGGIO*SCALA, R.w + RAGGIO*2*SCALA, R.h + RAGGIO*2*SCALA, 0, 0, mw, mh);
    const grande = gM.getImageData(0,0,mw,mh).data;
    let miglior=Infinity, mdx=0, mdy=0;
    for(let dy=0; dy<=RAGGIO*2; dy++){
      for(let dx=0; dx<=RAGGIO*2; dx++){
        let s=0;
        for(let y=0;y<ph;y+=2){
          const rg=((y+dy)*mw+dx)*4, rp=(y*pw)*4;
          for(let x=0;x<pw;x+=2){
            const a=rg+x*4, b=rp+x*4;
            s += Math.abs(grande[a]-modello[b]) + Math.abs(grande[a+1]-modello[b+1]) + Math.abs(grande[a+2]-modello[b+2]);
          }
        }
        if(s<miglior){ miglior=s; mdx=dx-RAGGIO; mdy=dy-RAGGIO; }
      }
    }
    // lo scarto trovato e' di quanto si e' mossa la TELA: la carta si e' mossa
    // al contrario, ed e' in unita' ridotte.
    const sx = -mdx*SCALA, sy = -mdy*SCALA;
    const d = Math.round(Math.hypot(sx,sy));
    const verso = (d<3) ? 'ferma' : ((sy<0?'su':(sy>0?'giu':'')) + (sx<0?'-sinistra':(sx>0?'-destra':'')));
    ipcRenderer.send('riga', t.toFixed(2)+'s  '+String(d).padStart(3)+'px  '+'#'.repeat(Math.round(d/2)).padEnd(26)+' '+verso);
  }
  ipcRenderer.send('fine');
});
</script></body>`;
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(pagina));
});
