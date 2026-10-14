/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    selectFiles(): Promise<string[]>;
    selectOutputFolder(): Promise<string | null>;
    openFolder(folder: string): Promise<boolean>;
    convertFile(args: {
      inputPath: string;
      outputDir: string;
      bitrate: number;
      index: number;
    }): Promise<{ outputPath: string }>;
    onConversionLog(callback: (data: { index: number; seconds: number }) => void): () => void;
  };
}