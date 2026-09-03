// Un PROVINO A CONTATTO: tanti fotogrammi affiancati in una sola immagine, con
// il tempo scritto sopra a ciascuno. Serve a guardare un movimento veloce
// vedendolo tutto insieme invece che un istante per volta.
//
//   electron provino.js <video> <uscita.png> <da> <a> <passo> [x0 y0 larg alt]
//
// Gli ultimi quattro, opzionali, ritagliano una finestra del fotogramma: un
// attacco occupa una parte piccola dello schermo, e guardarlo a tutta pagina
// vuol dire sprecare pixel su cose ferme.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const [, , VIDEO_IN, USCITA_IN, DA, A, PASSO, RX, RY, RW, RH] = process.argv;
const VIDEO = path.resolve(VIDEO_IN);
const USCITA = path.resolve(USCITA_IN);

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(() => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 800,
    webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false } });
  ipcMain.on('detto', (e, m) => console.log(m));
  ipcMain.on('fatto', (e, dati) => {
    fs.writeFileSync(USCITA, Buffer.from(dati.split(',')[1], 'base64'));
    console.log('scritto ' + USCITA);
    app.quit();
  });
  ipcMain.on('guasto', (e, m) => { console.error('GUASTO: ' + m); app.quit(); });

  const pagina = `<!doctype html><body style="margin:0;background:#000">
<video id="v" src="file:///${VIDEO.replace(/\\/g, '/')}" muted></video>
<script>
const { ipcRenderer } = require('electron');
const v = document.getElementById('v');
const DA=${Number(DA)}, A=${Number(A)}, PASSO=${Number(PASSO)};
const RIT = ${RX !== undefined ? `{x:${Number(RX)},y:${Number(RY)},w:${Number(RW)},h:${Number(RH)}}` : 'null'};
v.addEventListener('error', ()=> ipcRenderer.send('guasto', 'il video non si apre'));
v.addEventListener('loadedmetadata', async ()=>{
  const tempi = [];
  for(let t=DA; t<=A+1e-6; t+=PASSO) tempi.push(t);
  const rw = RIT ? RIT.w : v.videoWidth, rh = RIT ? RIT.h : v.videoHeight;
  // quante colonne: si punta a un provino largo circa 2000px
  const scala = Math.min(1, 480/rw);
  const cw = Math.round(rw*scala), ch = Math.round(rh*scala);
  const col = Math.max(1, Math.min(tempi.length, Math.floor(2000/cw)));
  const rig = Math.ceil(tempi.length/col);
  const c = document.createElement('canvas');
  c.width = col*cw; c.height = rig*(ch+18);
  const g = c.getContext('2d');
  g.fillStyle='#111'; g.fillRect(0,0,c.width,c.height);
  ipcRenderer.send('detto', tempi.length+' fotogrammi, '+col+'x'+rig+', ritaglio '+rw+'x'+rh);
  for(let i=0;i<tempi.length;i++){
    const t = tempi[i];
    await new Promise(ok=>{ const f=()=>{ v.removeEventListener('seeked', f); ok(); }; v.addEventListener('seeked', f); v.currentTime = t; });
    const x = (i%col)*cw, y = Math.floor(i/col)*(ch+18);
    if(RIT) g.drawImage(v, RIT.x, RIT.y, RIT.w, RIT.h, x, y+18, cw, ch);
    else g.drawImage(v, x, y+18, cw, ch);
    g.fillStyle='#0f0'; g.font='bold 13px monospace';
    g.fillText(t.toFixed(2)+'s', x+4, y+13);
    g.strokeStyle='#333'; g.strokeRect(x, y+18, cw, ch);
  }
  ipcRenderer.send('fatto', c.toDataURL('image/png'));
});
</script></body>`;
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(pagina));
});
