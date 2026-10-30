import { ClipMask, MaskPoint, BlendMode } from '../types/project';

/**
 * Motor de Máscaras y Composición para Kyvora Studio v3.0
 * Soporta formas rectangulares, circulares/elípticas y poligonales con feather e inversión.
 */

/**
 * Determina si un punto (x, y) en porcentaje [0, 100] está dentro de una máscara poligonal
 * Algoritmo Ray-Casting (Even-Odd rule)
 */
export function isPointInPolygon(px: number, py: number, points: MaskPoint[]): boolean {
  if (points.length < 3) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;

    const intersect = ((yi > py) !== (yj > py)) &&
      (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Calcula la distancia mínima de un punto al contorno del polígono para cálculo de feather
 */
export function distanceToPolygonEdge(px: number, py: number, points: MaskPoint[]): number {
  let minDistanceSq = Infinity;

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const p1 = points[i];
    const p2 = points[j];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;

    let t = lenSq === 0 ? 0 : ((px - p1.x) * dx + (py - p1.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = p1.x + t * dx;
    const projY = p1.y + t * dy;

    const distSq = (px - projX) * (px - projX) + (py - projY) * (py - projY);
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
    }
  }

  return Math.sqrt(minDistanceSq);
}

/**
 * Evalúa la opacidad resultante de una máscara en un punto normalizado (px, py) [0, 100]
 */
export function evaluateMaskAtPoint(mask: ClipMask, px: number, py: number): number {
  if (!mask.isEnabled) return 1.0;

  let inside = false;
  let distToEdge = 0;

  if (mask.type === 'rectangle') {
    const halfW = mask.width / 2;
    const halfH = mask.height / 2;
    const minX = mask.centerX - halfW;
    const maxX = mask.centerX + halfW;
    const minY = mask.centerY - halfH;
    const maxY = mask.centerY + halfH;

    inside = px >= minX && px <= maxX && py >= minY && py <= maxY;
    if (inside) {
      const dX = Math.min(px - minX, maxX - px);
      const dY = Math.min(py - minY, maxY - py);
      distToEdge = Math.min(dX, dY);
    } else {
      const dX = Math.max(0, minX - px, px - maxX);
      const dY = Math.max(0, minY - py, py - maxY);
      distToEdge = Math.sqrt(dX * dX + dY * dY);
    }
  } else if (mask.type === 'ellipse') {
    const radiusX = Math.max(0.1, mask.width / 2);
    const radiusY = Math.max(0.1, mask.height / 2);
    const normX = (px - mask.centerX) / radiusX;
    const normY = (py - mask.centerY) / radiusY;
    const distFromCenter = Math.sqrt(normX * normX + normY * normY);

    inside = distFromCenter <= 1.0;
    // Distancia aproximada en porcentaje al borde elíptico
    const avgRadius = (radiusX + radiusY) / 2;
    distToEdge = Math.abs(1.0 - distFromCenter) * avgRadius;
  } else if (mask.type === 'polygon') {
    inside = isPointInPolygon(px, py, mask.points);
    distToEdge = distanceToPolygonEdge(px, py, mask.points);
  }

  // Factor de desvanecimiento (feather)
  let alpha = inside ? 1.0 : 0.0;
  if (mask.feather > 0) {
    const featherPct = mask.feather / 10; // normalizado a escala de porcentaje
    if (inside) {
      if (distToEdge < featherPct) {
        alpha = 0.5 + 0.5 * (distToEdge / featherPct);
      }
    } else {
      if (distToEdge < featherPct) {
        alpha = 0.5 * (1 - distToEdge / featherPct);
      }
    }
  }

  if (mask.isInverted) {
    alpha = 1.0 - alpha;
  }

  return Math.max(0, Math.min(1, alpha * mask.opacity));
}

/**
 * Convierte un BlendMode de Kyvora al modo de fusión equivalente en FFmpeg
 */
export function getFfmpegBlendMode(mode?: BlendMode): string {
  switch (mode) {
    case 'multiply': return 'multiply';
    case 'screen': return 'screen';
    case 'overlay': return 'overlay';
    case 'darken': return 'darken';
    case 'lighten': return 'lighten';
    case 'colorDodge': return 'colordodge';
    case 'colorBurn': return 'colorburn';
    case 'hardLight': return 'hardlight';
    case 'softLight': return 'softlight';
    case 'difference': return 'difference';
    case 'exclusion': return 'exclusion';
    case 'normal':
    default:
      return 'normal';
  }
}

/**
 * Convierte un BlendMode de Kyvora al valor CSS / Canvas globalCompositeOperation
 */
export function getCanvasCompositeOperation(mode?: BlendMode): GlobalCompositeOperation {
  switch (mode) {
    case 'multiply': return 'multiply';
    case 'screen': return 'screen';
    case 'overlay': return 'overlay';
    case 'darken': return 'darken';
    case 'lighten': return 'lighten';
    case 'colorDodge': return 'color-dodge';
    case 'colorBurn': return 'color-burn';
    case 'hardLight': return 'hard-light';
    case 'softLight': return 'soft-light';
    case 'difference': return 'difference';
    case 'exclusion': return 'exclusion';
    case 'normal':
    default:
      return 'source-over';
  }
}

