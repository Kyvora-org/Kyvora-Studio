import { ChromaKeyProperties } from '../types/project';

/**
 * Motor de Chroma Key (Pantalla Verde y Azul) para Kyvora Studio v3.0
 * Incluye cálculo de distancia cromática, suavizado de bordes y supresión de desborde (spill).
 */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export function parseHexColor(hex: string): RgbColor {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) / 255,
      g: parseInt(clean[1] + clean[1], 16) / 255,
      b: parseInt(clean[2] + clean[2], 16) / 255
    };
  }
  if (clean.length >= 6) {
    return {
      r: parseInt(clean.substring(0, 2), 16) / 255,
      g: parseInt(clean.substring(2, 4), 16) / 255,
      b: parseInt(clean.substring(4, 6), 16) / 255
    };
  }
  return { r: 0, g: 1, b: 0 }; // Default Verde puro
}

/**
 * Convierte RGB [0, 1] a coordenadas cromáticas YCbCr para detección robusta independiente de brillo
 */
function rgbToYCbCr(r: number, g: number, b: number): [number, number, number] {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = -0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 0.5 * r - 0.418688 * g - 0.081312 * b;
  return [y, cb, cr];
}

/**
 * Procesa un píxel aplicando Chroma Key
 * Retorna [R, G, B, Alpha] donde Alpha está entre 0 (transparente) y 1 (opaco)
 */
export function processChromaPixel(
  r: number, 
  g: number, 
  b: number, 
  config: ChromaKeyProperties
): [number, number, number, number] {
  if (!config.isEnabled) return [r, g, b, 1.0];

  const isByteRange = r > 1 || g > 1 || b > 1;
  const normR = isByteRange ? r / 255 : r;
  const normG = isByteRange ? g / 255 : g;
  const normB = isByteRange ? b / 255 : b;

  const keyRGB = parseHexColor(config.keyColorHex || '#00FF00');
  const [, cbPixel, crPixel] = rgbToYCbCr(normR, normG, normB);
  const [, cbKey, crKey] = rgbToYCbCr(keyRGB.r, keyRGB.g, keyRGB.b);

  // Distancia euclidiana en el plano de croma
  const dCb = cbPixel - cbKey;
  const dCr = crPixel - crKey;
  const chromaDistance = Math.sqrt(dCb * dCb + dCr * dCr);

  // Umbrales basados en similarity y smoothness
  const sim = Math.max(0.01, config.similarity);
  const smooth = Math.max(0.001, config.smoothness);

  let alpha = 1.0;
  if (chromaDistance < sim) {
    alpha = 0.0;
  } else if (chromaDistance < sim + smooth) {
    alpha = (chromaDistance - sim) / smooth;
  }

  // Supresión de desborde (Spill Suppression):
  let outR = normR;
  let outG = normG;
  let outB = normB;

  if (config.spillSuppression > 0 && alpha > 0) {
    const isGreenKey = keyRGB.g > keyRGB.r && keyRGB.g > keyRGB.b;
    const isBlueKey = keyRGB.b > keyRGB.r && keyRGB.b > keyRGB.g;

    if (isGreenKey && normG > (normR + normB) / 2) {
      const maxAllowedG = (normR + normB) / 2;
      const suppressedG = normG * (1 - config.spillSuppression) + maxAllowedG * config.spillSuppression;
      outG = Math.min(normG, suppressedG);
    } else if (isBlueKey && normB > (normR + normG) / 2) {
      const maxAllowedB = (normR + normG) / 2;
      const suppressedB = normB * (1 - config.spillSuppression) + maxAllowedB * config.spillSuppression;
      outB = Math.min(normB, suppressedB);
    }
  }

  if (isByteRange) {
    return [Math.round(outR * 255), Math.round(outG * 255), Math.round(outB * 255), alpha];
  }
  return [outR, outG, outB, alpha];
}

/**
 * Traduce la configuración de Chroma Key a la sintaxis del filtro 'chromakey' y 'despill' de FFmpeg
 */
export function formatFfmpegChromaKeyFilter(config: ChromaKeyProperties): string | null {
  if (!config.isEnabled) return null;

  const hexColor = (config.keyColorHex || '#00FF00').replace('#', '0x');
  const sim = Math.max(0.01, Math.min(1.0, config.similarity)).toFixed(3);
  const smooth = Math.max(0.001, Math.min(1.0, config.smoothness)).toFixed(3);

  let filter = `chromakey=color=${hexColor}:similarity=${sim}:blend=${smooth}`;
  if (config.spillSuppression > 0) {
    // FFmpeg despill filter
    const keyRGB = parseHexColor(config.keyColorHex || '#00FF00');
    const type = keyRGB.b > keyRGB.g ? 'blue' : 'green';
    filter += `,despill=type=${type}:mix=${config.spillSuppression.toFixed(2)}`;
  }

  return filter;
}
