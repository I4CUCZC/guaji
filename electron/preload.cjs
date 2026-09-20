const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('guaji', {
  isElectron: true,
  onInput: (cb) => {
    const listener = (_event, payload) => {
      if (payload && typeof cb === 'function') cb(payload);
    };
    ipcRenderer.on('guaji:input', listener);
    return () => ipcRenderer.removeListener('guaji:input', listener);
  },
  setIgnoreMouseEvents: (ignore, options) => {
    ipcRenderer.send('guaji:set-ignore-mouse', !!ignore, options || {});
  },
  reportInput: (payload) => {
    ipcRenderer.send('guaji:report-input', payload);
  },
});
