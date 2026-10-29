import { MediaType } from '../types/project';

export interface MediaProbeResult {
  formatName: string;
  durationInSeconds: number;
  width?: number;
  height?: number;
  frameRate?: number;
  audioChannels?: number;
  sampleRate?: number;
  codecName?: string;
  fileSizeBytes: number;
  hasVideo: boolean;
  hasAudio: boolean;
  thumbnailBase64?: string;
}

export interface MediaImportProgress {
  assetId: string;
  fileName: string;
  percentage: number; // 0 to 100
  phase: 'hashing' | 'probing' | 'thumbnail' | 'storing' | 'completed' | 'error';
  errorMessage?: string;
}

export interface MediaFormatSupport {
  isSupported: boolean;
  mediaType: MediaType;
  container: string;
  browserLimitationNote?: string;
}

export interface MediaStorageRecord {
  assetId: string;        // ID estable (hash sha256)
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  data: ArrayBuffer | Uint8Array;
  thumbnailDataUrl?: string;
  createdAt: string;
}

export const SUPPORTED_EXTENSIONS: Record<string, { type: MediaType; container: string; browserNative: boolean }> = {
  // Video
  'mp4': { type: 'video', container: 'mp4', browserNative: true },
  'webm': { type: 'video', container: 'webm', browserNative: true },
  'mov': { type: 'video', container: 'quicktime', browserNative: true },
  'mkv': { type: 'video', container: 'matroska', browserNative: false },
  'avi': { type: 'video', container: 'avi', browserNative: false },
  // Audio
  'mp3': { type: 'audio', container: 'mp3', browserNative: true },
  'wav': { type: 'audio', container: 'wav', browserNative: true },
  'ogg': { type: 'audio', container: 'ogg', browserNative: true },
  'aac': { type: 'audio', container: 'aac', browserNative: true },
  'flac': { type: 'audio', container: 'flac', browserNative: true },
  'm4a': { type: 'audio', container: 'm4a', browserNative: true },
  // Image
  'png': { type: 'image', container: 'png', browserNative: true },
  'jpg': { type: 'image', container: 'jpeg', browserNative: true },
  'jpeg': { type: 'image', container: 'jpeg', browserNative: true },
  'webp': { type: 'image', container: 'webp', browserNative: true },
  'svg': { type: 'image', container: 'svg', browserNative: true },
  'gif': { type: 'image', container: 'gif', browserNative: true },
  'bmp': { type: 'image', container: 'bmp', browserNative: true }
};

export function detectMediaFormatSupport(fileName: string, _mimeType?: string): MediaFormatSupport {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const known = SUPPORTED_EXTENSIONS[extension];

  if (!known) {
    return {
      isSupported: false,
      mediaType: 'video',
      container: extension || 'unknown',
      browserLimitationNote: `Formato de archivo no reconocido (.${extension}).`
    };
  }

  let browserLimitationNote: string | undefined;
  if (!known.browserNative) {
    browserLimitationNote = `El contenedor .${extension} no es nativo en todos los navegadores web. En el escritorio se procesará vía FFprobe nativo.`;
  }

  return {
    isSupported: true,
    mediaType: known.type,
    container: known.container,
    browserLimitationNote
  };
}
