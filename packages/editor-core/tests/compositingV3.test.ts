import { describe, it, expect } from 'vitest';
import {
  evaluateMaskAtPoint,
  isPointInPolygon,
  getCanvasCompositeOperation,
  getFfmpegBlendMode,
  processChromaPixel,
  formatFfmpegChromaKeyFilter,
  ClipMask,
  ChromaKeyProperties
} from '../src/index';

describe('KYVORA STUDIO v3.0 - Compositing, Masks & Chroma Key Suite', () => {
  describe('Motor de Máscaras Vectoriales (Rectángulo, Elipse, Polígono)', () => {
    it('evalúa pertenencia y pluma (feather) en máscara rectangular', () => {
      const rectMask: ClipMask = {
        id: 'mask-rect-1',
        name: 'Rect Mask',
        type: 'rectangle',
        isEnabled: true,
        points: [],
        centerX: 50,
        centerY: 50,
        width: 40,
        height: 40,
        rotationDegrees: 0,
        feather: 5,
        isInverted: false,
        opacity: 1.0
      };

      // Centro exacto (50, 50) debe tener opacidad 1.0
      const centerAlpha = evaluateMaskAtPoint(rectMask, 50, 50);
      expect(centerAlpha).toBe(1.0);

      // Fuera del rectángulo (10, 10) debe ser 0.0
      const outsideAlpha = evaluateMaskAtPoint(rectMask, 10, 10);
      expect(outsideAlpha).toBe(0.0);

      // Si se invierte la máscara, el exterior pasa a 1.0 y el interior a 0.0
      const invertedMask = { ...rectMask, isInverted: true };
      expect(evaluateMaskAtPoint(invertedMask, 50, 50)).toBe(0.0);
      expect(evaluateMaskAtPoint(invertedMask, 10, 10)).toBe(1.0);
    });

    it('evalúa algoritmo Ray-Casting en polígonos arbitrarios complejos', () => {
      // Triángulo: (20,20), (80,20), (50,80)
      const triangle = [
        { x: 20, y: 20 },
        { x: 80, y: 20 },
        { x: 50, y: 80 }
      ];

      expect(isPointInPolygon(50, 30, triangle)).toBe(true);  // Dentro
      expect(isPointInPolygon(10, 10, triangle)).toBe(false); // Fuera
      expect(isPointInPolygon(50, 90, triangle)).toBe(false); // Fuera
    });
  });

  describe('Chroma Key y Supresión de Reflejo (Spill Suppression)', () => {
    it('detecta fondo verde exacto y genera transparencia total con despill', () => {
      const chromaProps: ChromaKeyProperties = {
        isEnabled: true,
        keyColorHex: '#00FF00',
        similarity: 0.3,
        smoothness: 0.1,
        spillSuppression: 0.8
      };

      // Píxel verde puro (0, 255, 0)
      const [, , , alphaGreen] = processChromaPixel(0, 255, 0, chromaProps);
      expect(alphaGreen).toBe(0); // Transparente

      // Píxel rojo puro (255, 0, 0) debe permanecer 100% opaco
      const [rRed, , , alphaRed] = processChromaPixel(255, 0, 0, chromaProps);
      expect(alphaRed).toBe(1.0);
      expect(rRed).toBe(255);

      // Píxel con derrame verde en bordes (120, 200, 100)
      const [, gSpill, , ] = processChromaPixel(120, 200, 100, chromaProps);
      // El canal verde debe ser atenuado por spillSuppression
      expect(gSpill).toBeLessThan(200);
    });

    it('genera filtro FFmpeg nativo chromakey y despill', () => {
      const chromaProps: ChromaKeyProperties = {
        isEnabled: true,
        keyColorHex: '#00FF00',
        similarity: 0.35,
        smoothness: 0.15,
        spillSuppression: 0.7
      };

      const filter = formatFfmpegChromaKeyFilter(chromaProps);
      expect(filter).toContain('chromakey=color=0x00FF00');
      expect(filter).toContain('similarity=0.35');
      expect(filter).toContain('despill=type=green');
    });
  });

  describe('Modos de Fusión (Blend Modes)', () => {
    it('asigna modos de fusión estándar a canvas y a FFmpeg', () => {
      expect(getCanvasCompositeOperation('multiply')).toBe('multiply');
      expect(getCanvasCompositeOperation('screen')).toBe('screen');
      expect(getCanvasCompositeOperation('overlay')).toBe('overlay');

      expect(getFfmpegBlendMode('multiply')).toBe('multiply');
      expect(getFfmpegBlendMode('screen')).toBe('screen');
      expect(getFfmpegBlendMode('normal')).toBe('normal');
    });
  });
});
