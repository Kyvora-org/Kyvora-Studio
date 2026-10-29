export const XTP_FORMAT_IDENTIFIER = 'XTP';
export const CURRENT_XTP_FORMAT_VERSION = '1.0.0';

export type XtpMediaMode = 'embedded' | 'referenced' | 'hybrid';

export interface XtpMediaEntry {
  assetId: string;
  name: string;
  type: 'video' | 'audio' | 'image' | 'text';
  isEmbedded: boolean;
  archivePath?: string;    // e.g., 'media/asset-1.mp4' if embedded
  externalPath?: string;   // e.g., 'C:/Videos/intro.mp4' if referenced
  sizeBytes?: number;
  checksumSha256?: string;
}

export interface XtpManifest {
  format: 'XTP';
  formatVersion: string;   // e.g., '1.0.0'
  schemaVersion: string;   // e.g., '1.0.0' (KyvoraProject schemaVersion)
  projectId: string;
  projectName: string;
  mediaMode: XtpMediaMode;
  createdAt: string;
  updatedAt: string;
  mediaEntries: XtpMediaEntry[];
  thumbnails: string[];    // list of paths inside archive, e.g., ['thumbnails/poster.png']
}

export interface XtpPackageSecurityLimits {
  maxZipEntries: number;       // Default: 1000
  maxTotalSizeBytes: number;   // Default: 2 GB
  maxEntrySizeBytes: number;   // Default: 1 GB
  maxUncompressedRatio: number; // Ratio decompressed/compressed to prevent zip-bombs (default: 100)
}

export const DEFAULT_XTP_SECURITY_LIMITS: XtpPackageSecurityLimits = {
  maxZipEntries: 1000,
  maxTotalSizeBytes: 2 * 1024 * 1024 * 1024, // 2 GB
  maxEntrySizeBytes: 1024 * 1024 * 1024,      // 1 GB
  maxUncompressedRatio: 100
};

export interface MissingMediaReport {
  assetId: string;
  assetName: string;
  lastKnownPath?: string;
  isMissing: boolean;
}

export interface XtpExtractionResult {
  manifest: XtpManifest;
  project: any; // KyvoraProject
  missingMedia: MissingMediaReport[];
  embeddedMediaBuffers: Map<string, Uint8Array>;
  thumbnails: Map<string, Uint8Array>;
}
