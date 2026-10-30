/**
 * Motor de Scopes de Colorimetría para Kyvora Studio v3.0
 * Procesa buffers de píxeles (RGBA) para generar:
 * 1. Waveform (Luma Y y RGB Parade)
 * 2. Vectorscope (Chroma Cb/Cr en coordenadas polares)
 * 3. Histograma (R, G, B y Luminancia)
 */

export interface HistogramData {
  r: Uint32Array; // 256 bins
  g: Uint32Array; // 256 bins
  b: Uint32Array; // 256 bins
  luma: Uint32Array; // 256 bins
  maxCount: number;
}

export interface WaveformData {
  width: number;
  height: number;
  // Mapa de densidad de luma [x, y] donde y va de 0 (negro) a height-1 (blanco)
  lumaDensity: Uint16Array; // width * height
  maxDensity: number;
}

export interface VectorscopePoint {
  x: number; // -128 a +127 (centrado en 0)
  y: number; // -128 a +127 (centrado en 0)
}

export interface VectorscopeData {
  densityMap: Uint16Array; // 256 * 256
  maxDensity: number;
}

/**
 * Calcula el histograma de 256 niveles de una imagen RGBA
 */
export function computeHistogram(rgbaPixels: Uint8ClampedArray | Uint8Array): HistogramData {
  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  const luma = new Uint32Array(256);
  let maxCount = 0;

  const totalPixels = rgbaPixels.length / 4;
  // Submuestreo adaptativo si la imagen es masiva para mantener 60 FPS
  const step = totalPixels > 100000 ? Math.ceil(totalPixels / 100000) * 4 : 4;

  for (let i = 0; i < rgbaPixels.length; i += step) {
    const red = rgbaPixels[i];
    const green = rgbaPixels[i + 1];
    const blue = rgbaPixels[i + 2];
    // BT.709 Luma
    const y = Math.round(0.2126 * red + 0.7152 * green + 0.0722 * blue);

    r[red]++;
    g[green]++;
    b[blue]++;
    luma[y]++;

    if (r[red] > maxCount) maxCount = r[red];
    if (g[green] > maxCount) maxCount = g[green];
    if (b[blue] > maxCount) maxCount = b[blue];
    if (luma[y] > maxCount) maxCount = luma[y];
  }

  return { r, g, b, luma, maxCount };
}

/**
 * Genera el mapa de densidad para el osciloscopio Waveform
 * targetWidth y targetHeight definen la resolución de la gráfica del osciloscopio
 */
export function computeWaveform(
  rgbaPixels: Uint8ClampedArray | Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number = 256,
  targetHeight: number = 100
): WaveformData {
  const lumaDensity = new Uint16Array(targetWidth * targetHeight);
  let maxDensity = 0;

  const stepX = Math.max(1, Math.floor(sourceWidth / targetWidth));
  const stepY = Math.max(1, Math.floor(sourceHeight / 120));

  for (let x = 0; x < sourceWidth; x += stepX) {
    const targetX = Math.min(targetWidth - 1, Math.floor((x / sourceWidth) * targetWidth));

    for (let y = 0; y < sourceHeight; y += stepY) {
      const idx = (y * sourceWidth + x) * 4;
      const r = rgbaPixels[idx];
      const g = rgbaPixels[idx + 1];
      const b = rgbaPixels[idx + 2];

      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      // Invertir Y para que 100 IRE esté arriba y 0 IRE abajo
      const targetY = Math.max(0, Math.min(targetHeight - 1, Math.floor(((255 - luma) / 255) * (targetHeight - 1))));

      const mapIdx = targetY * targetWidth + targetX;
      lumaDensity[mapIdx]++;
      if (lumaDensity[mapIdx] > maxDensity) {
        maxDensity = lumaDensity[mapIdx];
      }
    }
  }

  return {
    width: targetWidth,
    height: targetHeight,
    lumaDensity,
    maxDensity
  };
}

/**
 * Genera el mapa de distribución cromática para Vectorscope (espacio YCbCr / UV centrado)
 */
export function computeVectorscope(
  rgbaPixels: Uint8ClampedArray | Uint8Array,
  sampleLimit: number = 25000
): VectorscopeData {
  const densityMap = new Uint16Array(256 * 256);
  let maxDensity = 0;

  const totalPixels = rgbaPixels.length / 4;
  const step = Math.max(4, Math.floor(totalPixels / sampleLimit) * 4);

  for (let i = 0; i < rgbaPixels.length; i += step) {
    const r = rgbaPixels[i];
    const g = rgbaPixels[i + 1];
    const b = rgbaPixels[i + 2];

    // ITU-R BT.709 Cb y Cr normalizados a rango [0, 255] centrado en 128
    const cb = Math.round(128 - 0.1146 * r - 0.3854 * g + 0.5 * b);
    const cr = Math.round(128 + 0.5 * r - 0.4542 * g - 0.0458 * b);

    const clampedCb = Math.max(0, Math.min(255, cb));
    const clampedCr = Math.max(0, Math.min(255, cr));

    // Y invertido para plano cartesiano tradicional
    const mapIdx = (255 - clampedCr) * 256 + clampedCb;
    densityMap[mapIdx]++;
    if (densityMap[mapIdx] > maxDensity) {
      maxDensity = densityMap[mapIdx];
    }
  }

  return {
    densityMap,
    maxDensity
  };
}

