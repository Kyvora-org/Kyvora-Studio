import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  useEditorStore, 
  formatDuration, 
  findSnapTime 
} from '@kyvora/editor-core';
import { 
  ZoomIn, 
  ZoomOut, 
  Volume2, 
  VolumeX, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  Plus, 
  Scissors, 
  Magnet, 
  Trash2, 
  Copy, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  Music, 
  Video, 
  Unlink 
} from 'lucide-react';

export const Timeline: React.FC = () => {
  const { 
    project, 
    currentTimeSeconds, 
    zoomLevel, 
    selectedClipId, 
    isSnappingEnabled,
    setCurrentTime, 
    setZoomLevel, 
    selectClip, 
    addClipToTrack,
    addTrack,
    removeTrack,
    toggleTrackVisibility,
    toggleTrackLock,
    toggleTrackMute,
    splitClipAtPlayhead,
    trimClip,
    duplicateClip,
    moveClip,
    removeClip,
    toggleSnapping,
    separateAudioFromVideo
  } = useEditorStore();

  const timelineTrackAreaRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    clipId: string;
  } | null>(null);

  // Estados locales para arrastre interactivo con previsualización
  const [activeDrag, setActiveDrag] = useState<{
    clipId: string;
    originalTrackId: string;
    targetTrackId: string;
    originalStart: number;
    previewStart: number;
    initialMouseX: number;
    initialMouseY: number;
    hasMovedPastThreshold: boolean;
  } | null>(null);

  // Estados locales para recorte interactivo con previsualización
  const [activeTrim, setActiveTrim] = useState<{
    clipId: string;
    edge: 'start' | 'end';
    initialPosition: number;
    previewPosition: number;
    initialMouseX: number;
    hasMovedPastThreshold: boolean;
  } | null>(null);

  // Suscripción de alta frecuencia para mover el cabezal directamente en el DOM
  useEffect(() => {
    if (playheadRef.current) {
      playheadRef.current.style.transform = `translateX(${currentTimeSeconds * zoomLevel}px)`;
    }

    const unsub = useEditorStore.subscribe((state) => {
      if (playheadRef.current) {
        playheadRef.current.style.transform = `translateX(${state.currentTimeSeconds * state.zoomLevel}px)`;
      }
    });

    return () => unsub();
  }, [zoomLevel, currentTimeSeconds]);

  // Recopilar puntos de magnetismo
  const getSnapPoints = useCallback((excludeClipId?: string): number[] => {
    const points = [0, useEditorStore.getState().currentTimeSeconds];
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        if (clip.id === excludeClipId) continue;
        points.push(clip.startInTimelineSeconds);
        points.push(clip.startInTimelineSeconds + clip.durationSeconds);
      }
    }
    return points;
  }, [project.tracks]);

  // Clic en la regla o carriles para reposicionar el cabezal
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeDrag?.hasMovedPastThreshold || activeTrim?.hasMovedPastThreshold) return;
    if (!timelineTrackAreaRef.current) return;
    const rect = timelineTrackAreaRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + timelineTrackAreaRef.current.scrollLeft;
    const clickedSeconds = Math.max(0, clickX / zoomLevel);

    if (isSnappingEnabled) {
      const snapResult = findSnapTime(clickedSeconds, getSnapPoints());
      setCurrentTime(snapResult.snappedTime);
    } else {
      setCurrentTime(clickedSeconds);
    }
    setContextMenu(null);
  };

  const handleZoomIn = () => setZoomLevel(Math.min(120, zoomLevel + 10));
  const handleZoomOut = () => setZoomLevel(Math.max(10, zoomLevel - 10));
  const handleResetZoom = () => setZoomLevel(25);

  // Salto de fotogramas preciso
  const frameRate = project.settings?.frameRate || 30;
  const frameTime = 1 / frameRate;
  const handleStepFrames = (deltaFrames: number) => {
    setCurrentTime(Math.max(0, Math.min(project.durationSeconds, currentTimeSeconds + deltaFrames * frameTime)));
  };

  const totalWidth = Math.max(project.durationSeconds * zoomLevel + 400, 1800);

  // Marcadores de regla de tiempo proporcionales al zoom
  const stepSeconds = zoomLevel >= 80 ? 0.5 : zoomLevel >= 40 ? 1 : zoomLevel >= 20 ? 2 : zoomLevel >= 10 ? 5 : 10;
  const markerCount = Math.ceil(project.durationSeconds / stepSeconds) + 5;
  const markers = Array.from({ length: markerCount }, (_, i) => i * stepSeconds);

  // Handlers globales para mover clip o recortar
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (activeDrag) {
        const deltaX = e.clientX - activeDrag.initialMouseX;
        const deltaY = Math.abs(e.clientY - activeDrag.initialMouseY);
        const distance = Math.hypot(deltaX, deltaY);

        const hasMovedPastThreshold = activeDrag.hasMovedPastThreshold || distance > 4;
        const deltaSeconds = deltaX / zoomLevel;
        let newStart = Math.max(0, activeDrag.originalStart + deltaSeconds);

        if (isSnappingEnabled) {
          const snap = findSnapTime(newStart, getSnapPoints(activeDrag.clipId), 0.15);
          newStart = snap.snappedTime;
        }

        let targetTrackId = activeDrag.originalTrackId;
        if (timelineTrackAreaRef.current) {
          const trackLanes = timelineTrackAreaRef.current.querySelectorAll('.track-lane');
          const sourceTrack = project.tracks.find(t => t.id === activeDrag.originalTrackId);

          trackLanes.forEach((lane, idx) => {
            const laneRect = lane.getBoundingClientRect();
            if (e.clientY >= laneRect.top && e.clientY <= laneRect.bottom) {
              const candidateTrack = project.tracks[idx];
              if (candidateTrack && (!sourceTrack || candidateTrack.type === sourceTrack.type)) {
                targetTrackId = candidateTrack.id;
              }
            }
          });
        }

        setActiveDrag(prev => prev ? {
          ...prev,
          previewStart: newStart,
          targetTrackId,
          hasMovedPastThreshold
        } : null);
      } else if (activeTrim) {
        const deltaX = e.clientX - activeTrim.initialMouseX;
        const hasMovedPastThreshold = activeTrim.hasMovedPastThreshold || Math.abs(deltaX) > 4;
        const deltaSeconds = deltaX / zoomLevel;
        let targetPos = Math.max(0, activeTrim.initialPosition + deltaSeconds);

        if (isSnappingEnabled) {
          const snap = findSnapTime(targetPos, getSnapPoints(activeTrim.clipId), 0.15);
          targetPos = snap.snappedTime;
        }

        setActiveTrim(prev => prev ? {
          ...prev,
          previewPosition: targetPos,
          hasMovedPastThreshold
        } : null);
      }
    };

    const handleMouseUp = () => {
      if (activeDrag) {
        if (activeDrag.hasMovedPastThreshold) {
          moveClip(activeDrag.clipId, activeDrag.targetTrackId, activeDrag.previewStart);
        }
        setActiveDrag(null);
      }

      if (activeTrim) {
        if (activeTrim.hasMovedPastThreshold) {
          trimClip(activeTrim.clipId, activeTrim.edge, activeTrim.previewPosition);
        }
        setActiveTrim(null);
      }
    };

    if (activeDrag || activeTrim) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeDrag, activeTrim, zoomLevel, isSnappingEnabled, project.tracks, moveClip, trimClip, getSnapPoints]);

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipId) {
        e.preventDefault();
        removeClip(selectedClipId);
      } else if (e.key === 's' || e.key === 'S' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        splitClipAtPlayhead();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D') && selectedClipId) {
        e.preventDefault();
        duplicateClip(selectedClipId);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleStepFrames(e.shiftKey ? -10 : -1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleStepFrames(e.shiftKey ? 10 : 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, removeClip, splitClipAtPlayhead, duplicateClip, currentTimeSeconds]);

  // Clip seleccionado
  let activeSelectedClip = null;
  if (selectedClipId) {
    for (const t of project.tracks) {
      const found = t.clips.find(c => c.id === selectedClipId);
      if (found) {
        activeSelectedClip = found;
        break;
      }
    }
  }

  return (
    <div className="h-72 shrink-0 bg-[#070A0F] border-t border-slate-800 flex flex-col select-none relative">
      {/* Timeline Control Toolbar */}
      <div className="h-10 bg-[#0B0F17] border-b border-slate-800 px-3 flex items-center justify-between text-xs text-slate-300 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Herramientas Principales */}
          <button
            type="button"
            title="Dividir clip en el cabezal de reproducción (Atajo: S o C)"
            onClick={() => splitClipAtPlayhead()}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors border border-slate-700 shadow-xs"
          >
            <Scissors className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] font-medium">Dividir (S)</span>
          </button>

          <button
            type="button"
            disabled={!selectedClipId}
            title="Duplicar clip seleccionado (Atajo: Ctrl+D)"
            onClick={() => selectedClipId && duplicateClip(selectedClipId)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 transition-colors border border-slate-700 shadow-xs"
          >
            <Copy className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-medium">Duplicar</span>
          </button>

          {activeSelectedClip && (
            <button
              type="button"
              title="Separar canal de audio del clip de vídeo"
              onClick={() => separateAudioFromVideo(activeSelectedClip.id)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700 shadow-xs"
            >
              <Unlink className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-medium">Separar Audio</span>
            </button>
          )}

          <button
            type="button"
            disabled={!selectedClipId}
            title="Eliminar clip seleccionado (Atajo: Supr / Delete)"
            onClick={() => selectedClipId && removeClip(selectedClipId)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-red-950/60 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 transition-colors border border-slate-700 shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[11px]">Eliminar</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-800 mx-1" />

          {/* Ajuste Magnético */}
          <button
            type="button"
            onClick={toggleSnapping}
            title={isSnappingEnabled ? "Ajuste magnético ACTIVO" : "Ajuste magnético INACTIVO"}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] transition-colors ${
              isSnappingEnabled 
                ? 'bg-blue-950/70 border-blue-500 text-blue-300 font-semibold' 
                : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Magnet className="w-3.5 h-3.5" />
            <span>Imán {isSnappingEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-800 mx-1" />

          {/* Navegación Precisa por Fotogramas */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => handleStepFrames(-10)}
              title="-10 Fotogramas (Shift + Flecha Izquierda)"
              className="px-1 hover:text-blue-400 font-mono"
            >
              -10f
            </button>
            <button
              type="button"
              onClick={() => handleStepFrames(-1)}
              title="-1 Fotograma (Flecha Izquierda)"
              className="px-1 hover:text-blue-400 font-mono"
            >
              -1f
            </button>
            <span className="text-slate-600">|</span>
            <button
              type="button"
              onClick={() => handleStepFrames(1)}
              title="+1 Fotograma (Flecha Derecha)"
              className="px-1 hover:text-blue-400 font-mono"
            >
              +1f
            </button>
            <button
              type="button"
              onClick={() => handleStepFrames(10)}
              title="+10 Fotogramas (Shift + Flecha Derecha)"
              className="px-1 hover:text-blue-400 font-mono"
            >
              +10f
            </button>
          </div>

          <div className="h-4 w-[1px] bg-slate-800 mx-1" />

          {/* Agregar Pistas */}
          <button
            type="button"
            onClick={() => addTrack({ name: `Video ${project.tracks.filter(t => t.type === 'video').length + 1}`, type: 'video', isMuted: false, isLocked: false, isVisible: true })}
            title="Agregar Pista de Video"
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
          >
            <Plus className="w-3 h-3 text-blue-400" />
            <span>+ Video</span>
          </button>

          <button
            type="button"
            onClick={() => addTrack({ name: `Audio ${project.tracks.filter(t => t.type === 'audio').length + 1}`, type: 'audio', isMuted: false, isLocked: false, isVisible: true })}
            title="Agregar Pista de Audio"
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
          >
            <Plus className="w-3 h-3 text-emerald-400" />
            <span>+ Audio</span>
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button 
            type="button" 
            onClick={handleZoomOut} 
            title="Reducir zoom horizontal (-10 px/s)"
            className="p-1 rounded hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          
          <button
            type="button"
            onClick={handleResetZoom}
            title="Restablecer zoom a 25 px/s"
            className="text-[10px] font-mono text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-950 border border-slate-800 transition-colors flex items-center gap-1"
          >
            <span>{zoomLevel} px/s</span>
            {zoomLevel !== 25 && <RotateCcw className="w-2.5 h-2.5 text-blue-400" />}
          </button>

          <button 
            type="button" 
            onClick={handleZoomIn} 
            title="Aumentar zoom horizontal (+10 px/s)"
            className="p-1 rounded hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track Headers (Left sidebar) */}
        <div className="w-52 bg-[#0B0F17] border-r border-slate-800 flex flex-col shrink-0">
          <div className="h-7 border-b border-slate-800 bg-slate-950/60 px-3 flex items-center justify-between text-[10px] text-slate-400 font-medium">
            <span>Pistas ({project.tracks.length})</span>
            <span className="text-[9px] text-slate-500 font-mono">{frameRate} fps</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {project.tracks.map((track) => {
              const isTargetTrack = activeDrag?.targetTrackId === track.id;
              return (
                <div 
                  key={track.id} 
                  className={`h-16 px-3 flex items-center justify-between text-xs transition-colors group ${
                    isTargetTrack ? 'bg-blue-950/50 border-l-2 border-blue-400' : 'bg-slate-900/40 hover:bg-slate-900/70'
                  }`}
                >
                  <div className="min-w-0 pr-2 flex items-center gap-1.5">
                    {track.type === 'video' ? (
                      <Video className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    ) : (
                      <Music className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    )}
                    <div>
                      <div className="font-semibold text-slate-200 truncate text-[11px]">{track.name}</div>
                      <div className="text-[9px] text-slate-500 capitalize">{track.type} • {track.clips.length} clip(s)</div>
                    </div>
                  </div>

                  {/* Controles de pista: Mute, Lock, Visibility, Delete */}
                  <div className="flex items-center gap-1 text-slate-400">
                    <button
                      type="button"
                      onClick={() => toggleTrackVisibility(track.id)}
                      title={track.isVisible === false ? 'Pista oculta (clic para mostrar)' : 'Pista visible (clic para ocultar)'}
                      className={`p-1 rounded hover:bg-slate-800 transition-colors ${track.isVisible === false ? 'text-amber-400' : 'text-slate-400'}`}
                    >
                      {track.isVisible === false ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleTrackMute(track.id)}
                      title={track.isMuted ? 'Pista silenciada' : 'Pista activa'}
                      className={`p-1 rounded hover:bg-slate-800 transition-colors ${track.isMuted ? 'text-red-400' : 'text-slate-400'}`}
                    >
                      {track.isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleTrackLock(track.id)}
                      title={track.isLocked ? 'Pista bloqueada' : 'Pista desbloqueada'}
                      className={`p-1 rounded hover:bg-slate-800 transition-colors ${track.isLocked ? 'text-amber-400' : 'text-slate-400'}`}
                    >
                      {track.isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </button>

                    {project.tracks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTrack(track.id)}
                        title="Eliminar esta pista"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-950 text-slate-500 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tracks Area (Ruler + Lanes + Clips + Playhead) */}
        <div 
          ref={timelineTrackAreaRef}
          onClick={handleTimelineClick}
          className="flex-1 overflow-x-auto overflow-y-auto relative bg-[#070A0F] flex flex-col cursor-crosshair"
        >
          {/* Cabezal de Reproducción (Playhead) */}
          <div 
            ref={playheadRef}
            className="absolute top-0 bottom-0 z-30 pointer-events-none flex flex-col items-center"
            style={{ transform: `translateX(${currentTimeSeconds * zoomLevel}px)` }}
          >
            <div className="w-3.5 h-3.5 bg-blue-500 rotate-45 -mt-1.5 shadow-md shadow-blue-500/50 border border-blue-300" />
            <div className="w-[1.5px] flex-1 bg-blue-500 shadow-sm shadow-blue-400" />
          </div>

          {/* Regla Temporal Graduada */}
          <div 
            className="h-7 border-b border-slate-800 bg-[#0B0F17] relative shrink-0"
            style={{ width: `${totalWidth}px` }}
          >
            {markers.map((sec) => (
              <div 
                key={sec} 
                className="absolute top-0 bottom-0 flex flex-col justify-end text-[10px] font-mono text-slate-500 pl-1 border-l border-slate-800/80"
                style={{ left: `${sec * zoomLevel}px` }}
              >
                <span className="pb-0.5">{formatDuration(sec)}</span>
              </div>
            ))}
          </div>

          {/* Carriles de Pistas */}
          <div 
            className="flex-1 divide-y divide-slate-800/40 relative"
            style={{ width: `${totalWidth}px` }}
          >
            {project.tracks.map((track) => (
              <div 
                key={track.id} 
                data-track-id={track.id}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('application/kyvora-asset-id')) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                  }
                }}
                onDrop={(e) => {
                  const assetId = e.dataTransfer.getData('application/kyvora-asset-id');
                  if (assetId) {
                    e.preventDefault();
                    e.stopPropagation();
                    const asset = project.assets.find(a => a.id === assetId);
                    if (asset) {
                      const trackRect = e.currentTarget.getBoundingClientRect();
                      const clickX = e.clientX - trackRect.left;
                      const dropSec = Math.max(0, clickX / zoomLevel);
                      const clipId = `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                      addClipToTrack(track.id, {
                        assetId: asset.id,
                        name: asset.name,
                        startInTimelineSeconds: dropSec,
                        durationSeconds: asset.durationInSeconds,
                        sourceStartSeconds: 0,
                        color: asset.type === 'video' ? '#0066FF' : asset.type === 'audio' ? '#10B981' : '#8B5CF6',
                        effects: []
                      }, clipId);
                      selectClip(clipId);
                      setCurrentTime(dropSec);
                    }
                  }
                }}
                className={`track-lane h-16 relative transition-colors ${
                  track.isVisible === false ? 'opacity-40 bg-slate-950/80' : ''
                } ${
                  activeDrag?.targetTrackId === track.id 
                    ? 'bg-blue-950/20 ring-1 ring-inset ring-blue-500/30' 
                    : 'bg-slate-950/40 hover:bg-slate-900/20'
                }`}
              >
                {/* Clips renderizados en este carril */}
                {track.clips.map((clip) => {
                  const isSelected = selectedClipId === clip.id;
                  const isBeingDragged = activeDrag?.clipId === clip.id;
                  const isBeingTrimmed = activeTrim?.clipId === clip.id;

                  let startSec = clip.startInTimelineSeconds;
                  let durationSec = clip.durationSeconds;

                  if (isBeingDragged && activeDrag.hasMovedPastThreshold) {
                    startSec = activeDrag.previewStart;
                  } else if (isBeingTrimmed && activeTrim.hasMovedPastThreshold) {
                    if (activeTrim.edge === 'start') {
                      const clipEnd = clip.startInTimelineSeconds + clip.durationSeconds;
                      startSec = Math.min(activeTrim.previewPosition, clipEnd - 0.1);
                      durationSec = clipEnd - startSec;
                    } else {
                      durationSec = Math.max(0.1, activeTrim.previewPosition - clip.startInTimelineSeconds);
                    }
                  }

                  const clipLeft = startSec * zoomLevel;
                  const clipWidth = Math.max(durationSec * zoomLevel, 32);

                  // Buscar asset para mostrar miniatura
                  const asset = project.assets.find(a => a.id === clip.assetId);
                  const hasThumbnail = Boolean(asset?.thumbnailUrl);
                  const isAudio = asset?.type === 'audio' || track.type === 'audio';

                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectClip(clip.id);
                        setContextMenu(null);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        selectClip(clip.id);
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          clipId: clip.id
                        });
                      }}
                      onMouseDown={(e) => {
                        const target = e.target as HTMLElement;
                        if (!target.classList.contains('trim-handle') && !track.isLocked) {
                          setActiveDrag({
                            clipId: clip.id,
                            originalTrackId: track.id,
                            targetTrackId: track.id,
                            originalStart: clip.startInTimelineSeconds,
                            previewStart: clip.startInTimelineSeconds,
                            initialMouseX: e.clientX,
                            initialMouseY: e.clientY,
                            hasMovedPastThreshold: false
                          });
                          selectClip(clip.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={`absolute top-2 bottom-2 rounded-md border text-xs flex items-center justify-between overflow-hidden transition-all shadow-sm group select-none ${
                        track.isLocked ? 'cursor-not-allowed opacity-80' : 'cursor-grab active:cursor-grabbing'
                      } ${
                        isSelected 
                          ? 'border-blue-400 ring-2 ring-blue-500/60 text-white z-20 shadow-lg shadow-blue-500/20' 
                          : 'border-slate-700/80 hover:border-slate-500 text-slate-200'
                      } ${isBeingDragged && activeDrag.hasMovedPastThreshold ? 'opacity-70 ring-blue-400 ring-2 scale-98' : ''}`}
                      style={{
                        left: `${clipLeft}px`,
                        width: `${clipWidth}px`,
                        backgroundColor: clip.color || (isAudio ? '#064E3B' : '#1E293B')
                      }}
                    >
                      {/* Manija de Recorte Izquierdo */}
                      {!track.isLocked && (
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setActiveTrim({
                              clipId: clip.id,
                              edge: 'start',
                              initialPosition: clip.startInTimelineSeconds,
                              previewPosition: clip.startInTimelineSeconds,
                              initialMouseX: e.clientX,
                              hasMovedPastThreshold: false
                            });
                            selectClip(clip.id);
                          }}
                          title="Recortar inicio de clip"
                          className="trim-handle absolute -left-1 top-0 bottom-0 w-3 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-blue-500 hover:bg-blue-400 rounded-l flex items-center justify-center transition-opacity z-10"
                        >
                          <ChevronLeft className="w-2.5 h-2.5 text-white pointer-events-none" />
                        </div>
                      )}

                      {/* Miniatura de fondo si es video o imagen */}
                      {hasThumbnail && (
                        <div 
                          className="absolute inset-0 opacity-20 pointer-events-none bg-cover bg-center"
                          style={{ backgroundImage: `url(${asset?.thumbnailUrl})` }}
                        />
                      )}

                      {/* Formas de onda si es pista de audio */}
                      {isAudio && (
                        <div className="absolute inset-x-0 bottom-0 h-4 opacity-30 pointer-events-none flex items-end gap-0.5 px-1 overflow-hidden">
                          {Array.from({ length: 30 }).map((_, i) => (
                            <div 
                              key={i} 
                              className="w-1 bg-emerald-400 rounded-xs"
                              style={{ height: `${20 + (i % 7) * 12}%` }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Cuerpo de Texto y Badges */}
                      <div className="px-2 truncate pointer-events-none flex items-center gap-1.5 flex-1 min-w-0 z-10">
                        <span className="truncate font-semibold text-[11px] drop-shadow">
                          {clip.name}
                        </span>
                        <span className="text-[9px] font-mono opacity-80 shrink-0">
                          {durationSec.toFixed(1)}s
                        </span>

                        {/* Badges de efectos, velocidad y transiciones */}
                        <div className="flex items-center gap-1 shrink-0 ml-auto">
                          {clip.effects && clip.effects.length > 0 && (
                            <span className="px-1 py-0.2 rounded bg-purple-900/80 text-[8px] font-mono text-purple-200 border border-purple-700/60">
                              FX:{clip.effects.length}
                            </span>
                          )}
                          {clip.speed && clip.speed.playbackSpeed !== 1 && (
                            <span className="px-1 py-0.2 rounded bg-amber-900/80 text-[8px] font-mono text-amber-200 border border-amber-700/60">
                              {clip.speed.playbackSpeed}x
                            </span>
                          )}
                          {clip.transitions && clip.transitions.length > 0 && (
                            <span className="px-1 py-0.2 rounded bg-blue-900/80 text-[8px] font-mono text-blue-200 border border-blue-700/60">
                              TR
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Manija de Recorte Derecho */}
                      {!track.isLocked && (
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setActiveTrim({
                              clipId: clip.id,
                              edge: 'end',
                              initialPosition: clip.startInTimelineSeconds + clip.durationSeconds,
                              previewPosition: clip.startInTimelineSeconds + clip.durationSeconds,
                              initialMouseX: e.clientX,
                              hasMovedPastThreshold: false
                            });
                            selectClip(clip.id);
                          }}
                          title="Recortar final de clip"
                          className="trim-handle absolute -right-1 top-0 bottom-0 w-3 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-blue-500 hover:bg-blue-400 rounded-r flex items-center justify-center transition-opacity z-10"
                        >
                          <ChevronRight className="w-2.5 h-2.5 text-white pointer-events-none" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Menú Contextual (Clic Derecho en Clip) */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 w-44 text-slate-200 text-xs font-medium"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y - 120}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              splitClipAtPlayhead(contextMenu.clipId);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2"
          >
            <Scissors className="w-3.5 h-3.5 text-blue-400" />
            <span>Dividir en cabezal</span>
          </button>

          <button
            type="button"
            onClick={() => {
              duplicateClip(contextMenu.clipId);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2"
          >
            <Copy className="w-3.5 h-3.5 text-emerald-400" />
            <span>Duplicar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              separateAudioFromVideo(contextMenu.clipId);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2"
          >
            <Unlink className="w-3.5 h-3.5 text-amber-400" />
            <span>Separar audio</span>
          </button>

          <div className="h-[1px] bg-slate-800 my-1" />

          <button
            type="button"
            onClick={() => {
              removeClip(contextMenu.clipId);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-red-600 hover:text-white text-red-300 flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span>Eliminar clip</span>
          </button>
        </div>
      )}
    </div>
  );
};
