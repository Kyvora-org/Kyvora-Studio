import { describe, it, expect } from 'vitest';
import {
  parseCubeLut,
  serializeCubeLut,
  sampleLut3D,
  generateBuiltinLut,
  buildCurveLookupTable,
  applyCurvesToRgb,
  formatFfmpegCurvesFilter,
  getDefaultColorWheels,
  applyColorWheelsToRgb,
  formatFfmpegColorWheelsFilter,
  computeHistogram,
  computeWaveform,
  computeVectorscope
} from '../src/index';

describe('KYVORA STUDIO v3.0 - Professional Color Grading Suite', () => {
  describe('3D LUT (.cube) Parser, Serializer & Trilinear Interpolation', () => {
    it('genera y procesa un LUT 3D sintético de Teal & Orange', () => {
      const lut = generateBuiltinLut('teal_orange');
      expect(lut.size).toBe(17);
      expect(lut.data.length).toBe(17 * 17 * 17 * 3);

      // Muestrear sombras oscuras (deben tener tinte azul/cian)
      const shadowSample = sampleLut3D(lut, 0.1, 0.1, 0.1);
      expect(shadowSample[2]).toBeGreaterThan(shadowSample[0]); // Azul > Rojo

      // Muestrear altas luces cálidas (deben tener tinte naranja/rojo)
      const highlightSample = sampleLut3D(lut, 0.8, 0.8, 0.8);
      expect(highlightSample[0]).toBeGreaterThan(highlightSample[2]); // Rojo > Azul
    });

    it('serializa a formato estándar .cube y lo parsea fielmente', () => {
      const originalLut = generateBuiltinLut('film_noir');
      const cubeString = serializeCubeLut(originalLut);

      expect(cubeString).toContain('TITLE "film_noir"');
      expect(cubeString).toContain('LUT_3D_SIZE 17');

      const parsedLut = parseCubeLut(cubeString);
      expect(parsedLut.size).toBe(17);
      expect(parsedLut.title).toBe('film_noir');
      expect(parsedLut.data.length).toBe(originalLut.data.length);

      // Comparación de muestra
      const s1 = sampleLut3D(originalLut, 0.5, 0.5, 0.5);
      const s2 = sampleLut3D(parsedLut, 0.5, 0.5, 0.5);
      expect(Math.abs(s1[0] - s2[0])).toBeLessThan(0.001);
      expect(Math.abs(s1[1] - s2[1])).toBeLessThan(0.001);
      expect(Math.abs(s1[2] - s2[2])).toBeLessThan(0.001);
    });
  });

  describe('Curvas RGB & Luma Spline Monotónica', () => {
    it('construye tablas de consulta (LUT de 256 niveles) con interpolación Fritsch-Carlson', () => {
      const curvePoints = [
        { x: 0.0, y: 0.0 },
        { x: 0.25, y: 0.15 }, // Aplastamiento suave de sombras
        { x: 0.75, y: 0.85 }, // Realce de altas luces (curva en S)
        { x: 1.0, y: 1.0 }
      ];

      const lut256 = buildCurveLookupTable(curvePoints);
      expect(lut256.length).toBe(256);
      expect(lut256[0]).toBe(0);
      expect(lut256[255]).toBe(1.0);
      // Puntos medios deben respetar la forma en S normalizada [0, 1]
      expect(lut256[64]).toBeLessThan(0.25); // 25% < input 25%
      expect(lut256[192]).toBeGreaterThan(0.75); // 75% > input 75%
    });

    it('aplica curvas por canal RGB y genera filtro FFmpeg nativo', () => {
      const curves = {
        master: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        red: [{ x: 0, y: 0 }, { x: 0.5, y: 0.7 }, { x: 1, y: 1 }],
        green: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        blue: [{ x: 0, y: 0 }, { x: 0.5, y: 0.3 }, { x: 1, y: 1 }]
      };

      const [rOut, gOut, bOut] = applyCurvesToRgb(curves, 0.5, 0.5, 0.5);
      expect(rOut).toBeGreaterThan(0.55); // Realzado
      expect(gOut).toBeCloseTo(0.5, 1);
      expect(bOut).toBeLessThan(0.45); // Atenuado

      const ffmpegFilter = formatFfmpegCurvesFilter(curves);
      expect(ffmpegFilter).toContain('curves=');
      expect(ffmpegFilter).toContain("r='0.000/0.000 0.500/0.700 1.000/1.000'");
      expect(ffmpegFilter).toContain("b='0.000/0.000 0.500/0.300 1.000/1.000'");
    });
  });

  describe('Ruedas de Color Lift / Gamma / Gain / Offset', () => {
    it('aplica gradación de sombras (Lift), medios (Gamma) y luces (Gain) independientemente', () => {
      const wheels = getDefaultColorWheels();
      // Incrementar azul en sombras (Lift) y rojo en luces (Gain)
      wheels.lift.b = 0.2;
      wheels.gain.r = 0.2;

      // Evaluar sombra (0.1)
      const shadow = applyColorWheelsToRgb(wheels, 0.1, 0.1, 0.1);
      expect(shadow[2]).toBeGreaterThan(shadow[0]); // Azul mayor en sombras

      // Evaluar luz (0.9)
      const highlight = applyColorWheelsToRgb(wheels, 0.9, 0.9, 0.9);
      expect(highlight[0]).toBeGreaterThan(highlight[2]); // Rojo mayor en luces

      const filter = formatFfmpegColorWheelsFilter(wheels);
      expect(filter).toContain('colorbalance=');
    });
  });

  describe('Video Scopes en Tiempo Real (Histograma, Waveform, Vectorscopio)', () => {
    it('calcula histograma RGB y Luma preciso de 256 niveles', () => {
      // Buffer sintético: 100 píxeles blancos (255, 255, 255, 255)
      const rgba = new Uint8ClampedArray(100 * 4);
      for (let i = 0; i < rgba.length; i += 4) {
        rgba[i] = 255;
        rgba[i + 1] = 255;
        rgba[i + 2] = 255;
        rgba[i + 3] = 255;
      }

      const histo = computeHistogram(rgba);
      expect(histo.r[255]).toBe(100);
      expect(histo.g[255]).toBe(100);
      expect(histo.b[255]).toBe(100);
      expect(histo.luma[255]).toBe(100);
      expect(histo.maxCount).toBe(100);
    });

    it('calcula mapa de densidad Waveform y Vectorscopio polar YCbCr', () => {
      const rgba = new Uint8ClampedArray(400 * 4);
      // Gradiente de 400 píxeles
      for (let i = 0; i < 400; i++) {
        const val = Math.floor((i / 400) * 255);
        rgba[i * 4] = val;
        rgba[i * 4 + 1] = val;
        rgba[i * 4 + 2] = val;
        rgba[i * 4 + 3] = 255;
      }

      const wf = computeWaveform(rgba, 20, 20, 100, 256);
      expect(wf.width).toBe(100);
      expect(wf.height).toBe(256);
      expect(wf.lumaDensity.length).toBe(100 * 256);

      const vs = computeVectorscope(rgba);
      expect(vs.densityMap.length).toBe(256 * 256);
    });
  });
});
