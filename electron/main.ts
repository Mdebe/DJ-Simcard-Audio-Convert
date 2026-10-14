import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";

const isDev = !app.isPackaged;

const SUPPORTED_EXTENSIONS = [
  ".3g2",".3gp",".3gpp",".aac",".ac3",".aif",".aifc",".aiff",".amr",".au",
  ".avi",".caf",".cavs",".dss",".dv",".dvr",".flac",".flv",".m2ts",".m4a",
  ".m4b",".m4v",".mkv",".mod",".mov",".mp4",".mpeg",".mpg",".mts",".mxf",
  ".oga",".ogg",".ogv",".opus",".rm",".rmvb",".swf",".ts",".vob",".voc",
  ".wav",".weba",".webm",".wma",".wmv",".wtv"
];

function getFfmpegPath(): string {
  const bin = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  if (isDev) {
    // ffmpeg-static resolves to a platform-specific binary.
    return require("ffmpeg-static") as string;
  }
  return path.join(process.resourcesPath, "app.asar.unpacked", "node_modules", "ffmpeg-static", bin);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: "#090b10",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }
}

ipcMain.handle("select-files", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Media files", extensions: SUPPORTED_EXTENSIONS.map(x => x.slice(1)) },
      { name: "All files", extensions: ["*"] }
    ]
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle("select-output-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("open-folder", async (_event, folder: string) => {
  if (folder && fs.existsSync(folder)) {
    await shell.openPath(folder);
    return true;
  }
  return false;
});

ipcMain.handle("convert-file", async (event, args: {
  inputPath: string;
  outputDir: string;
  bitrate: number;
  index: number;
}) => {
  const { inputPath, outputDir, bitrate, index } = args;
  const ffmpeg = getFfmpegPath();

  if (!fs.existsSync(inputPath)) {
    throw new Error("Input file does not exist.");
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const parsed = path.parse(inputPath);
  const outputPath = path.join(outputDir, `${parsed.name}.mp3`);

  const uniqueOutput = (() => {
    if (!fs.existsSync(outputPath)) return outputPath;
    let n = 1;
    while (fs.existsSync(path.join(outputDir, `${parsed.name} (${n}).mp3`))) n++;
    return path.join(outputDir, `${parsed.name} (${n}).mp3`);
  })();

  return await new Promise<{ outputPath: string }>((resolve, reject) => {
    const argsList = [
      "-hide_banner",
      "-y",
      "-i", inputPath,
      "-vn",
      "-map", "0:a:0?",
      "-c:a", "libmp3lame",
      "-b:a", `${bitrate}k`,
      "-id3v2_version", "3",
      uniqueOutput
    ];

    const child = spawn(ffmpeg, argsList, { windowsHide: true });
    let stderr = "";

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
      const match = stderr.match(/time=(\d+):(\d+):([\d.]+)/);
      if (match) {
        const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
        event.sender.send("conversion-log", { index, seconds });
      }
    });

    child.on("error", err => reject(err));

    child.on("close", code => {
      if (code === 0 && fs.existsSync(uniqueOutput)) {
        resolve({ outputPath: uniqueOutput });
      } else {
        reject(new Error(stderr.split("\n").filter(Boolean).slice(-5).join("\n") || `FFmpeg exited with code ${code}`));
      }
    });
  });
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});