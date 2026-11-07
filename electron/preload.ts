import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setMeshyKey: (key: string) => ipcRenderer.invoke("settings:setMeshyKey", key),
  setPlateToken: (t: string) => ipcRenderer.invoke("settings:setPlateToken", t),
  lookupPlate: (p: string) => ipcRenderer.invoke("plate:lookup", p),
  setImaginKey: (k: string) => ipcRenderer.invoke("settings:setImaginKey", k),
  colorsSync: (q: unknown) => ipcRenderer.invoke("colors:sync", q),
  colorsImport: (rows: unknown) => ipcRenderer.invoke("colors:import", rows),
  colorsList: (q: unknown) => ipcRenderer.invoke("colors:list", q),
  colorsMakes: () => ipcRenderer.invoke("colors:makes"),
  fipe: (route: string) => ipcRenderer.invoke("fipe:get", route),
  generateModel: (images: string[], hash: string) => ipcRenderer.invoke("model:generate", images, hash),
  photoRun: (opts: unknown) => ipcRenderer.invoke("photo:run", opts),
  photoCancel: () => ipcRenderer.invoke("photo:cancel"),
  libraryAddGlb: (glb: Uint8Array, hash: string, name: string) => ipcRenderer.invoke("library:addGlb", glb, hash, name),
  libraryList: () => ipcRenderer.invoke("library:list"),
  libraryLoad: (id: string) => ipcRenderer.invoke("library:load", id),
  libraryUpdate: (id: string, patch: unknown) => ipcRenderer.invoke("library:update", id, patch),
  libraryDelete: (id: string) => ipcRenderer.invoke("library:delete", id),
  onProgress: (cb: (p: { progress: number; status: string }) => void) => {
    const h = (_: unknown, p: { progress: number; status: string }) => cb(p);
    ipcRenderer.on("model:progress", h);
    return () => ipcRenderer.removeListener("model:progress", h);
  },
});
