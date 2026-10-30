import React, { useState } from 'react';
import { 
  TITLE_TEMPLATES_CATALOG, 
  AUDIO_PRESETS_CATALOG, 
  COLOR_PRESETS_CATALOG, 
  TitleTemplateDefinition,
  useEditorStore
} from '@kyvora/editor-core';
import { 
  Type, 
  Volume2, 
  Palette, 
  Plus, 
  Sparkles
} from 'lucide-react';

export const ResourceLibraryPanel: React.FC = () => {
  const { 
    project, 
    currentTimeSeconds, 
    selectedClipId, 
    addTrack, 
    addClipToTrack, 
    updateClipColorWheels,
    updateClipLut3D,
    updateClipAudioSuite
  } = useEditorStore();

  const [activeCategory, setActiveCategory] = useState<'titles' | 'audio' | 'color' | 'custom'>('titles');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(null), 2500);
  };

  // Agregar plantilla de título a la línea de tiempo
  const addTitleTemplateToTimeline = (template: TitleTemplateDefinition) => {
    // Buscar o crear pista de texto
    let textTrack = project.tracks.find(t => t.type === 'text' || t.type === 'overlay');
    if (!textTrack) {
      const trackId = `track-text-${Date.now()}`;
      addTrack({
        name: 'Títulos y Gráficos',
        type: 'text',
        isLocked: false,
        isMuted: false,
        isVisible: true
      }, trackId);
      textTrack = {
        id: trackId,
        name: 'Títulos y Gráficos',
        type: 'text',
        order: project.tracks.length,
        isLocked: false,
        isMuted: false,
        isVisible: true,
        clips: []
      };
    }

    const clipId = `clip_title_${Date.now()}`;
    addClipToTrack(textTrack.id, {
      assetId: 'asset_title_synthetic',
      name: template.name,
      startInTimelineSeconds: currentTimeSeconds,
      durationSeconds: 4.0,
      sourceStartSeconds: 0,
      color: '#A855F7',
      effects: [],
      titleProperties: { ...template.defaultProperties }
    }, clipId);

    showFeedback(`Título "${template.name}" insertado en el cabezal.`);
  };

  // Aplicar preset de color al clip seleccionado
  const applyColorPresetToSelected = (presetId: string) => {
    if (!selectedClipId) {
      showFeedback('Selecciona un clip en la línea de tiempo para aplicar el preset.');
      return;
    }
    const preset = COLOR_PRESETS_CATALOG.find(p => p.id === presetId);
    if (!preset) return;

    updateClipColorWheels(selectedClipId, preset.colorWheels);
    if (preset.lut) updateClipLut3D(selectedClipId, preset.lut);
    showFeedback(`Estilo "${preset.name}" aplicado al clip.`);
  };

  // Aplicar preset de audio al clip seleccionado
  const applyAudioPresetToSelected = (presetId: string) => {
    if (!selectedClipId) {
      showFeedback('Selecciona un clip en la línea de tiempo para aplicar el preset.');
      return;
    }
    const preset = AUDIO_PRESETS_CATALOG.find(p => p.id === presetId);
    if (!preset) return;

    updateClipAudioSuite(selectedClipId, preset.suite);
    showFeedback(`Preset de audio "${preset.name}" aplicado.`);
  };

  return (
    <div className="flex flex-col h-full bg-[#0B0F17] text-xs text-slate-300 select-none">
      {/* Pestañas de la Biblioteca */}
      <div className="h-11 border-b border-slate-800 px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveCategory('titles')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
              activeCategory === 'titles' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Títulos & Intros</span>
          </button>
          <button
            onClick={() => setActiveCategory('color')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
              activeCategory === 'color' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Looks Color</span>
          </button>
          <button
            onClick={() => setActiveCategory('audio')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
              activeCategory === 'audio' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Presets Audio</span>
          </button>
        </div>
      </div>

      {/* Notificación de feedback temporal */}
      {successNotice && (
        <div className="mx-3 mt-2 px-3 py-1.5 bg-blue-600/20 border border-blue-500/40 rounded text-blue-300 text-[11px] flex items-center gap-1.5 animate-fadeIn">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Contenido de la Biblioteca */}
      <div className="p-3 overflow-y-auto flex-1 space-y-2.5">
        {/* Categoría: Títulos */}
        {activeCategory === 'titles' && (
          <div className="grid grid-cols-1 gap-2.5">
            {TITLE_TEMPLATES_CATALOG.map(item => (
              <div
                key={item.id}
                className="p-3 bg-slate-900/60 rounded border border-slate-800 hover:border-slate-700 transition flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    <span>{item.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 max-w-[220px]">{item.description}</div>
                </div>
                <button
                  onClick={() => addTitleTemplateToTimeline(item)}
                  className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-[11px] font-medium flex items-center gap-1 transition shrink-0"
                >
                  <Plus className="w-3 h-3" />
                  <span>Insertar</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Categoría: Color Looks */}
        {activeCategory === 'color' && (
          <div className="grid grid-cols-1 gap-2.5">
            {COLOR_PRESETS_CATALOG.map(item => (
              <div
                key={item.id}
                className="p-3 bg-slate-900/60 rounded border border-slate-800 hover:border-slate-700 transition flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>{item.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 max-w-[220px]">{item.description}</div>
                </div>
                <button
                  onClick={() => applyColorPresetToSelected(item.id)}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium flex items-center gap-1 transition shrink-0"
                >
                  <span>Aplicar</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Categoría: Presets de Audio */}
        {activeCategory === 'audio' && (
          <div className="grid grid-cols-1 gap-2.5">
            {AUDIO_PRESETS_CATALOG.map(item => (
              <div
                key={item.id}
                className="p-3 bg-slate-900/60 rounded border border-slate-800 hover:border-slate-700 transition flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>{item.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 max-w-[220px]">{item.description}</div>
                </div>
                <button
                  onClick={() => applyAudioPresetToSelected(item.id)}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-medium flex items-center gap-1 transition shrink-0"
                >
                  <span>Aplicar</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
