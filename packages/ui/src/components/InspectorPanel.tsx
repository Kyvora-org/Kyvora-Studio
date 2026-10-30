import React, { useState } from 'react';
import { 
  useEditorStore, 
  formatTimecode,
  ClipEffect,
  ColorAdjustmentEffect,
  BlurEffect,
  FilmGrainEffect,
  PixelateEffect,
  SharpenEffect,
  Keyframe,
  AnimatableProperty
} from '@kyvora/editor-core';
import { 
  Sliders, 
  Settings2, 
  Info, 
  Sparkles, 
  Trash2, 
  RotateCcw,
  Gauge,
  Volume2,
  VolumeX,
  Type,
  Move,
  Zap,
  Clock,
  Plus
} from 'lucide-react';
import { ColorGradingPanel } from './ColorGradingPanel';
import { MasksInspector } from './MasksInspector';
import { AudioMixerPanel } from './AudioMixerPanel';
import { GraphEditor } from './GraphEditor';

export const InspectorPanel: React.FC = () => {
  const { 
    project, 
    currentTimeSeconds,
    selectedClipId, 
    selectedAssetId, 
    updateProjectName,
    addEffectToClip,
    updateEffectInClip,
    removeEffectFromClip,
    updateClipTransform,
    updateClipAudio,
    updateClipSpeed,
    addTransitionToClip,
    removeTransitionFromClip,
    addKeyframeToClip,
    removeKeyframeFromClip,
    updateTitleProperties,
    updateClipColorWheels,
    updateClipColorCurves,
    updateClipLut3D,
    updateClipMasks,
    updateClipChromaKey,
    updateClipBlendMode,
    updateClipAudioSuite
  } = useEditorStore();

  const [activeTab, setActiveTab] = useState<'transform' | 'speed' | 'audio' | 'effects' | 'transitions' | 'text' | 'keyframes' | 'color' | 'masks'>('transform');

  // Encontrar clip seleccionado en las pistas
  let selectedClip = null;
  let parentTrack = null;
  if (selectedClipId) {
    for (const track of project.tracks) {
      const clip = track.clips.find(c => c.id === selectedClipId);
      if (clip) {
        selectedClip = clip;
        parentTrack = track;
        break;
      }
    }
  }

  // Encontrar recurso seleccionado
  const selectedAsset = selectedAssetId 
    ? project.assets.find(a => a.id === selectedAssetId)
    : null;

  // Si no hay clip seleccionado, mostrar propiedades globales del proyecto
  if (!selectedClip) {
    return (
      <aside className="w-80 shrink-0 bg-[#0B0F17] border-l border-slate-800 flex flex-col select-none text-xs text-slate-300">
        <div className="h-12 border-b border-slate-800 px-4 flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-blue-500" />
          <h2 className="font-semibold text-slate-200 tracking-wider uppercase text-xs">Propiedades del Proyecto</h2>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-400">Nombre del Proyecto</label>
            <input
              type="text"
              value={project.name}
              onChange={(e) => updateProjectName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">Resolución</label>
              <div className="p-2 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-blue-400">
                {project.settings.width} × {project.settings.height}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">Frecuencia (FPS)</label>
              <div className="p-2 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-blue-400">
                {project.settings.frameRate} fps
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-400">Duración Total</label>
            <div className="p-2 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-slate-300">
              {project.durationSeconds.toFixed(1)} segundos ({formatTimecode(project.durationSeconds, project.settings.frameRate)})
            </div>
          </div>

          {selectedAsset && (
            <div className="pt-4 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center gap-1.5 text-blue-400 font-semibold text-[11px]">
                <Info className="w-3.5 h-3.5" />
                <span>Medio Seleccionado en Biblioteca</span>
              </div>
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded text-[11px] space-y-1 font-mono text-slate-400">
                <div className="truncate text-slate-200 font-sans font-medium">{selectedAsset.name}</div>
                <div>Tipo: <span className="text-blue-400 uppercase">{selectedAsset.type}</span></div>
                {selectedAsset.durationInSeconds > 0 && <div>Duración: {selectedAsset.durationInSeconds.toFixed(1)}s</div>}
                {selectedAsset.width && <div>Dimensiones: {selectedAsset.width}×{selectedAsset.height}</div>}
                {selectedAsset.codecName && <div>Códec: {selectedAsset.codecName}</div>}
                {selectedAsset.filePath && <div className="truncate text-[10px] text-slate-500" title={selectedAsset.filePath}>{selectedAsset.filePath}</div>}
              </div>
            </div>
          )}
        </div>
      </aside>
    );
  }

  // Datos del clip seleccionado
  const transform = selectedClip.transform || {
    scaleX: 1,
    scaleY: 1,
    positionX: 0,
    positionY: 0,
    rotationDegrees: 0,
    opacity: 1
  };

  const audio = selectedClip.audio || {
    volume: 1.0,
    gainDb: 0,
    isMuted: false,
    pan: 0,
    fadeInDurationSeconds: 0,
    fadeOutDurationSeconds: 0,
    isNormalized: false
  };

  const speed = selectedClip.speed || {
    playbackSpeed: 1.0,
    isReversed: false,
    pitchCorrection: true
  };

  const titleProps = selectedClip.titleProperties || {
    text: selectedClip.name,
    fontFamily: 'Inter, sans-serif',
    fontSize: 48,
    textColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignment: 'center',
    animationIn: 'fade',
    animationOut: 'fade',
    template: 'custom'
  };

  // Agregar efecto
  const handleAddEffect = (type: string) => {
    const effectId = `eff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let newEffect: ClipEffect;

    if (type === 'colorAdjustment') {
      newEffect = { id: effectId, type: 'colorAdjustment', name: 'Ajuste de Color', isEnabled: true, brightness: 0, contrast: 1, saturation: 1 };
    } else if (type === 'colorGrading') {
      newEffect = { id: effectId, type: 'colorGrading', name: 'Gradación de Color Pro', isEnabled: true, brightness: 0, contrast: 1, saturation: 1, temperature: 0, exposure: 0, shadows: 0, highlights: 0 };
    } else if (type === 'blur') {
      newEffect = { id: effectId, type: 'blur', name: 'Desenfoque Gaussiano', isEnabled: true, radius: 10 };
    } else if (type === 'vignette') {
      newEffect = { id: effectId, type: 'vignette', name: 'Efecto Viñeta', isEnabled: true, radius: 0.8, softness: 0.5, intensity: 0.8 };
    } else if (type === 'filmGrain') {
      newEffect = { id: effectId, type: 'filmGrain', name: 'Grano de Película', isEnabled: true, intensity: 0.4, roughness: 0.5 };
    } else if (type === 'pixelate') {
      newEffect = { id: effectId, type: 'pixelate', name: 'Pixelado', isEnabled: true, pixelSize: 12 };
    } else if (type === 'sharpen') {
      newEffect = { id: effectId, type: 'sharpen', name: 'Enfoque (Sharpen)', isEnabled: true, amount: 1.5 };
    } else if (type === 'grayscale') {
      newEffect = { id: effectId, type: 'grayscale', name: 'Blanco y Negro', isEnabled: true, amount: 1 };
    } else if (type === 'sepia') {
      newEffect = { id: effectId, type: 'sepia', name: 'Filtro Sepia', isEnabled: true, amount: 1 };
    } else if (type === 'fade') {
      newEffect = { id: effectId, type: 'fade', name: 'Fundido (Fade)', isEnabled: true, fadeInDurationSeconds: 1.0, fadeOutDurationSeconds: 1.0 };
    } else {
      newEffect = { id: effectId, type: 'colorAdjustment', name: 'Efecto', isEnabled: true, brightness: 0, contrast: 1, saturation: 1 };
    }

    addEffectToClip(selectedClip.id, newEffect);
  };

  // Keyframes: agregar keyframe en playhead
  const handleAddKeyframe = (property: AnimatableProperty, value: number) => {
    const relTime = Math.max(0, Math.min(selectedClip.durationSeconds, currentTimeSeconds - selectedClip.startInTimelineSeconds));
    const kf: Keyframe = {
      id: `kf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      property,
      timeSeconds: relTime,
      value,
      easing: 'easeInOut'
    };
    addKeyframeToClip(selectedClip.id, kf);
  };

  return (
    <aside className="w-80 shrink-0 bg-[#0B0F17] border-l border-slate-800 flex flex-col select-none text-xs text-slate-300">
      {/* Panel Header */}
      <div className="h-12 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Sliders className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="truncate">
            <h2 className="font-semibold text-slate-200 text-xs truncate">{selectedClip.name}</h2>
            <div className="text-[10px] text-slate-500 font-mono">
              {selectedClip.durationSeconds.toFixed(2)}s • Pista: {parentTrack?.name}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs de Configuración en Cuadrícula 2x4 sin desbordamientos */}
      <div className="grid grid-cols-4 border-b border-slate-800 bg-slate-950/70 p-1.5 gap-1 text-[10px] font-medium shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('transform')}
          className={`py-1 px-1 rounded text-center transition-colors truncate ${activeTab === 'transform' ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
        >
          Transform
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('effects')}
          className={`py-1 px-1 rounded text-center transition-colors truncate ${activeTab === 'effects' ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
        >
          FX ({selectedClip.effects?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('color')}
          className={`py-1 px-1 rounded text-center transition-colors truncate ${activeTab === 'color' ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
        >
          Color v3
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audio')}
          className={`py-1 px-1 rounded text-center transition-colors truncate ${activeTab === 'audio' ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
        >
          Audio
        </button>

        {/* Fila 2 */}
        <button
          type="button"
          onClick={() => setActiveTab('masks')}
          className={`py-1 px-1 rounded text-center transition-colors truncate ${activeTab === 'masks' ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
        >
          Máscaras
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('transitions')}
          className={`py-1 px-1 rounded text-center transition-colors truncate ${activeTab === 'transitions' ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
        >
          Transición
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('keyframes')}
          className={`py-1 px-1 rounded text-center transition-colors truncate ${activeTab === 'keyframes' ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
        >
          Keyframes
        </button>
        <button
          type="button"
          onClick={() => setActiveTab(selectedClip.titleProperties ? 'text' : 'speed')}
          className={`py-1 px-1 rounded text-center transition-colors truncate ${(activeTab === 'speed' || activeTab === 'text') ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
        >
          {selectedClip.titleProperties ? 'Texto' : 'Velocidad'}
        </button>
      </div>

      {/* Tab Body */}
      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        {/* TRANSFORM TAB */}
        {activeTab === 'transform' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-200">
              <span className="flex items-center gap-1.5"><Move className="w-3.5 h-3.5 text-blue-400" /> Transformación</span>
              <button
                type="button"
                onClick={() => updateClipTransform(selectedClip.id, { scaleX: 1, scaleY: 1, positionX: 0, positionY: 0, rotationDegrees: 0, opacity: 1 })}
                className="text-[10px] text-slate-500 hover:text-blue-400 flex items-center gap-1"
              >
                <RotateCcw className="w-2.5 h-2.5" /> Reset
              </button>
            </div>

            {/* Escala */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Escala</span>
                <span className="font-mono text-blue-400 font-bold">{Math.round(transform.scaleX * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.05"
                value={transform.scaleX}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  updateClipTransform(selectedClip.id, { scaleX: val, scaleY: val });
                }}
                className="w-full accent-blue-500"
              />
            </div>

            {/* Opacidad */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Opacidad</span>
                <span className="font-mono text-blue-400 font-bold">{Math.round(transform.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.02"
                value={transform.opacity}
                onChange={(e) => updateClipTransform(selectedClip.id, { opacity: parseFloat(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>

            {/* Posición X e Y */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Posición X</label>
                <input
                  type="number"
                  value={transform.positionX}
                  onChange={(e) => updateClipTransform(selectedClip.id, { positionX: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Posición Y</label>
                <input
                  type="number"
                  value={transform.positionY}
                  onChange={(e) => updateClipTransform(selectedClip.id, { positionY: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono"
                />
              </div>
            </div>

            {/* Rotación */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Rotación</span>
                <span className="font-mono text-blue-400 font-bold">{transform.rotationDegrees}°</span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={transform.rotationDegrees}
                onChange={(e) => updateClipTransform(selectedClip.id, { rotationDegrees: parseInt(e.target.value) || 0 })}
                className="w-full accent-blue-500"
              />
            </div>
          </div>
        )}

        {/* SPEED TAB */}
        {activeTab === 'speed' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-200">
              <span className="flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5 text-blue-400" /> Control de Velocidad</span>
              <span className="font-mono text-blue-400 font-bold">{speed.playbackSpeed}x</span>
            </div>

            {/* Presets rápidos */}
            <div className="grid grid-cols-4 gap-1.5">
              {[0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 4.0].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => updateClipSpeed(selectedClip.id, { playbackSpeed: s })}
                  className={`py-1 rounded text-center font-mono text-[10px] border transition-colors ${
                    speed.playbackSpeed === s
                      ? 'bg-blue-600 border-blue-400 text-white font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Slider continuo */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Velocidad personalizada</span>
                <span className="font-mono text-blue-400">{speed.playbackSpeed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.25"
                max="4.0"
                step="0.05"
                value={speed.playbackSpeed}
                onChange={(e) => updateClipSpeed(selectedClip.id, { playbackSpeed: parseFloat(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>

            {/* Reproducción Inversa (Reverse) */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-slate-200">Reproducción Inversa</div>
                <div className="text-[9px] text-slate-500">Reproduce el video de atrás hacia adelante</div>
              </div>
              <input
                type="checkbox"
                checked={speed.isReversed}
                onChange={(e) => updateClipSpeed(selectedClip.id, { isReversed: e.target.checked })}
                className="w-4 h-4 accent-blue-600 rounded"
              />
            </div>
          </div>
        )}

        {/* AUDIO TAB */}
        {activeTab === 'audio' && (
          <div className="space-y-4">
            <AudioMixerPanel
              clip={selectedClip}
              onUpdateAudioSuite={(suite) => updateClipAudioSuite(selectedClip.id, suite)}
            />

            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-200 pt-3 border-t border-slate-800">
              <span className="flex items-center gap-1.5"><Volume2 className="w-3.5 h-3.5 text-emerald-400" /> Parámetros Básicos</span>
              <button
                type="button"
                onClick={() => updateClipAudio(selectedClip.id, { isMuted: !audio.isMuted })}
                className={`px-2 py-0.5 rounded text-[10px] font-medium border flex items-center gap-1 ${
                  audio.isMuted ? 'bg-red-950 border-red-800 text-red-300' : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                {audio.isMuted ? <VolumeX className="w-3 h-3 text-red-400" /> : <Volume2 className="w-3 h-3 text-emerald-400" />}
                <span>{audio.isMuted ? 'Mutear (Activo)' : 'Mutear'}</span>
              </button>
            </div>

            {/* Volumen */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Volumen General</span>
                <span className="font-mono text-emerald-400 font-bold">{Math.round(audio.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="2.0"
                step="0.05"
                value={audio.volume}
                onChange={(e) => updateClipAudio(selectedClip.id, { volume: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>

            {/* Ganancia en Decibeles */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Ganancia (dB)</span>
                <span className="font-mono text-emerald-400 font-bold">{audio.gainDb || 0} dB</span>
              </div>
              <input
                type="range"
                min="-24"
                max="24"
                step="1"
                value={audio.gainDb || 0}
                onChange={(e) => updateClipAudio(selectedClip.id, { gainDb: parseInt(e.target.value) || 0 })}
                className="w-full accent-emerald-500"
              />
            </div>

            {/* Fundidos de audio */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Fade In (segundos)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.2"
                  value={audio.fadeInDurationSeconds || 0}
                  onChange={(e) => updateClipAudio(selectedClip.id, { fadeInDurationSeconds: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Fade Out (segundos)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.2"
                  value={audio.fadeOutDurationSeconds || 0}
                  onChange={(e) => updateClipAudio(selectedClip.id, { fadeOutDurationSeconds: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono"
                />
              </div>
            </div>

            {/* Normalización de Audio */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-slate-200">Normalización de Audio</div>
                <div className="text-[9px] text-slate-500">Estándar de sonoridad para transmisiones (EBU R128)</div>
              </div>
              <input
                type="checkbox"
                checked={audio.isNormalized || false}
                onChange={(e) => updateClipAudio(selectedClip.id, { isNormalized: e.target.checked })}
                className="w-4 h-4 accent-emerald-600 rounded"
              />
            </div>
          </div>
        )}

        {/* EFFECTS TAB */}
        {activeTab === 'effects' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-200">
              <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-purple-400" /> Efectos Visuales</span>
              <span className="font-mono text-purple-400 text-[10px]">{selectedClip.effects?.length || 0} activos</span>
            </div>

            {/* Selector de nuevo efecto */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400">Agregar nuevo efecto</label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddEffect(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:border-purple-500 focus:outline-none"
              >
                <option value="">+ Seleccionar efecto para agregar...</option>
                <option value="colorAdjustment">Ajuste de Color (Brillo / Contraste / Saturación)</option>
                <option value="colorGrading">Gradación de Color Pro (Temperatura / Exposición)</option>
                <option value="blur">Desenfoque Gaussiano</option>
                <option value="vignette">Efecto Viñeta</option>
                <option value="filmGrain">Grano de Película Cinematográfico</option>
                <option value="pixelate">Efecto Pixelado</option>
                <option value="sharpen">Enfoque (Sharpen)</option>
                <option value="grayscale">Blanco y Negro</option>
                <option value="sepia">Filtro Sepia Vintage</option>
                <option value="fade">Fundido Negro (Fade In / Out)</option>
              </select>
            </div>

            {/* Lista de Efectos Aplicados */}
            <div className="space-y-3 pt-2">
              {(!selectedClip.effects || selectedClip.effects.length === 0) ? (
                <div className="p-3 text-center border border-dashed border-slate-800 rounded text-slate-500 text-[11px]">
                  No hay efectos agregados a este clip.
                </div>
              ) : (
                selectedClip.effects.map((effect) => (
                  <div key={effect.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-purple-300">{effect.name}</span>
                      <button
                        type="button"
                        onClick={() => removeEffectFromClip(selectedClip.id, effect.id)}
                        className="p-1 rounded text-slate-500 hover:text-red-400"
                        title="Eliminar efecto"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Parámetros según tipo de efecto */}
                    {effect.type === 'colorAdjustment' && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Brillo</span>
                          <span className="font-mono text-purple-400 font-bold">{(effect as ColorAdjustmentEffect).brightness}</span>
                        </div>
                        <input
                          type="range"
                          min="-0.8"
                          max="0.8"
                          step="0.05"
                          value={(effect as ColorAdjustmentEffect).brightness}
                          onChange={(e) => updateEffectInClip(selectedClip.id, effect.id, { brightness: parseFloat(e.target.value) })}
                          className="w-full accent-purple-500"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Contraste</span>
                          <span className="font-mono text-purple-400 font-bold">{(effect as ColorAdjustmentEffect).contrast}</span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="2.0"
                          step="0.05"
                          value={(effect as ColorAdjustmentEffect).contrast}
                          onChange={(e) => updateEffectInClip(selectedClip.id, effect.id, { contrast: parseFloat(e.target.value) })}
                          className="w-full accent-purple-500"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Saturación</span>
                          <span className="font-mono text-purple-400 font-bold">{(effect as ColorAdjustmentEffect).saturation}</span>
                        </div>
                        <input
                          type="range"
                          min="0.0"
                          max="2.5"
                          step="0.05"
                          value={(effect as ColorAdjustmentEffect).saturation}
                          onChange={(e) => updateEffectInClip(selectedClip.id, effect.id, { saturation: parseFloat(e.target.value) })}
                          className="w-full accent-purple-500"
                        />
                      </div>
                    )}

                    {effect.type === 'blur' && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Radio (px)</span>
                          <span className="font-mono text-purple-400 font-bold">{(effect as BlurEffect).radius}px</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="40"
                          step="1"
                          value={(effect as BlurEffect).radius}
                          onChange={(e) => updateEffectInClip(selectedClip.id, effect.id, { radius: parseInt(e.target.value) || 0 })}
                          className="w-full accent-purple-500"
                        />
                      </div>
                    )}

                    {effect.type === 'pixelate' && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Tamaño Pixel</span>
                          <span className="font-mono text-purple-400 font-bold">{(effect as PixelateEffect).pixelSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="2"
                          max="48"
                          step="2"
                          value={(effect as PixelateEffect).pixelSize}
                          onChange={(e) => updateEffectInClip(selectedClip.id, effect.id, { pixelSize: parseInt(e.target.value) || 2 })}
                          className="w-full accent-purple-500"
                        />
                      </div>
                    )}

                    {effect.type === 'filmGrain' && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Intensidad de Grano</span>
                          <span className="font-mono text-purple-400 font-bold">{Math.round((effect as FilmGrainEffect).intensity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.05"
                          max="1.0"
                          step="0.05"
                          value={(effect as FilmGrainEffect).intensity}
                          onChange={(e) => updateEffectInClip(selectedClip.id, effect.id, { intensity: parseFloat(e.target.value) })}
                          className="w-full accent-purple-500"
                        />
                      </div>
                    )}

                    {effect.type === 'sharpen' && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Nitidez</span>
                          <span className="font-mono text-purple-400 font-bold">{(effect as SharpenEffect).amount}</span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="3.0"
                          step="0.1"
                          value={(effect as SharpenEffect).amount}
                          onChange={(e) => updateEffectInClip(selectedClip.id, effect.id, { amount: parseFloat(e.target.value) })}
                          className="w-full accent-purple-500"
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TRANSITIONS TAB */}
        {activeTab === 'transitions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-200">
              <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-blue-400" /> Transiciones</span>
            </div>

            {/* Transición de Entrada */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
              <div className="text-[11px] font-semibold text-blue-300">Transición de Entrada (In)</div>
              <select
                value={selectedClip.transitions?.find(t => t.position === 'start')?.type || ''}
                onChange={(e) => {
                  const existing = selectedClip.transitions?.find(t => t.position === 'start');
                  if (e.target.value) {
                    addTransitionToClip(selectedClip.id, {
                      id: existing?.id || `tr_in_${Date.now()}`,
                      type: e.target.value as any,
                      durationSeconds: 1.0,
                      position: 'start'
                    });
                  } else if (existing) {
                    removeTransitionFromClip(selectedClip.id, existing.id);
                  }
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs"
              >
                <option value="">Sin transición</option>
                <option value="fade">Disolución Fade In</option>
                <option value="dipToBlack">Fundido desde Negro (Dip to Black)</option>
                <option value="dipToWhite">Flash Blanco (Dip to White)</option>
                <option value="slideLeft">Deslizar desde la Izquierda</option>
                <option value="zoomIn">Zoom In</option>
              </select>
            </div>

            {/* Transición de Salida */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
              <div className="text-[11px] font-semibold text-blue-300">Transición de Salida (Out)</div>
              <select
                value={selectedClip.transitions?.find(t => t.position === 'end')?.type || ''}
                onChange={(e) => {
                  const existing = selectedClip.transitions?.find(t => t.position === 'end');
                  if (e.target.value) {
                    addTransitionToClip(selectedClip.id, {
                      id: existing?.id || `tr_out_${Date.now()}`,
                      type: e.target.value as any,
                      durationSeconds: 1.0,
                      position: 'end'
                    });
                  } else if (existing) {
                    removeTransitionFromClip(selectedClip.id, existing.id);
                  }
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs"
              >
                <option value="">Sin transición</option>
                <option value="fade">Disolución Fade Out</option>
                <option value="dipToBlack">Fundido a Negro (Dip to Black)</option>
                <option value="dipToWhite">Flash Blanco (Dip to White)</option>
                <option value="slideRight">Deslizar hacia la Derecha</option>
                <option value="zoomOut">Zoom Out</option>
              </select>
            </div>
          </div>
        )}

        {/* TEXT & TITLES TAB */}
        {activeTab === 'text' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-200">
              <span className="flex items-center gap-1.5"><Type className="w-3.5 h-3.5 text-blue-400" /> Editor de Títulos</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400">Texto del Título</label>
              <textarea
                rows={2}
                value={titleProps.text}
                onChange={(e) => updateTitleProperties(selectedClip.id, { text: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Tamaño de Fuente (px)</label>
                <input
                  type="number"
                  min="12"
                  max="120"
                  value={titleProps.fontSize}
                  onChange={(e) => updateTitleProperties(selectedClip.id, { fontSize: parseInt(e.target.value) || 48 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Color de Texto</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={titleProps.textColor}
                    onChange={(e) => updateTitleProperties(selectedClip.id, { textColor: e.target.value })}
                    className="w-8 h-7 bg-transparent border-0 cursor-pointer"
                  />
                  <span className="font-mono text-[10px] text-slate-400 uppercase">{titleProps.textColor}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400">Plantilla de Estilo</label>
              <select
                value={titleProps.template}
                onChange={(e) => updateTitleProperties(selectedClip.id, { template: e.target.value as any })}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs"
              >
                <option value="custom">Personalizado</option>
                <option value="lowerThird">Tercio Inferior (Lower Third Noticiero)</option>
                <option value="cinematic">Cinemático Minimalista</option>
                <option value="subtitle">Subtítulo Destacado</option>
                <option value="cyberpunk">Neón Eléctrico Kyvora</option>
              </select>
            </div>
          </div>
        )}

        {/* KEYFRAMES TAB */}
        {activeTab === 'keyframes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-200">
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-blue-400" /> Animación por Keyframes</span>
              <span className="font-mono text-blue-400">{selectedClip.keyframes?.length || 0} puntos</span>
            </div>

            <p className="text-[10px] text-slate-500">
              Agrega puntos clave en la posición actual del cabezal para animar propiedades en el tiempo.
            </p>

            {/* Botones rápidos para insertar keyframe */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleAddKeyframe('scaleX', transform.scaleX)}
                className="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] flex items-center justify-center gap-1"
              >
                <Plus className="w-3 h-3 text-blue-400" /> Escala ({Math.round(transform.scaleX * 100)}%)
              </button>
              <button
                type="button"
                onClick={() => handleAddKeyframe('opacity', transform.opacity)}
                className="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] flex items-center justify-center gap-1"
              >
                <Plus className="w-3 h-3 text-blue-400" /> Opacidad ({Math.round(transform.opacity * 100)}%)
              </button>
              <button
                type="button"
                onClick={() => handleAddKeyframe('positionX', transform.positionX)}
                className="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] flex items-center justify-center gap-1"
              >
                <Plus className="w-3 h-3 text-blue-400" /> Posición X ({transform.positionX}px)
              </button>
              <button
                type="button"
                onClick={() => handleAddKeyframe('volume', audio.volume)}
                className="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] flex items-center justify-center gap-1"
              >
                <Plus className="w-3 h-3 text-blue-400" /> Volumen ({Math.round(audio.volume * 100)}%)
              </button>
            </div>

            {/* Lista de Keyframes */}
            <div className="space-y-1.5 pt-2">
              {(!selectedClip.keyframes || selectedClip.keyframes.length === 0) ? (
                <div className="p-3 text-center border border-dashed border-slate-800 rounded text-slate-500 text-[10px]">
                  Sin keyframes. Agrega uno usando los botones superiores.
                </div>
              ) : (
                selectedClip.keyframes.map((kf) => (
                  <div key={kf.id} className="p-2 bg-slate-950 border border-slate-800 rounded flex items-center justify-between text-[10px] font-mono">
                    <div>
                      <span className="text-blue-400 font-bold uppercase">{kf.property}</span>: {kf.value.toFixed(2)}
                      <span className="text-slate-500 ml-2">@ {kf.timeSeconds.toFixed(2)}s</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeKeyframeFromClip(selectedClip.id, kf.id)}
                      className="text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
            {/* Editor de Curvas Bézier v3.0 */}
            <div className="pt-2 border-t border-slate-800">
              <GraphEditor
                keyframes={selectedClip.keyframes || []}
                onUpdateKeyframe={(kId, updates) => {
                  const existingKf = selectedClip.keyframes?.find(k => k.id === kId);
                  if (existingKf) {
                    addKeyframeToClip(selectedClip.id, { ...existingKf, ...updates });
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* COLOR GRADING v3 TAB */}
        {activeTab === 'color' && (
          <div className="space-y-4">
            <ColorGradingPanel
              clip={selectedClip}
              onUpdateWheels={(wheels) => updateClipColorWheels(selectedClip.id, wheels)}
              onUpdateCurves={(curves) => updateClipColorCurves(selectedClip.id, curves)}
              onUpdateLut={(lut) => updateClipLut3D(selectedClip.id, lut)}
            />
          </div>
        )}

        {/* MASKS & CHROMA KEY TAB */}
        {activeTab === 'masks' && (
          <div className="space-y-4">
            <MasksInspector
              clip={selectedClip}
              onUpdateMasks={(masks) => updateClipMasks(selectedClip.id, masks)}
              onUpdateChromaKey={(chroma) => updateClipChromaKey(selectedClip.id, chroma)}
              onUpdateBlendMode={(blend) => updateClipBlendMode(selectedClip.id, blend)}
            />
          </div>
        )}
      </div>
    </aside>
  );
};
