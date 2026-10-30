import { ColorCurves, CurvePoint } from '../types/project';

/**
 * Motor de Curvas RGB y Curvas de Luminancia (Spline Monotónica de Hermite)
 * Evita oscilaciones indebidas y asegura mapeos suaves entre 0 y 1.
 */

export class MonotoneCubicSpline {
  private xs: number[];
  private ys: number[];
  private ms: number[];

  constructor(points: CurvePoint[]) {
    // Ordenar por x ascendente y desduplicar
    const sorted = [...points].sort((a, b) => a.x - b.x);
    const filtered: CurvePoint[] = [];
    for (const p of sorted) {
      if (filtered.length === 0 || Math.abs(filtered[filtered.length - 1].x - p.x) > 0.0001) {
        filtered.push({
          x: Math.max(0, Math.min(1, p.x)),
          y: Math.max(0, Math.min(1, p.y))
        });
      }
    }

    if (filtered.length === 0) {
      filtered.push({ x: 0, y: 0 }, { x: 1, y: 1 });
    } else if (filtered.length === 1) {
      filtered.push({ x: filtered[0].x === 1 ? 0 : 1, y: filtered[0].y === 1 ? 0 : 1 });
      filtered.sort((a, b) => a.x - b.x);
    }

    // Asegurar anclajes en 0 y 1 si no existen
    if (filtered[0].x > 0) {
      filtered.unshift({ x: 0, y: filtered[0].y });
    }
    if (filtered[filtered.length - 1].x < 1) {
      filtered.push({ x: 1, y: filtered[filtered.length - 1].y });
    }

    const n = filtered.length;
    this.xs = filtered.map(p => p.x);
    this.ys = filtered.map(p => p.y);

    // Calcular diferencias y pendientes
    const dxs: number[] = [];
    const dys: number[] = [];
    const slopes: number[] = [];

    for (let i = 0; i < n - 1; i++) {
      const dx = this.xs[i + 1] - this.xs[i];
      const dy = this.ys[i + 1] - this.ys[i];
      dxs.push(dx);
      dys.push(dy);
      slopes.push(dx === 0 ? 0 : dy / dx);
    }

    // Inicializar tangentes medias
    this.ms = [slopes[0]];
    for (let i = 0; i < n - 2; i++) {
      const m = (slopes[i] + slopes[i + 1]) / 2;
      this.ms.push(m);
    }
    this.ms.push(slopes[slopes.length - 1]);

    // Ajuste de Fritsch-Carlson para garantizar monotonicidad
    for (let i = 0; i < n - 1; i++) {
      if (slopes[i] === 0) {
        this.ms[i] = 0;
        this.ms[i + 1] = 0;
      } else {
        const alpha = this.ms[i] / slopes[i];
        const beta = this.ms[i + 1] / slopes[i];
        const dist = alpha * alpha + beta * beta;
        if (dist > 9) {
          const tau = 3 / Math.sqrt(dist);
          this.ms[i] = tau * alpha * slopes[i];
          this.ms[i + 1] = tau * beta * slopes[i];
        }
      }
    }
  }

  public evaluate(x: number): number {
    const clampedX = Math.max(0, Math.min(1, x));
    let i = this.xs.length - 2;
    for (let k = 0; k < this.xs.length - 1; k++) {
      if (clampedX < this.xs[k + 1]) {
        i = k;
        break;
      }
    }

    const h = this.xs[i + 1] - this.xs[i];
    if (h === 0) return this.ys[i];
    const t = (clampedX - this.xs[i]) / h;

    const t2 = t * t;
    const t3 = t2 * t;

    // Polinomios base de Hermite
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    const val = h00 * this.ys[i] + h10 * h * this.ms[i] + h01 * this.ys[i + 1] + h11 * h * this.ms[i + 1];
    return Math.max(0, Math.min(1, val));
  }
}

/**
 * Genera tabla de consulta (LUT 1D) de 256 valores para un canal de curva
 */
export function buildCurveLookupTable(points: CurvePoint[]): Float32Array {
  const lut = new Float32Array(256);
  if (!points || points.length === 0) {
    for (let i = 0; i < 256; i++) lut[i] = i / 255;
    return lut;
  }

  const spline = new MonotoneCubicSpline(points);
  for (let i = 0; i < 256; i++) {
    lut[i] = spline.evaluate(i / 255);
  }
  return lut;
}

/**
 * Traduce un conjunto de curvas ColorCurves a la sintaxis del filtro 'curves' de FFmpeg
 */
export function formatFfmpegCurvesFilter(curves: ColorCurves): string | null {
  const formatPoints = (pts?: CurvePoint[]) => {
    if (!pts || pts.length === 0) return null;
    return pts
      .map(p => `${p.x.toFixed(3)}/${p.y.toFixed(3)}`)
      .join(' ');
  };

  const masterStr = formatPoints(curves.master);
  const redStr = formatPoints(curves.red);
  const greenStr = formatPoints(curves.green);
  const blueStr = formatPoints(curves.blue);

  const parts: string[] = [];
  if (masterStr && masterStr !== '0.000/0.000 1.000/1.000') parts.push(`m='${masterStr}'`);
  if (redStr && redStr !== '0.000/0.000 1.000/1.000') parts.push(`r='${redStr}'`);
  if (greenStr && greenStr !== '0.000/0.000 1.000/1.000') parts.push(`g='${greenStr}'`);
  if (blueStr && blueStr !== '0.000/0.000 1.000/1.000') parts.push(`b='${blueStr}'`);

  if (parts.length === 0) return null;
  return `curves=${parts.join(':')}`;
}

/**
 * Aplica una transformación de curvas RGB y Master a un píxel normalizado
 */
export function applyCurvesToRgb(
  curves: ColorCurves,
  r: number,
  g: number,
  b: number
): [number, number, number] {
  const mSpline = curves.master && curves.master.length > 0 ? new MonotoneCubicSpline(curves.master) : null;
  const rSpline = curves.red && curves.red.length > 0 ? new MonotoneCubicSpline(curves.red) : null;
  const gSpline = curves.green && curves.green.length > 0 ? new MonotoneCubicSpline(curves.green) : null;
  const bSpline = curves.blue && curves.blue.length > 0 ? new MonotoneCubicSpline(curves.blue) : null;

  let outR = rSpline ? rSpline.evaluate(r) : r;
  let outG = gSpline ? gSpline.evaluate(g) : g;
  let outB = bSpline ? bSpline.evaluate(b) : b;

  if (mSpline) {
    outR = mSpline.evaluate(outR);
    outG = mSpline.evaluate(outG);
    outB = mSpline.evaluate(outB);
  }

  return [outR, outG, outB];
}
