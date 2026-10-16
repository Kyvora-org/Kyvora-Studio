import React, { useState } from 'react';
import { 
  useEditorStore, 
  formatTimecode,
  ClipEffect,
  ColorAdjustmentEffect,
  GrayscaleEffect,
  SepiaEffect,
  TextOverlayEffect,
  FadeEffect
} from '@kyvora/editor-core';
import { 
  Sliders, 
  Settings2, 
  Layers, 
  Info, 
  Sparkles, 
  Trash2, 
  RotateCcw
} from 'lucide-react';

export const InspectorPanel: React.FC = () => {
  const { 
    project, 
    selectedClipId, 
    selectedAssetId, 
    updateProjectName,
    updateProjectSettings,
    addEffectToClip,
    updateEffectInClip,
    removeEffectFromClip,
    updateClipTransform
  } = useEditorStore();

  const [customResWidth, setCustomResWidth] = useState<number>(project.settings.width);
  const [customResHeight, setCustomResHeight] = useState<number>(project.settings.height);
  const [isCustomRes, setIsCustomRes] = useState<boolean>(false);

  // Find selected clip across tracks
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

  // Find selected asset
  const selectedAsset = selectedAssetId 
    ? project.assets.find(a => a.id === selectedAssetId)
    : null;

  // Manejar cambio de preset de resolución
  const handleResolutionPresetChange = (preset: string) => {
    if (preset === 'custom') {
      setIsCustomRes(true);
      return;
    }
    setIsCustomRes(false);
    if (preset === '720p') {
      updateProjectSettings({ width: 1280, height: 720 });
    } else if (preset === '1080p') {
      updateProjectSettings({ width: 1920, height: 1080 });
    } else if (preset === '1440p') {
      updateProjectSettings({ width: 2560, height: 1440 });
    } else if (preset === '4k') {
      updateProjectSettings({ width: 3840, height: 2160 });
    }
  };

  const handleApplyCustomResolution = () => {
    const w = Math.max(64, Math.min(7680, customResWidth || 1920));
    const h = Math.max(64, Math.min(7680, customResHeight || 1080));
    // Garantizar paridad para compatibilidad con códecs
    const evenW = w % 2 !== 0 ? w + 1 : w;
    const evenH = h % 2 !== 0 ? h + 1 : h;
    updateProjectSettings({ width: evenW, height: evenH });
  };

  // Ayudante para agregar nuevo efecto al clip seleccionado
  const handleAddEffect = (type: string) => {
    if (!selectedClip) return;
    const effectId = `eff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    let newEffect: ClipEffect;
    if (type === 'colorAdjustment') {
      newEffect = {
        id: effectId,
        type: 'colorAdjustment',
        name: 'Ajuste de Color',
        isEnabled: true,
        brightness: 0,
        contrast: 1,
        saturation: 1
      };
    } else if (type === 'grayscale') {
      newEffect = {
        id: effectId,
        type: 'grayscale',
        name: 'Blanco y Negro',
        isEnabled: true,
        amount: 1
      };
    } else if (type === 'sepia') {
      newEffect = {
        id: effectId,
        type: 'sepia',
        name: 'Filtro Sepia',
        isEnabled: true,
        amount: 1
      };
    } else if (type === 'textOverlay') {
      newEffect = {
        id: effectId,
        type: 'textOverlay',
        name: 'Texto Superpuesto',
        isEnabled: true,
        text: 'Kyvora Studio',
        fontFamily: 'Inter, sans-serif',
        fontSize: 36,
        color: '#ffffff',
        positionX: 50,
        positionY: 50
      };
    } else if (type === 'fade') {
      newEffect = {
        id: effectId,
        type: 'fade',
        name: 'Fundido (Fade In/Out)',
        isEnabled: true,
        fadeInDurationSeconds: 1,
        fadeOutDurationSeconds: 1
      };
    } else {
      return;
    }

    addEffectToClip(selectedClip.id, newEffect);
  };

  return (
    <aside className="w-80 shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col select-none overflow-y-auto">
      {/* Header */}
      <div className="h-10 px-3 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
          <Sliders className="w-3.5 h-3.5 text-blue-400" />
          <span>Inspector de Propiedades</span>
        </div>
      </div>

      <div className="p-3 space-y-4 text-xs">
        {/* Scenario 1: Clip Selected */}
        {selectedClip ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Layers className="w-4 h-4 text-blue-400" />
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-slate-200 truncate">{selectedClip.name}</h4>
                <p className="text-[10px] text-slate-500">Pista: {parentTrack?.name}</p>
              </div>
            </div>

            {/* Metadatos de Línea de Tiempo */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Inicio Línea</label>
                <div className="bg-slate-950 p-1.5 rounded border border-slate-800 font-mono text-slate-300 text-[11px]">
                  {formatTimecode(selectedClip.startInTimelineSeconds, project.settings.frameRate)}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Duración</label>
                <div className="bg-slate-950 p-1.5 rounded border border-slate-800 font-mono text-slate-300 text-[11px]">
                  {selectedClip.durationSeconds.toFixed(2)}s
                </div>
              </div>
            </div>

            {/* Transformaciones de Escala y Posición */}
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-slate-300 text-[11px] font-semibold border-b border-slate-850 pb-1">
                <span>Transformación</span>
                <button
                  type="button"
                  onClick={() => updateClipTransform(selectedClip.id, { scaleX: 1, scaleY: 1, positionX: 0, positionY: 0, opacity: 1 })}
                  title="Restablecer transformación"
                  className="p-0.5 text-slate-400 hover:text-white"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>

              {/* Escala */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Escala: {((selectedClip.transform?.scaleX ?? 1) * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.5"
                  step="0.05"
                  value={selectedClip.transform?.scaleX ?? 1}
                  onChange={(e) => {
                    const s = parseFloat(e.target.value);
                    updateClipTransform(selectedClip.id, { scaleX: s, scaleY: s });
                  }}
                  className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                />
              </div>

              {/* Opacidad */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Opacidad: {((selectedClip.transform?.opacity ?? 1) * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={selectedClip.transform?.opacity ?? 1}
                  onChange={(e) => updateClipTransform(selectedClip.id, { opacity: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                />
              </div>
            </div>

            {/* Panel de Efectos de Clip */}
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-slate-300 text-[11px] font-semibold border-b border-slate-850 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Efectos ({selectedClip.effects?.length || 0})</span>
                </div>

                {/* Dropdown / Botones para añadir efecto */}
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddEffect(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="bg-slate-900 border border-slate-800 rounded text-[10px] px-2 py-0.5 text-blue-300 font-medium cursor-pointer"
                >
                  <option value="" disabled>+ Añadir Efecto</option>
                  <option value="colorAdjustment">Ajuste de Color</option>
                  <option value="grayscale">Blanco y Negro</option>
                  <option value="sepia">Filtro Sepia</option>
                  <option value="textOverlay">Texto Superpuesto</option>
                  <option value="fade">Fundido Entrada/Salida</option>
                </select>
              </div>

              {/* Lista de Efectos Activos en el Clip */}
              {selectedClip.effects?.length === 0 ? (
                <div className="text-[10px] text-slate-500 text-center py-2">
                  No hay efectos aplicados en este clip.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedClip.effects.map((effect) => (
                    <div key={effect.id} className="p-2 rounded bg-slate-900 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <label className="flex items-center gap-1.5 font-medium text-slate-200">
                          <input
                            type="checkbox"
                            checked={effect.isEnabled}
                            onChange={(e) => updateEffectInClip(selectedClip.id, effect.id, { isEnabled: e.target.checked })}
                            className="accent-blue-500 rounded"
                          />
                          <span>{effect.name}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeEffectFromClip(selectedClip.id, effect.id)}
                          className="text-slate-500 hover:text-red-400 p-0.5"
                          title="Eliminar efecto"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Parámetros específicos según tipo de efecto */}
                      {effect.isEnabled && effect.type === 'colorAdjustment' && (
                        <div className="space-y-2 pt-1 text-[10px]">
                          {/* Brillo */}
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-slate-400">
                              <span>Brillo</span>
                              <span>{((effect as ColorAdjustmentEffect).brightness * 100).toFixed(0)}%</span>
                            </div>
                            <input
                              type="range"
                              min="-1"
                              max="1"
                              step="0.05"
                              value={(effect as ColorAdjustmentEffect).brightness}
                              onChange={(e) => updateEffectInClip(selectedClip.id, effect.id, { brightness: parseFloat(e.target.value) })}
                              className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                            />
                          </div>

                          {/* Contraste */}
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-slate-400">
                              <span>Contraste</span>
                              <span>{(((effect as ColorAdjustmentEffect).contrast) * 100).toFixed(0)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="2"
                              step="0.05"
                              value={(effect as ColorAdjustmentEffect).contrast}
                              onChange={(e) => updateEffectInClip(selectedClip.id, effect.id, { contrast: parseFloat(e.target.value) })}
                              className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                            />
                          </div>

                          {/* Saturación */}
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-slate-400">
                              <span>Saturación</span>
                              <span>{(((effect as ColorAdjustmentEffect).saturation) * 100).toFixed(0)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="2"
                              step="0.05"
                              value={(effect as ColorAdjustmentEffect).saturation}
                              onChange={(e) => updateEffectInClip(selectedClip.id, effect.id, { saturation: parseFloat(e.target.value) })}
                              className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                            />
                          </div>
                        </div>
                      )}

                      {effect.isEnabled && effect.type === 'grayscale' && (
                        <div className="space-y-1 pt-1 text-[10px]">
                          <div className="flex justify-between text-slate-400">
                            <span>Intensidad B&N</span>
                            <span>{(((effect as GrayscaleEffect).amount) * 100).toFixed(0)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={(effect as GrayscaleEffect).amount}
                            onChange={(e) => updateEffectInClip(selectedClip.id, effect.id, { amount: parseFloat(e.target.value) })}
                            className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                          />
                        </div>
                      )}

                      {effect.isEnabled && effect.type === 'sepia' && (
                        <div className="space-y-1 pt-1 text-[10px]">
                          <div className="flex justify-between text-slate-400">
                            <span>Tono Sepia</span>
                            <span>{(((effect as SepiaEffect).amount) * 100).toFixed(0)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={(effect as SepiaEffect).amount}
                            onChange={(e) => updateEffectInClip(selectedClip.id, effect.id, { amount: parseFloat(e.target.value) })}
                            className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                          />
                        </div>
                      )}

                      {effect.isEnabled && effect.type === 'textOverlay' && (
                        <div className="space-y-2 pt-1 text-[10px]">
                          <div className="space-y-0.5">
                            <span className="text-slate-400">Texto</span>
                            <input
                              type="text"
                              value={(effect as TextOverlayEffect).text}
                              onChange={(e) => updateEffectInClip(selectedClip.id, effect.id, { text: e.target.value })}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-0.5">
                              <span className="text-slate-400">Tamaño (px)</span>
                              <input
                                type="number"
                                min="12"
                                max="120"
                                value={(effect as TextOverlayEffect).fontSize}
                                onChange={(e) => updateEffectInClip(selectedClip.id, effect.id, { fontSize: parseInt(e.target.value) || 24 })}
                                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                              />
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-slate-400">Color</span>
                              <input
                                type="color"
                                value={(effect as TextOverlayEffect).color}
                                onChange={(e) => updateEffectInClip(selectedClip.id, effect.id, { color: e.target.value })}
                                className="w-full h-7 bg-slate-950 border border-slate-800 rounded cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {effect.isEnabled && effect.type === 'fade' && (
                        <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
                          <div className="space-y-0.5">
                            <span className="text-slate-400">Fade In (s)</span>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.2"
                              value={(effect as FadeEffect).fadeInDurationSeconds}
                              onChange={(e) => updateEffectInClip(selectedClip.id, effect.id, { fadeInDurationSeconds: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-slate-400">Fade Out (s)</span>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.2"
                              value={(effect as FadeEffect).fadeOutDurationSeconds}
                              onChange={(e) => updateEffectInClip(selectedClip.id, effect.id, { fadeOutDurationSeconds: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : selectedAsset ? (
          /* Scenario 2: Asset Selected */
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Info className="w-4 h-4 text-emerald-400" />
              <div>
                <h4 className="font-semibold text-slate-200 truncate w-48">{selectedAsset.name}</h4>
                <p className="text-[10px] text-slate-500 uppercase">{selectedAsset.type}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-medium text-slate-400">Duración base</label>
              <div className="bg-slate-950 p-2 rounded border border-slate-800 font-mono text-slate-300">
                {selectedAsset.durationInSeconds}s
              </div>
            </div>

            {selectedAsset.fileSize && (
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-slate-400">Tamaño de archivo</label>
                <div className="bg-slate-950 p-2 rounded border border-slate-800 text-slate-300">
                  {(selectedAsset.fileSize / (1024 * 1024)).toFixed(2)} MB
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Scenario 3: Global Project Settings */
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Settings2 className="w-4 h-4 text-blue-400" />
              <h4 className="font-semibold text-slate-200">Ajustes del Proyecto</h4>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">Nombre del Proyecto</label>
              <input
                type="text"
                value={project.name}
                onChange={(e) => updateProjectName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Ajustes de Resolución */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">Resolución</label>
              <select
                value={
                  isCustomRes ? 'custom' :
                  project.settings.width === 1280 && project.settings.height === 720 ? '720p' :
                  project.settings.width === 1920 && project.settings.height === 1080 ? '1080p' :
                  project.settings.width === 2560 && project.settings.height === 1440 ? '1440p' :
                  project.settings.width === 3840 && project.settings.height === 2160 ? '4k' : 'custom'
                }
                onChange={(e) => handleResolutionPresetChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:border-blue-500 focus:outline-none"
              >
                <option value="720p">1280 × 720 (HD 720p)</option>
                <option value="1080p">1920 × 1080 (Full HD 1080p)</option>
                <option value="1440p">2560 × 1440 (2K QHD 1440p)</option>
                <option value="4k">3840 × 2160 (4K UHD 2160p)</option>
                <option value="custom">Personalizada...</option>
              </select>

              {isCustomRes && (
                <div className="p-2 bg-slate-950 rounded border border-slate-800 space-y-2 mt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400">Ancho (px)</span>
                      <input
                        type="number"
                        min="320"
                        max="7680"
                        value={customResWidth}
                        onChange={(e) => setCustomResWidth(parseInt(e.target.value) || 1920)}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Alto (px)</span>
                      <input
                        type="number"
                        min="240"
                        max="4320"
                        value={customResHeight}
                        onChange={(e) => setCustomResHeight(parseInt(e.target.value) || 1080)}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCustomResolution}
                    className="w-full py-1 text-[11px] bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors"
                  >
                    Aplicar Resolución
                  </button>
                </div>
              )}
            </div>

            {/* Frecuencia de Fotogramas (FPS) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">Frecuencia de Fotogramas (FPS)</label>
              <select
                value={project.settings.frameRate}
                onChange={(e) => updateProjectSettings({ frameRate: parseInt(e.target.value) || 30 })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:border-blue-500 focus:outline-none"
              >
                <option value={24}>24 fps (Cinematográfico)</option>
                <option value={25}>25 fps (PAL / Broadcast Europeo)</option>
                <option value={30}>30 fps (Estándar Web / NTSC)</option>
                <option value={50}>50 fps (PAL Alta Velocidad)</option>
                <option value={60}>60 fps (Fluido para Videojuegos / Acción)</option>
              </select>
            </div>

            {/* Duración total */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">Duración total</label>
              <div className="bg-slate-950 p-2 rounded border border-slate-800 text-slate-300 font-mono">
                {project.durationSeconds}s ({formatTimecode(project.durationSeconds, project.settings.frameRate)})
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-500">
              Selecciona un clip en la línea de tiempo para configurar sus efectos (Ajuste de Color, Blanco y Negro, Sepia, Texto, Fundidos) y escala.
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
