/**
 * Parser y generador de LUTs 3D (.cube) para Kyvora Studio v3.0
 * Soporta especificación Adobe .cube (LUT 3D de N^3 puntos con interpolación trilineal)
 */

export interface Lut3DTable {
  title: string;
  size: number;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  data: Float32Array; // N^3 * 3 floats (R, G, B)
}

/**
 * Parsea el contenido de texto de un archivo .cube 3D
 */
export function parseCubeLut(cubeContent: string): Lut3DTable {
  const lines = cubeContent.split(/\r?\n/);
  let title = 'Kyvora LUT';
  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const rgbValues: number[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    const keyword = parts[0].toUpperCase();

    if (keyword === 'TITLE') {
      title = line.substring(5).replace(/["']/g, '').trim();
    } else if (keyword === 'LUT_3D_SIZE') {
      size = parseInt(parts[1], 10);
    } else if (keyword === 'DOMAIN_MIN') {
      domainMin = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
    } else if (keyword === 'DOMAIN_MAX') {
      domainMax = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
    } else if (!isNaN(parseFloat(parts[0])) && parts.length >= 3) {
      rgbValues.push(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]));
    }
  }

  if (size <= 0) {
    // Si no se especificó LUT_3D_SIZE, inferir de la longitud
    const totalPoints = Math.round(rgbValues.length / 3);
    size = Math.round(Math.cbrt(totalPoints));
  }

  const expectedLength = size * size * size * 3;
  const floatData = new Float32Array(expectedLength);
  for (let i = 0; i < Math.min(expectedLength, rgbValues.length); i++) {
    floatData[i] = rgbValues[i];
  }

  return {
    title,
    size,
    domainMin,
    domainMax,
    data: floatData
  };
}

/**
 * Serializa una tabla LUT 3D a formato .cube
 */
export function serializeCubeLut(lut: Lut3DTable): string {
  let out = `# Created by Kyvora Studio v3.0\n`;
  out += `TITLE "${lut.title}"\n`;
  out += `LUT_3D_SIZE ${lut.size}\n`;
  out += `DOMAIN_MIN ${lut.domainMin[0]} ${lut.domainMin[1]} ${lut.domainMin[2]}\n`;
  out += `DOMAIN_MAX ${lut.domainMax[0]} ${lut.domainMax[1]} ${lut.domainMax[2]}\n\n`;

  const total = lut.size * lut.size * lut.size;
  for (let i = 0; i < total; i++) {
    const idx = i * 3;
    const r = lut.data[idx].toFixed(6);
    const g = lut.data[idx + 1].toFixed(6);
    const b = lut.data[idx + 2].toFixed(6);
    out += `${r} ${g} ${b}\n`;
  }

  return out;
}

/**
 * Realiza muestreo con interpolación trilineal sobre la LUT 3D
 * r, g, b deben estar normalizados entre 0 y 1
 */
export function sampleLut3D(
  lut: Lut3DTable, 
  r: number, 
  g: number, 
  b: number, 
  strength: number = 1.0
): [number, number, number] {
  const s = lut.size;
  if (s < 2) return [r, g, b];

  // Coordenadas normalizadas escaladas al rango de cuadrícula [0, s-1]
  const clampR = Math.max(0, Math.min(1, r)) * (s - 1);
  const clampG = Math.max(0, Math.min(1, g)) * (s - 1);
  const clampB = Math.max(0, Math.min(1, b)) * (s - 1);

  const r0 = Math.floor(clampR);
  const r1 = Math.min(s - 1, r0 + 1);
  const g0 = Math.floor(clampG);
  const g1 = Math.min(s - 1, g0 + 1);
  const b0 = Math.floor(clampB);
  const b1 = Math.min(s - 1, b0 + 1);

  const dr = clampR - r0;
  const dg = clampG - g0;
  const db = clampB - b0;

  // En la especificación estándar .cube, los índices avanzan como:
  // index = (b * s * s + g * s + r) * 3
  const getRGB = (red: number, green: number, blue: number): [number, number, number] => {
    const idx = (blue * s * s + green * s + red) * 3;
    return [lut.data[idx], lut.data[idx + 1], lut.data[idx + 2]];
  };

  const c000 = getRGB(r0, g0, b0);
  const c100 = getRGB(r1, g0, b0);
  const c010 = getRGB(r0, g1, b0);
  const c110 = getRGB(r1, g1, b0);
  const c001 = getRGB(r0, g0, b1);
  const c101 = getRGB(r1, g0, b1);
  const c011 = getRGB(r0, g1, b1);
  const c111 = getRGB(r1, g1, b1);

  // Interpolación trilineal
  const outRGB: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const c00 = c000[i] * (1 - dr) + c100[i] * dr;
    const c10 = c010[i] * (1 - dr) + c110[i] * dr;
    const c01 = c001[i] * (1 - dr) + c101[i] * dr;
    const c11 = c011[i] * (1 - dr) + c111[i] * dr;

    const c0 = c00 * (1 - dg) + c10 * dg;
    const c1 = c01 * (1 - dg) + c11 * dg;

    const res = c0 * (1 - db) + c1 * db;
    const orig = i === 0 ? r : i === 1 ? g : b;
    outRGB[i] = orig * (1 - strength) + res * strength;
  }

  return [outRGB[0], outRGB[1], outRGB[2]];
}

export const BUILTIN_LUT_NAMES = [
  'teal_orange',
  'film_noir',
  'warm_sunset',
  'bleach_bypass',
  'cyberpunk',
  'vintage_70s'
] as const;

export type BuiltinLutName = typeof BUILTIN_LUT_NAMES[number];

/**
 * Biblioteca integrada de LUTs 3D cinematográficas (resolución 17x17x17 para velocidad y fidelidad)
 */
export function generateBuiltinLut(presetName: string): Lut3DTable {
  const size = 17;
  const data = new Float32Array(size * size * size * 3);

  for (let bIdx = 0; bIdx < size; bIdx++) {
    const b = bIdx / (size - 1);
    for (let gIdx = 0; gIdx < size; gIdx++) {
      const g = gIdx / (size - 1);
      for (let rIdx = 0; rIdx < size; rIdx++) {
        const r = rIdx / (size - 1);
        const idx = (bIdx * size * size + gIdx * size + rIdx) * 3;

        let outR = r;
        let outG = g;
        let outB = b;

        switch (presetName.toLowerCase()) {
          case 'teal_orange':
          case 'teal and orange':
            // Sombras hacia cian/teal, luces hacia naranja cálido
            outR = r > 0.5 ? Math.min(1, r * 1.25) : Math.max(0, r * 0.85);
            outG = g > 0.5 ? Math.min(1, g * 1.05) : Math.max(0, g * 0.95 + 0.04);
            outB = b < 0.5 ? Math.min(1, b * 1.35 + 0.08) : Math.max(0, b * 0.75);
            break;

          case 'film_noir':
          case 'noir':
            // Alto contraste blanco y negro con ligera tonalidad fría
            const lumNoir = 0.299 * r + 0.587 * g + 0.114 * b;
            const highContrast = Math.pow(lumNoir, 1.3);
            outR = highContrast * 0.96;
            outG = highContrast * 0.98;
            outB = highContrast * 1.04;
            break;

          case 'warm_sunset':
          case 'golden_hour':
            // Tonos dorados, realce de rojos y amarillos, sombras ámbar
            outR = Math.min(1, r * 1.18 + 0.03);
            outG = Math.min(1, g * 1.04);
            outB = Math.max(0, b * 0.82);
            break;

          case 'bleach_bypass':
            // Desaturación parcial con alto contraste y retención de plata
            const lumBleach = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            const sCurve = (x: number) => (x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x));
            outR = (r * 0.4 + lumBleach * 0.6) * 0.5 + sCurve(r) * 0.5;
            outG = (g * 0.4 + lumBleach * 0.6) * 0.5 + sCurve(g) * 0.5;
            outB = (b * 0.4 + lumBleach * 0.6) * 0.5 + sCurve(b) * 0.5;
            break;

          case 'cyberpunk':
            // Neón magenta / cian
            outR = Math.min(1, r * 1.35 + (b > 0.4 ? 0.1 : 0));
            outG = Math.max(0, g * 0.8);
            outB = Math.min(1, b * 1.45 + (r < 0.4 ? 0.15 : 0));
            break;

          case 'vintage_70s':
            // Sombras levantadas verdes/azules, calidez en medios, amarillos descoloridos
            outR = Math.min(1, r * 1.05 + 0.04);
            outG = Math.min(1, g * 0.98 + 0.02);
            outB = Math.min(1, Math.max(0.08, b * 0.85));
            break;

          default:
            // Identidad neutra
            outR = r;
            outG = g;
            outB = b;
        }

        data[idx] = Math.max(0, Math.min(1, outR));
        data[idx + 1] = Math.max(0, Math.min(1, outG));
        data[idx + 2] = Math.max(0, Math.min(1, outB));
      }
    }
  }

  return {
    title: presetName,
    size,
    domainMin: [0, 0, 0],
    domainMax: [1, 1, 1],
    data
  };
}
