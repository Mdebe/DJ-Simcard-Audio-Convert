# DJ Simcard Audio Convert

A Windows desktop application for converting audio/video files to MP3 locally using Electron, React, TypeScript, Vite and FFmpeg.

## Requirements

- Windows 10/11
- Node.js 20+ recommended
- npm

## Run in development

```bash
npm install
npm run dev
```

## Build Windows installer

```bash
npm install
npm run dist
```

The installer will be generated in the `dist` folder.

## Features

- Drag and drop files
- Batch conversion
- Local/offline processing
- 128, 160, 192, 224, 256 and 320 kbps
- Audio extraction from supported video containers
- Output folder selection
- Open output folder
- Progress/status display
- Windows NSIS installer

## Notes

FFmpeg is used for decoding and MP3 encoding. Files are processed locally and are not uploaded to a server.

The first version intentionally does not attempt to convert files that contain no audio stream.