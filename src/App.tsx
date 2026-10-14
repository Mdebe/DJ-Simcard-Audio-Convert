import React, { useEffect, useMemo, useState } from "react";

type FileStatus = "Ready" | "Converting" | "Completed" | "Failed";

type AudioFile = {
  id: string;
  path: string;
  name: string;
  size: number;
  status: FileStatus;
  progress: number;
  outputPath?: string;
  error?: string;
};

const ACCEPTED = /\.(3g2|3gp|3gpp|aac|ac3|aif|aifc|aiff|amr|au|avi|caf|cavs|dss|dv|dvr|flac|flv|m2ts|m4a|m4b|m4v|mkv|mod|mov|mp4|mpeg|mpg|mts|mxf|oga|ogg|ogv|opus|rm|rmvb|swf|ts|vob|voc|wav|weba|webm|wma|wmv|wtv)$/i;

function basename(p: string) {
  return p.split(/[\\/]/).pop() || p;
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function fileSize(path: string) {
  // Browser cannot inspect local paths. Size is shown after conversion only if available.
  return 0;
}

export default function App() {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [bitrate, setBitrate] = useState(320);
  const [outputDir, setOutputDir] = useState("");
  const [dragging, setDragging] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    return window.electronAPI.onConversionLog(({ index }) => {
      setFiles(current => current.map((f, i) =>
        i === index && f.status === "Converting"
          ? { ...f, progress: Math.min(95, f.progress + 2) }
          : f
      ));
    });
  }, []);

  const completed = useMemo(() => files.filter(f => f.status === "Completed").length, [files]);
  const failed = useMemo(() => files.filter(f => f.status === "Failed").length, [files]);

  async function chooseFiles() {
    const paths = await window.electronAPI.selectFiles();
    addPaths(paths);
  }

  function addPaths(paths: string[]) {
    const valid = paths.filter(p => ACCEPTED.test(p));
    setFiles(current => {
      const existing = new Set(current.map(f => f.path.toLowerCase()));
      const additions = valid
        .filter(p => !existing.has(p.toLowerCase()))
        .map(p => ({
          id: crypto.randomUUID(),
          path: p,
          name: basename(p),
          size: fileSize(p),
          status: "Ready" as FileStatus,
          progress: 0
        }));
      return [...current, ...additions];
    });
  }

  async function chooseOutput() {
    const folder = await window.electronAPI.selectOutputFolder();
    if (folder) setOutputDir(folder);
  }

  function remove(id: string) {
    if (converting) return;
    setFiles(current => current.filter(f => f.id !== id));
  }

  function clearCompleted() {
    if (converting) return;
    setFiles(current => current.filter(f => f.status !== "Completed"));
  }

  async function convertAll() {
    if (!files.length || converting) return;

    let folder = outputDir;
    if (!folder) {
      folder = await window.electronAPI.selectOutputFolder() || "";
      if (!folder) return;
      setOutputDir(folder);
    }

    setConverting(true);

    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      if (item.status === "Completed") continue;

      setFiles(current => current.map(f =>
        f.id === item.id ? { ...f, status: "Converting", progress: 5, error: undefined } : f
      ));

      try {
        const result = await window.electronAPI.convertFile({
          inputPath: item.path,
          outputDir: folder,
          bitrate,
          index: i
        });

        setFiles(current => current.map(f =>
          f.id === item.id
            ? { ...f, status: "Completed", progress: 100, outputPath: result.outputPath }
            : f
        ));
      } catch (err) {
        setFiles(current => current.map(f =>
          f.id === item.id
            ? { ...f, status: "Failed", progress: 0, error: err instanceof Error ? err.message : String(err) }
            : f
        ));
      }
    }

    setConverting(false);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    // Electron exposes dropped files as File objects with a path property.
    const paths = Array.from(event.dataTransfer.files)
      .map(file => (file as File & { path?: string }).path)
      .filter((p): p is string => Boolean(p));
    addPaths(paths);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">DJ</div>
          <div>
            <div className="brand-title">DJ SIMCARD</div>
            <div className="brand-subtitle">AUDIO CONVERT</div>
          </div>
        </div>
        <div className="offline"><span /> OFFLINE CONVERTER</div>
      </header>

      <main className="content">
        <section className="hero">
          <div>
            <h1>Convert your music to <em>MP3</em></h1>
            <p>Fast local conversion. Your files stay on your computer.</p>
          </div>
        </section>

        <section
          className={`dropzone ${dragging ? "dragging" : ""}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div className="drop-icon">♫</div>
          <h2>Drop audio or video files here</h2>
          <p>or select files from your computer</p>
          <button className="primary" onClick={chooseFiles}>Browse Files</button>
          <div className="formats">
            WAV · FLAC · M4A · AAC · OGG · OPUS · MP4 · MKV · MOV · AVI · 3GP · WEBM · and more
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Files</h2>
              <span>{files.length} selected</span>
            </div>
            {files.length > 0 && (
              <button className="text-button" onClick={clearCompleted}>Clear completed</button>
            )}
          </div>

          {files.length === 0 ? (
            <div className="empty">No files selected yet.</div>
          ) : (
            <div className="file-list">
              {files.map(file => (
                <div className="file-row" key={file.id}>
                  <div className="file-type">♫</div>
                  <div className="file-info">
                    <strong title={file.path}>{file.name}</strong>
                    <span>{file.size ? formatBytes(file.size) : "Local file"} · MP3</span>
                    {file.status === "Converting" && (
                      <div className="mini-progress"><div style={{ width: `${file.progress}%` }} /></div>
                    )}
                    {file.error && <small className="error">{file.error.slice(0, 140)}</small>}
                  </div>
                  <div className={`status ${file.status.toLowerCase()}`}>
                    {file.status}
                  </div>
                  <button className="remove" onClick={() => remove(file.id)} disabled={converting}>×</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="settings">
          <div className="setting">
            <label>MP3 Quality</label>
            <select value={bitrate} onChange={e => setBitrate(Number(e.target.value))} disabled={converting}>
              {[128,160,192,224,256,320].map(rate => <option key={rate} value={rate}>{rate} kbps</option>)}
            </select>
          </div>

          <div className="setting output">
            <label>Output Folder</label>
            <div className="output-control">
              <input value={outputDir} placeholder="Choose where converted MP3 files will be saved" readOnly />
              <button onClick={chooseOutput} disabled={converting}>Choose</button>
              {outputDir && <button onClick={() => window.electronAPI.openFolder(outputDir)} disabled={converting}>Open</button>}
            </div>
          </div>
        </section>

        <button
          className="convert"
          onClick={convertAll}
          disabled={converting || files.length === 0}
        >
          {converting ? "CONVERTING..." : "CONVERT TO MP3"}
        </button>

        <div className="summary">
          <span>Completed: <b>{completed}</b></span>
          <span>Failed: <b>{failed}</b></span>
          <span>Remaining: <b>{files.filter(f => f.status === "Ready").length}</b></span>
        </div>
      </main>

      <footer>
        <span>DJ Simcard Audio Convert v1.0.0</span>
        <span>Local processing · No uploads</span>
      </footer>
    </div>
  );
}