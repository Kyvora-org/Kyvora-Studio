import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createNewProject, 
  immutableAddClip, 
  generateRenderPlan, 
  ExportSettings,
  PreviewEngine,
  WebExportAdapter 
} from '../src/index';

describe('Motor de Vista Previa y Exportación de Kyvora Studio', () => {
  let project = createNewProject({ name: 'Proyecto Render Test' });

  beforeEach(() => {
    project = createNewProject({ name: 'Proyecto Render Test' });
  });

  describe('Generador de Plan de Renderizado (RenderPlanGenerator)', () => {
    it('traduce clips, recortes de origen y transformaciones a una secuencia de filtros válida de FFmpeg', () => {
      // Registrar un asset
      project.assets.push({
        id: 'asset_cam1',
        name: 'toma_principal.mp4',
        type: 'video',
        durationInSeconds: 30,
        filePath: 'C:/Videos/toma_principal.mp4',
        createdAt: new Date().toISOString()
      });

      // Añadir clip con recorte (inicio en timeline: 5s, duración: 10s, inicio en fuente: 3s) y efecto de color
      const track1 = project.tracks[0].id;
      const projectWithClip = immutableAddClip(project, track1, {
        assetId: 'asset_cam1',
        name: 'Clip Escena 1',
        startInTimelineSeconds: 5,
        durationSeconds: 10,
        sourceStartSeconds: 3,
        effects: [
          {
            id: 'fx_color_1',
            type: 'colorAdjustment',
            name: 'Brillo y Contraste',
            isEnabled: true,
            brightness: 0.1,
            contrast: 1.2,
            saturation: 1.1
          }
        ]
      }, 'clip_render_1');

      const settings: ExportSettings = {
        resolutionPreset: '1080p',
        width: 1920,
        height: 1080,
        fps: 30,
        quality: 'high',
        videoCodec: 'h264',
        audioCodec: 'aac',
        outputPath: 'C:/Export/pelicula_final.mp4'
      };

      const plan = generateRenderPlan(projectWithClip, settings);

      expect(plan.projectId).toBe(projectWithClip.id);
      expect(plan.settings.width).toBe(1920);
      expect(plan.settings.height).toBe(1080);
      expect(plan.inputs.length).toBe(1);
      expect(plan.inputs[0].sourceFilePath).toBe('C:/Videos/toma_principal.mp4');

      // Comprobar presencia de filtros de recorte (trim), ecualizador de color (eq) y superposición (overlay)
      expect(plan.ffmpegFilterComplex).toContain('trim=start=3:end=13');
      expect(plan.ffmpegFilterComplex).toContain('eq=brightness=0.1:contrast=1.2:saturation=1.1');
      expect(plan.ffmpegFilterComplex).toContain("enable='between(t,5,15)'");

      // Comprobar argumentos de invocación de FFmpeg
      expect(plan.ffmpegArgs).toContain('-y');
      expect(plan.ffmpegArgs).toContain('libx264');
      expect(plan.ffmpegArgs).toContain('-crf');
      expect(plan.ffmpegArgs).toContain('18'); // Calidad High = CRF 18
      expect(plan.ffmpegArgs).toContain('C:/Export/pelicula_final.mp4');
    });

    it('genera filtros para 1440p, 50fps, grayscale, sepia y fundidos (fade)', () => {
      project.assets.push({
        id: 'asset_2k',
        name: 'video_2k.mp4',
        type: 'video',
        durationInSeconds: 60,
        filePath: 'C:/Videos/video_2k.mp4',
        createdAt: new Date().toISOString()
      });

      const track1 = project.tracks[0].id;
      const projectWithFx = immutableAddClip(project, track1, {
        assetId: 'asset_2k',
        name: 'Clip 2K Fx',
        startInTimelineSeconds: 0,
        durationSeconds: 20,
        sourceStartSeconds: 0,
        effects: [
          { id: 'fx_gray', type: 'grayscale', name: 'B&N', isEnabled: true, amount: 1 },
          { id: 'fx_sepia', type: 'sepia', name: 'Sepia', isEnabled: true, amount: 0.8 },
          { id: 'fx_fade', type: 'fade', name: 'Fundido', isEnabled: true, fadeInDurationSeconds: 1.5, fadeOutDurationSeconds: 2.0 }
        ]
      }, 'clip_fx_all');

      const settings: ExportSettings = {
        resolutionPreset: '1440p',
        width: 2560,
        height: 1440,
        fps: 50,
        quality: 'ultra',
        videoCodec: 'h264',
        audioCodec: 'aac',
        outputPath: 'C:/Export/render_2k.mp4'
      };

      const plan = generateRenderPlan(projectWithFx, settings);

      expect(plan.settings.width).toBe(2560);
      expect(plan.settings.height).toBe(1440);
      expect(plan.settings.fps).toBe(50);
      expect(plan.ffmpegFilterComplex).toContain('scale=2560:1440');
      expect(plan.ffmpegFilterComplex).toContain('hue=s=0');
      expect(plan.ffmpegFilterComplex).toContain('colorchannelmixer=');
      expect(plan.ffmpegFilterComplex).toContain('fade=t=in:st=0:d=1.5');
      expect(plan.ffmpegFilterComplex).toContain('fade=t=out:st=18:d=2');
    });

    it('genera silenciamiento de audio sintético si no hay pistas de audio activas en la mesa', () => {
      const settings: ExportSettings = {
        resolutionPreset: '720p',
        width: 1280,
        height: 720,
        fps: 24,
        quality: 'medium',
        videoCodec: 'h264',
        audioCodec: 'aac',
        outputPath: 'test.mp4'
      };

      const plan = generateRenderPlan(project, settings);
      expect(plan.ffmpegFilterComplex).toContain('anullsrc');
      expect(plan.ffmpegFilterComplex).toContain('final_audio');
    });
  });

  describe('Motor de Previsualización (PreviewEngine)', () => {
    it('controla reproducción, pausa, salto temporal y sincroniza con los clips activos', () => {
      project.assets.push({
        id: 'asset_preview_1',
        name: 'video_clip.mp4',
        type: 'video',
        durationInSeconds: 20,
        createdAt: new Date().toISOString()
      });

      const projectWithClips = immutableAddClip(project, project.tracks[0].id, {
        assetId: 'asset_preview_1',
        name: 'Clip Activo 4 a 14s',
        startInTimelineSeconds: 4,
        durationSeconds: 10,
        sourceStartSeconds: 0,
        effects: []
      }, 'clip_prev_1');

      const engine = new PreviewEngine(projectWithClips);

      // Estado inicial en segundo 0 (sin clip activo)
      let state = engine.getCurrentFrameState();
      expect(state.currentTimeSeconds).toBe(0);
      expect(state.isPlaying).toBe(false);
      expect(state.activeVideoClip).toBeNull();

      // Salto temporal a segundo 6 (debe estar activo el clip)
      engine.seek(6);
      state = engine.getCurrentFrameState();
      expect(state.currentTimeSeconds).toBe(6);
      expect(state.activeVideoClip?.id).toBe('clip_prev_1');
      expect(state.activeMediaAsset?.id).toBe('asset_preview_1');
      expect(state.clipOffsetSeconds).toBe(2); // 6s - 4s = 2s

      // Control de reproducción y pausa
      engine.play();
      expect(engine.getIsPlaying()).toBe(true);
      engine.pause();
      expect(engine.getIsPlaying()).toBe(false);

      // Liberación de recursos
      engine.registerBlobUrl('blob:http://localhost/dummy');
      engine.releaseResources();
      engine.destroy();
    });
  });

  describe('Preparación y Staging de Medios para Exportación', () => {
    it('soporta proyectos con múltiples clips que comparten el mismo medio', () => {
      project.assets.push({
        id: 'asset_shared_1',
        name: 'entrevista_completa.mp4',
        type: 'video',
        durationInSeconds: 120,
        filePath: 'C:/Videos/entrevista_completa.mp4',
        createdAt: new Date().toISOString()
      });

      const track1 = project.tracks[0].id;
      // Añadir clip 1
      project = immutableAddClip(project, track1, {
        assetId: 'asset_shared_1',
        name: 'Clip 1 (Intro)',
        startInTimelineSeconds: 0,
        durationSeconds: 10,
        sourceStartSeconds: 0,
        effects: []
      }, 'clip_part_1');

      // Añadir clip 2 con el mismo asset
      project = immutableAddClip(project, track1, {
        assetId: 'asset_shared_1',
        name: 'Clip 2 (Cierre)',
        startInTimelineSeconds: 15,
        durationSeconds: 15,
        sourceStartSeconds: 40,
        effects: []
      }, 'clip_part_2');

      const plan = generateRenderPlan(project, {
        resolutionPreset: '1080p',
        width: 1920,
        height: 1080,
        fps: 30,
        quality: 'high',
        videoCodec: 'h264',
        audioCodec: 'aac',
        outputPath: 'shared_asset_export.mp4'
      });

      // El plan debe deduplicar los inputs físicos a 1 solo input
      const inputsForShared = plan.inputs.filter(i => i.assetId === 'asset_shared_1');
      expect(inputsForShared.length).toBe(1);
      expect(plan.videoSegments.length).toBe(2);
      expect(plan.videoSegments[0].inputIndex).toBe(inputsForShared[0].index);
      expect(plan.videoSegments[1].inputIndex).toBe(inputsForShared[0].index);
    });

    it('respeta configuraciones personalizadas de resolución impar, frameRate y códec de audio mp3', () => {
      project.assets.push({
        id: 'asset_custom_test',
        name: 'custom_audio.mp3',
        type: 'audio',
        durationInSeconds: 45,
        filePath: 'C:/Audio/custom_audio.mp3',
        createdAt: new Date().toISOString()
      });

      const audioTrack = project.tracks.find(t => t.type === 'audio')?.id || project.tracks[1]?.id;
      project = immutableAddClip(project, audioTrack, {
        assetId: 'asset_custom_test',
        name: 'Pista de Audio MP3',
        startInTimelineSeconds: 0,
        durationSeconds: 30,
        sourceStartSeconds: 0,
        effects: []
      }, 'clip_audio_custom');

      const plan = generateRenderPlan(project, {
        resolutionPreset: 'custom',
        width: 1081, // Impar para verificar normalización a par
        height: 1921, // Impar para vertical / reels
        fps: 60,
        quality: 'ultra',
        videoCodec: 'hevc',
        audioCodec: 'mp3',
        outputPath: 'custom_test_export.mp4'
      });

      // Dimensiones deben ser normalizadas a números pares
      expect(plan.ffmpegFilterComplex).toContain('s=1080x1920:r=60');
      // Códecs deben reflejarse en ffmpegArgs
      expect(plan.ffmpegArgs).toContain('libx265');
      expect(plan.ffmpegArgs).toContain('libmp3lame');
      expect(plan.ffmpegArgs).toContain('14'); // Calidad Ultra = CRF 14
    });

    it('ejecuta exportaciones reales A (720p 30fps) y B (1080p 60fps) y valida con ffprobe', async () => {
      const { execFileSync, execSync } = await import('child_process');
      const path = await import('path');
      const fs = await import('fs');

      const testInputPath = path.resolve('scratch/test_input.mp4').replace(/\\/g, '/');
      if (!fs.existsSync(testInputPath)) {
        return; // Skip if scratch sample is absent
      }

      // 1. Export A: 720p @ 30 FPS
      const projA = createNewProject({ name: 'Export_A_720p_30fps', width: 1280, height: 720, frameRate: 30 });
      projA.durationSeconds = 1;
      projA.assets.push({
        id: 'asset_test_a',
        name: 'test_input.mp4',
        type: 'video',
        durationInSeconds: 5,
        filePath: testInputPath,
        createdAt: new Date().toISOString()
      });
      const withClipA = immutableAddClip(projA, projA.tracks[0].id, {
        assetId: 'asset_test_a',
        name: 'Clip A',
        startInTimelineSeconds: 0,
        durationSeconds: 1,
        sourceStartSeconds: 0,
        effects: []
      });

      const outPathA = path.resolve('scratch/output_export_a_720p_30fps.mp4').replace(/\\/g, '/');
      const planA = generateRenderPlan(withClipA, {
        resolutionPreset: '720p',
        width: 1280,
        height: 720,
        fps: 30,
        quality: 'medium',
        videoCodec: 'h264',
        audioCodec: 'aac',
        outputPath: outPathA
      });

      execFileSync('ffmpeg', planA.ffmpegArgs, { stdio: 'pipe' });
      expect(fs.existsSync(outPathA)).toBe(true);

      const probeA = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,codec_name -of default=noprint_wrappers=1 "${outPathA}"`).toString();
      expect(probeA).toContain('width=1280');
      expect(probeA).toContain('height=720');
      expect(probeA).toContain('r_frame_rate=30/1');
      expect(probeA).toContain('codec_name=h264');

      // 2. Export B: 1080p @ 60 FPS
      const projB = createNewProject({ name: 'Export_B_1080p_60fps', width: 1920, height: 1080, frameRate: 60 });
      projB.durationSeconds = 1;
      projB.assets.push({
        id: 'asset_test_b',
        name: 'test_input.mp4',
        type: 'video',
        durationInSeconds: 5,
        filePath: testInputPath,
        createdAt: new Date().toISOString()
      });
      const withClipB = immutableAddClip(projB, projB.tracks[0].id, {
        assetId: 'asset_test_b',
        name: 'Clip B',
        startInTimelineSeconds: 0,
        durationSeconds: 1,
        sourceStartSeconds: 0,
        effects: []
      });

      const outPathB = path.resolve('scratch/output_export_b_1080p_60fps.mp4').replace(/\\/g, '/');
      const planB = generateRenderPlan(withClipB, {
        resolutionPreset: '1080p',
        width: 1920,
        height: 1080,
        fps: 60,
        quality: 'high',
        videoCodec: 'h264',
        audioCodec: 'aac',
        outputPath: outPathB
      });

      execFileSync('ffmpeg', planB.ffmpegArgs, { stdio: 'pipe' });
      expect(fs.existsSync(outPathB)).toBe(true);

      const probeB = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,codec_name -of default=noprint_wrappers=1 "${outPathB}"`).toString();
      expect(probeB).toContain('width=1920');
      expect(probeB).toContain('height=1080');
      expect(probeB).toContain('r_frame_rate=60/1');
      expect(probeB).toContain('codec_name=h264');
    }, 120000);
  });
});


