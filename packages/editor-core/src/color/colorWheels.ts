import { ColorWheels } from '../types/project';

/**
 * Motor de Ruedas de Color (Lift, Gamma, Gain, Offset) para Kyvora Studio v3.0
 * Sigue la formulación estándar de corrección de color para NLEs profesionales.
 */

export function getDefaultColorWheels(): ColorWheels {
  return {
    lift: { r: 0, g: 0, b: 0, y: 0 },
    gamma: { r: 0, g: 0, b: 0, y: 0 },
    gain: { r: 0, g: 0, b: 0, y: 0 },
    offset: { r: 0, g: 0, b: 0, y: 0 }
  };
}

/**
 * Traduce las ruedas de color al filtro 'colorbalance' y 'eq' de FFmpeg
 */
export function formatFfmpegColorWheelsFilter(wheels: ColorWheels): string | null {
  const { lift, gamma, gain, offset } = wheels;

  // colorbalance en FFmpeg admite rangos entre -1.0 y 1.0 para sombras (s), medios (m) y luces (h)
  const rs = Math.max(-1, Math.min(1, lift.r)).toFixed(3);
  const gs = Math.max(-1, Math.min(1, lift.g)).toFixed(3);
  const bs = Math.max(-1, Math.min(1, lift.b)).toFixed(3);

  const rm = Math.max(-1, Math.min(1, gamma.r)).toFixed(3);
  const gm = Math.max(-1, Math.min(1, gamma.g)).toFixed(3);
  const bm = Math.max(-1, Math.min(1, gamma.b)).toFixed(3);

  const rh = Math.max(-1, Math.min(1, gain.r)).toFixed(3);
  const gh = Math.max(-1, Math.min(1, gain.g)).toFixed(3);
  const bh = Math.max(-1, Math.min(1, gain.b)).toFixed(3);

  const isColorBalanceActive = 
    Math.abs(lift.r) > 0.001 || Math.abs(lift.g) > 0.001 || Math.abs(lift.b) > 0.001 ||
    Math.abs(gamma.r) > 0.001 || Math.abs(gamma.g) > 0.001 || Math.abs(gamma.b) > 0.001 ||
    Math.abs(gain.r) > 0.001 || Math.abs(gain.g) > 0.001 || Math.abs(gain.b) > 0.001;

  const filters: string[] = [];

  if (isColorBalanceActive) {
    filters.push(`colorbalance=rs=${rs}:gs=${gs}:bs=${bs}:rm=${rm}:gm=${gm}:bm=${bm}:rh=${rh}:gh=${gh}:bh=${bh}`);
  }

  // Ajustes de Luma / Offset a través de 'eq'
  const lumaOffset = offset.y + (lift.y * 0.5) + (gain.y * 0.5);
  const gammaExp = 1.0 - (gamma.y * 0.5);
  const isEqActive = Math.abs(lumaOffset) > 0.001 || Math.abs(gammaExp - 1.0) > 0.001;

  if (isEqActive) {
    const brightness = Math.max(-1, Math.min(1, lumaOffset)).toFixed(3);
    const gammaVal = Math.max(0.1, Math.min(10, gammaExp)).toFixed(3);
    filters.push(`eq=brightness=${brightness}:gamma=${gammaVal}`);
  }

  return filters.length > 0 ? filters.join(',') : null;
}

/**
 * Aplica la transformación de Lift, Gamma, Gain y Offset a un píxel normalizado [0, 1]
 */
export function applyColorWheelsToRgb(
  wheels: ColorWheels,
  r: number,
  g: number,
  b: number
): [number, number, number] {
  const { lift, gamma, gain, offset } = wheels;

  const applyChannel = (val: number, l: number, ly: number, m: number, my: number, h: number, hy: number, off: number, offY: number) => {
    // 1. Lift (afecta principalmente sombras con decrecimiento hacia altas luces)
    const liftTerm = (l + ly) * (1 - val);

    // 2. Gain (multiplicador para altas luces)
    const gainFactor = 1 + (h + hy);
    let graded = (val + liftTerm) * gainFactor + (off + offY);

    // 3. Gamma (curva de medios tonos)
    const gammaFactor = Math.max(0.01, 1 - (m + my));
    if (graded > 0) {
      graded = Math.pow(graded, gammaFactor);
    }

    return Math.max(0, Math.min(1, graded));
  };

  const outR = applyChannel(r, lift.r, lift.y, gamma.r, gamma.y, gain.r, gain.y, offset.r, offset.y);
  const outG = applyChannel(g, lift.g, lift.y, gamma.g, gamma.y, gain.g, gain.y, offset.g, offset.y);
  const outB = applyChannel(b, lift.b, lift.y, gamma.b, gamma.y, gain.b, gain.y, offset.b, offset.y);

  return [outR, outG, outB];
}

