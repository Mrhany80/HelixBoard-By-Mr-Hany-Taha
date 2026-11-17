/* the only bridge between the board page and Windows: opening files and a synchronous prompt() */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('helixDesktop', {
  platform: process.platform,
  prompt: (message, value) => ipcRenderer.sendSync('prompt-sync', message, value),
  onOpenFile: cb => ipcRenderer.on('open-file', (e, msg) => cb(msg)),
  ready: () => ipcRenderer.send('renderer-ready'),
  capture: () => ipcRenderer.invoke('screen:capture'),
  annotate: () => ipcRenderer.send('overlay:open'),
  onInsertImage: cb => { ipcRenderer.removeAllListeners('insert-image'); ipcRenderer.on('insert-image', (e, url) => cb(url)); },
  showFile: file => ipcRenderer.send('show-file', file),
  checkUpdates: () => ipcRenderer.send('update:check'),
});
