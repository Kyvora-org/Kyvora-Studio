import { 
  KyvoraProject, 
  ColorAdjustmentEffect,
  ColorGradingEffect,
  BlurEffect,
  VignetteEffect,
  FilmGrainEffect,
  PixelateEffect,
  SharpenEffect
} from '../types/project';

export type ExportResolution = '480p' | '720p' | '1080p' | '1440p' | '4k' | 'custom';
export type ExportQuality = 'low' | 'medium' | 'high' | 'ultra';
export type VideoCodec = 'h264' | 'hevc' | 'vp9' | 'prores';
export type AudioCodec = 'aac' | 'mp3' | 'opus' | 'pcm';

export interface ExportSettings {
  resolutionPreset: ExportResolution;
  width: number;
  height: number;
  fps: number;
  quality: ExportQuality;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  customBitrateKbps?: number;
  outputPath: string;
}

export interface RenderInput {
  index: number;
  assetId: string;
  sourceFilePath: string;
  mediaType: 'video' | 'audio' | 'image' | 'text';
}

export interface RenderClipSegment {
  inputIndex: number;
  clipId: string;
  mediaType: 'video' | 'audio' | 'image' | 'text';
  startInTimelineSeconds: number;
  durationSeconds: number;
  sourceStartSeconds: number;
  scaleX: number;
  scaleY: number;
  positionX: number;
  positionY: number;
  opacity: number;
  volume: number;
  gainDb?: number;
  isMuted: boolean;
  audioFadeIn?: number;
  audioFadeOut?: number;
  isNormalized?: boolean;
  playbackSpeed: number;
  isReversed: boolean;
  colorAdjustment?: {
    brightness: number;
    contrast: number;
    saturation: number;
  };
  colorGrading?: {
    brightness: number;
    contrast: number;
    saturation: number;
    temperature: number;
    exposure: number;
  };
  grayscale?: number;
  sepia?: number;
  blurRadius?: number;
  vignette?: boolean;
  filmGrain?: number;
  pixelate?: number;
  sharpen?: number;
  textOverlay?: {
    text: string;
    fontFamily: string;
    fontSize: number;
    textColor: string;
    backgroundColor?: string;
    positionX: number;
    positionY: number;
  };
  fade?: {
    fadeInDuration: number;
    fadeOutDuration: number;
  };
  transitionIn?: {
    type: string;
    duration: number;
  };
  transitionOut?: {
    type: string;
    duration: number;
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
  '480p': { width: 854, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '1440p': { width: 2560, height: 1440 },
  '4k': { width: 3840, height: 2160 },
  'custom': { width: 1920, height: 1080 }
};

export const QUALITY_CRF: Record<ExportQuality, { crf: number; preset: string; audioBitrate: string }> = {
  'low': { crf: 28, preset: 'faster', audioBitrate: '128k' },
  'medium': { crf: 23, preset: 'medium', audioBitrate: '192k' },
  'high': { crf: 18, preset: 'medium', audioBitrate: '256k' },
  'ultra': { crf: 14, preset: 'medium', audioBitrate: '320k' }
};

function escapeDrawText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%');
}

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
    if (track.isVisible === false) continue; // Pistas ocultas no se exportan
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
    if (track.isVisible === false) continue;

    for (const clip of track.clips) {
      const inputIndex = assetInputMap.get(clip.assetId);
      if (inputIndex === undefined) continue;

      const asset = project.assets.find(a => a.id === clip.assetId);
      const mediaType = asset?.type || (track.type === 'video' ? 'video' : 'audio');

      // Extraer efectos aplicados
      let colorAdj: { brightness: number; contrast: number; saturation: number } | undefined;
      const colorEffect = clip.effects.find(e => e.type === 'colorAdjustment') as ColorAdjustmentEffect | undefined;
      if (colorEffect && colorEffect.isEnabled) {
        colorAdj = {
          brightness: colorEffect.brightness,
          contrast: colorEffect.contrast,
          saturation: colorEffect.saturation
        };
      }

      let colorGrading: { brightness: number; contrast: number; saturation: number; temperature: number; exposure: number } | undefined;
      const gradingEffect = clip.effects.find(e => e.type === 'colorGrading') as ColorGradingEffect | undefined;
      if (gradingEffect && gradingEffect.isEnabled) {
        colorGrading = {
          brightness: gradingEffect.brightness,
          contrast: gradingEffect.contrast,
          saturation: gradingEffect.saturation,
          temperature: gradingEffect.temperature,
          exposure: gradingEffect.exposure
        };
      }

      const grayEffect = clip.effects.find(e => e.type === 'grayscale' && e.isEnabled) as import('../types/project').GrayscaleEffect | undefined;
      const sepiaEffect = clip.effects.find(e => e.type === 'sepia' && e.isEnabled) as import('../types/project').SepiaEffect | undefined;
      const blurEffect = clip.effects.find(e => e.type === 'blur' && e.isEnabled) as BlurEffect | undefined;
      const vignetteEffect = clip.effects.find(e => e.type === 'vignette' && e.isEnabled) as VignetteEffect | undefined;
      const grainEffect = clip.effects.find(e => e.type === 'filmGrain' && e.isEnabled) as FilmGrainEffect | undefined;
      const pixelEffect = clip.effects.find(e => e.type === 'pixelate' && e.isEnabled) as PixelateEffect | undefined;
      const sharpEffect = clip.effects.find(e => e.type === 'sharpen' && e.isEnabled) as SharpenEffect | undefined;
      const textEffect = clip.effects.find(e => e.type === 'textOverlay' && e.isEnabled) as import('../types/project').TextOverlayEffect | undefined;
      const fadeEffect = clip.effects.find(e => e.type === 'fade' && e.isEnabled) as import('../types/project').FadeEffect | undefined;

      // Transiciones In / Out
      const transIn = clip.transitions?.find(t => t.position === 'start');
      const transOut = clip.transitions?.find(t => t.position === 'end');

      // Propiedades de texto si es un clip de título
      const titleProps = clip.titleProperties;
      let textOverlayData = textEffect ? {
        text: textEffect.text,
        fontFamily: textEffect.fontFamily,
        fontSize: textEffect.fontSize,
        textColor: textEffect.color,
        backgroundColor: textEffect.backgroundColor,
        positionX: textEffect.positionX,
        positionY: textEffect.positionY
      } : undefined;

      if (titleProps) {
        textOverlayData = {
          text: titleProps.text,
          fontFamily: titleProps.fontFamily,
          fontSize: titleProps.fontSize,
          textColor: titleProps.textColor,
          backgroundColor: titleProps.backgroundColor,
          positionX: 50,
          positionY: 80
        };
      }

      const speedVal = clip.speed?.playbackSpeed ?? 1.0;
      const isRev = clip.speed?.isReversed ?? false;

      const segment: RenderClipSegment = {
        inputIndex,
        clipId: clip.id,
        mediaType,
        startInTimelineSeconds: clip.startInTimelineSeconds,
        durationSeconds: clip.durationSeconds,
        sourceStartSeconds: clip.sourceStartSeconds,
        scaleX: clip.transform?.scaleX ?? 1,
        scaleY: clip.transform?.scaleY ?? 1,
        positionX: clip.transform?.positionX ?? 0,
        positionY: clip.transform?.positionY ?? 0,
        opacity: clip.transform?.opacity ?? 1,
        volume: track.isMuted || clip.audio?.isMuted ? 0 : (clip.audio?.volume ?? 1),
        gainDb: clip.audio?.gainDb,
        isMuted: track.isMuted || (clip.audio?.isMuted ?? false),
        audioFadeIn: clip.audio?.fadeInDurationSeconds,
        audioFadeOut: clip.audio?.fadeOutDurationSeconds,
        isNormalized: clip.audio?.isNormalized,
        playbackSpeed: speedVal,
        isReversed: isRev,
        colorAdjustment: colorAdj,
        colorGrading,
        grayscale: grayEffect ? grayEffect.amount : undefined,
        sepia: sepiaEffect ? sepiaEffect.amount : undefined,
        blurRadius: blurEffect ? blurEffect.radius : undefined,
        vignette: vignetteEffect ? true : undefined,
        filmGrain: grainEffect ? grainEffect.intensity : undefined,
        pixelate: pixelEffect ? pixelEffect.pixelSize : undefined,
        sharpen: sharpEffect ? sharpEffect.amount : undefined,
        textOverlay: textOverlayData,
        fade: fadeEffect ? {
          fadeInDuration: fadeEffect.fadeInDurationSeconds,
          fadeOutDuration: fadeEffect.fadeOutDurationSeconds
        } : undefined,
        transitionIn: transIn ? { type: transIn.type, duration: transIn.durationSeconds } : undefined,
        transitionOut: transOut ? { type: transOut.type, duration: transOut.durationSeconds } : undefined
      };

      if (track.type === 'video' || track.type === 'overlay' || track.type === 'text') {
        videoSegments.push(segment);
        // Si el activo es un video y no está muteado ni con volumen 0, también incluir su audio
        if (asset && asset.type === 'video' && !track.isMuted && !clip.audio?.isMuted) {
          audioSegments.push(segment);
        }
      } else if (track.type === 'audio') {
        if (!track.isMuted && !clip.audio?.isMuted && (asset?.type === 'audio' || asset?.type === 'video')) {
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
  const targetW = settings.width % 2 !== 0 ? settings.width - 1 : settings.width;
  const targetH = settings.height % 2 !== 0 ? settings.height - 1 : settings.height;
  const targetFps = settings.fps;

  // Fondo base negro sólido de la resolución y FPS del proyecto en formato YUV420P estándar
  filterChains.push(
    `color=c=black:s=${targetW}x${targetH}:r=${targetFps}:d=${project.durationSeconds},format=yuv420p[base_video]`
  );

  let currentVideoOutput = 'base_video';

  videoSegments.forEach((seg, idx) => {
    const trimTag = `v_trimmed_${idx}`;
    const formattedTag = `v_fmt_${idx}`;
    const overlayTag = `v_comp_${idx}`;

    // A. Recorte del archivo fuente (trim) y soporte para imágenes / secuencias
    const endSourceSeconds = seg.sourceStartSeconds + seg.durationSeconds;
    let chain = '';
    if (seg.mediaType === 'image') {
      // Para imágenes estáticas, aplicar loop infinito antes del recorte para que persista toda la duración
      chain = `[${seg.inputIndex}:v]loop=loop=-1:size=1:start=0,trim=start=${seg.sourceStartSeconds}:end=${endSourceSeconds},setpts=PTS-STARTPTS[${trimTag}]`;
    } else {
      chain = `[${seg.inputIndex}:v]trim=start=${seg.sourceStartSeconds}:end=${endSourceSeconds},setpts=PTS-STARTPTS[${trimTag}]`;
    }
    filterChains.push(chain);

    // B. Transformaciones y efectos de video
    let postFilter = `[${trimTag}]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2,format=yuv420p,fps=${targetFps}`;

    // Velocidad y reversa
    if (seg.playbackSpeed !== 1.0) {
      const speedFactor = (1.0 / seg.playbackSpeed).toFixed(4);
      postFilter += `,setpts=${speedFactor}*PTS`;
    }
    if (seg.isReversed) {
      postFilter += `,reverse`;
    }

    // Efectos de color
    if (seg.colorAdjustment) {
      const b = seg.colorAdjustment.brightness;
      const c = seg.colorAdjustment.contrast;
      const s = seg.colorAdjustment.saturation;
      postFilter += `,eq=brightness=${b}:contrast=${c}:saturation=${s}`;
    }

    if (seg.colorGrading) {
      const b = seg.colorGrading.brightness;
      const c = seg.colorGrading.contrast;
      const s = seg.colorGrading.saturation;
      postFilter += `,eq=brightness=${b}:contrast=${c}:saturation=${s}`;
      if (seg.colorGrading.temperature !== 0) {
        // Ajuste de temperatura mediante balance de canales rojo y azul
        const temp = seg.colorGrading.temperature;
        const rMul = (1 + temp * 0.2).toFixed(2);
        const bMul = (1 - temp * 0.2).toFixed(2);
        postFilter += `,colorchannelmixer=rr=${rMul}:bb=${bMul}`;
      }
    }

    if (seg.grayscale !== undefined && seg.grayscale > 0) {
      postFilter += `,hue=s=${Math.max(0, 1 - seg.grayscale)}`;
    }

    if (seg.sepia !== undefined && seg.sepia > 0) {
      postFilter += `,colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131`;
    }

    if (seg.blurRadius && seg.blurRadius > 0) {
      postFilter += `,boxblur=${Math.min(50, seg.blurRadius)}:1`;
    }

    if (seg.vignette) {
      postFilter += `,vignette=PI/4`;
    }

    if (seg.filmGrain && seg.filmGrain > 0) {
      const noiseVal = Math.round(seg.filmGrain * 40);
      postFilter += `,noise=alls=${noiseVal}:allf=t+u`;
    }

    if (seg.pixelate && seg.pixelate > 1) {
      const px = Math.min(64, Math.max(2, Math.round(seg.pixelate)));
      postFilter += `,scale=iw/${px}:-1:flags=neighbor,scale=${targetW}:${targetH}:flags=neighbor`;
    }

    if (seg.sharpen && seg.sharpen > 0) {
      const sh = seg.sharpen.toFixed(1);
      postFilter += `,unsharp=5:5:${sh}:5:5:0.0`;
    }

    // Fundidos (Fade In / Out)
    if (seg.fade) {
      if (seg.fade.fadeInDuration > 0) {
        postFilter += `,fade=t=in:st=0:d=${seg.fade.fadeInDuration}`;
      }
      if (seg.fade.fadeOutDuration > 0) {
        const outStart = Math.max(0, seg.durationSeconds - seg.fade.fadeOutDuration);
        postFilter += `,fade=t=out:st=${outStart}:d=${seg.fade.fadeOutDuration}`;
      }
    }

    // Transiciones In / Out
    if (seg.transitionIn) {
      if (seg.transitionIn.type === 'fade' || seg.transitionIn.type === 'dipToBlack') {
        postFilter += `,fade=t=in:st=0:d=${seg.transitionIn.duration}`;
      } else if (seg.transitionIn.type === 'dipToWhite') {
        postFilter += `,fade=t=in:st=0:d=${seg.transitionIn.duration}:color=white`;
      }
    }
    if (seg.transitionOut) {
      const outStart = Math.max(0, seg.durationSeconds - seg.transitionOut.duration);
      if (seg.transitionOut.type === 'fade' || seg.transitionOut.type === 'dipToBlack') {
        postFilter += `,fade=t=out:st=${outStart}:d=${seg.transitionOut.duration}`;
      } else if (seg.transitionOut.type === 'dipToWhite') {
        postFilter += `,fade=t=out:st=${outStart}:d=${seg.transitionOut.duration}:color=white`;
      }
    }

    // Texto o Título integrado
    if (seg.textOverlay && seg.textOverlay.text) {
      const escaped = escapeDrawText(seg.textOverlay.text);
      const fs = seg.textOverlay.fontSize || 36;
      const color = seg.textOverlay.textColor || 'white';
      const drawX = `(w-text_w)/2`;
      const drawY = `h-(text_h*2.5)`;
      postFilter += `,drawtext=text='${escaped}':fontsize=${fs}:fontcolor=${color}:x=${drawX}:y=${drawY}:box=1:boxcolor=black@0.6:boxborderw=8`;
    }

    postFilter += `[${formattedTag}]`;
    filterChains.push(postFilter);

    // C. Composición sobre la línea de tiempo mediante overlay
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
    const aFilterTag = `a_flt_${idx}`;
    const aDelayTag = `a_delay_${idx}`;
    const endSource = seg.sourceStartSeconds + seg.durationSeconds;
    const delayMs = Math.round(seg.startInTimelineSeconds * 1000);

    filterChains.push(
      `[${seg.inputIndex}:a]atrim=start=${seg.sourceStartSeconds}:end=${endSource},asetpts=PTS-STARTPTS[${aTrimTag}]`
    );

    let aFilter = `[${aTrimTag}]volume=${seg.volume}`;
    if (seg.gainDb && seg.gainDb !== 0) {
      aFilter += `,volume=${seg.gainDb}dB`;
    }
    if (seg.playbackSpeed !== 1.0) {
      // atempo de FFmpeg soporta rangos entre 0.5 y 2.0; encadenar si excede
      let sp = seg.playbackSpeed;
      while (sp > 2.0) {
        aFilter += `,atempo=2.0`;
        sp /= 2.0;
      }
      while (sp < 0.5) {
        aFilter += `,atempo=0.5`;
        sp /= 0.5;
      }
      aFilter += `,atempo=${sp.toFixed(3)}`;
    }
    if (seg.isReversed) {
      aFilter += `,areverse`;
    }
    if (seg.audioFadeIn && seg.audioFadeIn > 0) {
      aFilter += `,afade=t=in:st=0:d=${seg.audioFadeIn}`;
    }
    if (seg.audioFadeOut && seg.audioFadeOut > 0) {
      const outStart = Math.max(0, seg.durationSeconds - seg.audioFadeOut);
      aFilter += `,afade=t=out:st=${outStart}:d=${seg.audioFadeOut}`;
    }
    if (seg.isNormalized) {
      aFilter += `,loudnorm`;
    }

    aFilter += `[${aFilterTag}]`;
    filterChains.push(aFilter);

    filterChains.push(
      `[${aFilterTag}]adelay=${delayMs}|${delayMs}[${aDelayTag}]`
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
  let vcodec = 'libx264';
  if (settings.videoCodec === 'hevc') vcodec = 'libx265';
  else if (settings.videoCodec === 'vp9') vcodec = 'libvpx-vp9';
  else if (settings.videoCodec === 'prores') vcodec = 'prores_ks';

  let acodec = 'aac';
  if (settings.audioCodec === 'mp3') acodec = 'libmp3lame';
  else if (settings.audioCodec === 'opus') acodec = 'libopus';
  else if (settings.audioCodec === 'pcm') acodec = 'pcm_s16le';

  ffmpegArgs.push('-c:v', vcodec);

  if (settings.videoCodec === 'prores') {
    ffmpegArgs.push('-profile:v', '3', '-pix_fmt', 'yuv422p10le');
  } else if (settings.customBitrateKbps && settings.customBitrateKbps > 0) {
    ffmpegArgs.push(
      '-b:v', `${settings.customBitrateKbps}k`,
      '-maxrate', `${Math.round(settings.customBitrateKbps * 1.5)}k`,
      '-bufsize', `${Math.round(settings.customBitrateKbps * 2)}k`,
      '-pix_fmt', 'yuv420p'
    );
  } else {
    ffmpegArgs.push(
      '-preset', qualityParams.preset,
      '-crf', qualityParams.crf.toString(),
      '-pix_fmt', 'yuv420p'
    );
  }

  ffmpegArgs.push(
    '-c:a', acodec,
    '-b:a', qualityParams.audioBitrate,
    '-threads', '2',
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
