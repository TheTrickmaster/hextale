// Estrae fotogrammi da un video usando Electron, che e' gia' installato per
// l'importazione delle carte. Chromium sa decodificare l'mp4; noi lo mettiamo
// in pausa a istanti precisi e disegniamo su una tela.
//
//   electron fotogrammi.js <video> <cartella> <da> <a> <passo>
//
// I tempi sono in secondi. Senza <da>/<a> prende tutto il video a passi di 1s
// e stampa solo la durata, per capire dove guardare.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const [, , VIDEO_IN, DIR_IN, DA, A, PASSO] = process.argv;
const VIDEO = path.resolve(VIDEO_IN);
const DIR = path.resolve(DIR_IN || '.');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(() => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 800,
    webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false } });

  ipcMain.on('durata', (e, d) => console.log('DURATA ' + d));
  ipcMain.on('foto', (e, { nome, dati }) => {
    fs.writeFileSync(path.join(DIR, nome), Buffer.from(dati.split(',')[1], 'base64'));
    console.log('  ' + nome);
  });
  ipcMain.on('finito', () => { console.log('fatto'); app.quit(); });
  ipcMain.on('guasto', (e, m) => { console.error('GUASTO: ' + m); app.quit(); });

  const pagina = `<!doctype html><body style="margin:0;background:#000">
<video id="v" src="file:///${VIDEO.replace(/\\/g, '/')}" muted></video>
<script>
const { ipcRenderer } = require('electron');
const v = document.getElementById('v');
const DA = ${DA ? Number(DA) : 'null'}, A = ${A ? Number(A) : 'null'}, PASSO = ${PASSO ? Number(PASSO) : 1};
v.addEventListener('error', ()=> ipcRenderer.send('guasto', 'il video non si apre: ' + (v.error && v.error.message)));
v.addEventListener('loadedmetadata', async ()=>{
  ipcRenderer.send('durata', v.duration.toFixed(2) + 's  ' + v.videoWidth + 'x' + v.videoHeight);
  const da = (DA===null) ? 0 : DA;
  const a  = (A===null)  ? v.duration : Math.min(A, v.duration);
  const c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  const g = c.getContext('2d');
  for(let t = da; t <= a + 0.0001; t += PASSO){
    await new Promise(ok=>{ const f=()=>{ v.removeEventListener('seeked', f); ok(); }; v.addEventListener('seeked', f); v.currentTime = t; });
    g.drawImage(v, 0, 0, c.width, c.height);
    const nome = 't' + t.toFixed(2).replace('.', '_') + '.png';
    ipcRenderer.send('foto', { nome, dati: c.toDataURL('image/png') });
  }
  ipcRenderer.send('finito');
});
</script></body>`;
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(pagina));
});
