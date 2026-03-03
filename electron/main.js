const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let pythonProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#050505',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
  });

  // Load Next.js app
  // In development, always try to load from localhost:3000
  // Check if we're in development by checking if the app is packaged
  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
  
  if (isDev) {
    // Wait a bit for Next.js to be ready, then load
    const loadURL = () => {
      mainWindow.loadURL('http://localhost:3000').catch((err) => {
        console.error('Failed to load URL:', err);
        // Retry after a delay
        setTimeout(loadURL, 2000);
      });
    };
    
    setTimeout(loadURL, 2000);
    mainWindow.webContents.openDevTools();
    
    // Handle navigation errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load:', errorCode, errorDescription);
      // Retry after a delay
      setTimeout(loadURL, 2000);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startPythonBackend() {
  const pythonPath = process.platform === 'win32' 
    ? path.join(__dirname, '../backend/venv/Scripts/python.exe')
    : path.join(__dirname, '../backend/venv/bin/python');
  
  const scriptPath = path.join(__dirname, '../backend/main.py');
  
  pythonProcess = spawn(pythonPath, [scriptPath], {
    cwd: path.join(__dirname, '../backend'),
    stdio: 'inherit',
  });

  pythonProcess.on('error', (err) => {
    console.error('Failed to start Python backend:', err);
  });

  pythonProcess.on('exit', (code) => {
    console.log(`Python backend exited with code ${code}`);
  });
}

app.whenReady().then(() => {
  startPythonBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
});
