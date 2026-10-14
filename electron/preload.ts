import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  selectFiles: () => ipcRenderer.invoke("select-files"),
  selectOutputFolder: () => ipcRenderer.invoke("select-output-folder"),
  openFolder: (folder: string) => ipcRenderer.invoke("open-folder", folder),
  convertFile: (args: {
    inputPath: string;
    outputDir: string;
    bitrate: number;
    index: number;
  }) => ipcRenderer.invoke("convert-file", args),
  onConversionLog: (callback: (data: { index: number; seconds: number }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { index: number; seconds: number }) => callback(data);
    ipcRenderer.on("conversion-log", listener);
    return () => ipcRenderer.removeListener("conversion-log", listener);
  }
});