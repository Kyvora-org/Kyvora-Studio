import { 
  KyvoraProject, 
  TimelineTrack, 
  TimelineClip, 
  MediaAsset, 
  CURRENT_SCHEMA_VERSION 
} from '../types/project';

export { CURRENT_SCHEMA_VERSION };

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

export function validateProjectSchema(data: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      issues: [{ field: 'root', message: 'El proyecto debe ser un objeto JSON válido' }]
    };
  }

  const proj = data as Partial<KyvoraProject>;

  // ID validation
  if (!proj.id || typeof proj.id !== 'string' || proj.id.trim() === '') {
    issues.push({ field: 'id', message: 'El id del proyecto es requerido y debe ser una cadena no vacía' });
  }

  // Schema version validation
  if (!proj.schemaVersion || typeof proj.schemaVersion !== 'string') {
    issues.push({ field: 'schemaVersion', message: 'La versión del esquema es requerida' });
  }

  // Name validation
  if (typeof proj.name !== 'string' || proj.name.trim() === '') {
    issues.push({ field: 'name', message: 'El nombre del proyecto es requerido' });
  }

  // Settings validation
  if (!proj.settings || typeof proj.settings !== 'object') {
    issues.push({ field: 'settings', message: 'Los ajustes del proyecto son requeridos' });
  } else {
    if (typeof proj.settings.width !== 'number' || isNaN(proj.settings.width) || !Number.isInteger(proj.settings.width) || proj.settings.width < 64 || proj.settings.width > 7680) {
      issues.push({ field: 'settings.width', message: 'El ancho de resolución debe ser un entero entre 64 y 7680 píxeles' });
    }
    if (typeof proj.settings.height !== 'number' || isNaN(proj.settings.height) || !Number.isInteger(proj.settings.height) || proj.settings.height < 64 || proj.settings.height > 7680) {
      issues.push({ field: 'settings.height', message: 'El alto de resolución debe ser un entero entre 64 y 7680 píxeles' });
    }
    if (typeof proj.settings.frameRate !== 'number' || isNaN(proj.settings.frameRate) || proj.settings.frameRate <= 0) {
      issues.push({ field: 'settings.frameRate', message: 'La tasa de fotogramas (frameRate) debe ser un número positivo' });
    }
    if (proj.settings.previewQuality && !['performance', 'balanced', 'high'].includes(proj.settings.previewQuality)) {
      issues.push({ field: 'settings.previewQuality', message: 'La calidad de vista previa debe ser performance, balanced o high' });
    }
  }

  // Duration validation
  if (typeof proj.durationSeconds !== 'number' || isNaN(proj.durationSeconds) || proj.durationSeconds <= 0) {
    issues.push({ field: 'durationSeconds', message: 'La duración del proyecto debe ser un número positivo mayor que 0' });
  }

  // Assets validation
  if (!Array.isArray(proj.assets)) {
    issues.push({ field: 'assets', message: 'La lista de recursos multimedia debe ser un arreglo' });
  } else {
    proj.assets.forEach((asset: MediaAsset, index: number) => {
      if (!asset.id || typeof asset.id !== 'string') {
        issues.push({ field: `assets[${index}].id`, message: 'El id del recurso es obligatorio' });
      }
      if (!asset.name || typeof asset.name !== 'string') {
        issues.push({ field: `assets[${index}].name`, message: 'El nombre del recurso es obligatorio' });
      }
      if (!['video', 'audio', 'image'].includes(asset.type)) {
        issues.push({ field: `assets[${index}].type`, message: 'El tipo de recurso debe ser video, audio o image' });
      }
      if (typeof asset.durationInSeconds !== 'number' || asset.durationInSeconds < 0) {
        issues.push({ field: `assets[${index}].durationInSeconds`, message: 'La duración del recurso debe ser un número >= 0' });
      }
    });
  }

  // Tracks validation
  if (!Array.isArray(proj.tracks)) {
    issues.push({ field: 'tracks', message: 'La lista de pistas debe ser un arreglo' });
  } else {
    proj.tracks.forEach((track: TimelineTrack, trackIndex: number) => {
      if (!track.id || typeof track.id !== 'string') {
        issues.push({ field: `tracks[${trackIndex}].id`, message: 'El id de pista es obligatorio' });
      }
      if (!['video', 'audio'].includes(track.type)) {
        issues.push({ field: `tracks[${trackIndex}].type`, message: 'El tipo de pista debe ser video o audio' });
      }
      if (!Array.isArray(track.clips)) {
        issues.push({ field: `tracks[${trackIndex}].clips`, message: 'Los clips de la pista deben ser un arreglo' });
      } else {
        track.clips.forEach((clip: TimelineClip, clipIndex: number) => {
          if (!clip.id || typeof clip.id !== 'string') {
            issues.push({ field: `tracks[${trackIndex}].clips[${clipIndex}].id`, message: 'El id de clip es obligatorio' });
          }
          if (typeof clip.startInTimelineSeconds !== 'number' || clip.startInTimelineSeconds < 0) {
            issues.push({ field: `tracks[${trackIndex}].clips[${clipIndex}].startInTimelineSeconds`, message: 'El inicio del clip debe ser >= 0' });
          }
          if (typeof clip.durationSeconds !== 'number' || clip.durationSeconds <= 0) {
            issues.push({ field: `tracks[${trackIndex}].clips[${clipIndex}].durationSeconds`, message: 'La duración del clip debe ser mayor a 0' });
          }
          if (clip.effects && !Array.isArray(clip.effects)) {
            issues.push({ field: `tracks[${trackIndex}].clips[${clipIndex}].effects`, message: 'Los efectos del clip deben ser un arreglo' });
          }
        });
      }
    });
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export interface ProjectMigration {
  fromVersion: string;
  toVersion: string;
  migrate: (project: any) => any;
}

// Registry of schema migrations
export const PROJECT_MIGRATIONS: ProjectMigration[] = [
  {
    fromVersion: '0.1.0',
    toVersion: '1.0.0',
    migrate: (rawProject: any): any => {
      const updatedTracks = (rawProject.tracks || []).map((track: any) => ({
        ...track,
        clips: (track.clips || []).map((clip: any) => ({
          ...clip,
          effects: clip.effects || [],
          transform: clip.transform || {
            scaleX: 1,
            scaleY: 1,
            positionX: 0,
            positionY: 0,
            rotationDegrees: 0,
            opacity: 1.0
          },
          audio: clip.audio || {
            volume: 1.0,
            isMuted: false,
            pan: 0
          }
        }))
      }));

      return {
        ...rawProject,
        schemaVersion: '1.0.0',
        tracks: updatedTracks
      };
    }
  },
  {
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    migrate: (rawProject: any): KyvoraProject => {
      const existingSettings = rawProject.settings || {};
      return {
        ...rawProject,
        schemaVersion: '1.1.0',
        settings: {
          name: existingSettings.name || 'Standard',
          width: typeof existingSettings.width === 'number' && existingSettings.width >= 64 ? existingSettings.width : 1920,
          height: typeof existingSettings.height === 'number' && existingSettings.height >= 64 ? existingSettings.height : 1080,
          frameRate: typeof existingSettings.frameRate === 'number' && existingSettings.frameRate > 0 ? existingSettings.frameRate : 60,
          timecodeFormat: existingSettings.timecodeFormat || 'smpte',
          previewQuality: existingSettings.previewQuality || 'balanced',
          aspectRatioLocked: existingSettings.aspectRatioLocked !== undefined ? existingSettings.aspectRatioLocked : true
        }
      };
    }
  }
];

export function migrateProjectIfNeeded(raw: any): KyvoraProject {
  let current = { ...raw };
  let version = current.schemaVersion || '0.1.0';

  while (version !== CURRENT_SCHEMA_VERSION) {
    const migration = PROJECT_MIGRATIONS.find(m => m.fromVersion === version);
    if (!migration) {
      break; // No further migration found, return as is to let validation handle errors
    }
    current = migration.migrate(current);
    version = current.schemaVersion;
  }

  return current as KyvoraProject;
}

export function serializeProject(project: KyvoraProject): string {
  const validation = validateProjectSchema(project);
  if (!validation.isValid) {
    throw new Error(`Error al serializar proyecto inválido: ${validation.issues.map(i => `${i.field}: ${i.message}`).join(', ')}`);
  }
  return JSON.stringify(project, null, 2);
}

export function deserializeProject(jsonString: string): KyvoraProject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new Error(`JSON no válido: ${(err as Error).message}`, { cause: err });
  }

  // Run migration pipeline if project comes from older schema versions
  const migrated = migrateProjectIfNeeded(parsed);

  const validation = validateProjectSchema(migrated);
  if (!validation.isValid) {
    throw new Error(`Esquema de proyecto no válido: ${validation.issues.map(i => `${i.field}: ${i.message}`).join(', ')}`);
  }

  return migrated;
}

export function createNewProject(params?: {
  name?: string;
  width?: number;
  height?: number;
  frameRate?: number;
  previewQuality?: import('../types/project').PreviewQuality;
  aspectRatioLocked?: boolean;
}): KyvoraProject {
  const now = new Date().toISOString();
  return {
    id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: params?.name || 'Proyecto Sin Título - Kyvora Studio',
    settings: {
      name: 'Custom',
      width: params?.width || 1920,
      height: params?.height || 1080,
      frameRate: params?.frameRate || 60,
      timecodeFormat: 'smpte',
      previewQuality: params?.previewQuality || 'balanced',
      aspectRatioLocked: params?.aspectRatioLocked ?? true
    },
    assets: [],
    tracks: [
      {
        id: `track_video_1`,
        name: 'Video 1',
        type: 'video',
        order: 0,
        isMuted: false,
        isLocked: false,
        clips: []
      },
      {
        id: `track_audio_1`,
        name: 'Audio 1',
        type: 'audio',
        order: 1,
        isMuted: false,
        isLocked: false,
        clips: []
      }
    ],
    durationSeconds: 120,
    createdAt: now,
    updatedAt: now
  };
}
