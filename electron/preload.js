const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  fetchEsriTile: (url) => {
    return ipcRenderer.invoke("fetch-esri-tile", url);
  },
});
