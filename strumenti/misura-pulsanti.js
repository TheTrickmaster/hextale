// Misura OGNI pulsante del gioco — larghezza e posizione dentro al suo
// contenitore — uno stato dell'interfaccia per volta.
//
//   electron misura.js <nome-dello-scatto>
//
// Le misure sono offsetWidth/offsetLeft/offsetTop e non getBoundingClientRect:
// il gioco vive dentro a un foglio 1920x1080 che viene scalato per stare nella
// finestra, e il rettangolo sullo schermo e' gia' moltiplicato per quella
// scala. I 400px di cui si parla sono quelli del foglio.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');

const path = require('path');
const RADICE = 'file:///' + path.resolve(__dirname, '..').split(path.sep).join('/');
const PAGINA = RADICE + '/play/index.html';
const NOME = process.argv[2] || 'scatto';

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080,
    webPreferences: { contextIsolation: false, webSecurity: false } });
  await win.loadURL(PAGINA);
  await new Promise(r => setTimeout(r, 2500));

  const esito = await win.webContents.executeJavaScript(`(function(){
    const righe = {};
    const strada = (el)=>{
      const p = []; let n = el;
      for(let i=0;i<4 && n && n !== document.body;i++){
        let s = n.tagName.toLowerCase();
        if(n.id) s += '#' + n.id;
        else if(n.className && typeof n.className === 'string') s += '.' + n.className.trim().split(/\\s+/).slice(0,2).join('.');
        p.unshift(s); n = n.parentElement;
      }
      return p.join(' > ');
    };
    const guarda = ()=>{
      document.querySelectorAll('.hx-btn').forEach(b=>{
        if(b.offsetWidth < 1) return;
        const et = b.querySelector('.hxb-label');
        const testo = ((et && et.textContent) || b.textContent || '').trim().slice(0,28);
        const k = strada(b) + ' | ' + testo;
        if(righe[k]) return;
        righe[k] = { largo:b.offsetWidth, x:b.offsetLeft, y:b.offsetTop };
      });
    };

    guarda();
    document.querySelectorAll('.hx-overlay').forEach(o=>{
      const c_era = o.classList.contains('show');
      o.classList.add('show'); o.getBoundingClientRect(); guarda();
      if(!c_era) o.classList.remove('show');
    });
    document.querySelectorAll('.hx-btn').forEach(b=>{
      if(b.offsetWidth >= 1) return;
      let n = b;
      while(n && n !== document.body){
        const st = getComputedStyle(n);
        if(st.display === 'none') n.style.display = 'flex';
        if(st.visibility === 'hidden') n.style.visibility = 'visible';
        if(+st.opacity === 0) n.style.opacity = '1';
        n = n.parentElement;
      }
    });
    document.body.getBoundingClientRect();
    guarda();
    return righe;
  })()`);

  fs.writeFileSync('misura-' + NOME + '.json', JSON.stringify(esito, null, 1));
  const chiavi = Object.keys(esito);
  const troppo = chiavi.filter(k => esito[k].largo > 400);
  console.log('pulsanti misurati: ' + chiavi.length);
  console.log('sopra i 400px: ' + troppo.length);
  troppo.sort((a, b) => esito[b].largo - esito[a].largo).forEach(k =>
    console.log('  ' + String(esito[k].largo).padStart(4) + 'px  x=' + String(esito[k].x).padStart(4) + '  ' + k));
  app.quit();
}).catch(e => { console.error(e); app.quit(); });
