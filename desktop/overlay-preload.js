const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  through: on => ipcRenderer.send('overlay:through', on),
  snap: () => ipcRenderer.invoke('overlay:snap'),
  close: () => ipcRenderer.send('overlay:close'),
});
