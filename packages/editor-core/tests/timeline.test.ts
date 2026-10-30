import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createNewProject, 
  immutableAddClip, 
  immutableMoveClip, 
  immutableSplitClip, 
  immutableTrimClip, 
  immutableDuplicateClip,
  immutableRemoveClip,
  immutableToggleTrackVisibility,
  immutableToggleTrackMute,
  immutableToggleTrackLock,
  immutableToggleTrackSolo,
  findSnapTime,
  useEditorStore 
} from '../src/index';

describe('Línea de Tiempo Funcional de Kyvora Studio', () => {
  let project = createNewProject({ name: 'Timeline Tests' });

  beforeEach(() => {
    project = createNewProject({ name: 'Timeline Tests' });
    useEditorStore.getState().initNewProject({ name: 'Timeline Tests' });
  });

  describe('División de Clips (Split at Playhead)', () => {
    it('divide un clip en dos partes contiguas preservando offsets y duraciones exactas', () => {
      const track1 = project.tracks[0].id;
      const initialProject = immutableAddClip(project, track1, {
        assetId: 'asset_v1',
        name: 'Clip Largo',
        startInTimelineSeconds: 10,
        durationSeconds: 20,
        sourceStartSeconds: 5,
        effects: []
      }, 'clip_split_target');

      // Dividir en el segundo 18 (8 segundos después del inicio del clip)
      const { project: splitProject, leftClipId, rightClipId } = immutableSplitClip(
        initialProject,
        'clip_split_target',
        18
      );

      expect(leftClipId).toBe('clip_split_target');
      expect(rightClipId).toBeDefined();

      const track = splitProject.tracks[0];
      expect(track.clips.length).toBe(2);

      const left = track.clips.find(c => c.id === leftClipId)!;
      const right = track.clips.find(c => c.id === rightClipId)!;

      // El primer clip dura de 10s a 18s (duración 8s)
      expect(left.startInTimelineSeconds).toBe(10);
      expect(left.durationSeconds).toBe(8);
      expect(left.sourceStartSeconds).toBe(5);

      // El segundo clip dura de 18s a 30s (duración 12s, sourceStart 5 + 8 = 13)
      expect(right.startInTimelineSeconds).toBe(18);
      expect(right.durationSeconds).toBe(12);
      expect(right.sourceStartSeconds).toBe(13);
    });

    it('no divide si la posición solicitada está fuera de los límites del clip', () => {
      const track1 = project.tracks[0].id;
      const initialProject = immutableAddClip(project, track1, {
        assetId: 'asset_v1',
        name: 'Clip 10-20',
        startInTimelineSeconds: 10,
        durationSeconds: 10,
        sourceStartSeconds: 0,
        effects: []
      }, 'clip_bounds');

      // Corte antes del inicio (segundo 5)
      const resBefore = immutableSplitClip(initialProject, 'clip_bounds', 5);
      expect(resBefore.leftClipId).toBeUndefined();
      expect(resBefore.project.tracks[0].clips.length).toBe(1);

      // Corte después del final (segundo 25)
      const resAfter = immutableSplitClip(initialProject, 'clip_bounds', 25);
      expect(resAfter.leftClipId).toBeUndefined();
      expect(resAfter.project.tracks[0].clips.length).toBe(1);
    });
  });

  describe('Recorte de Extremos (Trim Clip)', () => {
    it('recorta el extremo inicial ajustando inicio, duración y sourceStartSeconds', () => {
      const track1 = project.tracks[0].id;
      const withClip = immutableAddClip(project, track1, {
        assetId: 'asset_v1',
        name: 'Clip Recortable',
        startInTimelineSeconds: 5,
        durationSeconds: 15,
        sourceStartSeconds: 2,
        effects: []
      }, 'clip_trim_start');

      // Recortar inicio desde 5s hasta 8s (se acorta 3s)
      const trimmed = immutableTrimClip(withClip, 'clip_trim_start', 'start', 8);
      const clip = trimmed.tracks[0].clips.find(c => c.id === 'clip_trim_start')!;

      expect(clip.startInTimelineSeconds).toBe(8);
      expect(clip.durationSeconds).toBe(12); // 15 - 3 = 12
      expect(clip.sourceStartSeconds).toBe(5); // 2 + 3 = 5
    });

    it('recorta el extremo final ajustando duración sin alterar el inicio ni sourceStart', () => {
      const track1 = project.tracks[0].id;
      const withClip = immutableAddClip(project, track1, {
        assetId: 'asset_v1',
        name: 'Clip Trim End',
        startInTimelineSeconds: 10,
        durationSeconds: 20,
        sourceStartSeconds: 0,
        effects: []
      }, 'clip_trim_end');

      // Recortar final de 30s a 22s (duración resultante 12s)
      const trimmed = immutableTrimClip(withClip, 'clip_trim_end', 'end', 22);
      const clip = trimmed.tracks[0].clips.find(c => c.id === 'clip_trim_end')!;

      expect(clip.startInTimelineSeconds).toBe(10);
      expect(clip.durationSeconds).toBe(12);
      expect(clip.sourceStartSeconds).toBe(0);
    });

    it('respeta el límite mínimo de duración para no permitir clips de duración negativa o nula', () => {
      const track1 = project.tracks[0].id;
      const withClip = immutableAddClip(project, track1, {
        assetId: 'asset_v1',
        name: 'Clip Min Limit',
        startInTimelineSeconds: 5,
        durationSeconds: 5,
        sourceStartSeconds: 0,
        effects: []
      }, 'clip_min_limit');

      // Intentar recortar el final antes del inicio (ej: segundo 2)
      const trimmed = immutableTrimClip(withClip, 'clip_min_limit', 'end', 2, 0.5);
      const clip = trimmed.tracks[0].clips.find(c => c.id === 'clip_min_limit')!;

      expect(clip.durationSeconds).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('Movimiento entre Pistas y Ajuste Magnético (Snapping)', () => {
    it('mueve un clip entre diferentes pistas y cambia su posición temporal', () => {
      const track1 = project.tracks[0].id;
      const track2 = project.tracks[1].id;

      const withClip = immutableAddClip(project, track1, {
        assetId: 'asset_v1',
        name: 'Clip Migrante',
        startInTimelineSeconds: 2,
        durationSeconds: 10,
        sourceStartSeconds: 0,
        effects: []
      }, 'clip_migrante');

      const moved = immutableMoveClip(withClip, 'clip_migrante', track2, 14.5);
      expect(moved.tracks[0].clips.length).toBe(0);
      expect(moved.tracks[1].clips.length).toBe(1);

      const target = moved.tracks[1].clips[0];
      expect(target.id).toBe('clip_migrante');
      expect(target.trackId).toBe(track2);
      expect(target.startInTimelineSeconds).toBe(14.5);
    });

    it('calcula puntos de ajuste magnético con precisión respecto a cabezal y otros clips', () => {
      const snapPoints = [0, 10.0, 25.5, 40.0];

      // Candidato 10.1s está a 0.1s de 10.0s (dentro del umbral de 0.2s)
      const snap1 = findSnapTime(10.1, snapPoints, 0.2);
      expect(snap1.isSnapped).toBe(true);
      expect(snap1.snappedTime).toBe(10.0);

      // Candidato 10.5s está a 0.5s de 10.0s (fuera del umbral)
      const snap2 = findSnapTime(10.5, snapPoints, 0.2);
      expect(snap2.isSnapped).toBe(false);
      expect(snap2.snappedTime).toBe(10.5);
    });
  });

  describe('Integración con Zustand Store y Undo/Redo', () => {
    it('ejecuta splitClipAtPlayhead a través del store y soporta deshacer y rehacer', () => {
      const store = useEditorStore.getState();
      const track1 = store.project.tracks[0].id;

      store.addClipToTrack(track1, {
        assetId: 'asset_store',
        name: 'Clip Store Split',
        startInTimelineSeconds: 0,
        durationSeconds: 20,
        sourceStartSeconds: 0,
        effects: []
      }, 'clip_store_1');

      // Posicionar cabezal en segundo 7
      store.setCurrentTime(7);
      expect(useEditorStore.getState().currentTimeSeconds).toBe(7);

      // Ejecutar división
      store.splitClipAtPlayhead('clip_store_1');
      expect(useEditorStore.getState().project.tracks[0].clips.length).toBe(2);
      expect(useEditorStore.getState().canUndo).toBe(true);

      // Deshacer división
      store.undo();
      expect(useEditorStore.getState().project.tracks[0].clips.length).toBe(1);
      expect(useEditorStore.getState().project.tracks[0].clips[0].durationSeconds).toBe(20);

      // Rehacer división
      store.redo();
      expect(useEditorStore.getState().project.tracks[0].clips.length).toBe(2);
    });

    it('duplica un clip preservando sus propiedades y registrando en el historial undo/redo', () => {
      const store = useEditorStore.getState();
      const track1 = store.project.tracks[0].id;

      store.addClipToTrack(track1, {
        assetId: 'asset_dup',
        name: 'Clip Original',
        startInTimelineSeconds: 2,
        durationSeconds: 10,
        sourceStartSeconds: 1,
        effects: []
      }, 'clip_dup_src');

      store.duplicateClip('clip_dup_src');
      const trackClips = useEditorStore.getState().project.tracks[0].clips;
      expect(trackClips.length).toBe(2);

      const dupClip = trackClips[1];
      expect(dupClip.name).toContain('(Copia)');
      expect(dupClip.startInTimelineSeconds).toBe(12); // 2 + 10 = 12
      expect(dupClip.durationSeconds).toBe(10);
      expect(dupClip.sourceStartSeconds).toBe(1);

      // Deshacer duplicación
      store.undo();
      expect(useEditorStore.getState().project.tracks[0].clips.length).toBe(1);

      // Rehacer duplicación
      store.redo();
      expect(useEditorStore.getState().project.tracks[0].clips.length).toBe(2);
    });

    it('controla el nivel de zoom y la conversión píxeles a segundos sin desfasar los clips', () => {
      const store = useEditorStore.getState();
      store.setZoomLevel(50);
      expect(useEditorStore.getState().zoomLevel).toBe(50);

      // Conversión de 100px a 50px/s => 2.0 segundos
      const timeInSec = 100 / useEditorStore.getState().zoomLevel;
      expect(timeInSec).toBe(2.0);

      store.setZoomLevel(100);
      expect(useEditorStore.getState().zoomLevel).toBe(100);
      const timeInSecZoom100 = 100 / useEditorStore.getState().zoomLevel;
      expect(timeInSecZoom100).toBe(1.0);
    });
  });

  describe('Control Funcional de Pistas: Mute, Solo, Visibilidad y Bloqueo', () => {
    it('alterna visibilidad, silencio y modo solo de pistas', () => {
      const track1 = project.tracks[0].id;

      // Visibilidad
      const hidden = immutableToggleTrackVisibility(project, track1);
      expect(hidden.tracks[0].isVisible).toBe(false);

      const shown = immutableToggleTrackVisibility(hidden, track1);
      expect(shown.tracks[0].isVisible).toBe(true);

      // Mute
      const muted = immutableToggleTrackMute(project, track1);
      expect(muted.tracks[0].isMuted).toBe(true);

      const unmuted = immutableToggleTrackMute(muted, track1);
      expect(unmuted.tracks[0].isMuted).toBe(false);

      // Solo
      const soloed = immutableToggleTrackSolo(project, track1);
      expect(soloed.tracks[0].isSolo).toBe(true);

      const unSoloed = immutableToggleTrackSolo(soloed, track1);
      expect(unSoloed.tracks[0].isSolo).toBe(false);
    });

    it('una pista bloqueada impide añadir, mover, dividir, recortar, duplicar y eliminar clips', () => {
      const track1 = project.tracks[0].id;
      // Añadir un clip inicial
      let prj = immutableAddClip(project, track1, {
        assetId: 'asset_test',
        name: 'Clip Protegido',
        startInTimelineSeconds: 5,
        durationSeconds: 10,
        sourceStartSeconds: 0,
        effects: []
      }, 'clip_locked_test');

      expect(prj.tracks[0].clips.length).toBe(1);

      // Bloquear pista
      prj = immutableToggleTrackLock(prj, track1);
      expect(prj.tracks[0].isLocked).toBe(true);

      // 1. Impedir añadir clips
      const addAttempt = immutableAddClip(prj, track1, {
        assetId: 'asset_fail',
        name: 'No Debería Entrar',
        startInTimelineSeconds: 20,
        durationSeconds: 5,
        sourceStartSeconds: 0,
        effects: []
      });
      expect(addAttempt.tracks[0].clips.length).toBe(1);

      // 2. Impedir mover clip
      const moveAttempt = immutableMoveClip(prj, 'clip_locked_test', track1, 15);
      expect(moveAttempt.tracks[0].clips[0].startInTimelineSeconds).toBe(5);

      // 3. Impedir dividir clip
      const splitAttempt = immutableSplitClip(prj, 'clip_locked_test', 8);
      expect(splitAttempt.leftClipId).toBeUndefined();
      expect(splitAttempt.project.tracks[0].clips.length).toBe(1);

      // 4. Impedir recortar clip
      const trimAttempt = immutableTrimClip(prj, 'clip_locked_test', 'start', 7);
      expect(trimAttempt.tracks[0].clips[0].startInTimelineSeconds).toBe(5);

      // 5. Impedir duplicar clip
      const dupAttempt = immutableDuplicateClip(prj, 'clip_locked_test');
      expect(dupAttempt.newClipId).toBeUndefined();
      expect(dupAttempt.project.tracks[0].clips.length).toBe(1);

      // 6. Impedir eliminar clip
      const removeAttempt = immutableRemoveClip(prj, 'clip_locked_test');
      expect(removeAttempt.tracks[0].clips.length).toBe(1);

      // Desbloquear pista y verificar que las operaciones vuelven a estar habilitadas
      prj = immutableToggleTrackLock(prj, track1);
      expect(prj.tracks[0].isLocked).toBe(false);

      const unlockedTrim = immutableTrimClip(prj, 'clip_locked_test', 'start', 7);
      expect(unlockedTrim.tracks[0].clips[0].startInTimelineSeconds).toBe(7);
    });
  });
});
