import { describe, it, expect } from 'vitest';
import { 
  createNewProject, 
  validateProjectSchema, 
  deserializeProject, 
  CURRENT_SCHEMA_VERSION 
} from '../src/model/schema';
import { 
  validateResolution, 
  timeToFrame, 
  frameToTime, 
  snapTimeToFrame,
  SUPPORTED_FRAME_RATES
} from '../src/utils/timecode';
import { 
  immutableUpdateProjectSettings 
} from '../src/model/operations';
import { 
  createXtpArchive, 
  extractXtpArchive 
} from '../src/xtp/xtpArchive';

describe('Kyvora Studio — Ajustes de Proyecto y Motor Multimedia', () => {
  it('1. Configura proyecto por defecto a 1920x1080, 60 FPS, balanced y aspecto bloqueado', () => {
    const project = createNewProject();
    expect(project.settings.width).toBe(1920);
    expect(project.settings.height).toBe(1080);
    expect(project.settings.frameRate).toBe(60);
    expect(project.settings.previewQuality).toBe('balanced');
    expect(project.settings.aspectRatioLocked).toBe(true);
    expect(project.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);

    const validation = validateProjectSchema(project);
    expect(validation.isValid).toBe(true);
  });

  it('2. Valida dimensiones de resolución personalizadas y paridad para códec', () => {
    // Casos válidos
    expect(validateResolution(1280, 720).isValid).toBe(true);
    expect(validateResolution(1920, 1080).isValid).toBe(true);
    expect(validateResolution(2560, 1440).isValid).toBe(true);
    expect(validateResolution(3840, 2160).isValid).toBe(true);
    expect(validateResolution(64, 64).isValid).toBe(true);
    expect(validateResolution(7680, 4320).isValid).toBe(true);

    // Rechazo de NaN, fuera de rango o impares para H.264
    expect(validateResolution(NaN, 1080).isValid).toBe(false);
    expect(validateResolution(1920, NaN).isValid).toBe(false);
    expect(validateResolution(32, 1080).isValid).toBe(false); // < 64
    expect(validateResolution(8000, 4320).isValid).toBe(false); // > 7680
    expect(validateResolution(1921, 1080, true).isValid).toBe(false); // Impar
    expect(validateResolution(1920, 1081, true).isValid).toBe(false); // Impar
  });

  it('3. Convierte tiempos y fotogramas con alta precisión evitando derivas', () => {
    const fps = 60;
    // Segundo 1.5 a 60fps = fotograma 90
    expect(timeToFrame(1.5, fps)).toBe(90);
    expect(frameToTime(90, fps)).toBe(1.5);
    expect(snapTimeToFrame(1.503, fps)).toBeCloseTo(1.5, 2);

    // A 24 FPS
    expect(timeToFrame(1.0, 24)).toBe(24);
    expect(timeToFrame(0.5, 24)).toBe(12);

    // Frame rates soportados
    expect(SUPPORTED_FRAME_RATES).toEqual([24, 25, 30, 50, 60]);
  });

  it('4. immutableUpdateProjectSettings actualiza resolución, FPS y calidad sin alterar archivos originales', () => {
    const project = createNewProject({ name: 'Test Settings' });
    project.assets.push({
      id: 'asset_1',
      name: 'camara_original.mp4',
      type: 'video',
      durationInSeconds: 30,
      filePath: 'C:/Videos/camara_original.mp4',
      createdAt: new Date().toISOString()
    });

    const updated = immutableUpdateProjectSettings(project, {
      width: 2560,
      height: 1440,
      frameRate: 50,
      previewQuality: 'performance',
      aspectRatioLocked: false
    });

    // Ajustes aplicados
    expect(updated.settings.width).toBe(2560);
    expect(updated.settings.height).toBe(1440);
    expect(updated.settings.frameRate).toBe(50);
    expect(updated.settings.previewQuality).toBe('performance');
    expect(updated.settings.aspectRatioLocked).toBe(false);

    // Archivo original intacto
    expect(updated.assets.length).toBe(1);
    expect(updated.assets[0].filePath).toBe('C:/Videos/camara_original.mp4');
    expect(updated.assets[0].id).toBe('asset_1');
  });

  it('5. Persiste y restaura configuraciones en formato de paquete XTP', async () => {
    const originalProject = createNewProject({ name: 'Proyecto Persistencia XTP' });
    const configuredProject = immutableUpdateProjectSettings(originalProject, {
      width: 3840,
      height: 2160,
      frameRate: 25,
      previewQuality: 'high',
      aspectRatioLocked: true
    });

    const xtpArchive = await createXtpArchive(configuredProject);
    const extraction = await extractXtpArchive(xtpArchive);

    expect(extraction.project.name).toBe('Proyecto Persistencia XTP');
    expect(extraction.project.settings.width).toBe(3840);
    expect(extraction.project.settings.height).toBe(2160);
    expect(extraction.project.settings.frameRate).toBe(25);
    expect(extraction.project.settings.previewQuality).toBe('high');
    expect(extraction.project.settings.aspectRatioLocked).toBe(true);
    expect(extraction.project.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('6. Migra proyectos de versión 1.0.0 a 1.1.0 incorporando valores por defecto seguros', () => {
    const legacyProjectV1: any = {
      id: 'proj_legacy_1',
      schemaVersion: '1.0.0',
      name: 'Proyecto Antiguo',
      durationSeconds: 60,
      settings: {
        name: 'Standard',
        width: 1920,
        height: 1080,
        frameRate: 30,
        timecodeFormat: 'smpte'
      },
      assets: [],
      tracks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const json = JSON.stringify(legacyProjectV1);
    const loaded = deserializeProject(json);

    expect(loaded.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(loaded.settings.previewQuality).toBe('balanced');
    expect(loaded.settings.aspectRatioLocked).toBe(true);
    expect(loaded.settings.frameRate).toBe(30);
    expect(loaded.settings.width).toBe(1920);
    expect(loaded.settings.height).toBe(1080);
  });
});
