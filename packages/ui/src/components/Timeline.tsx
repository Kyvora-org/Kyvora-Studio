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
  Plus, 
  Scissors, 
  Layers,
  Magnet,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  RotateCcw
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
    addTrack,
    splitClipAtPlayhead,
    trimClip,
    duplicateClip,
    moveClip,
    removeClip,
    toggleSnapping
  } = useEditorStore();

  const timelineTrackAreaRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);

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

  // Suscripción transitoria de alta frecuencia para mover el cabezal directamente en el DOM
  // sin forzar re-renderizado de todo el árbol de React en cada tick
  useEffect(() => {
    // Posición inicial
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

  // Recopilar puntos de magnetismo (Snapping points: inicios/finales de clips)
  // Sin incluir currentTimeSeconds para evitar recrear la función en cada microtick
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
  };

  const handleZoomIn = () => setZoomLevel(Math.min(120, zoomLevel + 10));
  const handleZoomOut = () => setZoomLevel(Math.max(10, zoomLevel - 10));
  const handleResetZoom = () => setZoomLevel(25);

  // Ancho dinámico mínimo proporcional a la duración del proyecto y zoom
  const totalWidth = Math.max(project.durationSeconds * zoomLevel + 300, 1600);

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

        // Detectar si el puntero se movió verticalmente a otra pista compatible
        let targetTrackId = activeDrag.originalTrackId;
        if (timelineTrackAreaRef.current) {
          const trackLanes = timelineTrackAreaRef.current.querySelectorAll('.track-lane');
          const sourceTrack = project.tracks.find(t => t.id === activeDrag.originalTrackId);

          trackLanes.forEach((lane, idx) => {
            const laneRect = lane.getBoundingClientRect();
            if (e.clientY >= laneRect.top && e.clientY <= laneRect.bottom) {
              const candidateTrack = project.tracks[idx];
              // Verificar compatibilidad de pista (ej. video con video, audio con audio)
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
          // Confirmar el movimiento en el modelo inmutable del proyecto
          moveClip(activeDrag.clipId, activeDrag.targetTrackId, activeDrag.previewStart);
        }
        setActiveDrag(null);
      }

      if (activeTrim) {
        if (activeTrim.hasMovedPastThreshold) {
          // Confirmar el recorte en el modelo inmutable del proyecto
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

  // Accesibilidad por teclado:
  // - Delete / Backspace: Eliminar clip
  // - S / s: Dividir clip en el cabezal
  // - Ctrl+D / Cmd+D: Duplicar clip seleccionado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipId) {
        e.preventDefault();
        removeClip(selectedClipId);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        splitClipAtPlayhead();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D') && selectedClipId) {
        e.preventDefault();
        duplicateClip(selectedClipId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, removeClip, splitClipAtPlayhead, duplicateClip]);

  return (
    <div className="h-64 shrink-0 bg-slate-950 border-t border-slate-800 flex flex-col select-none relative">
      {/* Timeline Control Toolbar */}
      <div className="h-9 bg-slate-900 border-b border-slate-800/80 px-3 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 font-semibold text-slate-300">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Línea de Tiempo</span>
          </div>
          
          <div className="h-4 w-[1px] bg-slate-800 mx-1" />

          {/* Botón de División en Posición del Cabezal */}
          <button
            type="button"
            title="Dividir clip en el cabezal de reproducción (Atajo: S)"
            onClick={() => splitClipAtPlayhead()}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-750 text-slate-200 hover:text-white transition-colors border border-slate-700/60"
          >
            <Scissors className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] font-medium">Dividir</span>
          </button>

          {/* Botón Duplicar clip seleccionado */}
          <button
            type="button"
            disabled={!selectedClipId}
            title="Duplicar clip seleccionado (Atajo: Ctrl+D)"
            onClick={() => selectedClipId && duplicateClip(selectedClipId)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-750 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 hover:text-white transition-colors border border-slate-700/60"
          >
            <Copy className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-medium">Duplicar</span>
          </button>

          {/* Botón Eliminar clip seleccionado */}
          <button
            type="button"
            disabled={!selectedClipId}
            title="Eliminar clip seleccionado (Atajo: Supr / Delete)"
            onClick={() => selectedClipId && removeClip(selectedClipId)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800/80 hover:bg-red-950/50 hover:text-red-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 transition-colors border border-slate-700/60"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[11px]">Eliminar</span>
          </button>

          {/* Ajuste Magnético (Snapping) */}
          <button
            type="button"
            onClick={toggleSnapping}
            title={isSnappingEnabled ? "Ajuste magnético ACTIVO (Click para desactivar)" : "Ajuste magnético INACTIVO (Click para activar)"}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] transition-colors ${
              isSnappingEnabled 
                ? 'bg-blue-950/60 border-blue-500/70 text-blue-300 font-semibold' 
                : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Magnet className="w-3.5 h-3.5" />
            <span>Imán {isSnappingEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-800 mx-1" />

          {/* Botón + Pista Video */}
          <button
            type="button"
            onClick={() => addTrack({ name: `Pista Video ${project.tracks.filter(t => t.type === 'video').length + 1}`, type: 'video', isMuted: false, isLocked: false })}
            title="Agregar Pista de Video"
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60"
          >
            <Plus className="w-3 h-3 text-blue-400" />
            <span>+ Video</span>
          </button>

          {/* Botón + Pista Audio */}
          <button
            type="button"
            onClick={() => addTrack({ name: `Pista Audio ${project.tracks.filter(t => t.type === 'audio').length + 1}`, type: 'audio', isMuted: false, isLocked: false })}
            title="Agregar Pista de Audio"
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60"
          >
            <Plus className="w-3 h-3 text-emerald-400" />
            <span>+ Audio</span>
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
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
            className="text-[10px] font-mono text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 transition-colors flex items-center gap-1"
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
        <div className="w-48 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
          <div className="h-7 border-b border-slate-800 bg-slate-950/60 px-3 flex items-center justify-between text-[10px] text-slate-400 font-medium">
            <span>Pistas ({project.tracks.length})</span>
            <span className="text-[9px] text-slate-500 font-mono">16:9 30fps</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
            {project.tracks.map((track) => {
              const isTargetTrack = activeDrag?.targetTrackId === track.id;
              return (
                <div 
                  key={track.id} 
                  className={`h-16 px-3 flex items-center justify-between text-xs transition-colors ${
                    isTargetTrack ? 'bg-blue-950/50 border-l-2 border-blue-400' : 'bg-slate-900/50'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-slate-200 truncate">{track.name}</div>
                    <div className="text-[10px] text-slate-400 capitalize">{track.type}</div>
                  </div>
                  <div className="flex items-center gap-1 text-slate-400">
                    <span className="p-1 opacity-70">
                      {track.isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </span>
                    <span className="p-1 opacity-70">
                      {track.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </span>
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
          className="flex-1 overflow-x-auto overflow-y-auto relative bg-slate-950 flex flex-col cursor-crosshair"
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
            className="h-7 border-b border-slate-800 bg-slate-900/40 relative shrink-0"
            style={{ width: `${totalWidth}px` }}
          >
            {markers.map((sec) => (
              <div 
                key={sec} 
                className="absolute top-0 bottom-0 flex flex-col justify-end text-[10px] font-mono text-slate-400 pl-1 border-l border-slate-800/80"
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
                className={`track-lane h-16 relative transition-colors ${
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

                  // Calcular posición y anchura considerando previsualización de arrastre o recorte
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
                  const clipWidth = Math.max(durationSec * zoomLevel, 28);

                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectClip(clip.id);
                      }}
                      onMouseDown={(e) => {
                        const target = e.target as HTMLElement;
                        if (!target.classList.contains('trim-handle')) {
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
                      aria-label={`Clip ${clip.name}, inicio ${startSec.toFixed(1)} segundos`}
                      className={`absolute top-2 bottom-2 rounded-md border text-xs flex items-center justify-between cursor-grab active:cursor-grabbing transition-shadow shadow-sm group ${
                        isSelected 
                          ? 'border-blue-400 ring-2 ring-blue-500/50 text-white z-20 shadow-lg shadow-blue-500/20' 
                          : 'border-slate-700/80 hover:border-slate-500 text-slate-200'
                      } ${isBeingDragged && activeDrag.hasMovedPastThreshold ? 'opacity-70 scale-98 ring-blue-400 ring-2' : ''}`}
                      style={{
                        left: `${clipLeft}px`,
                        width: `${clipWidth}px`,
                        backgroundColor: clip.color || '#1E293B'
                      }}
                    >
                      {/* Manija de Recorte Izquierdo (Start Trim) */}
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
                        title="Arrastrar para recortar inicio"
                        className="trim-handle absolute -left-1.5 top-0 bottom-0 w-3.5 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-blue-400 hover:bg-blue-300 rounded-l flex items-center justify-center transition-opacity z-10"
                      >
                        <ChevronLeft className="w-2.5 h-2.5 text-black" />
                      </div>

                      {/* Cuerpo de Texto y Metadatos */}
                      <div className="px-2 truncate pointer-events-none flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="truncate font-semibold text-[11px] drop-shadow">
                          {clip.name}
                        </span>
                        <span className="text-[9px] font-mono opacity-80 shrink-0">
                          {durationSec.toFixed(1)}s
                        </span>
                      </div>

                      {/* Manija de Recorte Derecho (End Trim) */}
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
                        title="Arrastrar para recortar final"
                        className="trim-handle absolute -right-1.5 top-0 bottom-0 w-3.5 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-blue-400 hover:bg-blue-300 rounded-r flex items-center justify-center transition-opacity z-10"
                      >
                        <ChevronRight className="w-2.5 h-2.5 text-black" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
