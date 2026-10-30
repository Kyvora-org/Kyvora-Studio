import { describe, it, expect } from 'vitest';
import {
  getDefaultAudioSuite,
  computeBiquadCoefficients,
  calculateFrequencyResponse,
  computeAudioLevels,
  formatFfmpegAudioFilters
} from '../src/index';

describe('KYVORA STUDIO v3.0 - Professional Audio Processing Suite', () => {
  describe('Parametric EQ & Biquad Synthesis', () => {
    it('calcula coeficientes biquad normalizados para peaking, lowshelf y highshelf', () => {
      const biquadPeak = computeBiquadCoefficients(48000, 'peaking', 1000, 6.0, 1.0);
      expect(biquadPeak.a0).toBe(1.0);
      expect(Number.isFinite(biquadPeak.b0)).toBe(true);
      expect(Number.isFinite(biquadPeak.b1)).toBe(true);

      const biquadLow = computeBiquadCoefficients(48000, 'lowshelf', 100, 4.0, 0.707);
      expect(biquadLow.a0).toBe(1.0);

      const biquadHigh = computeBiquadCoefficients(48000, 'highshelf', 10000, -3.0, 0.707);
      expect(biquadHigh.a0).toBe(1.0);
    });

    it('calcula curva de respuesta en frecuencia agregada en puntos clave de audio', () => {
      const suite = getDefaultAudioSuite();
      // Incrementar graves a 80 Hz en +6 dB
      suite.eqBands[0].gainDb = 6.0;

      const testFreqs = [40, 80, 500, 10000];
      const resp = calculateFrequencyResponse(suite.eqBands, testFreqs, 48000);

      expect(resp.length).toBe(4);
      // A 80 Hz la ganancia debe ser significativamente positiva (~3 dB half-gain en frecuencia de corte)
      const at80 = resp.find(r => r.frequency === 80);
      expect(at80?.gainDb).toBeGreaterThanOrEqual(2.95);

      // A 500 Hz la ganancia debe estar cerca de 0 dB
      const at500 = resp.find(r => r.frequency === 500);
      expect(Math.abs(at500?.gainDb || 0)).toBeLessThan(1.0);
    });
  });

  describe('Medición de Loudness BS.1770-4 LUFS y Pico Real', () => {
    it('mide silencio digital como -96 dBFS / -96 LUFS', () => {
      const silence = new Float32Array(48000); // 1 segundo a 48kHz
      const reading = computeAudioLevels(silence, 2);
      expect(reading.peakDb).toBe(-96);
      expect(reading.rmsDb).toBe(-96);
      expect(reading.lufsIntegrated).toBe(-96);
      expect(reading.isClipping).toBe(false);
    });

    it('mide señal senoidal normalizada de 1 kHz con K-weighting con precisión', () => {
      // Tono de prueba senoidal a 1000 Hz, amplitud 0.5 (-6 dBFS)
      const samples = new Float32Array(48000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = 0.5 * Math.sin((2 * Math.PI * 1000 * i) / 48000);
      }

      const reading = computeAudioLevels(samples, 1);
      expect(reading.peakDb).toBeCloseTo(-6.0, 1);
      expect(reading.rmsDb).toBeCloseTo(-9.0, 1);
      expect(reading.lufsIntegrated).toBeGreaterThan(-15);
      expect(reading.isClipping).toBe(false);
    });
  });

  describe('Filtros de Audio para FFmpeg', () => {
    it('genera comandos precisos para EQ, compresor, limitador y reverb', () => {
      const suite = getDefaultAudioSuite();
      suite.eqBands[0].gainDb = 3.0; // Low shelf
      suite.compressor.isEnabled = true;
      suite.limiter.isEnabled = true;
      suite.reverb.isEnabled = true;

      const filters = formatFfmpegAudioFilters(
        { volume: 0.9, gainDb: 2.0, isMuted: false, pan: 0.2 },
        suite
      );

      const filterStr = filters.join(',');
      expect(filterStr).toContain('volume=');
      expect(filterStr).toContain('pan=stereo');
      expect(filterStr).toContain('lowshelf=f=80');
      expect(filterStr).toContain('acompressor=threshold=-18dB');
      expect(filterStr).toContain('alimiter=');
      expect(filterStr).toContain('aecho=');
    });
  });
});
