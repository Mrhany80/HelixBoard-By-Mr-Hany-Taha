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
  cl: {
    start: opts => ipcRenderer.invoke('cl:start', opts),
    cmd: (cmd, arg) => ipcRenderer.invoke('cl:cmd', cmd, arg),
    onEvent: cb => { ipcRenderer.removeAllListeners('cl:event'); ipcRenderer.on('cl:event', (e, type, data, snap) => cb(type, data, snap)); },
  },
  saveRecording: (name, bytes) => ipcRenderer.invoke('rec:save', name, bytes),
  showFile: file => ipcRenderer.send('show-file', file),
  checkUpdates: () => ipcRenderer.send('update:check'),
  allowFirewall: () => ipcRenderer.invoke('fw:allow'),
  printPdf: name => ipcRenderer.invoke('report:pdf', name),
  live: {
    start: quiz => ipcRenderer.invoke('live:start', quiz),
    cmd: (cmd, arg) => ipcRenderer.invoke('live:cmd', cmd, arg),
    onUpdate: cb => { ipcRenderer.removeAllListeners('live:update'); ipcRenderer.on('live:update', (e, snap) => cb(snap)); },
  },
});
