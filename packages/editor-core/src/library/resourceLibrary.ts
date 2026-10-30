/**
 * KYVORA STUDIO v3.0 - Professional Resource Library
 *
 * Provides out-of-the-box professional templates, presets, and catalogs:
 * - Title and Motion Graphics templates (Lower Third, Cinematic Title, Subtitle, Cyberpunk, etc.)
 * - Professional Audio Suite presets (Podcast Vocal, Broadcast, Cinematic Trailer, Warm Acoustic)
 * - Color Grading Presets (Teal & Orange, Film Noir, Golden Hour, Cyberpunk, Bleach Bypass)
 * - Built-in 3D LUT registry
 * - User custom preset persistence manager
 */

import {
  TitleProperties,
  TitleTemplate,
  AudioEffectsSuite,
  ColorWheels,
  ColorCurves,
  Lut3DConfig
} from '../types/project.js';

export interface TitleTemplateDefinition {
  id: TitleTemplate;
  name: string;
  description: string;
  category: 'lowerThird' | 'title' | 'caption' | 'intro';
  defaultProperties: TitleProperties;
}

export interface AudioPresetDefinition {
  id: string;
  name: string;
  description: string;
  category: 'vocal' | 'music' | 'cinematic' | 'broadcast';
  suite: AudioEffectsSuite;
}

export interface ColorPresetDefinition {
  id: string;
  name: string;
  description: string;
  category: 'cinematic' | 'vintage' | 'stylized' | 'neutral';
  colorWheels: ColorWheels;
  colorCurves?: ColorCurves;
  lut?: Partial<Lut3DConfig>;
}

// 1. Built-in Title Templates
export const TITLE_TEMPLATES_CATALOG: TitleTemplateDefinition[] = [
  {
    id: 'lowerThird',
    name: 'Lower Third Pro',
    description: 'Elegante cintillo informativo inferior para entrevistas, nombres y cargos.',
    category: 'lowerThird',
    defaultProperties: {
      template: 'lowerThird',
      text: 'CARLOS ALVAREZ | DIRECTOR CREATIVO',
      fontFamily: 'Inter, sans-serif',
      fontSize: 32,
      textColor: '#FFFFFF',
      backgroundColor: 'rgba(10, 10, 15, 0.85)',
      outlineColor: '#00F0FF',
      outlineWidth: 2,
      shadowColor: 'rgba(0,0,0,0.6)',
      shadowBlur: 8,
      shadowOffsetX: 0,
      shadowOffsetY: 4,
      alignment: 'left',
      animationIn: 'slideUp',
      animationOut: 'slideDown'
    }
  },
  {
    id: 'cinematic',
    name: 'Cinematic Minimalist',
    description: 'Título cinematográfico centrado con espaciado amplio y desvanecimiento suave.',
    category: 'title',
    defaultProperties: {
      template: 'cinematic',
      text: 'KYVORA ORIGINALS',
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: 54,
      textColor: '#F5E6C8',
      shadowColor: 'rgba(0,0,0,0.8)',
      shadowBlur: 16,
      shadowOffsetX: 0,
      shadowOffsetY: 6,
      alignment: 'center',
      animationIn: 'fade',
      animationOut: 'fade'
    }
  },
  {
    id: 'boldIntro',
    name: 'Bold Impact Intro',
    description: 'Tipografía de impacto para intros de YouTube, Reels y videos promocionales.',
    category: 'intro',
    defaultProperties: {
      template: 'boldIntro',
      text: 'CREATIVIDAD SIN LÍMITES',
      fontFamily: 'Impact, Montserrat Black, sans-serif',
      fontSize: 68,
      textColor: '#FFFFFF',
      outlineColor: '#FF2A55',
      outlineWidth: 4,
      shadowColor: '#000000',
      shadowBlur: 20,
      shadowOffsetX: 4,
      shadowOffsetY: 6,
      alignment: 'center',
      animationIn: 'zoomIn',
      animationOut: 'zoomOut'
    }
  },
  {
    id: 'cyberpunk',
    name: 'Neon Cyberpunk',
    description: 'Estilo futurista con brillo de neón y efecto de glitch.',
    category: 'title',
    defaultProperties: {
      template: 'cyberpunk',
      text: 'NEO KYVORA 2099',
      fontFamily: 'Orbitron, Courier New, monospace',
      fontSize: 48,
      textColor: '#00FFCC',
      backgroundColor: 'rgba(15, 0, 30, 0.75)',
      outlineColor: '#FF0055',
      outlineWidth: 2,
      shadowColor: '#00FFCC',
      shadowBlur: 24,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      alignment: 'center',
      animationIn: 'typewriter',
      animationOut: 'fade'
    }
  },
  {
    id: 'subtitle',
    name: 'Clean Subtitles',
    description: 'Subtítulos legibles de alta visibilidad para video vertical y horizontal.',
    category: 'caption',
    defaultProperties: {
      template: 'subtitle',
      text: 'Subtítulo claro y legible con fondo semitransparente.',
      fontFamily: 'Roboto, Inter, sans-serif',
      fontSize: 36,
      textColor: '#FFFF00',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      shadowColor: 'rgba(0,0,0,0.9)',
      shadowBlur: 4,
      shadowOffsetX: 1,
      shadowOffsetY: 2,
      alignment: 'center',
      animationIn: 'fade',
      animationOut: 'none'
    }
  },
  {
    id: 'minimal',
    name: 'Modern Clean',
    description: 'Diseño minimalista para documentales, arquitectura y diseño contemporáneo.',
    category: 'title',
    defaultProperties: {
      template: 'minimal',
      text: 'Capítulo 01 — El Comienzo',
      fontFamily: 'Helvetica Neue, Arial, sans-serif',
      fontSize: 40,
      textColor: '#FFFFFF',
      shadowColor: 'rgba(0,0,0,0.4)',
      shadowBlur: 6,
      shadowOffsetX: 0,
      shadowOffsetY: 2,
      alignment: 'left',
      animationIn: 'fade',
      animationOut: 'fade'
    }
  }
];

// 2. Built-in Audio Suite Presets
export const AUDIO_PRESETS_CATALOG: AudioPresetDefinition[] = [
  {
    id: 'podcast_vocal',
    name: 'Voz Podcast Pro',
    description: 'Corte de graves retumbantes, presencia de brillo vocal, compresión suave y gate antirruido.',
    category: 'vocal',
    suite: {
      eqBands: [
        { id: 'b1', type: 'highpass', frequencyHz: 80, gainDb: 0, qFactor: 0.707, isEnabled: true },
        { id: 'b2', type: 'peaking', frequencyHz: 350, gainDb: -2.5, qFactor: 1.2, isEnabled: true },
        { id: 'b3', type: 'peaking', frequencyHz: 3200, gainDb: 3.0, qFactor: 1.0, isEnabled: true },
        { id: 'b4', type: 'peaking', frequencyHz: 6500, gainDb: 2.0, qFactor: 1.4, isEnabled: true },
        { id: 'b5', type: 'highshelf', frequencyHz: 12000, gainDb: 1.5, qFactor: 0.707, isEnabled: true }
      ],
      compressor: {
        isEnabled: true,
        thresholdDb: -20,
        ratio: 3.2,
        attackMs: 12,
        releaseMs: 100,
        makeupGainDb: 3.5,
        kneeDb: 6
      },
      limiter: {
        isEnabled: true,
        ceilingDb: -1.0,
        releaseMs: 40
      },
      noiseGate: {
        isEnabled: true,
        thresholdDb: -48,
        reductionDb: 22
      },
      reverb: {
        isEnabled: false,
        roomSize: 0.2,
        damping: 0.7,
        wetGainDb: -20,
        dryGainDb: 0
      },
      delay: {
        isEnabled: false,
        delayTimeMs: 120,
        feedback: 0.1,
        mix: 0.05
      },
      ducking: {
        isEnabled: false,
        thresholdDb: -20,
        duckingDb: -14,
        attackMs: 30,
        releaseMs: 400
      }
    }
  },
  {
    id: 'broadcast_radio',
    name: 'Radio Broadcast Máximo',
    description: 'Compresión densa, presencia vocal agresiva y control de picos estilo emisora FM.',
    category: 'broadcast',
    suite: {
      eqBands: [
        { id: 'b1', type: 'lowshelf', frequencyHz: 100, gainDb: 2.0, qFactor: 0.8, isEnabled: true },
        { id: 'b2', type: 'peaking', frequencyHz: 400, gainDb: -1.5, qFactor: 1.5, isEnabled: true },
        { id: 'b3', type: 'peaking', frequencyHz: 2500, gainDb: 3.5, qFactor: 1.1, isEnabled: true },
        { id: 'b4', type: 'peaking', frequencyHz: 5000, gainDb: 2.5, qFactor: 1.0, isEnabled: true },
        { id: 'b5', type: 'highshelf', frequencyHz: 10000, gainDb: 3.0, qFactor: 0.707, isEnabled: true }
      ],
      compressor: {
        isEnabled: true,
        thresholdDb: -24,
        ratio: 5.5,
        attackMs: 5,
        releaseMs: 70,
        makeupGainDb: 5.0,
        kneeDb: 4
      },
      limiter: {
        isEnabled: true,
        ceilingDb: -0.2,
        releaseMs: 25
      },
      noiseGate: {
        isEnabled: true,
        thresholdDb: -42,
        reductionDb: 28
      },
      reverb: {
        isEnabled: false,
        roomSize: 0.1,
        damping: 0.8,
        wetGainDb: -24,
        dryGainDb: 0
      },
      delay: {
        isEnabled: false,
        delayTimeMs: 50,
        feedback: 0.05,
        mix: 0.02
      },
      ducking: {
        isEnabled: false,
        thresholdDb: -20,
        duckingDb: -14,
        attackMs: 30,
        releaseMs: 400
      }
    }
  },
  {
    id: 'cinematic_soundtrack',
    name: 'Banda Sonora Cinemática',
    description: 'Espacio envolvente, sub-graves profundos y espacialidad de sala de cine.',
    category: 'cinematic',
    suite: {
      eqBands: [
        { id: 'b1', type: 'lowshelf', frequencyHz: 60, gainDb: 3.0, qFactor: 0.707, isEnabled: true },
        { id: 'b2', type: 'peaking', frequencyHz: 250, gainDb: -1.0, qFactor: 1.0, isEnabled: true },
        { id: 'b3', type: 'peaking', frequencyHz: 1500, gainDb: 1.0, qFactor: 0.8, isEnabled: true },
        { id: 'b4', type: 'peaking', frequencyHz: 4000, gainDb: 1.5, qFactor: 0.9, isEnabled: true },
        { id: 'b5', type: 'highshelf', frequencyHz: 14000, gainDb: 2.5, qFactor: 0.707, isEnabled: true }
      ],
      compressor: {
        isEnabled: true,
        thresholdDb: -16,
        ratio: 2.2,
        attackMs: 40,
        releaseMs: 250,
        makeupGainDb: 1.5,
        kneeDb: 8
      },
      limiter: {
        isEnabled: true,
        ceilingDb: -0.3,
        releaseMs: 60
      },
      noiseGate: {
        isEnabled: false,
        thresholdDb: -60,
        reductionDb: 10
      },
      reverb: {
        isEnabled: true,
        roomSize: 0.7,
        damping: 0.35,
        wetGainDb: -14,
        dryGainDb: 0
      },
      delay: {
        isEnabled: false,
        delayTimeMs: 320,
        feedback: 0.2,
        mix: 0.1
      },
      ducking: {
        isEnabled: false,
        thresholdDb: -20,
        duckingDb: -12,
        attackMs: 50,
        releaseMs: 500
      }
    }
  },
  {
    id: 'warm_dialogue',
    name: 'Diálogo Cálido y Natural',
    description: 'Atenuación suave sin artefactos, ideal para entrevistas íntimas y documentales.',
    category: 'vocal',
    suite: {
      eqBands: [
        { id: 'b1', type: 'lowshelf', frequencyHz: 120, gainDb: 1.5, qFactor: 0.707, isEnabled: true },
        { id: 'b2', type: 'peaking', frequencyHz: 500, gainDb: -1.0, qFactor: 1.2, isEnabled: true },
        { id: 'b3', type: 'peaking', frequencyHz: 2000, gainDb: 1.8, qFactor: 1.0, isEnabled: true },
        { id: 'b4', type: 'peaking', frequencyHz: 5000, gainDb: -1.2, qFactor: 2.0, isEnabled: true },
        { id: 'b5', type: 'highshelf', frequencyHz: 10000, gainDb: 0.5, qFactor: 0.707, isEnabled: true }
      ],
      compressor: {
        isEnabled: true,
        thresholdDb: -18,
        ratio: 2.5,
        attackMs: 25,
        releaseMs: 140,
        makeupGainDb: 2.0,
        kneeDb: 6
      },
      limiter: {
        isEnabled: true,
        ceilingDb: -0.8,
        releaseMs: 40
      },
      noiseGate: {
        isEnabled: true,
        thresholdDb: -50,
        reductionDb: 18
      },
      reverb: {
        isEnabled: false,
        roomSize: 0.15,
        damping: 0.8,
        wetGainDb: -22,
        dryGainDb: 0
      },
      delay: {
        isEnabled: false,
        delayTimeMs: 100,
        feedback: 0.1,
        mix: 0.05
      },
      ducking: {
        isEnabled: false,
        thresholdDb: -20,
        duckingDb: -12,
        attackMs: 30,
        releaseMs: 300
      }
    }
  }
];

// 3. Built-in Color Presets (Wheels + Curves + 3D LUT)
export const COLOR_PRESETS_CATALOG: ColorPresetDefinition[] = [
  {
    id: 'blockbuster_teal_orange',
    name: 'Blockbuster Teal & Orange',
    description: 'Sombras azuladas/turquesa y tonos de piel anaranjados de superproducción de Hollywood.',
    category: 'cinematic',
    colorWheels: {
      lift: { r: -0.12, g: 0.02, b: 0.18, y: -0.05 },
      gamma: { r: 0.05, g: 0.0, b: -0.05, y: 0.02 },
      gain: { r: 0.18, g: 0.06, b: -0.14, y: 0.05 },
      offset: { r: 0, g: 0, b: 0, y: 0 }
    },
    lut: {
      isEnabled: true,
      name: 'Teal & Orange',
      strength: 0.85
    }
  },
  {
    id: 'film_noir',
    name: 'Film Noir Monocromático',
    description: 'Blanco y negro dramático de alto contraste inspirado en el cine clásico.',
    category: 'stylized',
    colorWheels: {
      lift: { r: 0, g: 0, b: 0, y: -0.15 },
      gamma: { r: 0, g: 0, b: 0, y: -0.05 },
      gain: { r: 0, g: 0, b: 0, y: 0.2 },
      offset: { r: 0, g: 0, b: 0, y: 0 }
    },
    lut: {
      isEnabled: true,
      name: 'Film Noir',
      strength: 1.0
    }
  },
  {
    id: 'golden_sunset',
    name: 'Golden Hour Cálido',
    description: 'Brillo solar dorado atardecer con altas luces ámbar y sombras suaves.',
    category: 'cinematic',
    colorWheels: {
      lift: { r: 0.06, g: 0.02, b: -0.04, y: 0.02 },
      gamma: { r: 0.12, g: 0.05, b: -0.08, y: 0.04 },
      gain: { r: 0.16, g: 0.08, b: -0.12, y: 0.06 },
      offset: { r: 0.02, g: 0.01, b: 0, y: 0 }
    },
    lut: {
      isEnabled: true,
      name: 'Warm Sunset',
      strength: 0.9
    }
  },
  {
    id: 'bleach_bypass',
    name: 'Bleach Bypass Desaturado',
    description: 'Estilo cinematográfico desaturado de alto contraste y grano metálico.',
    category: 'stylized',
    colorWheels: {
      lift: { r: -0.05, g: -0.05, b: -0.05, y: -0.1 },
      gamma: { r: 0, g: 0, b: 0, y: 0.0 },
      gain: { r: 0.1, g: 0.1, b: 0.1, y: 0.15 },
      offset: { r: 0, g: 0, b: 0, y: 0 }
    },
    lut: {
      isEnabled: true,
      name: 'Bleach Bypass',
      strength: 0.9
    }
  },
  {
    id: 'cyberpunk_neon',
    name: 'Cyberpunk Neon Nights',
    description: 'Magenta futurista en altas luces y azules profundos en sombras.',
    category: 'stylized',
    colorWheels: {
      lift: { r: -0.15, g: -0.05, b: 0.25, y: -0.08 },
      gamma: { r: 0.08, g: -0.04, b: 0.1, y: 0.0 },
      gain: { r: 0.22, g: -0.08, b: 0.15, y: 0.1 },
      offset: { r: 0, g: 0, b: 0, y: 0 }
    },
    lut: {
      isEnabled: true,
      name: 'Cyberpunk',
      strength: 0.95
    }
  }
];

export interface UserPreset {
  id: string;
  name: string;
  type: 'color' | 'audio' | 'title' | 'mask';
  createdAt: string;
  payload: any;
}

/**
 * Custom Preset Manager for saving and loading user-defined templates and styles
 */
export class PresetStorageManager {
  private static STORAGE_KEY = 'kyvora_user_presets_v3';

  public static listPresets(type?: 'color' | 'audio' | 'title' | 'mask'): UserPreset[] {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return [];
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return [];
      const items: UserPreset[] = JSON.parse(raw);
      if (!Array.isArray(items)) return [];
      if (type) {
        return items.filter(i => i.type === type);
      }
      return items;
    } catch {
      return [];
    }
  }

  public static savePreset(preset: Omit<UserPreset, 'id' | 'createdAt'>): UserPreset {
    const newPreset: UserPreset = {
      ...preset,
      id: 'preset-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      createdAt: new Date().toISOString()
    };

    const existing = this.listPresets();
    const updated = [...existing.filter(p => p.name !== newPreset.name), newPreset];
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Failed to save preset to local storage:', e);
    }

    return newPreset;
  }

  public static deletePreset(id: string): void {
    const existing = this.listPresets();
    const filtered = existing.filter(p => p.id !== id);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
      }
    } catch (e) {
      console.warn('Failed to delete preset from local storage:', e);
    }
  }

  public static exportPresetsJson(): string {
    return JSON.stringify(this.listPresets(), null, 2);
  }

  public static importPresetsJson(jsonString: string): number {
    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed)) return 0;
      let count = 0;
      for (const item of parsed) {
        if (item.name && item.type && item.payload) {
          this.savePreset({
            name: item.name,
            type: item.type,
            payload: item.payload
          });
          count++;
        }
      }
      return count;
    } catch {
      return 0;
    }
  }
}
