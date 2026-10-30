/**
 * KYVORA STUDIO v3.0 - Proxy Media Engine
 *
 * Implements high-performance proxy workflow for smooth playback on 8GB RAM systems.
 * Transcodes 4K/2K/high-bitrate sources to lightweight qHD (960x540) or 720p H.264
 * for lightning-fast timeline scrubbing and zero-lag editing.
 */

import { MediaAsset, ProjectSettings } from '../types/project.js';

export interface ProxyResolutionPreset {
  name: string;
  width: number;
  height: number;
  crf: number;
  preset: string;
}

export const PROXY_PRESETS: Record<'qhd' | 'hd720', ProxyResolutionPreset> = {
  qhd: {
    name: 'qHD (960x540) - Máximo Rendimiento',
    width: 960,
    height: 540,
    crf: 28,
    preset: 'ultrafast'
  },
  hd720: {
    name: '720p (1280x720) - Balance Calidad/Fluidez',
    width: 1280,
    height: 720,
    crf: 25,
    preset: 'veryfast'
  }
};

/**
 * Determines whether a media asset warrants proxy generation.
 */
export function shouldGenerateProxy(asset: MediaAsset): boolean {
  if (asset.type !== 'video') {
    return false;
  }
  if (asset.hasProxy && asset.proxyFilePath) {
    return false;
  }
  // If resolution is 1080p or higher, proxy is highly recommended for smooth multicam/preview
  if (asset.width && asset.width >= 1920) {
    return true;
  }
  if (asset.height && asset.height >= 1080) {
    return true;
  }
  return false;
}

/**
 * Builds the FFmpeg command arguments to encode a fast proxy file.
 */
export function buildProxyTranscodeArgs(
  sourcePath: string,
  outputPath: string,
  presetType: 'qhd' | 'hd720' = 'qhd'
): string[] {
  const preset = PROXY_PRESETS[presetType];

  return [
    '-y',
    '-i', sourcePath,
    '-vf', `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
    '-c:v', 'libx264',
    '-preset', preset.preset,
    '-crf', String(preset.crf),
    '-g', '15', // frequent keyframes for snappy scrubbing
    '-c:a', 'aac',
    '-b:a', '96k',
    '-movflags', '+faststart',
    outputPath
  ];
}

/**
 * Returns the active media source path: proxy file if proxy editing is enabled and proxy exists,
 * or the master original file path.
 */
export function resolveActiveAssetPath(asset: MediaAsset, projectSettings?: ProjectSettings): string {
  if (projectSettings?.enableProxyEditing && asset.hasProxy && asset.proxyFilePath) {
    return asset.proxyFilePath;
  }
  return asset.filePath || '';
}
