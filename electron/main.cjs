/**
 * Thin Electron shell — transparent / framed companion window + input forwarding.
 * Companion / idle-gear logic stays in src/core (loaded by the renderer).
 */
const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('node:path');

const isDev = process.argv.includes('--dev');
const ROOT = path.join(__dirname, '..');

/** @type {BrowserWindow | null} */
let mainWindow = null;

function sendInput(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('guaji:input', payload);
  }
}

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = display.workAreaSize;
  // Slightly larger framed panel for usable gear UI (MVP)
  const winW = 540;
  const winH = 720;

  mainWindow = new BrowserWindow({
    width: winW,
    height: winH,
    x: Math.round(sw - winW - 24),
    y: Math.round(Math.max(24, sh - winH - 24)),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    hasShadow: true,
    minWidth: 420,
    minHeight: 600,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  try {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch {
    /* unsupported on some platforms */
  }

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(ROOT, 'dist', 'index.html'));
  }

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && !input.isAutoRepeat) {
      sendInput({
        type: 'keyboard',
        detail: input.code || input.key,
        timestamp: Date.now(),
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.on('guaji:set-ignore-mouse', (_e, ignore, options) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (ignore) {
    mainWindow.setIgnoreMouseEvents(true, {
      forward: options?.forward !== false,
    });
  } else {
    mainWindow.setIgnoreMouseEvents(false);
  }
});

ipcMain.on('guaji:report-input', (_e, payload) => {
  sendInput(payload);
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
