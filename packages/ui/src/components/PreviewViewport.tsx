import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { 
  useEditorStore, 
  formatTimecode, 
  defaultWebMediaRepository, 
  TimelineClip, 
  MediaAsset,
  ColorAdjustmentEffect,
  ColorGradingEffect,
  GrayscaleEffect,
  SepiaEffect,
  TextOverlayEffect,
  FadeEffect,
  BlurEffect,
  GlowEffect,
  VignetteEffect,
  FilmGrainEffect,
  interpolateClipPropertyAtTime
} from '@kyvora/editor-core';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Maximize2, 
  Minimize2, 
  MonitorPlay, 
  RotateCcw, 
  AlertTriangle, 
  ZoomIn, 
  ZoomOut,
  SlidersHorizontal
} from 'lucide-react';
import { isTauriEnvironment, getAssetSrc } from '../utils/fileDialogs';

export type ViewportScaleMode = 'fit' | 'cover' | 'actual';
export type PreviewQualityMode = 'performance' | 'balanced' | 'high';

export const PreviewViewport: React.FC = () => {
  const { 
    project, 
    currentTimeSeconds, 
    isPlaying, 
    setCurrentTime, 
    togglePlayPause,
    updateProjectSettings
  } = useEditorStore();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timeDisplayRef = useRef<HTMLSpanElement | null>(null);
  const bottomTimeDisplayRef = useRef<HTMLSpanElement | null>(null);
  const frameRequestRef = useRef<number | null>(null);

  // Estados visuales y de escala
  const [scaleMode, setScaleMode] = useState<ViewportScaleMode>('fit');
  const [customZoom, setCustomZoom] = useState<number>(100);
  const qualityMode = (project.settings.previewQuality || 'balanced') as PreviewQualityMode;
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Estados del reproductor multimedia
  const [activeMediaUrl, setActiveMediaUrl] = useState<string | null>(null);
  const [loadedAssetId, setLoadedAssetId] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  // Determinar clip y asset de video activo en el cabezal de reproducción
  let activeVideoClip: TimelineClip | null = null;
  let activeAsset: MediaAsset | null = null;
  for (const track of project.tracks) {
    if (track.type === 'video') {
      const found = track.clips.find(
        c => currentTimeSeconds >= c.startInTimelineSeconds && currentTimeSeconds < (c.startInTimelineSeconds + c.durationSeconds)
      );
      if (found) {
        activeVideoClip = found;
        activeAsset = project.assets.find(a => a.id === found.assetId) || null;
        break;
      }
    }
  }

  // Monitor de Origen: Si no hay clip en la línea de tiempo pero hay un activo seleccionado en la biblioteca
  const selectedAssetId = useEditorStore(state => state.selectedAssetId);
  if (!activeAsset && selectedAssetId) {
    const candidate = project.assets.find(a => a.id === selectedAssetId);
    if (candidate && (candidate.type === 'video' || candidate.type === 'image')) {
      activeAsset = candidate;
    }
  }

  // Cargar el archivo original: streaming nativo en Tauri o IndexedDB en Web
  useEffect(() => {
    let isMounted = true;

    if (!activeAsset) {
      if (activeMediaUrl && activeMediaUrl.startsWith('blob:')) {
        URL.revokeObjectURL(activeMediaUrl);
      }
      setActiveMediaUrl(null);
      setLoadedAssetId(null);
      setVideoError(null);
      setIsVideoLoaded(false);
      return;
    }

    if (activeAsset.id === loadedAssetId) {
      return; // Ya cargado
    }

    setVideoError(null);
    setIsVideoLoaded(false);

    const loadOriginalMedia = async () => {
      try {
        // En entorno Tauri de escritorio: streaming directo desde disco a través del protocolo nativo
        // CERO consumo de memoria RAM y arranque inmediato incluso con archivos 4K pesados
        if (activeAsset!.filePath && isTauriEnvironment()) {
          const streamUrl = getAssetSrc(activeAsset!.filePath);
          if (activeMediaUrl && activeMediaUrl.startsWith('blob:')) {
            URL.revokeObjectURL(activeMediaUrl);
          }
          if (!isMounted) return;
          setActiveMediaUrl(streamUrl);
          setLoadedAssetId(activeAsset!.id);
          setIsVideoLoaded(true);
          return;
        }

        // Fallback en entorno Web: carga desde IndexedDB
        const record = await defaultWebMediaRepository.getMedia(activeAsset!.id);
        if (!isMounted) return;

        if (!record || !record.data) {
          setVideoError(`No se encontró el archivo original para "${activeAsset!.name}" en el almacén local.`);
          return;
        }

        const blob = new Blob([record.data as BlobPart], { type: record.mimeType || 'video/mp4' });
        const newUrl = URL.createObjectURL(blob);

        if (activeMediaUrl && activeMediaUrl.startsWith('blob:')) {
          URL.revokeObjectURL(activeMediaUrl);
        }

        setActiveMediaUrl(newUrl);
        setLoadedAssetId(activeAsset!.id);
      } catch (err) {
        if (!isMounted) return;
        setVideoError(`Error al acceder al medio original: ${(err as Error).message}`);
      }
    };

    loadOriginalMedia();

    return () => {
      isMounted = false;
    };
  }, [activeAsset, loadedAssetId, activeMediaUrl]);

  // Limpieza global de Object URLs al desmontar
  useEffect(() => {
    return () => {
      if (activeMediaUrl && activeMediaUrl.startsWith('blob:')) {
        URL.revokeObjectURL(activeMediaUrl);
      }
      if (frameRequestRef.current) {
        cancelAnimationFrame(frameRequestRef.current);
      }
    };
  }, [activeMediaUrl]);

  // Métricas reales de rendimiento del reproductor
  const [playbackMetrics, setPlaybackMetrics] = useState<{
    presentedFps: number;
    droppedFrames: number;
    totalPresentedFrames: number;
  }>({ presentedFps: 0, droppedFrames: 0, totalPresentedFrames: 0 });

  const metricsRef = useRef({
    lastFrameTime: performance.now(),
    framesCount: 0,
    fpsCalculationTimer: performance.now(),
    presentedFps: 0,
    droppedFrames: 0,
    totalPresentedFrames: 0
  });

  // Sincronización temporal: Mapear el tiempo global del proyecto al tiempo local del clip
  const syncVideoTime = useCallback((targetTimelineSeconds: number) => {
    const video = videoRef.current;
    if (!video || !activeVideoClip) return;

    const clipLocalSeconds = targetTimelineSeconds - activeVideoClip.startInTimelineSeconds + activeVideoClip.sourceStartSeconds;
    const clampedLocalTime = Math.max(0, Math.min(clipLocalSeconds, activeVideoClip.durationSeconds + activeVideoClip.sourceStartSeconds));

    if (Math.abs(video.currentTime - clampedLocalTime) > 0.05) {
      video.currentTime = clampedLocalTime;
    }
  }, [activeVideoClip]);

  // Búsqueda temporal (scrubbing cuando NO se está reproduciendo)
  useEffect(() => {
    if (!isPlaying) {
      syncVideoTime(currentTimeSeconds);
      const formatted = formatTimecode(currentTimeSeconds, project.settings.frameRate);
      if (timeDisplayRef.current) {
        timeDisplayRef.current.textContent = formatted;
      }
      if (bottomTimeDisplayRef.current) {
        bottomTimeDisplayRef.current.textContent = `${formatted} (${currentTimeSeconds.toFixed(2)}s / ${project.durationSeconds.toFixed(1)}s)`;
      }
    }
  }, [currentTimeSeconds, isPlaying, syncVideoTime, project.settings.frameRate, project.durationSeconds]);

  // Manejo de arranque / pausa: sincronizar SOLO al iniciar o pausar, nunca en cada tick
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying && activeVideoClip) {
      // Sincronizar al instante de pulsar play
      const targetTime = useEditorStore.getState().currentTimeSeconds;
      syncVideoTime(targetTime);

      // Aplicar velocidad de reproducción real configurada
      if (activeVideoClip.speed?.playbackSpeed) {
        video.playbackRate = activeVideoClip.speed.playbackSpeed;
      } else {
        video.playbackRate = 1.0;
      }

      video.play().catch((err) => {
        console.warn('Kyvora Video Playback:', err.message);
      });
    } else {
      video.pause();
    }
    // NOTA CLAVE: currentTimeSeconds NO debe ser dependencia aquí para evitar micro-seeks continuos
  }, [isPlaying, activeVideoClip, syncVideoTime]);

  // Bucle de sincronización de reproducción guiado por el reloj del decodificador multimedia
  useEffect(() => {
    if (!isPlaying) {
      if (frameRequestRef.current) {
        const video = videoRef.current;
        if (video && 'cancelVideoFrameCallback' in video && typeof (video as any).cancelVideoFrameCallback === 'function') {
          (video as any).cancelVideoFrameCallback(frameRequestRef.current);
        } else {
          cancelAnimationFrame(frameRequestRef.current);
        }
        frameRequestRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    let isCancelled = false;
    let lastStoreSyncTime = performance.now();
    let accumulatedTime = useEditorStore.getState().currentTimeSeconds;
    let lastAnimTick = performance.now();

    // Función de actualización ejecutada en cada fotograma presentado
    const onFrame = (now: number, metadata?: any) => {
      if (isCancelled) return;

      let currentTimelineSec: number;

      if (video && !video.paused && activeVideoClip) {
        // Fuente de verdad: Reloj del decodificador de video real
        const videoTime = video.currentTime;
        currentTimelineSec = (videoTime - activeVideoClip.sourceStartSeconds) + activeVideoClip.startInTimelineSeconds;

        // Comprobar fin de clip
        if (currentTimelineSec >= (activeVideoClip.startInTimelineSeconds + activeVideoClip.durationSeconds)) {
          video.pause();
        }

        // Medición de rendimiento real con VideoFrameMetadata cuando el navegador lo soporte
        if (metadata) {
          metricsRef.current.framesCount++;
          metricsRef.current.totalPresentedFrames = metadata.presentedFrames || metricsRef.current.framesCount;
          if (typeof (video as any).getVideoPlaybackQuality === 'function') {
            const quality = (video as any).getVideoPlaybackQuality();
            metricsRef.current.droppedFrames = quality.droppedVideoFrames || 0;
          }
        } else {
          metricsRef.current.framesCount++;
        }
      } else {
        // Fallback cuando no hay clip de video activo en el cabezal (ej. imagen o espacio vacío)
        const deltaSec = (now - lastAnimTick) / 1000;
        accumulatedTime += deltaSec;
        currentTimelineSec = accumulatedTime;
      }

      lastAnimTick = now;

      // Calcular FPS efectivos medidos cada 1000ms
      if (now - metricsRef.current.fpsCalculationTimer >= 1000) {
        const elapsedSec = (now - metricsRef.current.fpsCalculationTimer) / 1000;
        const currentFps = Math.round(metricsRef.current.framesCount / elapsedSec);
        metricsRef.current.presentedFps = currentFps;
        metricsRef.current.framesCount = 0;
        metricsRef.current.fpsCalculationTimer = now;

        setPlaybackMetrics({
          presentedFps: currentFps,
          droppedFrames: metricsRef.current.droppedFrames,
          totalPresentedFrames: metricsRef.current.totalPresentedFrames
        });
      }

      if (currentTimelineSec >= project.durationSeconds) {
        setCurrentTime(project.durationSeconds);
        togglePlayPause();
        return;
      }

      // 1. Actualización directa del contador DOM a la tasa nativa del video sin re-renderizar React
      const formattedTc = formatTimecode(currentTimelineSec, project.settings.frameRate);
      if (timeDisplayRef.current) {
        timeDisplayRef.current.textContent = formattedTc;
      }
      if (bottomTimeDisplayRef.current) {
        bottomTimeDisplayRef.current.textContent = `${formattedTc} (${currentTimelineSec.toFixed(2)}s / ${project.durationSeconds.toFixed(1)}s)`;
      }

      // 2. Sincronizar Zustand suavemente (cada ~50ms / ~20fps) para el cabezal de la línea de tiempo
      if (now - lastStoreSyncTime > 50) {
        setCurrentTime(currentTimelineSec);
        lastStoreSyncTime = now;
      }

      // Registrar próximo fotograma mediante requestVideoFrameCallback o rAF
      if (video && 'requestVideoFrameCallback' in video && typeof (video as any).requestVideoFrameCallback === 'function' && !video.paused) {
        frameRequestRef.current = (video as any).requestVideoFrameCallback((frameNow: number, frameMeta: any) => {
          onFrame(frameNow, frameMeta);
        });
      } else {
        frameRequestRef.current = requestAnimationFrame(onFrame);
      }
    };

    // Iniciar bucle
    if (video && 'requestVideoFrameCallback' in video && typeof (video as any).requestVideoFrameCallback === 'function' && !video.paused) {
      frameRequestRef.current = (video as any).requestVideoFrameCallback((frameNow: number, frameMeta: any) => {
        onFrame(frameNow, frameMeta);
      });
    } else {
      frameRequestRef.current = requestAnimationFrame(onFrame);
    }

    return () => {
      isCancelled = true;
      if (frameRequestRef.current) {
        if (video && 'cancelVideoFrameCallback' in video && typeof (video as any).cancelVideoFrameCallback === 'function') {
          (video as any).cancelVideoFrameCallback(frameRequestRef.current);
        } else {
          cancelAnimationFrame(frameRequestRef.current);
        }
        frameRequestRef.current = null;
      }
    };
  }, [isPlaying, activeVideoClip, project.durationSeconds, project.settings.frameRate, setCurrentTime, togglePlayPause]);

  // Event Handlers de HTMLVideoElement
  const handleLoadedMetadata = () => {
    setIsVideoLoaded(true);
    setVideoError(null);
    syncVideoTime(currentTimeSeconds);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && isPlaying && activeVideoClip) {
      const currentClipTime = video.currentTime - activeVideoClip.sourceStartSeconds;
      if (currentClipTime >= activeVideoClip.durationSeconds) {
        video.pause();
      }
    }
  };

  const handleVideoError = () => {
    const video = videoRef.current;
    const mediaErr = video?.error;
    let desc = 'Error al reproducir el archivo de video.';
    if (mediaErr) {
      if (mediaErr.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        desc = `Códec o contenedor no soportado nativamente por el navegador (${activeAsset?.name}). En escritorio, Kyvora exportará correctamente con FFmpeg.`;
      } else if (mediaErr.code === MediaError.MEDIA_ERR_DECODE) {
        desc = `Fallo de decodificación en el archivo (${activeAsset?.name}).`;
      }
    }
    setVideoError(desc);
  };

  // Controles de paso a paso (Frame stepping)
  const handleStepForward = () => {
    const frameDuration = 1 / project.settings.frameRate;
    setCurrentTime(Math.min(project.durationSeconds, currentTimeSeconds + frameDuration));
  };

  const handleStepBackward = () => {
    const frameDuration = 1 / project.settings.frameRate;
    setCurrentTime(Math.max(0, currentTimeSeconds - frameDuration));
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Extraer efectos activos del clip seleccionado
  const activeEffects = useMemo(() => {
    if (!activeVideoClip?.effects) return [];
    return activeVideoClip.effects.filter(e => e.isEnabled);
  }, [activeVideoClip]);

  const textOverlayEffect = useMemo(() => {
    return activeEffects.find(e => e.type === 'textOverlay') as TextOverlayEffect | undefined;
  }, [activeEffects]);

  const vignetteEffect = useMemo(() => {
    return activeEffects.find(e => e.type === 'vignette') as VignetteEffect | undefined;
  }, [activeEffects]);

  const filmGrainEffect = useMemo(() => {
    return activeEffects.find(e => e.type === 'filmGrain') as FilmGrainEffect | undefined;
  }, [activeEffects]);

  // Clips de títulos o texto activos en el cabezal de reproducción
  const activeTitleClips = useMemo(() => {
    const list: TimelineClip[] = [];
    for (const track of project.tracks) {
      if (track.isMuted) continue;
      for (const clip of track.clips) {
        if (
          currentTimeSeconds >= clip.startInTimelineSeconds &&
          currentTimeSeconds < clip.startInTimelineSeconds + clip.durationSeconds &&
          (clip.titleProperties || clip.effects.some(e => e.type === 'textOverlay'))
        ) {
          list.push(clip);
        }
      }
    }
    return list;
  }, [project.tracks, currentTimeSeconds]);

  // Cálculo de tiempo relativo dentro del clip actual
  const clipRelativeSeconds = activeVideoClip
    ? Math.max(0, currentTimeSeconds - activeVideoClip.startInTimelineSeconds)
    : 0;

  // Cálculo de opacidad y transiciones dinámicas (In / Out / Fade / Keyframes)
  const fadeOpacity = useMemo(() => {
    if (!activeVideoClip) return 1;

    // 1. Keyframes de opacidad si existen
    const keyframedOpacity = interpolateClipPropertyAtTime(activeVideoClip, 'opacity', clipRelativeSeconds);
    const baseOpacity = keyframedOpacity !== null ? keyframedOpacity : (activeVideoClip.transform?.opacity ?? 1);

    let factor = 1;

    // 2. Transiciones de entrada y salida
    if (activeVideoClip.transitions && activeVideoClip.transitions.length > 0) {
      const timeSinceStart = clipRelativeSeconds;
      const timeUntilEnd = activeVideoClip.durationSeconds - clipRelativeSeconds;

      for (const tr of activeVideoClip.transitions) {
        if (tr.position === 'start' && timeSinceStart < tr.durationSeconds && tr.durationSeconds > 0) {
          const tProgress = Math.max(0, Math.min(1, timeSinceStart / tr.durationSeconds));
          if (tr.type === 'fade' || tr.type === 'crossDissolve') {
            factor *= tProgress;
          }
        }
        if (tr.position === 'end' && timeUntilEnd < tr.durationSeconds && tr.durationSeconds > 0) {
          const tProgress = Math.max(0, Math.min(1, timeUntilEnd / tr.durationSeconds));
          if (tr.type === 'fade' || tr.type === 'crossDissolve') {
            factor *= tProgress;
          }
        }
      }
    }

    // 3. Efecto Fade complementario
    const fade = activeEffects.find(e => e.type === 'fade') as FadeEffect | undefined;
    if (fade) {
      const timeSinceStart = clipRelativeSeconds;
      const timeUntilEnd = activeVideoClip.durationSeconds - clipRelativeSeconds;

      if (fade.fadeInDurationSeconds > 0 && timeSinceStart < fade.fadeInDurationSeconds) {
        factor *= Math.max(0, timeSinceStart / fade.fadeInDurationSeconds);
      }
      if (fade.fadeOutDurationSeconds > 0 && timeUntilEnd < fade.fadeOutDurationSeconds) {
        factor *= Math.min(1, Math.max(0, timeUntilEnd / fade.fadeOutDurationSeconds));
      }
    }

    return Math.max(0, Math.min(1, baseOpacity * factor));
  }, [activeVideoClip, activeEffects, clipRelativeSeconds]);

  // Construcción dinámica de filtros CSS para la vista previa
  const computedFilterString = useMemo(() => {
    const filters: string[] = [];

    // Ajuste de Calidad de Previsualización:
    // 'performance' => reduce filtros pesados
    // 'balanced' => renderiza filtros estándar
    // 'high' => máxima fidelidad
    for (const eff of activeEffects) {
      if (eff.type === 'colorAdjustment') {
        const c = eff as ColorAdjustmentEffect;
        filters.push(`brightness(${100 + c.brightness * 100}%)`);
        filters.push(`contrast(${c.contrast * 100}%)`);
        filters.push(`saturate(${c.saturation * 100}%)`);
      } else if (eff.type === 'colorGrading') {
        const cg = eff as ColorGradingEffect;
        filters.push(`brightness(${100 + (cg.brightness ?? 0) * 100}%)`);
        filters.push(`contrast(${(cg.contrast ?? 1) * 100}%)`);
        filters.push(`saturate(${(cg.saturation ?? 1) * 100}%)`);
        if (cg.temperature) {
          filters.push(`sepia(${Math.min(100, Math.abs(cg.temperature) * 60)}%)`);
          filters.push(`hue-rotate(${cg.temperature > 0 ? 15 * cg.temperature : -25 * Math.abs(cg.temperature)}deg)`);
        }
      } else if (eff.type === 'grayscale') {
        const g = eff as GrayscaleEffect;
        filters.push(`grayscale(${g.amount * 100}%)`);
      } else if (eff.type === 'sepia') {
        const s = eff as SepiaEffect;
        filters.push(`sepia(${s.amount * 100}%)`);
      } else if (eff.type === 'blur') {
        const b = eff as BlurEffect;
        if (qualityMode !== 'performance') {
          filters.push(`blur(${b.radius ?? 0}px)`);
        }
      } else if (eff.type === 'glow') {
        const gl = eff as GlowEffect;
        filters.push(`drop-shadow(0 0 ${gl.radius ?? 8}px ${gl.color ?? '#0066FF'})`);
      } else if (eff.type === 'sharpen') {
        const sh = eff as any;
        filters.push(`contrast(${100 + (sh.amount ?? 1) * 25}%)`);
      }
    }

    return filters.length > 0 ? filters.join(' ') : 'none';
  }, [activeEffects, qualityMode]);

  // Cálculo de dimensiones de renderizado según scaleMode, animaciones y transform del clip
  const getVideoTransformStyle = (): React.CSSProperties => {
    // Interpolar propiedades si existen keyframes
    const animScaleX = activeVideoClip
      ? (interpolateClipPropertyAtTime(activeVideoClip, 'scaleX', clipRelativeSeconds) ?? activeVideoClip.transform?.scaleX ?? 1)
      : 1;
    const animScaleY = activeVideoClip
      ? (interpolateClipPropertyAtTime(activeVideoClip, 'scaleY', clipRelativeSeconds) ?? activeVideoClip.transform?.scaleY ?? 1)
      : 1;
    const animPosX = activeVideoClip
      ? (interpolateClipPropertyAtTime(activeVideoClip, 'positionX', clipRelativeSeconds) ?? activeVideoClip.transform?.positionX ?? 0)
      : 0;
    const animPosY = activeVideoClip
      ? (interpolateClipPropertyAtTime(activeVideoClip, 'positionY', clipRelativeSeconds) ?? activeVideoClip.transform?.positionY ?? 0)
      : 0;
    const animRot = activeVideoClip
      ? (interpolateClipPropertyAtTime(activeVideoClip, 'rotationDegrees', clipRelativeSeconds) ?? activeVideoClip.transform?.rotationDegrees ?? 0)
      : 0;

    const zoomFactor = (customZoom / 100) * animScaleX;

    let baseFit: React.CSSProperties['objectFit'] = 'contain';
    let baseWidth = '100%';
    let baseHeight = '100%';

    if (scaleMode === 'actual') {
      baseWidth = activeAsset?.width ? `${activeAsset.width * (customZoom / 100)}px` : 'auto';
      baseHeight = activeAsset?.height ? `${activeAsset.height * (customZoom / 100)}px` : 'auto';
    } else if (scaleMode === 'cover') {
      baseFit = 'cover';
    }

    return {
      width: baseWidth,
      height: baseHeight,
      maxWidth: scaleMode === 'actual' ? 'none' : '100%',
      maxHeight: scaleMode === 'actual' ? 'none' : '100%',
      objectFit: baseFit,
      opacity: fadeOpacity,
      filter: computedFilterString,
      transform: `scale(${zoomFactor}, ${(customZoom / 100) * animScaleY}) translate(${animPosX}px, ${animPosY}px) rotate(${animRot}deg)`,
      imageRendering: qualityMode === 'performance' ? 'pixelated' : 'auto'
    };
  };

  return (
    <div 
      ref={containerRef}
      className="flex-1 bg-slate-950 flex flex-col items-center justify-between p-3 select-none relative overflow-hidden"
    >
      {/* Top Viewport Toolbar */}
      <div className="w-full flex items-center justify-between text-[11px] text-slate-400 pb-2 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <MonitorPlay className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-slate-300">Monitor de Vista Previa</span>
          <span className="text-[10px] bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-mono">
            {project.settings.width} × {project.settings.height} ({project.settings.frameRate} fps)
          </span>
          {activeVideoClip && (
            <span className="text-[10px] bg-blue-950/80 border border-blue-800/60 px-1.5 py-0.5 rounded text-blue-300 font-medium truncate max-w-xs">
              Fuente: {activeVideoClip.name}
            </span>
          )}
          {isPlaying && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
              playbackMetrics.droppedFrames > 0 
                ? 'bg-amber-950/70 border-amber-800/60 text-amber-300' 
                : 'bg-emerald-950/70 border-emerald-800/60 text-emerald-300'
            }`} title={`FPS medidos: ${playbackMetrics.presentedFps} | Frames perdidos: ${playbackMetrics.droppedFrames}`}>
              {playbackMetrics.presentedFps} fps {playbackMetrics.droppedFrames > 0 ? `(-${playbackMetrics.droppedFrames} drop)` : ''}
            </span>
          )}
        </div>

        {/* Display Mode, Quality & Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Calidad de Vista Previa */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5 text-[10px]">
            <SlidersHorizontal className="w-3 h-3 text-slate-500 ml-1 mr-0.5" />
            <select
              value={qualityMode}
              onChange={(e) => updateProjectSettings({ previewQuality: e.target.value as PreviewQualityMode })}
              className="bg-transparent text-slate-300 px-1 py-0.5 text-[10px] focus:outline-none cursor-pointer"
              title="Calidad de previsualización en tiempo real"
            >
              <option value="performance" className="bg-slate-900">Rendimiento</option>
              <option value="balanced" className="bg-slate-900">Equilibrada</option>
              <option value="high" className="bg-slate-900">Alta Calidad</option>
            </select>
          </div>

          {/* Selector de Modo de Escala */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => { setScaleMode('fit'); setCustomZoom(100); }}
              title="Ajustar al área disponible manteniendo aspecto"
              className={`px-2 py-0.5 rounded transition-colors ${
                scaleMode === 'fit' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ajustar
            </button>
            <button
              type="button"
              onClick={() => { setScaleMode('cover'); setCustomZoom(100); }}
              title="Encajar rellenando el monitor"
              className={`px-2 py-0.5 rounded transition-colors ${
                scaleMode === 'cover' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Encajar
            </button>
            <button
              type="button"
              onClick={() => { setScaleMode('actual'); setCustomZoom(100); }}
              title="Mostrar al 100% de escala nativa"
              className={`px-2 py-0.5 rounded transition-colors ${
                scaleMode === 'actual' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              100%
            </button>
          </div>

          {/* Controles de Zoom */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5">
            <button
              type="button"
              onClick={() => setCustomZoom(prev => Math.max(25, prev - 25))}
              title="Reducir zoom"
              className="p-1 text-slate-400 hover:text-white"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="font-mono text-[10px] text-slate-300 px-1 min-w-9 text-center">
              {customZoom}%
            </span>
            <button
              type="button"
              onClick={() => setCustomZoom(prev => Math.min(300, prev + 25))}
              title="Aumentar zoom"
              className="p-1 text-slate-400 hover:text-white"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            {customZoom !== 100 && (
              <button
                type="button"
                onClick={() => setCustomZoom(100)}
                title="Restablecer zoom a 100%"
                className="p-1 text-blue-400 hover:text-blue-300"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="h-4 w-[1px] bg-slate-800" />

          {/* Timecode actual */}
          <span 
            ref={timeDisplayRef}
            className="font-mono text-xs text-blue-400 font-medium"
          >
            {formatTimecode(currentTimeSeconds, project.settings.frameRate)}
          </span>

          {/* Botón Pantalla Completa */}
          <button 
            type="button" 
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Frame Principal del Monitor con Proporción Adaptable al Proyecto */}
      <div className="w-full flex-1 flex items-center justify-center min-h-0 relative p-2 overflow-hidden">
        <div 
          className="w-full h-full max-w-full max-h-full bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center shadow-2xl relative overflow-hidden"
          style={{ aspectRatio: `${project.settings.width} / ${project.settings.height}` }}
        >
          {/* Patrón de Rejilla de Fondo Profesional */}
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#334155_1px,transparent_1px),linear-gradient(to_bottom,#334155_1px,transparent_1px)] bg-[size:32px_32px]" />

          {/* REPRODUCTOR REAL HTML5 VIDEO */}
          {activeMediaUrl && activeAsset?.type === 'video' && (
            <video
              ref={videoRef}
              src={activeMediaUrl}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onSeeking={() => setIsSeeking(true)}
              onSeeked={() => setIsSeeking(false)}
              onError={handleVideoError}
              playsInline
              preload="auto"
              className="transition-transform duration-75 select-none"
              style={getVideoTransformStyle()}
            />
          )}

          {/* VISUALIZADOR PARA IMÁGENES ORIGINALES */}
          {activeMediaUrl && activeAsset?.type === 'image' && (
            <img 
              src={activeMediaUrl} 
              alt={activeAsset.name} 
              className="transition-transform duration-75 select-none"
              style={getVideoTransformStyle()}
            />
          )}

          {/* EFECTO VIGNETTE OVERLAY */}
          {vignetteEffect && (
            <div 
              className="absolute inset-0 pointer-events-none z-10"
              style={{
                background: `radial-gradient(circle, transparent ${Math.max(10, 100 - (vignetteEffect.radius || 0.5) * 80)}%, rgba(0,0,0,${Math.min(1, (vignetteEffect.intensity || 0.5) * 1.5)}) 100%)`
              }}
            />
          )}

          {/* EFECTO FILM GRAIN OVERLAY */}
          {filmGrainEffect && (
            <div 
              className="absolute inset-0 pointer-events-none z-10 opacity-25 mix-blend-overlay"
              style={{
                backgroundImage: `radial-gradient(rgba(255,255,255,${filmGrainEffect.intensity * 0.4}) 1px, transparent 0)`,
                backgroundSize: '4px 4px'
              }}
            />
          )}

          {/* RENDERIZADO DE TÍTULOS Y PLANTILLAS DE TEXTO PROFESIONALES */}
          {activeTitleClips.map(clip => {
            if (!clip.titleProperties) return null;
            const tp = clip.titleProperties;
            const tRel = currentTimeSeconds - clip.startInTimelineSeconds;
            let opacity = 1;
            if (tp.animationIn === 'fade' && tRel < 0.5) {
              opacity = tRel / 0.5;
            }
            if (tp.animationOut === 'fade' && (clip.durationSeconds - tRel) < 0.5) {
              opacity = Math.max(0, (clip.durationSeconds - tRel) / 0.5);
            }

            if (tp.template === 'lowerThird') {
              return (
                <div 
                  key={clip.id}
                  className="absolute bottom-8 left-8 z-20 pointer-events-none transition-all"
                  style={{ opacity }}
                >
                  <div className="bg-gradient-to-r from-blue-900/95 to-slate-900/85 border-l-4 border-blue-500 px-4 py-2 rounded-r shadow-2xl backdrop-blur-xs">
                    <p 
                      className="font-bold leading-tight" 
                      style={{ 
                        fontFamily: tp.fontFamily || 'sans-serif', 
                        fontSize: `${tp.fontSize || 24}px`, 
                        color: tp.textColor || '#ffffff' 
                      }}
                    >
                      {tp.text}
                    </p>
                  </div>
                </div>
              );
            }

            if (tp.template === 'cinematic') {
              return (
                <div 
                  key={clip.id}
                  className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none transition-all px-12 text-center"
                  style={{ opacity }}
                >
                  <p 
                    className="font-light tracking-[0.25em] uppercase drop-shadow-2xl" 
                    style={{ 
                      fontFamily: tp.fontFamily || 'serif', 
                      fontSize: `${tp.fontSize || 36}px`, 
                      color: tp.textColor || '#f8fafc',
                      textShadow: '0 4px 20px rgba(0,0,0,0.8)'
                    }}
                  >
                    {tp.text}
                  </p>
                </div>
              );
            }

            if (tp.template === 'cyberpunk') {
              return (
                <div 
                  key={clip.id}
                  className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none transition-all px-8 text-center"
                  style={{ opacity }}
                >
                  <div className="border border-cyan-400 bg-black/85 px-6 py-3 shadow-[0_0_20px_rgba(6,182,212,0.6)]">
                    <p 
                      className="font-black tracking-widest uppercase font-mono text-cyan-400" 
                      style={{ 
                        fontSize: `${tp.fontSize || 32}px`, 
                        color: tp.textColor || '#22d3ee',
                        textShadow: '0 0 10px rgba(34,211,238,0.8)' 
                      }}
                    >
                      {tp.text}
                    </p>
                  </div>
                </div>
              );
            }

            if (tp.template === 'subtitle') {
              return (
                <div 
                  key={clip.id}
                  className="absolute bottom-6 inset-x-0 flex justify-center z-20 pointer-events-none transition-all px-8 text-center"
                  style={{ opacity }}
                >
                  <span 
                    className="bg-black/80 text-white px-4 py-1.5 rounded-full text-sm font-medium shadow-lg max-w-2xl"
                    style={{ 
                      fontFamily: tp.fontFamily || 'sans-serif', 
                      fontSize: `${tp.fontSize || 18}px`, 
                      color: tp.textColor || '#ffffff' 
                    }}
                  >
                    {tp.text}
                  </span>
                </div>
              );
            }

            // Custom o BoldIntro
            return (
              <div 
                key={clip.id}
                className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none transition-all px-8 text-center"
                style={{ opacity }}
              >
                <p 
                  className="font-extrabold drop-shadow-2xl" 
                  style={{ 
                    fontFamily: tp.fontFamily || 'sans-serif', 
                    fontSize: `${tp.fontSize || 42}px`, 
                    color: tp.textColor || '#ffffff',
                    backgroundColor: tp.backgroundColor || 'transparent',
                    textShadow: '0 4px 15px rgba(0,0,0,0.9)'
                  }}
                >
                  {tp.text}
                </p>
              </div>
            );
          })}

          {/* TEXTO SUPERPUESTO (EFECTO TEXTOVERLAY) */}
          {textOverlayEffect && textOverlayEffect.text && (
            <div 
              className="absolute pointer-events-none drop-shadow-md select-none font-bold z-20"
              style={{
                left: `${textOverlayEffect.positionX || 50}%`,
                top: `${textOverlayEffect.positionY || 50}%`,
                transform: 'translate(-50%, -50%)',
                fontSize: `${textOverlayEffect.fontSize || 32}px`,
                color: textOverlayEffect.color || '#ffffff',
                fontFamily: textOverlayEffect.fontFamily || 'sans-serif'
              }}
            >
              {textOverlayEffect.text}
            </div>
          )}

          {/* INDICADOR DE ERROR DE CÓDEC / RECURSO */}
          {videoError && (
            <div className="absolute inset-x-4 top-4 z-20 p-3 bg-red-950/80 border border-red-800/80 rounded-lg text-red-200 text-xs flex items-start gap-2 shadow-lg backdrop-blur-xs">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Aviso de Compatibilidad</p>
                <p className="text-[11px] text-red-300 mt-0.5">{videoError}</p>
              </div>
            </div>
          )}

          {/* PANTALLA DE ESPERA / SIN CLIP ACTIVO NI MEDIO SELECCIONADO */}
          {!activeVideoClip && !activeAsset && (
            <div className="z-10 text-center p-6 space-y-2 pointer-events-none">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 mx-auto flex items-center justify-center text-blue-400">
                <MonitorPlay className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">
                Monitor de Vista Previa
              </h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Importa un archivo de video o selecciónalo en la biblioteca para comenzar a editarlo.
              </p>
            </div>
          )}

          {/* OVERLAY DE INFORMACIÓN EN REPRODUCCIÓN */}
          <div className="absolute bottom-2 left-3 z-10 font-mono text-[11px] text-slate-300 bg-black/70 px-2 py-0.5 rounded border border-slate-800/80 flex items-center gap-2">
            <span ref={bottomTimeDisplayRef}>
              {formatTimecode(currentTimeSeconds, project.settings.frameRate)} ({currentTimeSeconds.toFixed(2)}s / {project.durationSeconds.toFixed(1)}s)
            </span>
            {isSeeking && <span className="text-blue-400 text-[10px] animate-pulse">Buscando...</span>}
            {activeVideoClip && isVideoLoaded && (
              <span className="text-[10px] text-slate-400">
                • {activeAsset?.width}x{activeAsset?.height} • Efectos: {activeEffects.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Controles de Transporte de Reproducción */}
      <div className="w-full pt-2 flex items-center justify-center gap-4">
        {/* Reiniciar / Ir al inicio */}
        <button
          type="button"
          onClick={() => {
            setCurrentTime(0);
            if (videoRef.current) videoRef.current.currentTime = 0;
          }}
          title="Reiniciar reproducción (Ir al inicio: 00:00:00)"
          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        {/* Fotograma anterior */}
        <button
          type="button"
          onClick={handleStepBackward}
          title="Fotograma anterior (-1f)"
          className="text-xs font-mono px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
        >
          -1f
        </button>

        {/* Botón Principal Play / Pausa */}
        <button
          type="button"
          onClick={togglePlayPause}
          title={isPlaying ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}
          className="p-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all transform active:scale-95"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>

        {/* Fotograma siguiente */}
        <button
          type="button"
          onClick={handleStepForward}
          title="Fotograma siguiente (+1f)"
          className="text-xs font-mono px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
        >
          +1f
        </button>

        {/* Ir al final */}
        <button
          type="button"
          onClick={() => {
            setCurrentTime(project.durationSeconds);
            if (isPlaying) togglePlayPause();
          }}
          title="Ir al final de la línea de tiempo"
          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
