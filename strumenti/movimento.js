// Quanto si muove una parte dello schermo, fotogramma per fotogramma.
// Serve quando "sembra che rimbalzi due volte": l'occhio non sa dire se sono
// due movimenti o uno con una pausa, un grafico si'.
//
//   electron strumenti/movimento.js <video> <da> <a> <passo> <x> <y> <larg> <alt>
//
// Stampa, per ogni istante, quanto quel riquadro differisce dal PRIMO
// fotogramma (quello a riposo) e un istogramma per leggerlo a colpo d'occhio.
// Due gobbe = due movimenti.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const [, , VIDEO_IN, DA, A, PASSO, X, Y, W, H] = process.argv;
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
const RIT={x:${Number(X)},y:${Number(Y)},w:${Number(W)},h:${Number(H)}};
v.addEventListener('error', ()=> ipcRenderer.send('guasto','il video non si apre'));
v.addEventListener('loadedmetadata', async ()=>{
  const c=document.createElement('canvas'); c.width=RIT.w; c.height=RIT.h;
  const g=c.getContext('2d', {willReadFrequently:true});
  const prendi = async (t)=>{
    await new Promise(ok=>{ const f=()=>{ v.removeEventListener('seeked',f); ok(); }; v.addEventListener('seeked',f); v.currentTime=t; });
    g.drawImage(v, RIT.x, RIT.y, RIT.w, RIT.h, 0, 0, RIT.w, RIT.h);
    return g.getImageData(0,0,RIT.w,RIT.h).data;
  };
  const riposo = await prendi(DA);
  const misure = [];
  for(let t=DA; t<=A+1e-6; t+=PASSO){
    const ora = await prendi(t);
    let somma=0;
    for(let i=0;i<ora.length;i+=4){
      somma += Math.abs(ora[i]-riposo[i]) + Math.abs(ora[i+1]-riposo[i+1]) + Math.abs(ora[i+2]-riposo[i+2]);
    }
    misure.push({t, d: somma/(ora.length/4)});
  }
  const max = Math.max(...misure.map(m=>m.d)) || 1;
  ipcRenderer.send('riga', 'riquadro ' + RIT.w + 'x' + RIT.h + ' a (' + RIT.x + ',' + RIT.y + '), riposo = ' + DA.toFixed(2) + 's');
  ipcRenderer.send('riga', '');
  for(const m of misure){
    const n = Math.round((m.d/max)*60);
    ipcRenderer.send('riga', m.t.toFixed(2)+'s  '+String(Math.round(m.d)).padStart(4)+' |'+'#'.repeat(n));
  }
  ipcRenderer.send('fine');
});
</script></body>`;
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(pagina));
});
