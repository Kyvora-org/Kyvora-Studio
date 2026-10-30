import { describe, it, expect } from 'vitest';
import {
  CubicBezier,
  createBezierFromPreset,
  interpolatePropertyAtTimeV3,
  TimelineClip,
  Keyframe
} from '../src/index';

describe('KYVORA STUDIO v3.0 - Motion Graphics & Bézier Easing Engine', () => {
  describe('Cubic Bézier Solver', () => {
    it('resuelve t en curvas lineales y cuadráticas con alta precisión', () => {
      const linear = new CubicBezier(0, 0, 1, 1);
      expect(linear.solve(0.0)).toBeCloseTo(0.0, 4);
      expect(linear.solve(0.5)).toBeCloseTo(0.5, 4);
      expect(linear.solve(1.0)).toBeCloseTo(1.0, 4);

      const easeInOut = new CubicBezier(0.42, 0, 0.58, 1);
      expect(easeInOut.solve(0.0)).toBeCloseTo(0.0, 4);
      expect(easeInOut.solve(0.5)).toBeCloseTo(0.5, 4);
      expect(easeInOut.solve(1.0)).toBeCloseTo(1.0, 4);
    });

    it('evalúa presets industriales (easeIn, easeOut, backOut)', () => {
      const easeIn = createBezierFromPreset('easeIn');
      // En t=0.5, easeIn debe estar retrasado respecto a linear (< 0.5)
      expect(easeIn.solve(0.5)).toBeLessThan(0.45);

      const easeOut = createBezierFromPreset('easeOut');
      // En t=0.5, easeOut debe estar adelantado respecto a linear (> 0.5)
      expect(easeOut.solve(0.5)).toBeGreaterThan(0.55);

      const backOut = createBezierFromPreset('backOut');
      // backOut genera un rebote/overshoot temporal (> 1.0) antes de estabilizarse
      expect(backOut.solve(0.85)).toBeGreaterThan(1.0);
    });
  });

  describe('Interpolación de Keyframes v3 con Curvas Bézier', () => {
    it('interpola posiciones animadas usando keyframes con easing easeInOut y hold', () => {
      const keyframes: Keyframe[] = [
        {
          id: 'kf1',
          property: 'positionX',
          timeSeconds: 0,
          value: 0,
          interpolation: 'easeInOut'
        },
        {
          id: 'kf2',
          property: 'positionX',
          timeSeconds: 2.0,
          value: 100,
          interpolation: 'easeInOut'
        }
      ];

      const clip: TimelineClip = {
        id: 'clip-anim',
        assetId: 'asset-1',
        trackId: 'track-1',
        name: 'Animated Clip',
        startInTimelineSeconds: 0,
        durationSeconds: 4.0,
        sourceStartSeconds: 0,
        effects: [],
        keyframes
      };

      // En t = 0
      expect(interpolatePropertyAtTimeV3(clip, 'positionX', 0)).toBe(0);
      // En t = 2.0
      expect(interpolatePropertyAtTimeV3(clip, 'positionX', 2.0)).toBe(100);
      // En t = 1.0 (punto medio con easeInOut) debe ser exactamente 50
      expect(interpolatePropertyAtTimeV3(clip, 'positionX', 1.0)).toBeCloseTo(50, 1);
    });
  });
});
