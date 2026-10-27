const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('promptBridge', { done: v => ipcRenderer.send('prompt-done', v) });
