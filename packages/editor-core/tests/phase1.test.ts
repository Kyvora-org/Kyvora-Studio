import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createNewProject, 
  validateProjectSchema, 
  serializeProject, 
  deserializeProject, 
  CURRENT_SCHEMA_VERSION 
} from '../src/model/schema';
import {
  immutableAddAsset,
  immutableRemoveAsset,
  immutableAddClip,
  immutableMoveClip,
  immutableAddEffectToClip,
  immutableRemoveEffectFromClip
} from '../src/model/operations';
import { HistoryManager } from '../src/history/historyManager';
import { 
  DesktopLocalFileStorageAdapter, 
  INativeFileSystemBridge
} from '../src/storage/projectStorage';

describe('Fase 1: Schema, Validación y Serialización Versionada', () => {
  it('crea un proyecto inicial válido con esquema actual 1.1.0', () => {
    const project = createNewProject({ name: 'Mi Película' });
    expect(project.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(project.name).toBe('Mi Película');
    expect(project.settings.frameRate).toBe(60);
    expect(project.settings.width).toBe(1920);
    expect(project.settings.height).toBe(1080);
    expect(project.settings.previewQuality).toBe('balanced');
    expect(project.settings.aspectRatioLocked).toBe(true);

    const validation = validateProjectSchema(project);
    expect(validation.isValid).toBe(true);
    expect(validation.issues.length).toBe(0);
  });

  it('detecta errores de validación en proyectos con datos corruptos o incompletos', () => {
    const invalidProject: any = {
      id: '',
      schemaVersion: '1.0.0',
      name: '',
      settings: { width: -100, height: 0, frameRate: 0 },
      durationSeconds: -5,
      tracks: 'not-an-array'
    };

    const validation = validateProjectSchema(invalidProject);
    expect(validation.isValid).toBe(false);
    expect(validation.issues.some(i => i.field === 'id')).toBe(true);
    expect(validation.issues.some(i => i.field === 'name')).toBe(true);
    expect(validation.issues.some(i => i.field === 'settings.width')).toBe(true);
    expect(validation.issues.some(i => i.field === 'durationSeconds')).toBe(true);
    expect(validation.issues.some(i => i.field === 'tracks')).toBe(true);
  });

  it('serializa a JSON formateado y deserializa preservando tipos y valores', () => {
    const project = createNewProject({ name: 'Proyecto Serialización' });
    const json = serializeProject(project);
    expect(typeof json).toBe('string');

    const deserialized = deserializeProject(json);
    expect(deserialized.id).toBe(project.id);
    expect(deserialized.name).toBe(project.name);
    expect(deserialized.settings.width).toBe(1920);
  });

  it('ejecuta migraciones hacia adelante desde versiones de esquema anteriores (ej: 0.1.0 -> 1.0.0)', () => {
    const legacyProject01: any = {
      id: 'legacy-proj-1',
      schemaVersion: '0.1.0',
      name: 'Legacy Project',
      settings: {
        name: 'Legacy',
        width: 1920,
        height: 1080,
        frameRate: 30,
        timecodeFormat: 'smpte'
      },
      assets: [],
      tracks: [
        {
          id: 'track-1',
          name: 'Video',
          type: 'video',
          order: 0,
          isMuted: false,
          isLocked: false,
          clips: [
            {
              id: 'clip-1',
              assetId: 'asset-1',
              trackId: 'track-1',
              name: 'Clip Sin Efectos',
              startInTimelineSeconds: 0,
              durationSeconds: 10,
              sourceStartSeconds: 0
            }
          ]
        }
      ],
      durationSeconds: 60,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const deserialized = deserializeProject(JSON.stringify(legacyProject01));
    expect(deserialized.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(deserialized.tracks[0].clips[0].effects).toEqual([]);
    expect(deserialized.tracks[0].clips[0].transform?.scaleX).toBe(1);
    expect(deserialized.tracks[0].clips[0].audio?.volume).toBe(1.0);
  });
});

describe('Fase 1: Operaciones Inmutables con Integridad Referencial', () => {
  let project = createNewProject();

  beforeEach(() => {
    project = createNewProject({ name: 'Base Test' });
  });

  it('agrega y remueve assets limpiando clips huérfanos de las pistas', () => {
    const asset = {
      id: 'asset-1',
      name: 'Entrevista.mp4',
      type: 'video' as const,
      durationInSeconds: 30,
      createdAt: new Date().toISOString()
    };

    const withAsset = immutableAddAsset(project, asset);
    expect(withAsset.assets.length).toBe(1);
    expect(project.assets.length).toBe(0); // Inmutabilidad comprobada

    // Agregar un clip referenciando a asset-1
    const trackId = withAsset.tracks[0].id;
    const withClip = immutableAddClip(withAsset, trackId, {
      assetId: 'asset-1',
      name: 'Clip Entrevista',
      startInTimelineSeconds: 5,
      durationSeconds: 15,
      sourceStartSeconds: 0,
      effects: []
    }, 'clip-1');

    expect(withClip.tracks[0].clips.length).toBe(1);

    // Al remover el asset, el clip asociado debe eliminarse
    const afterRemove = immutableRemoveAsset(withClip, 'asset-1');
    expect(afterRemove.assets.length).toBe(0);
    expect(afterRemove.tracks[0].clips.length).toBe(0);
  });

  it('soporta mover clips entre diferentes pistas y actualizar su tiempo de inicio', () => {
    const track1 = project.tracks[0].id;
    const track2 = project.tracks[1].id;

    const withClip = immutableAddClip(project, track1, {
      assetId: 'asset-x',
      name: 'Clip Movible',
      startInTimelineSeconds: 10,
      durationSeconds: 8,
      sourceStartSeconds: 0,
      effects: []
    }, 'clip-mov');

    expect(withClip.tracks[0].clips.length).toBe(1);
    expect(withClip.tracks[1].clips.length).toBe(0);

    const moved = immutableMoveClip(withClip, 'clip-mov', track2, 25.5);
    expect(moved.tracks[0].clips.length).toBe(0);
    expect(moved.tracks[1].clips.length).toBe(1);
    expect(moved.tracks[1].clips[0].id).toBe('clip-mov');
    expect(moved.tracks[1].clips[0].trackId).toBe(track2);
    expect(moved.tracks[1].clips[0].startInTimelineSeconds).toBe(25.5);
  });

  it('agrega y remueve efectos tipados en clips', () => {
    const trackId = project.tracks[0].id;
    const withClip = immutableAddClip(project, trackId, {
      assetId: 'asset-fx',
      name: 'Clip con Efectos',
      startInTimelineSeconds: 0,
      durationSeconds: 10,
      sourceStartSeconds: 0,
      effects: []
    }, 'clip-fx');

    const withEffect = immutableAddEffectToClip(withClip, 'clip-fx', {
      id: 'fx-color-1',
      type: 'colorAdjustment',
      name: 'Brillo y Contraste',
      isEnabled: true,
      brightness: 0.2,
      contrast: 1.2,
      saturation: 1.0
    });

    expect(withEffect.tracks[0].clips[0].effects.length).toBe(1);
    expect(withEffect.tracks[0].clips[0].effects[0].type).toBe('colorAdjustment');

    const withoutEffect = immutableRemoveEffectFromClip(withEffect, 'clip-fx', 'fx-color-1');
    expect(withoutEffect.tracks[0].clips[0].effects.length).toBe(0);
  });
});

describe('Fase 1: Historial Consistente (Undo / Redo) y Límites de Memoria', () => {
  it('registra cambios y retrocede/avanza consistentemente', () => {
    const history = new HistoryManager<string>('v0', { maxDepth: 5 });
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);

    history.push('v1');
    history.push('v2');
    history.push('v3');
    expect(history.getState()).toBe('v3');
    expect(history.canUndo()).toBe(true);

    expect(history.undo()).toBe('v2');
    expect(history.undo()).toBe('v1');
    expect(history.getState()).toBe('v1');
    expect(history.canRedo()).toBe(true);

    expect(history.redo()).toBe('v2');
    expect(history.getState()).toBe('v2');
  });

  it('limita el tamaño de memoria descartando los estados más antiguos cuando se excede maxDepth', () => {
    const maxDepth = 3;
    const history = new HistoryManager<number>(0, { maxDepth });

    history.push(1);
    history.push(2);
    history.push(3);
    history.push(4);
    history.push(5);

    const depth = history.getDepth();
    expect(depth.pastCount).toBe(3); // No debe sobrepasar el límite configurado

    // Retroceder hasta agotar past
    expect(history.undo()).toBe(4);
    expect(history.undo()).toBe(3);
    expect(history.undo()).toBe(2);
    expect(history.undo()).toBeNull(); // El estado 0 y 1 fueron purgados por el límite
  });
});

describe('Fase 1: Adaptadores de Almacenamiento Compartidos (Web & Desktop)', () => {
  it('DesktopLocalFileStorageAdapter reporta fallos claros si no hay bridge nativo configurado', async () => {
    const adapter = new DesktopLocalFileStorageAdapter();
    const project = createNewProject({ name: 'SinBridge' });

    const saveRes = await adapter.saveProject(project);
    expect(saveRes.success).toBe(false);
    expect(saveRes.error).toContain('Bridge');

    const loadRes = await adapter.loadProject('cualquier_ruta.kyvora');
    expect(loadRes.success).toBe(false);
    expect(loadRes.error).toContain('Bridge');
  });

  it('DesktopLocalFileStorageAdapter guarda y carga proyectos reales cuando se provee un bridge nativo', async () => {
    const virtualDisk = new Map<string, string>();
    const mockBridge: INativeFileSystemBridge = {
      writeTextFile: async (path, content) => { virtualDisk.set(path, content); },
      readTextFile: async (path) => {
        const content = virtualDisk.get(path);
        if (!content) throw new Error('Archivo no encontrado');
        return content;
      },
      exists: async (path) => virtualDisk.has(path)
    };

    const adapter = new DesktopLocalFileStorageAdapter(mockBridge);
    const originalProject = createNewProject({ name: 'Proyecto Escritorio Local' });

    const saveResult = await adapter.saveProject(originalProject, 'C:/videos/test.kyvora');
    expect(saveResult.success).toBe(true);
    expect(virtualDisk.has('C:/videos/test.kyvora')).toBe(true);

    const loadResult = await adapter.loadProject('C:/videos/test.kyvora');
    expect(loadResult.success).toBe(true);
    expect(loadResult.project?.id).toBe(originalProject.id);
    expect(loadResult.project?.name).toBe('Proyecto Escritorio Local');
  });
});
