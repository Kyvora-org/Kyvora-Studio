import { create } from 'zustand';
import type { KyvoraProject, TimelineClip, MediaAsset, TimelineTrack, ClipEffect } from '../types/project';
import { createNewProject } from '../model/schema';
import { 
  immutableUpdateProjectName,
  immutableUpdateProjectDuration,
  immutableAddAsset,
  immutableRemoveAsset,
  immutableAddTrack,
  immutableRemoveTrack,
  immutableAddClip,
  immutableMoveClip,
  immutableRemoveClip,
  immutableSplitClip,
  immutableTrimClip,
  immutableDuplicateClip,
  immutableAddEffectToClip,
  immutableRemoveEffectFromClip,
  immutableUpdateProjectSettings,
  immutableUpdateEffectInClip,
  immutableUpdateClipTransform,
  immutableToggleTrackVisibility,
  immutableToggleTrackLock,
  immutableToggleTrackMute,
  immutableUpdateClipAudio,
  immutableUpdateClipSpeed,
  immutableAddTransitionToClip,
  immutableRemoveTransitionFromClip,
  immutableAddKeyframeToClip,
  immutableRemoveKeyframeFromClip,
  immutableUpdateTitleProperties,
  immutableSeparateAudioFromVideo,
  immutableJoinClips,
  immutableUpdateClipColorWheels,
  immutableUpdateClipColorCurves,
  immutableUpdateClipMasks,
  immutableUpdateClipChromaKey,
  immutableUpdateClipBlendMode,
  immutableUpdateClipAudioSuite
} from '../model/operations';
import type {
  ColorWheels,
  ColorCurves,
  ClipMask,
  ChromaKeyProperties,
  BlendMode,
  AudioEffectsSuite,
  Lut3DConfig
} from '../types/project';
import { HistoryManager } from '../history/historyManager';
import { IProjectStorageAdapter, WebIndexedDBStorageAdapter } from '../storage/projectStorage';
import { relinkMissingMedia, createXtpArchive, extractXtpArchive } from '../xtp/xtpArchive';

export interface EditorState {
  project: KyvoraProject;
  currentTimeSeconds: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  selectedAssetId: string | null;
  zoomLevel: number;
  canUndo: boolean;
  canRedo: boolean;
  storageAdapter: IProjectStorageAdapter;

  // Estado de persistencia y control de cambios (dirty tracking)
  isDirty: boolean;
  currentFilePath: string | null;
  markDirty: () => void;
  markClean: (path?: string) => void;

  // Acciones de reproducción y UI
  setCurrentTime: (timeInSeconds: number) => void;
  togglePlayPause: () => void;
  selectClip: (clipId: string | null) => void;
  selectAsset: (assetId: string | null) => void;
  setZoomLevel: (zoom: number) => void;
  setStorageAdapter: (adapter: IProjectStorageAdapter) => void;

  // Acciones inmutables sobre el proyecto con registro en historial
  initNewProject: (params?: { name?: string; width?: number; height?: number; frameRate?: number }) => void;
  loadProjectFromData: (project: KyvoraProject, filePath?: string) => void;
  updateProjectName: (name: string) => void;
  updateProjectDuration: (durationSeconds: number) => void;
  addAsset: (asset: MediaAsset) => void;
  removeAsset: (assetId: string) => void;
  addTrack: (track: Omit<TimelineTrack, 'id' | 'order' | 'clips'>, customId?: string) => void;
  removeTrack: (trackId: string) => void;
  addClipToTrack: (trackId: string, clip: Omit<TimelineClip, 'id' | 'trackId'>, customClipId?: string) => void;
  moveClip: (clipId: string, newTrackId: string, newStartSeconds: number) => void;
  removeClip: (clipId: string) => void;
  splitClipAtPlayhead: (clipId?: string) => void;
  trimClip: (clipId: string, edge: 'start' | 'end', newTimelinePositionSeconds: number) => void;
  duplicateClip: (clipId: string, targetTrackId?: string, targetStartSeconds?: number) => void;
  isSnappingEnabled: boolean;
  toggleSnapping: () => void;
  addEffectToClip: (clipId: string, effect: ClipEffect) => void;
  updateEffectInClip: (clipId: string, effectId: string, updatedFields: Partial<ClipEffect>) => void;
  removeEffectFromClip: (clipId: string, effectId: string) => void;
  updateClipTransform: (clipId: string, transform: Partial<import('../types/project').TransformProperties>) => void;
  updateProjectSettings: (settings: Partial<KyvoraProject['settings']>) => void;

  // Acciones avanzadas de pista y edición NLE
  toggleTrackVisibility: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;
  toggleTrackMute: (trackId: string) => void;
  updateClipAudio: (clipId: string, audio: Partial<import('../types/project').AudioProperties>) => void;
  updateClipSpeed: (clipId: string, speed: Partial<import('../types/project').SpeedProperties>) => void;
  addTransitionToClip: (clipId: string, transition: import('../types/project').ClipTransition) => void;
  removeTransitionFromClip: (clipId: string, transitionId: string) => void;
  addKeyframeToClip: (clipId: string, keyframe: import('../types/project').Keyframe) => void;
  removeKeyframeFromClip: (clipId: string, keyframeId: string) => void;
  updateTitleProperties: (clipId: string, titleProps: Partial<import('../types/project').TitleProperties>) => void;
  separateAudioFromVideo: (clipId: string) => void;
  joinClips: (firstClipId: string, secondClipId: string) => void;

  // v3.0 Professional Suite Actions
  updateClipColorWheels: (clipId: string, colorWheels: ColorWheels) => void;
  updateClipColorCurves: (clipId: string, colorCurves: ColorCurves) => void;
  updateClipLut3D: (clipId: string, lut3d: Partial<Lut3DConfig>) => void;
  updateClipMasks: (clipId: string, masks: ClipMask[]) => void;
  updateClipChromaKey: (clipId: string, chromaKey: Partial<ChromaKeyProperties>) => void;
  updateClipBlendMode: (clipId: string, blendMode: BlendMode) => void;
  updateClipAudioSuite: (clipId: string, audioSuite: Partial<AudioEffectsSuite>) => void;

  // Historial consistente (Undo / Redo)
  undo: () => void;
  redo: () => void;

  // Persistencia real delegada en adapter
  saveProject: (location?: string) => Promise<{ success: boolean; location?: string; message?: string }>;
  saveProjectAs: (location: string) => Promise<{ success: boolean; location?: string; message?: string }>;
  loadProject: (location: string) => Promise<{ success: boolean; message?: string }>;
  exportProject: () => Promise<{ success: boolean; message: string }>;

  // Métodos especializados para formato XTP
  missingMediaList: Array<{ assetId: string; assetName: string; lastKnownPath?: string; isMissing: boolean }>;
  exportXtpArchive: (options?: import('../xtp/xtpArchive').XtpPackageOptions) => Promise<Uint8Array>;
  importXtpArchive: (archiveBytes: Uint8Array, checkMediaExists?: (path: string) => Promise<boolean>, filePath?: string) => Promise<{ success: boolean; message: string }>;
  relinkMediaAsset: (assetId: string, newExternalPath: string) => void;
}

const defaultProject = createNewProject();
const history = new HistoryManager<KyvoraProject>(defaultProject, { maxDepth: 50 });
let currentStorageAdapter: IProjectStorageAdapter = new WebIndexedDBStorageAdapter();

export const useEditorStore = create<EditorState>((set, get) => ({
  project: defaultProject,
  currentTimeSeconds: 0,
  isPlaying: false,
  selectedClipId: null,
  selectedAssetId: null,
  zoomLevel: 25,
  canUndo: false,
  canRedo: false,
  storageAdapter: currentStorageAdapter,
  missingMediaList: [],
  isSnappingEnabled: true,
  isDirty: false,
  currentFilePath: null,

  markDirty: () => set({ isDirty: true }),
  markClean: (path) => set({ isDirty: false, ...(path !== undefined ? { currentFilePath: path } : {}) }),

  setCurrentTime: (time) => {
    const clamped = Math.max(0, Math.min(time, get().project.durationSeconds));
    set({ currentTimeSeconds: clamped });
  },

  togglePlayPause: () => {
    set((state) => ({ isPlaying: !state.isPlaying }));
  },

  selectClip: (clipId) => {
    set({ selectedClipId: clipId, selectedAssetId: null });
  },

  selectAsset: (assetId) => {
    set({ selectedAssetId: assetId, selectedClipId: null });
  },

  setZoomLevel: (zoom) => {
    const clamped = Math.max(5, Math.min(zoom, 200));
    set({ zoomLevel: clamped });
  },

  setStorageAdapter: (adapter) => {
    currentStorageAdapter = adapter;
    set({ storageAdapter: adapter });
  },

  initNewProject: (params) => {
    const newProj = createNewProject(params);
    history.clear(newProj);
    set({
      project: newProj,
      currentTimeSeconds: 0,
      isPlaying: false,
      selectedClipId: null,
      selectedAssetId: null,
      canUndo: false,
      canRedo: false,
      isDirty: false,
      currentFilePath: null,
      missingMediaList: []
    });
  },

  loadProjectFromData: (loadedProject, filePath) => {
    history.clear(loadedProject);
    set({
      project: loadedProject,
      currentTimeSeconds: 0,
      isPlaying: false,
      selectedClipId: null,
      selectedAssetId: null,
      canUndo: false,
      canRedo: false,
      isDirty: false,
      currentFilePath: filePath !== undefined ? filePath : get().currentFilePath,
      missingMediaList: []
    });
  },

  updateProjectName: (name) => {
    const nextProject = immutableUpdateProjectName(get().project, name);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  updateProjectDuration: (durationSeconds) => {
    const nextProject = immutableUpdateProjectDuration(get().project, durationSeconds);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  addAsset: (asset) => {
    const nextProject = immutableAddAsset(get().project, asset);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  removeAsset: (assetId) => {
    const nextProject = immutableRemoveAsset(get().project, assetId);
    history.push(nextProject);
    set({
      project: nextProject,
      selectedAssetId: get().selectedAssetId === assetId ? null : get().selectedAssetId,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  addTrack: (track, customId) => {
    const nextProject = immutableAddTrack(get().project, track, customId);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  removeTrack: (trackId) => {
    const nextProject = immutableRemoveTrack(get().project, trackId);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  addClipToTrack: (trackId, clip, customClipId) => {
    const nextProject = immutableAddClip(get().project, trackId, clip, customClipId);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  moveClip: (clipId, newTrackId, newStartSeconds) => {
    const nextProject = immutableMoveClip(get().project, clipId, newTrackId, newStartSeconds);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  removeClip: (clipId) => {
    const nextProject = immutableRemoveClip(get().project, clipId);
    history.push(nextProject);
    set({
      project: nextProject,
      selectedClipId: get().selectedClipId === clipId ? null : get().selectedClipId,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  splitClipAtPlayhead: (explicitClipId) => {
    const playheadTime = get().currentTimeSeconds;
    const targetClipId = explicitClipId || get().selectedClipId;

    if (!targetClipId) {
      // Si no hay clip explícito seleccionado, buscar clip bajo el cabezal en cualquier pista
      for (const track of get().project.tracks) {
        const found = track.clips.find(
          c => playheadTime > c.startInTimelineSeconds && playheadTime < (c.startInTimelineSeconds + c.durationSeconds)
        );
        if (found) {
          const res = immutableSplitClip(get().project, found.id, playheadTime);
          if (res.leftClipId) {
            history.push(res.project);
            set({
              project: res.project,
              selectedClipId: res.rightClipId || res.leftClipId,
              isDirty: true,
              canUndo: history.canUndo(),
              canRedo: history.canRedo()
            });
          }
          return;
        }
      }
      return;
    }

    const res = immutableSplitClip(get().project, targetClipId, playheadTime);
    if (res.leftClipId) {
      history.push(res.project);
      set({
        project: res.project,
        selectedClipId: res.rightClipId || res.leftClipId,
        isDirty: true,
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    }
  },

  trimClip: (clipId, edge, newTimelinePositionSeconds) => {
    const nextProject = immutableTrimClip(get().project, clipId, edge, newTimelinePositionSeconds);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  duplicateClip: (clipId, targetTrackId, targetStartSeconds) => {
    const res = immutableDuplicateClip(get().project, clipId, targetTrackId, targetStartSeconds);
    if (res.newClipId) {
      history.push(res.project);
      set({
        project: res.project,
        selectedClipId: res.newClipId,
        isDirty: true,
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    }
  },

  toggleSnapping: () => {
    set((state) => ({ isSnappingEnabled: !state.isSnappingEnabled }));
  },

  addEffectToClip: (clipId, effect) => {
    const nextProject = immutableAddEffectToClip(get().project, clipId, effect);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  removeEffectFromClip: (clipId, effectId) => {
    const nextProject = immutableRemoveEffectFromClip(get().project, clipId, effectId);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  updateEffectInClip: (clipId, effectId, updatedFields) => {
    const nextProject = immutableUpdateEffectInClip(get().project, clipId, effectId, updatedFields);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  updateClipTransform: (clipId, transform) => {
    const nextProject = immutableUpdateClipTransform(get().project, clipId, transform);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  updateProjectSettings: (settings) => {
    const nextProject = immutableUpdateProjectSettings(get().project, settings);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  toggleTrackVisibility: (trackId) => {
    const nextProject = immutableToggleTrackVisibility(get().project, trackId);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  toggleTrackLock: (trackId) => {
    const nextProject = immutableToggleTrackLock(get().project, trackId);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  toggleTrackMute: (trackId) => {
    const nextProject = immutableToggleTrackMute(get().project, trackId);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  updateClipAudio: (clipId, audio) => {
    const nextProject = immutableUpdateClipAudio(get().project, clipId, audio);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  updateClipSpeed: (clipId, speed) => {
    const nextProject = immutableUpdateClipSpeed(get().project, clipId, speed);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  addTransitionToClip: (clipId, transition) => {
    const nextProject = immutableAddTransitionToClip(get().project, clipId, transition);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  removeTransitionFromClip: (clipId, transitionId) => {
    const nextProject = immutableRemoveTransitionFromClip(get().project, clipId, transitionId);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  addKeyframeToClip: (clipId, keyframe) => {
    const nextProject = immutableAddKeyframeToClip(get().project, clipId, keyframe);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  removeKeyframeFromClip: (clipId, keyframeId) => {
    const nextProject = immutableRemoveKeyframeFromClip(get().project, clipId, keyframeId);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  updateTitleProperties: (clipId, titleProps) => {
    const nextProject = immutableUpdateTitleProperties(get().project, clipId, titleProps);
    history.push(nextProject);
    set({
      project: nextProject,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  separateAudioFromVideo: (clipId) => {
    const res = immutableSeparateAudioFromVideo(get().project, clipId);
    history.push(res.project);
    set({
      project: res.project,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  joinClips: (firstClipId, secondClipId) => {
    const res = immutableJoinClips(get().project, firstClipId, secondClipId);
    history.push(res.project);
    set({
      project: res.project,
      isDirty: true,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  },

  updateClipColorWheels: (clipId, colorWheels) => {
    const next = immutableUpdateClipColorWheels(get().project, clipId, colorWheels);
    history.push(next);
    set({ project: next, isDirty: true, canUndo: history.canUndo(), canRedo: history.canRedo() });
  },

  updateClipColorCurves: (clipId, colorCurves) => {
    const next = immutableUpdateClipColorCurves(get().project, clipId, colorCurves);
    history.push(next);
    set({ project: next, isDirty: true, canUndo: history.canUndo(), canRedo: history.canRedo() });
  },

  updateClipLut3D: (clipId, lut3d) => {
    const current = get().project;
    const next: KyvoraProject = {
      ...current,
      tracks: current.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c => {
          if (c.id !== clipId) return c;
          const prevLut = c.lut3d || { isEnabled: true, name: 'Custom LUT', strength: 1.0 };
          return { ...c, lut3d: { ...prevLut, ...lut3d } };
        })
      })),
      updatedAt: new Date().toISOString()
    };
    history.push(next);
    set({ project: next, isDirty: true, canUndo: history.canUndo(), canRedo: history.canRedo() });
  },

  updateClipMasks: (clipId, masks) => {
    const next = immutableUpdateClipMasks(get().project, clipId, masks);
    history.push(next);
    set({ project: next, isDirty: true, canUndo: history.canUndo(), canRedo: history.canRedo() });
  },

  updateClipChromaKey: (clipId, chromaKey) => {
    const current = get().project;
    const clip = current.tracks.flatMap(t => t.clips).find(c => c.id === clipId);
    const existing = clip?.chromaKey || {
      isEnabled: true,
      keyColorHex: '#00FF00',
      similarity: 0.3,
      smoothness: 0.1,
      spillSuppression: 0.5
    };
    const next = immutableUpdateClipChromaKey(current, clipId, { ...existing, ...chromaKey });
    history.push(next);
    set({ project: next, isDirty: true, canUndo: history.canUndo(), canRedo: history.canRedo() });
  },

  updateClipBlendMode: (clipId, blendMode) => {
    const next = immutableUpdateClipBlendMode(get().project, clipId, blendMode);
    history.push(next);
    set({ project: next, isDirty: true, canUndo: history.canUndo(), canRedo: history.canRedo() });
  },

  updateClipAudioSuite: (clipId, audioSuite) => {
    const current = get().project;
    const clip = current.tracks.flatMap(t => t.clips).find(c => c.id === clipId);
    const existing = clip?.audioSuite || {
      eqBands: [],
      compressor: { isEnabled: false, thresholdDb: -18, ratio: 3, attackMs: 15, releaseMs: 120, makeupGainDb: 2, kneeDb: 4 },
      limiter: { isEnabled: true, ceilingDb: -0.1, releaseMs: 50 },
      noiseGate: { isEnabled: false, thresholdDb: -45, reductionDb: 24 },
      reverb: { isEnabled: false, roomSize: 0.4, damping: 0.5, wetGainDb: -12, dryGainDb: 0 },
      delay: { isEnabled: false, delayTimeMs: 250, feedback: 0.35, mix: 0.25 },
      ducking: { isEnabled: false, thresholdDb: -22, duckingDb: -12, attackMs: 40, releaseMs: 350 }
    };
    const next = immutableUpdateClipAudioSuite(current, clipId, { ...existing, ...audioSuite });
    history.push(next);
    set({ project: next, isDirty: true, canUndo: history.canUndo(), canRedo: history.canRedo() });
  },

  undo: () => {
    const previous = history.undo();
    if (previous) {
      set({
        project: previous,
        isDirty: true,
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    }
  },

  redo: () => {
    const next = history.redo();
    if (next) {
      set({
        project: next,
        isDirty: true,
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    }
  },

  saveProject: async (location) => {
    const currentProj = get().project;
    const adapter = get().storageAdapter;
    const targetLocation = location || get().currentFilePath || undefined;

    const res = await adapter.saveProject(currentProj, targetLocation);
    if (!res.success) {
      return {
        success: false,
        location: res.location,
        message: res.error || 'Error al persistir el proyecto'
      };
    }

    set({
      isDirty: false,
      currentFilePath: res.location || targetLocation || get().currentFilePath
    });

    return {
      success: true,
      location: res.location,
      message: `Proyecto persistido exitosamente en ${adapter.platform} (${res.location})`
    };
  },

  saveProjectAs: async (location: string) => {
    const currentProj = get().project;
    const adapter = get().storageAdapter;

    const res = await adapter.saveProject(currentProj, location);
    if (!res.success) {
      return {
        success: false,
        location: res.location,
        message: res.error || 'Error al persistir el proyecto con Guardar Como'
      };
    }

    set({
      isDirty: false,
      currentFilePath: res.location || location
    });

    return {
      success: true,
      location: res.location || location,
      message: `Proyecto guardado exitosamente como: ${res.location || location}`
    };
  },

  loadProject: async (location) => {
    const adapter = get().storageAdapter;
    const res = await adapter.loadProject(location);
    if (!res.success || !res.project) {
      return {
        success: false,
        message: res.error || 'No se pudo cargar el proyecto solicitado'
      };
    }

    get().loadProjectFromData(res.project, location);
    return {
      success: true,
      message: `Proyecto cargado exitosamente: ${res.project.name}`
    };
  },

  exportProject: async () => {
    return {
      success: false,
      message: 'Motor de exportación no implementado (Planificado para Fase 2).'
    };
  },

  exportXtpArchive: async (options) => {
    return createXtpArchive(get().project, options);
  },

  importXtpArchive: async (archiveBytes, checkMediaExists, filePath) => {
    try {
      const extraction = await extractXtpArchive(archiveBytes, checkMediaExists);
      get().loadProjectFromData(extraction.project, filePath);
      set({ missingMediaList: extraction.missingMedia });

      const missingCount = extraction.missingMedia.filter(m => m.isMissing).length;
      if (missingCount > 0) {
        return {
          success: true,
          message: `Proyecto XTP "${extraction.project.name}" cargado con ${missingCount} recurso(s) no localizados.`
        };
      }

      return {
        success: true,
        message: `Proyecto XTP "${extraction.project.name}" importado exitosamente.`
      };
    } catch (err) {
      return {
        success: false,
        message: (err as Error).message
      };
    }
  },

  relinkMediaAsset: (assetId, newExternalPath) => {
    const updated = relinkMissingMedia(get().project, assetId, newExternalPath);
    history.push(updated);
    set((state) => ({
      project: updated,
      missingMediaList: state.missingMediaList.filter(m => m.assetId !== assetId),
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    }));
  }
}));
