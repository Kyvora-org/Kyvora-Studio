import { KyvoraProject, ColorAdjustmentEffect } from '../types/project';

export type ExportResolution = '1080p' | '720p' | '1440p' | '4k' | 'custom';
export type ExportQuality = 'low' | 'medium' | 'high' | 'ultra';
export type VideoCodec = 'h264' | 'hevc';
export type AudioCodec = 'aac' | 'mp3';

export interface ExportSettings {
  resolutionPreset: ExportResolution;
  width: number;
  height: number;
  fps: number;
  quality: ExportQuality;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  outputPath: string;
}

export interface RenderInput {
  index: number;
  assetId: string;
  sourceFilePath: string;
  mediaType: 'video' | 'audio' | 'image';
}

export interface RenderClipSegment {
  inputIndex: number;
  clipId: string;
  startInTimelineSeconds: number;
  durationSeconds: number;
  sourceStartSeconds: number;
  scaleX: number;
  scaleY: number;
  positionX: number;
  positionY: number;
  opacity: number;
  volume: number;
  isMuted: boolean;
  colorAdjustment?: {
    brightness: number;
    contrast: number;
    saturation: number;
  };
  grayscale?: number;
  sepia?: number;
  textOverlay?: {
    text: string;
    fontSize: number;
    color: string;
    positionX: number;
    positionY: number;
  };
  fade?: {
    fadeInDuration: number;
    fadeOutDuration: number;
  };
}

export interface RenderPlan {
  projectId: string;
  settings: ExportSettings;
  durationSeconds: number;
  inputs: RenderInput[];
  videoSegments: RenderClipSegment[];
  audioSegments: RenderClipSegment[];
  ffmpegFilterComplex: string;
  ffmpegArgs: string[];
}

export const RESOLUTION_PRESETS: Record<ExportResolution, { width: number; height: number }> = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '1440p': { width: 2560, height: 1440 },
  '4k': { width: 3840, height: 2160 },
  'custom': { width: 1920, height: 1080 }
};

export const QUALITY_CRF: Record<ExportQuality, { crf: number; preset: string; audioBitrate: string }> = {
  'low': { crf: 28, preset: 'faster', audioBitrate: '128k' },
  'medium': { crf: 23, preset: 'medium', audioBitrate: '192k' },
  'high': { crf: 18, preset: 'slow', audioBitrate: '256k' },
  'ultra': { crf: 14, preset: 'slower', audioBitrate: '320k' }
};

/**
 * Convierte un proyecto y configuraciones de exportación en un Plan de Renderizado determinista
 * con la secuencia de filtros FFmpeg exacta (`filter_complex`).
 */
export function generateRenderPlan(
  project: KyvoraProject,
  settings: ExportSettings
): RenderPlan {
  const inputs: RenderInput[] = [];
  const assetInputMap = new Map<string, number>();

  // 1. Recopilar inputs únicos
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      const asset = project.assets.find(a => a.id === clip.assetId);
      const sourcePath = asset?.filePath || `media/${clip.assetId}_${asset?.name || 'media'}`;

      if (!assetInputMap.has(clip.assetId)) {
        const inputIdx = inputs.length;
        assetInputMap.set(clip.assetId, inputIdx);
        inputs.push({
          index: inputIdx,
          assetId: clip.assetId,
          sourceFilePath: sourcePath,
          mediaType: asset?.type || (track.type === 'video' ? 'video' : 'audio')
        });
      }
    }
  }

  // 2. Extraer segmentos de video y audio ordenados cronológicamente
  const videoSegments: RenderClipSegment[] = [];
  const audioSegments: RenderClipSegment[] = [];

  for (const track of project.tracks) {
    for (const clip of track.clips) {
      const inputIndex = assetInputMap.get(clip.assetId);
      if (inputIndex === undefined) continue;

      let colorAdj: { brightness: number; contrast: number; saturation: number } | undefined = undefined;
      const colorEffect = clip.effects.find(e => e.type === 'colorAdjustment') as ColorAdjustmentEffect | undefined;
      if (colorEffect && colorEffect.isEnabled) {
        colorAdj = {
          brightness: colorEffect.brightness,
          contrast: colorEffect.contrast,
          saturation: colorEffect.saturation
        };
      }

      const grayEffect = clip.effects.find(e => e.type === 'grayscale' && e.isEnabled) as import('../types/project').GrayscaleEffect | undefined;
      const sepiaEffect = clip.effects.find(e => e.type === 'sepia' && e.isEnabled) as import('../types/project').SepiaEffect | undefined;
      const textEffect = clip.effects.find(e => e.type === 'textOverlay' && e.isEnabled) as import('../types/project').TextOverlayEffect | undefined;
      const fadeEffect = clip.effects.find(e => e.type === 'fade' && e.isEnabled) as import('../types/project').FadeEffect | undefined;

      const segment: RenderClipSegment = {
        inputIndex,
        clipId: clip.id,
        startInTimelineSeconds: clip.startInTimelineSeconds,
        durationSeconds: clip.durationSeconds,
        sourceStartSeconds: clip.sourceStartSeconds,
        scaleX: clip.transform?.scaleX ?? 1,
        scaleY: clip.transform?.scaleY ?? 1,
        positionX: clip.transform?.positionX ?? 0,
        positionY: clip.transform?.positionY ?? 0,
        opacity: clip.transform?.opacity ?? 1,
        volume: clip.audio?.isMuted ? 0 : (clip.audio?.volume ?? 1),
        isMuted: clip.audio?.isMuted ?? false,
        colorAdjustment: colorAdj,
        grayscale: grayEffect ? grayEffect.amount : undefined,
        sepia: sepiaEffect ? sepiaEffect.amount : undefined,
        textOverlay: textEffect ? {
          text: textEffect.text,
          fontSize: textEffect.fontSize,
          color: textEffect.color,
          positionX: textEffect.positionX,
          positionY: textEffect.positionY
        } : undefined,
        fade: fadeEffect ? {
          fadeInDuration: fadeEffect.fadeInDurationSeconds,
          fadeOutDuration: fadeEffect.fadeOutDurationSeconds
        } : undefined
      };

      if (track.type === 'video') {
        videoSegments.push(segment);
        // Si el activo es un video y no está muteado ni con volumen 0, también incluir su audio
        const asset = project.assets.find(a => a.id === clip.assetId);
        if (asset && asset.type === 'video') {
          audioSegments.push(segment);
        }
      } else {
        const asset = project.assets.find(a => a.id === clip.assetId);
        // Solo agregar a audioSegments si el activo es de audio o de video (tiene audio nativo)
        if (!asset || asset.type === 'audio' || asset.type === 'video') {
          audioSegments.push(segment);
        }
      }
    }
  }

  // Ordenar cronológicamente
  videoSegments.sort((a, b) => a.startInTimelineSeconds - b.startInTimelineSeconds);
  audioSegments.sort((a, b) => a.startInTimelineSeconds - b.startInTimelineSeconds);

  // 3. Construir cadena de filtros complejos (filter_complex) de FFmpeg
  const filterChains: string[] = [];
  // Asegurar dimensiones pares para códecs de video compatibles con subsampling YUV 4:2:0
  const targetW = settings.width % 2 !== 0 ? settings.width - 1 : settings.width;
  const targetH = settings.height % 2 !== 0 ? settings.height - 1 : settings.height;
  const targetFps = settings.fps;

  // Fondo base negro sólido de la resolución del proyecto
  filterChains.push(
    `color=c=black:s=${targetW}x${targetH}:r=${targetFps}:d=${project.durationSeconds}[base_video]`
  );

  let currentVideoOutput = 'base_video';

  videoSegments.forEach((seg, idx) => {
    const trimTag = `v_trimmed_${idx}`;
    const formattedTag = `v_fmt_${idx}`;
    const overlayTag = `v_comp_${idx}`;

    // A. Recorte del archivo fuente (trim)
    const endSourceSeconds = seg.sourceStartSeconds + seg.durationSeconds;
    let chain = `[${seg.inputIndex}:v]trim=start=${seg.sourceStartSeconds}:end=${endSourceSeconds},setpts=PTS-STARTPTS[${trimTag}]`;
    filterChains.push(chain);

    // B. Transformaciones y efectos (escala, eq de color, grayscale, sepia, fade, fps)
    let postFilter = `[${trimTag}]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2,fps=${targetFps}`;

    if (seg.colorAdjustment) {
      const b = seg.colorAdjustment.brightness;
      const c = seg.colorAdjustment.contrast;
      const s = seg.colorAdjustment.saturation;
      postFilter += `,eq=brightness=${b}:contrast=${c}:saturation=${s}`;
    }

    if (seg.grayscale !== undefined && seg.grayscale > 0) {
      // Para blanco y negro usamos saturación en 0 proporcional al monto
      postFilter += `,hue=s=${Math.max(0, 1 - seg.grayscale)}`;
    }

    if (seg.sepia !== undefined && seg.sepia > 0) {
      // Sepia profesional en FFmpeg mediante curvas o colorchannelmixer
      postFilter += `,colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131`;
    }

    if (seg.fade) {
      if (seg.fade.fadeInDuration > 0) {
        postFilter += `,fade=t=in:st=0:d=${seg.fade.fadeInDuration}`;
      }
      if (seg.fade.fadeOutDuration > 0) {
        const outStart = Math.max(0, seg.durationSeconds - seg.fade.fadeOutDuration);
        postFilter += `,fade=t=out:st=${outStart}:d=${seg.fade.fadeOutDuration}`;
      }
    }

    postFilter += `[${formattedTag}]`;
    filterChains.push(postFilter);

    // C. Composición sobre la línea de tiempo mediante overlay con time-gate y soporte de posición
    const overlayStartTime = seg.startInTimelineSeconds;
    const overlayEndTime = seg.startInTimelineSeconds + seg.durationSeconds;
    const posX = seg.positionX || 0;
    const posY = seg.positionY || 0;
    const xCoord = posX === 0 ? '(W-w)/2' : `(W-w)/2+${posX}`;
    const yCoord = posY === 0 ? '(H-h)/2' : `(H-h)/2+${posY}`;

    filterChains.push(
      `[${currentVideoOutput}][${formattedTag}]overlay=x=${xCoord}:y=${yCoord}:enable='between(t,${overlayStartTime},${overlayEndTime})'[${overlayTag}]`
    );
    currentVideoOutput = overlayTag;
  });

  // Procesamiento de audio
  const audioOutputs: string[] = [];
  audioSegments.forEach((seg, idx) => {
    if (seg.isMuted || seg.volume === 0) return;
    const aTrimTag = `a_trim_${idx}`;
    const aDelayTag = `a_delay_${idx}`;
    const endSource = seg.sourceStartSeconds + seg.durationSeconds;
    const delayMs = Math.round(seg.startInTimelineSeconds * 1000);

    filterChains.push(
      `[${seg.inputIndex}:a]atrim=start=${seg.sourceStartSeconds}:end=${endSource},asetpts=PTS-STARTPTS,volume=${seg.volume}[${aTrimTag}]`
    );
    filterChains.push(
      `[${aTrimTag}]adelay=${delayMs}|${delayMs}[${aDelayTag}]`
    );
    audioOutputs.push(`[${aDelayTag}]`);
  });

  let finalAudioOutput = '[final_audio]';
  if (audioOutputs.length > 0) {
    filterChains.push(
      `${audioOutputs.join('')}amix=inputs=${audioOutputs.length}:duration=longest[final_audio]`
    );
  } else {
    // Si no hay audio, generar canal silencioso
    filterChains.push(
      `anullsrc=channel_layout=stereo:sample_rate=48000:d=${project.durationSeconds}[final_audio]`
    );
  }

  const ffmpegFilterComplex = filterChains.join(';\n');

  // 4. Generar lista de argumentos de FFmpeg
  const qualityParams = QUALITY_CRF[settings.quality] || QUALITY_CRF.high;
  const ffmpegArgs: string[] = ['-y'];

  // Entradas de archivo
  for (const input of inputs) {
    ffmpegArgs.push('-i', input.sourceFilePath);
  }

  ffmpegArgs.push('-filter_complex', ffmpegFilterComplex);
  ffmpegArgs.push('-map', `[${currentVideoOutput}]`);
  ffmpegArgs.push('-map', finalAudioOutput);

  // Códecs y parámetros de codificación
  const vcodec = settings.videoCodec === 'hevc' ? 'libx265' : 'libx264';
  const acodec = settings.audioCodec === 'mp3' ? 'libmp3lame' : 'aac';
  ffmpegArgs.push(
    '-c:v', vcodec,
    '-preset', qualityParams.preset,
    '-crf', qualityParams.crf.toString(),
    '-pix_fmt', 'yuv420p',
    '-c:a', acodec,
    '-b:a', qualityParams.audioBitrate,
    '-t', project.durationSeconds.toString(),
    settings.outputPath
  );

  return {
    projectId: project.id,
    settings,
    durationSeconds: project.durationSeconds,
    inputs,
    videoSegments,
    audioSegments,
    ffmpegFilterComplex,
    ffmpegArgs
  };
}
