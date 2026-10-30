import { Keyframe, KeyframeInterpolation, AnimatableProperty, TimelineClip } from '../types/project';

/**
 * Evaluador de Curvas Cúbicas de Bézier para Motion Graphics en Kyvora Studio v3.0
 * Resuelve x(t) mediante Newton-Raphson con fallback por bisección y evalúa y(t).
 */

export class CubicBezier {
  private x1: number;
  private y1: number;
  private x2: number;
  private y2: number;

  constructor(x1: number, y1: number, x2: number, y2: number) {
    this.x1 = Math.max(0, Math.min(1, x1));
    this.y1 = y1;
    this.x2 = Math.max(0, Math.min(1, x2));
    this.y2 = y2;
  }

  private sampleCurveX(t: number): number {
    // ((1-3*x2+3*x1)*t + (3*x2-6*x1))*t + 3*x1)*t
    const cx = 3.0 * this.x1;
    const bx = 3.0 * (this.x2 - this.x1) - cx;
    const ax = 1.0 - cx - bx;
    return ((ax * t + bx) * t + cx) * t;
  }

  private sampleCurveY(t: number): number {
    const cy = 3.0 * this.y1;
    const by = 3.0 * (this.y2 - this.y1) - cy;
    const ay = 1.0 - cy - by;
    return ((ay * t + by) * t + cy) * t;
  }

  private sampleCurveDerivativeX(t: number): number {
    const cx = 3.0 * this.x1;
    const bx = 3.0 * (this.x2 - this.x1) - cx;
    const ax = 1.0 - cx - bx;
    return (3.0 * ax * t + 2.0 * bx) * t + cx;
  }

  public solveCurveX(x: number, epsilon: number = 1e-6): number {
    let t0 = 0;
    let t1 = 1;
    let t2 = x;

    // Primero intentar hasta 8 iteraciones de Newton-Raphson
    for (let i = 0; i < 8; i++) {
      const x2 = this.sampleCurveX(t2) - x;
      if (Math.abs(x2) < epsilon) return t2;
      const d2 = this.sampleCurveDerivativeX(t2);
      if (Math.abs(d2) < 1e-6) break;
      t2 = t2 - x2 / d2;
    }

    // Fallback por Bisección
    t2 = x;
    while (t0 < t1) {
      const x2 = this.sampleCurveX(t2);
      if (Math.abs(x2 - x) < epsilon) return t2;
      if (x > x2) t0 = t2;
      else t1 = t2;
      t2 = (t1 - t0) * 0.5 + t0;
    }

    return t2;
  }

  public evaluate(x: number): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return this.sampleCurveY(this.solveCurveX(x));
  }

  public solve(x: number): number {
    return this.evaluate(x);
  }
}

// Catálogo de Curvas de Animación Estándar de la Industria
export const BEZIER_PRESETS: Record<string, [number, number, number, number]> = {
  linear: [0.0, 0.0, 1.0, 1.0],
  easeIn: [0.42, 0.0, 1.0, 1.0],
  easeOut: [0.0, 0.0, 0.58, 1.0],
  easeInOut: [0.42, 0.0, 0.58, 1.0],
  backIn: [0.36, 0.0, 0.66, -0.56],
  backOut: [0.34, 1.56, 0.64, 1.0],
  smoothBounce: [0.68, -0.55, 0.265, 1.55]
};

export function createBezierFromPreset(presetName: keyof typeof BEZIER_PRESETS | string): CubicBezier {
  const p = BEZIER_PRESETS[presetName] || BEZIER_PRESETS.linear;
  return new CubicBezier(p[0], p[1], p[2], p[3]);
}

/**
 * Evalúa el progreso interpolado entre dos keyframes
 */
export function evaluateKeyframeProgress(
  normalizedTime: number, 
  k1: Keyframe, 
  k2: Keyframe
): number {
  const interp: KeyframeInterpolation = k1.interpolation || (k1.easing as KeyframeInterpolation) || 'linear';

  if (interp === 'hold') {
    return 0.0;
  }

  if (interp === 'bezier' && k1.controlPointOut && k2.controlPointIn) {
    const bezier = new CubicBezier(
      k1.controlPointOut.x,
      k1.controlPointOut.y,
      k2.controlPointIn.x,
      k2.controlPointIn.y
    );
    return bezier.evaluate(normalizedTime);
  }

  const preset = BEZIER_PRESETS[interp] || BEZIER_PRESETS.linear;
  const bezier = new CubicBezier(preset[0], preset[1], preset[2], preset[3]);
  return bezier.evaluate(normalizedTime);
}

/**
 * Interpola cualquier propiedad animable de un clip en un instante relativo t
 */
export function interpolatePropertyAtTimeV3(
  clip: TimelineClip,
  property: AnimatableProperty,
  clipTimeSeconds: number
): number | null {
  if (!clip.keyframes || clip.keyframes.length === 0) {
    return null;
  }

  const kfs = clip.keyframes
    .filter(k => k.property === property)
    .sort((a, b) => a.timeSeconds - b.timeSeconds);

  if (kfs.length === 0) return null;
  if (kfs.length === 1) return kfs[0].value;

  if (clipTimeSeconds <= kfs[0].timeSeconds) {
    return kfs[0].value;
  }
  if (clipTimeSeconds >= kfs[kfs.length - 1].timeSeconds) {
    return kfs[kfs.length - 1].value;
  }

  for (let i = 0; i < kfs.length - 1; i++) {
    const k1 = kfs[i];
    const k2 = kfs[i + 1];

    if (clipTimeSeconds >= k1.timeSeconds && clipTimeSeconds <= k2.timeSeconds) {
      const span = k2.timeSeconds - k1.timeSeconds;
      if (span === 0) return k1.value;

      const normT = (clipTimeSeconds - k1.timeSeconds) / span;
      const progress = evaluateKeyframeProgress(normT, k1, k2);
      return k1.value + (k2.value - k1.value) * progress;
    }
  }

  return kfs[kfs.length - 1].value;
}
