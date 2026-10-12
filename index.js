const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_DIR = __dirname;

let mcProcess = null;
let serverLogs = [];

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

const EULA_FILE = path.join(SERVER_DIR, 'eula.txt');
if (!fs.existsSync(EULA_FILE)) {
  fs.writeFileSync(EULA_FILE, 'eula=true\n');
}

app.get('/', (req, res) => {
  res.render('index', {
    isRunning: mcProcess !== null,
    logs: serverLogs.slice(-50).join('')
  });
});

app.post('/server/start', (req, res) => {
  if (!mcProcess) {
    serverLogs.push('[Dashboard] Memulai server Minecraft...\n');
    
    mcProcess = spawn('java', ['-Xmx1024M', '-Xms1024M', '-jar', 'server.jar', 'nogui'], { cwd: SERVER_DIR });

    mcProcess.stdout.on('data', (data) => {
      serverLogs.push(data.toString());
    });

    mcProcess.stderr.on('data', (data) => {
      serverLogs.push(data.toString());
    });

    mcProcess.on('close', (code) => {
      mcProcess = null;
      serverLogs.push(`[Dashboard] Server Minecraft berhenti dengan kode keluaran: ${code}\n`);
    });

    mcProcess.on('error', (err) => {
      mcProcess = null;
      serverLogs.push(`[Dashboard] Gagal menjalankan server: ${err.message}\n`);
    });
  }
  res.redirect('/');
});

app.post('/server/stop', (req, res) => {
  if (mcProcess) {
    serverLogs.push('[Dashboard] Mengirim perintah stop ke server Minecraft...\n');
    mcProcess.stdin.write('stop\n');

    setTimeout(() => {
      if (mcProcess) {
        serverLogs.push('[Dashboard] Server tidak merespon, menghentikan secara paksa...\n');
        mcProcess.kill('SIGKILL');
        mcProcess = null;
      }
    }, 10000);
  }
  res.redirect('/');
});

app.get('/files', (req, res) => {
  const reqPath = req.query.path || '';
  const targetDir = path.join(SERVER_DIR, reqPath);

  if (!targetDir.startsWith(SERVER_DIR)) {
    return res.status(403).send('Akses ditolak');
  }

  fs.readdir(targetDir, { withFileTypes: true }, (err, files) => {
    if (err) return res.status(500).send('Gagal membaca direktori');

    const fileList = files.map(file => ({
      name: file.name,
      isDirectory: file.isDirectory(),
      path: path.join(reqPath, file.name)
    }));

    res.render('files', {
      files: fileList,
      currentPath: reqPath,
      parentPath: reqPath ? path.dirname(reqPath) : null
    });
  });
});

app.get('/files/read', (req, res) => {
  const filePath = path.join(SERVER_DIR, req.query.path || '');
  if (!filePath.startsWith(SERVER_DIR)) return res.status(403).send('Akses ditolak');

  fs.readFile(filePath, 'utf8', (err, content) => {
    if (err) return res.status(500).send('Gagal membaca file');
    res.json({ content });
  });
});

app.post('/files/create', (req, res) => {
  const { name, isFolder, currentPath } = req.body;
  const targetPath = path.join(SERVER_DIR, currentPath || '', name);

  if (!targetPath.startsWith(SERVER_DIR)) return res.status(403).send('Akses ditolak');

  try {
    if (isFolder === 'true') {
      fs.mkdirSync(targetPath, { recursive: true });
    } else {
      fs.writeFileSync(targetPath, '');
    }
  } catch (err) {
    return res.status(500).send('Gagal membuat file/folder');
  }

  res.redirect(`/files?path=${encodeURIComponent(currentPath || '')}`);
});

app.post('/files/save', (req, res) => {
  const { filePath, content, currentPath } = req.body;
  const targetPath = path.join(SERVER_DIR, filePath);

  if (!targetPath.startsWith(SERVER_DIR)) return res.status(403).send('Akses ditolak');

  fs.writeFile(targetPath, content, 'utf8', (err) => {
    if (err) return res.status(500).send('Gagal menyimpan file');
    res.redirect(`/files?path=${encodeURIComponent(currentPath || '')}`);
  });
});

app.post('/files/delete', (req, res) => {
  const { filePath, currentPath } = req.body;
  const targetPath = path.join(SERVER_DIR, filePath);

  if (!targetPath.startsWith(SERVER_DIR)) return res.status(403).send('Akses ditolak');

  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } catch (err) {
    return res.status(500).send('Gagal menghapus file/folder');
  }

  res.redirect(`/files?path=${encodeURIComponent(currentPath || '')}`);
});

app.listen(PORT, () => {
  console.log(`Dashboard berjalan pada port ${PORT}`);
});
