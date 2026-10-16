export const SUPPORTED_FRAME_RATES = [24, 25, 30, 50, 60] as const;
export type SupportedFrameRate = typeof SUPPORTED_FRAME_RATES[number];

/**
 * Formats seconds into SMPTE-like timecode (HH:MM:SS:FF)
 */
export function formatTimecode(seconds: number, fps = 30): string {
  const safeSeconds = Math.max(0, seconds);
  const totalFrames = Math.floor(safeSeconds * fps);
  
  const frames = totalFrames % fps;
  const totalSecs = Math.floor(safeSeconds);
  const secs = totalSecs % 60;
  const mins = Math.floor(totalSecs / 60) % 60;
  const hours = Math.floor(totalSecs / 3600);

  const pad = (n: number, z = 2) => n.toString().padStart(z, '0');

  return `${pad(hours)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
}

/**
 * Formats seconds to human readable standard duration MM:SS
 */
export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const mins = Math.floor(safeSeconds / 60);
  const secs = Math.floor(safeSeconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Convierte segundos a número entero de fotograma según los FPS dados.
 */
export function timeToFrame(seconds: number, fps: number): number {
  if (isNaN(seconds) || seconds < 0 || fps <= 0) return 0;
  return Math.round(seconds * fps);
}

/**
 * Convierte un número de fotograma a segundos exactos con alta precisión.
 */
export function frameToTime(frame: number, fps: number): number {
  if (isNaN(frame) || frame < 0 || fps <= 0) return 0;
  return frame / fps;
}

/**
 * Ajusta un tiempo en segundos al fotograma discreto más cercano para evitar derivas.
 */
export function snapTimeToFrame(seconds: number, fps: number): number {
  return frameToTime(timeToFrame(seconds, fps), fps);
}

export interface ResolutionValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Valida dimensiones de resolución para proyectos y exportaciones.
 * - Rango configurable 64 a 7680 píxeles.
 * - Enteros positivos, no NaN, no infinitos.
 * - Dimensiones pares para compatibilidad con códecs como H.264 (YUV 4:2:0).
 */
export function validateResolution(
  width: number, 
  height: number, 
  requireEvenForCodec = true
): ResolutionValidationResult {
  const errors: string[] = [];

  if (typeof width !== 'number' || isNaN(width) || !isFinite(width)) {
    errors.push('El ancho debe ser un número numérico válido.');
  } else if (!Number.isInteger(width)) {
    errors.push('El ancho debe ser un número entero de píxeles.');
  } else if (width < 64 || width > 7680) {
    errors.push('El ancho debe estar comprendido entre 64 y 7680 píxeles.');
  } else if (requireEvenForCodec && width % 2 !== 0) {
    errors.push('El ancho debe ser un número par para garantizar compatibilidad con códecs de video (YUV 4:2:0).');
  }

  if (typeof height !== 'number' || isNaN(height) || !isFinite(height)) {
    errors.push('El alto debe ser un número numérico válido.');
  } else if (!Number.isInteger(height)) {
    errors.push('El alto debe ser un número entero de píxeles.');
  } else if (height < 64 || height > 7680) {
    errors.push('El alto debe estar comprendido entre 64 y 7680 píxeles.');
  } else if (requireEvenForCodec && height % 2 !== 0) {
    errors.push('El alto debe ser un número par para garantizar compatibilidad con códecs de video (YUV 4:2:0).');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}


