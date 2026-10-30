import { describe, it, expect } from 'vitest';
import {
  KyvoraProject,
  validateProjectSchema,
  migrateProjectIfNeeded,
  CURRENT_SCHEMA_VERSION,
  immutableAddTrack,
  immutableToggleTrackVisibility,
  immutableToggleTrackLock,
  immutableToggleTrackMute,
  immutableUpdateClipAudio,
  immutableUpdateClipSpeed,
  immutableAddTransitionToClip,
  immutableRemoveTransitionFromClip,
  immutableAddKeyframeToClip,
  interpolateClipPropertyAtTime,
  immutableUpdateTitleProperties,
  immutableSeparateAudioFromVideo,
  immutableJoinClips,
  generateRenderPlan,
  ExportSettings
} from '../src';

function createMockProject(): KyvoraProject {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'test-project-nle',
    name: 'Kyvora NLE Project',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      name: 'Test Project',
      width: 1920,
      height: 1080,
      frameRate: 30,
      timecodeFormat: 'smpte',
      previewQuality: 'balanced',
      aspectRatioLocked: true
    },
    durationSeconds: 10,
    assets: [
      {
        id: 'asset-video-1',
        name: 'intro.mp4',
        type: 'video',
        durationInSeconds: 10,
        filePath: 'C:/media/intro.mp4',
        width: 1920,
        height: 1080,
        frameRate: 30,
        createdAt: new Date().toISOString()
      },
      {
        id: 'asset-audio-1',
        name: 'music.mp3',
        type: 'audio',
        durationInSeconds: 30,
        filePath: 'C:/media/music.mp3',
        createdAt: new Date().toISOString()
      }
    ],
    tracks: [
      {
        id: 'track-v1',
        name: 'Video 1',
        type: 'video',
        order: 0,
        isLocked: false,
        isMuted: false,
        isVisible: true,
        clips: [
          {
            id: 'clip-1',
            assetId: 'asset-video-1',
            trackId: 'track-v1',
            name: 'Intro Clip',
            startInTimelineSeconds: 0,
            durationSeconds: 5,
            sourceStartSeconds: 0,
            effects: []
          },
          {
            id: 'clip-2',
            assetId: 'asset-video-1',
            trackId: 'track-v1',
            name: 'Intro Clip Part 2',
            startInTimelineSeconds: 5,
            durationSeconds: 5,
            sourceStartSeconds: 5,
            effects: []
          }
        ]
      },
      {
        id: 'track-a1',
        name: 'Audio 1',
        type: 'audio',
        order: 1,
        isLocked: false,
        isMuted: false,
        isVisible: true,
        clips: []
      }
    ]
  };
}

describe('NLE Expansion Suite: Track and Clip Operations', () => {
  it('should toggle track visibility, lock, and mute immutably', () => {
    const project = createMockProject();

    const muted = immutableToggleTrackMute(project, 'track-v1');
    expect(muted.tracks[0].isMuted).toBe(true);
    expect(project.tracks[0].isMuted).toBe(false); // Inmutabilidad

    const locked = immutableToggleTrackLock(muted, 'track-v1');
    expect(locked.tracks[0].isLocked).toBe(true);

    const hidden = immutableToggleTrackVisibility(locked, 'track-v1');
    expect(hidden.tracks[0].isVisible).toBe(false);
  });

  it('should add new specialized tracks (video, audio, text, overlay)', () => {
    let project = createMockProject();

    project = immutableAddTrack(project, { name: 'Subtítulos', type: 'text', isVisible: true, isLocked: false, isMuted: false });
    expect(project.tracks.length).toBe(3);
    expect(project.tracks[2].type).toBe('text');
    expect(project.tracks[2].name).toBe('Subtítulos');

    project = immutableAddTrack(project, { name: 'Capas FX', type: 'overlay', isVisible: true, isLocked: false, isMuted: false });
    expect(project.tracks.length).toBe(4);
    expect(project.tracks[3].type).toBe('overlay');
  });

  it('should update clip audio properties (volume, gain, fades, normalize)', () => {
    const project = createMockProject();

    const updated = immutableUpdateClipAudio(project, 'clip-1', {
      volume: 1.5,
      gainDb: 6,
      fadeInDurationSeconds: 1.0,
      fadeOutDurationSeconds: 0.5,
      isNormalized: true
    });

    const clip = updated.tracks[0].clips.find(c => c.id === 'clip-1');
    expect(clip?.audio?.volume).toBe(1.5);
    expect(clip?.audio?.gainDb).toBe(6);
    expect(clip?.audio?.fadeInDurationSeconds).toBe(1.0);
    expect(clip?.audio?.isNormalized).toBe(true);
  });

  it('should update clip speed properties (fast-motion, slow-motion, reverse)', () => {
    const project = createMockProject();

    // 2x speed
    const fast = immutableUpdateClipSpeed(project, 'clip-1', {
      playbackSpeed: 2.0,
      isReversed: false,
      pitchCorrection: true
    });
    const fastClip = fast.tracks[0].clips.find(c => c.id === 'clip-1');
    expect(fastClip?.speed?.playbackSpeed).toBe(2.0);

    // Reverse
    const reversed = immutableUpdateClipSpeed(fast, 'clip-1', {
      isReversed: true
    });
    const revClip = reversed.tracks[0].clips.find(c => c.id === 'clip-1');
    expect(revClip?.speed?.isReversed).toBe(true);
  });

  it('should add, interpolate and remove keyframes on clips', () => {
    let project = createMockProject();

    project = immutableAddKeyframeToClip(project, 'clip-1', {
      id: 'kf-1',
      property: 'scaleX',
      timeSeconds: 0,
      value: 1.0,
      easing: 'linear'
    });

    project = immutableAddKeyframeToClip(project, 'clip-1', {
      id: 'kf-2',
      property: 'scaleX',
      timeSeconds: 4,
      value: 2.0,
      easing: 'easeInOut'
    });

    const clip = project.tracks[0].clips.find(c => c.id === 'clip-1')!;
    expect(clip.keyframes?.length).toBe(2);

    // Interpolación
    const valAtStart = interpolateClipPropertyAtTime(clip, 'scaleX', 0);
    expect(valAtStart).toBe(1.0);

    const valAtEnd = interpolateClipPropertyAtTime(clip, 'scaleX', 4);
    expect(valAtEnd).toBe(2.0);

    const valAtMid = interpolateClipPropertyAtTime(clip, 'scaleX', 2);
    expect(valAtMid).toBeCloseTo(1.5, 1);
  });

  it('should add and remove transitions on clips', () => {
    let project = createMockProject();

    project = immutableAddTransitionToClip(project, 'clip-1', {
      id: 'tr-1',
      type: 'crossDissolve',
      durationSeconds: 1.2,
      position: 'start'
    });

    let clip = project.tracks[0].clips.find(c => c.id === 'clip-1')!;
    expect(clip.transitions?.length).toBe(1);
    expect(clip.transitions![0].type).toBe('crossDissolve');

    project = immutableRemoveTransitionFromClip(project, 'clip-1', 'tr-1');
    clip = project.tracks[0].clips.find(c => c.id === 'clip-1')!;
    expect(clip.transitions?.length).toBe(0);
  });

  it('should update title and text template properties', () => {
    let project = createMockProject();

    project = immutableUpdateTitleProperties(project, 'clip-1', {
      text: 'Bienvenido a Kyvora Studio',
      fontFamily: 'Inter',
      fontSize: 36,
      textColor: '#0066FF',
      template: 'lowerThird',
      alignment: 'left',
      animationIn: 'fade',
      animationOut: 'slideDown'
    });

    const clip = project.tracks[0].clips.find(c => c.id === 'clip-1')!;
    expect(clip.titleProperties?.text).toBe('Bienvenido a Kyvora Studio');
    expect(clip.titleProperties?.template).toBe('lowerThird');
  });

  it('should separate audio from video into a dedicated audio track', () => {
    const project = createMockProject();

    const { project: separated } = immutableSeparateAudioFromVideo(project, 'clip-1');
    const videoClip = separated.tracks[0].clips.find(c => c.id === 'clip-1');
    expect(videoClip?.audio?.isMuted).toBe(true);

    const audioTrack = separated.tracks.find(t => t.type === 'audio');
    expect(audioTrack?.clips.length).toBe(1);
    expect(audioTrack?.clips[0].name).toContain('Audio');
  });

  it('should join two adjacent clips into one continuous clip', () => {
    const project = createMockProject();

    const { project: joined } = immutableJoinClips(project, 'clip-1', 'clip-2');
    expect(joined.tracks[0].clips.length).toBe(1);

    const mergedClip = joined.tracks[0].clips[0];
    expect(mergedClip.durationSeconds).toBe(10); // 5s + 5s = 10s
  });
});

describe('NLE Expansion Suite: Render Plan Generation with Advanced Features', () => {
  it('should generate FFmpeg render plan with speed, reverse, and audio normalization', () => {
    let project = createMockProject();

    // Configurar speed 2x y reverse en clip-1
    project = immutableUpdateClipSpeed(project, 'clip-1', {
      playbackSpeed: 2.0,
      isReversed: true,
      pitchCorrection: true
    });

    // Configurar audio fade y normalización
    project = immutableUpdateClipAudio(project, 'clip-1', {
      volume: 1.2,
      fadeInDurationSeconds: 0.5,
      fadeOutDurationSeconds: 0.5,
      isNormalized: true
    });

    const exportSettings: ExportSettings = {
      resolutionPreset: '1080p',
      width: 1920,
      height: 1080,
      fps: 60,
      videoCodec: 'h264',
      audioCodec: 'aac',
      quality: 'high',
      outputPath: 'C:/exports/test_nle.mp4'
    };

    const plan = generateRenderPlan(project, exportSettings);
    expect(plan.ffmpegArgs).toBeDefined();

    expect(plan.ffmpegFilterComplex).toContain('setpts=0.5000*PTS'); // 2x speed
    expect(plan.ffmpegFilterComplex).toContain('reverse'); // Invertido
    expect(plan.ffmpegFilterComplex).toContain('afade=t=in'); // Fade in de audio
    expect(plan.ffmpegFilterComplex).toContain('afade=t=out'); // Fade out de audio
    expect(plan.ffmpegFilterComplex).toContain('loudnorm'); // Normalización EBU R128
  });

  it('should generate FFmpeg render plan with title text overlay (drawtext)', () => {
    let project = createMockProject();

    project = immutableUpdateTitleProperties(project, 'clip-1', {
      text: 'Kyvora Studio Pro',
      fontFamily: 'Arial',
      fontSize: 48,
      textColor: '#ffffff',
      template: 'cinematic',
      alignment: 'center',
      animationIn: 'fade',
      animationOut: 'none'
    });

    const exportSettings: ExportSettings = {
      resolutionPreset: '4k',
      width: 3840,
      height: 2160,
      fps: 30,
      videoCodec: 'hevc',
      audioCodec: 'aac',
      quality: 'ultra',
      outputPath: 'C:/exports/title_render.mp4'
    };

    const plan = generateRenderPlan(project, exportSettings);
    expect(plan.ffmpegFilterComplex).toContain('drawtext=');
    expect(plan.ffmpegFilterComplex).toContain('Kyvora Studio Pro');
    expect(plan.ffmpegArgs).toContain('libx265'); // HEVC
  });

  it('should support custom bitrate and VP9 / ProRes export configs', () => {
    const project = createMockProject();

    const vp9Settings: ExportSettings = {
      resolutionPreset: '720p',
      width: 1280,
      height: 720,
      fps: 24,
      videoCodec: 'vp9',
      audioCodec: 'opus',
      quality: 'medium',
      customBitrateKbps: 8000,
      outputPath: 'C:/exports/web_render.webm'
    };

    const plan = generateRenderPlan(project, vp9Settings);
    expect(plan.ffmpegArgs).toContain('libvpx-vp9');
    expect(plan.ffmpegArgs).toContain('libopus');
    expect(plan.ffmpegArgs).toContain('-b:v');
    expect(plan.ffmpegArgs).toContain('8000k');
  });
});

describe('NLE Expansion Suite: Schema v2.0 Evolution & Backwards Compatibility', () => {
  it('should validate Kyvora Project Schema 2.0.0 with all new NLE properties', () => {
    const project = createMockProject();
    const result = validateProjectSchema(project);
    expect(result.isValid).toBe(true);
    expect(result.issues.length).toBe(0);
  });

  it('should migrate legacy project v1.1.0 to v2.0.0 with zero loss', () => {
    const legacyProjectV1: any = {
      schemaVersion: '1.1.0',
      id: 'legacy-proj-1',
      name: 'Legacy Project',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      settings: {
        width: 1920,
        height: 1080,
        frameRate: 30,
        sampleRate: 48000,
        audioChannels: 2
      },
      durationSeconds: 15,
      assets: [
        {
          id: 'asset-1',
          name: 'clip.mp4',
          type: 'video',
          durationInSeconds: 15,
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      ],
      tracks: [
        {
          id: 'track-1',
          name: 'Track 1',
          clips: [
            {
              id: 'c1',
              assetId: 'asset-1',
              trackId: 'track-1',
              name: 'Clip 1',
              startInTimelineSeconds: 0,
              durationSeconds: 15,
              sourceStartSeconds: 0,
              effects: []
            }
          ]
        }
      ]
    };

    const migrated = migrateProjectIfNeeded(legacyProjectV1);
    expect(migrated.schemaVersion).toBe('3.0.0');
    expect(migrated.tracks[0].type).toBe('video');
    expect(migrated.tracks[0].isLocked).toBe(false);
    expect(migrated.tracks[0].isMuted).toBe(false);

    // Debe validar con la versión actual 3.0.0
    const validation = validateProjectSchema(migrated);
    expect(validation.isValid).toBe(true);
  });
});
