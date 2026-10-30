import React from 'react';
import { 
  TimelineClip, 
  ClipMask, 
  ChromaKeyProperties, 
  BlendMode 
} from '@kyvora/editor-core';
import { 
  Scissors, 
  Layers, 
  Trash2, 
  Sparkles, 
  Square, 
  Circle, 
  Hexagon 
} from 'lucide-react';

interface MasksInspectorProps {
  clip: TimelineClip;
  onUpdateMasks: (masks: ClipMask[]) => void;
  onUpdateChromaKey: (chromaKey: Partial<ChromaKeyProperties>) => void;
  onUpdateBlendMode: (blendMode: BlendMode) => void;
}

const BLEND_MODES: { id: BlendMode; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'multiply', label: 'Multiplicar (Multiply)' },
  { id: 'screen', label: 'Trama (Screen)' },
  { id: 'overlay', label: 'Superponer (Overlay)' },
  { id: 'darken', label: 'Oscurecer (Darken)' },
  { id: 'lighten', label: 'Aclarar (Lighten)' },
  { id: 'colorDodge', label: 'Sobreexponer Color (Color Dodge)' },
  { id: 'colorBurn', label: 'Subexponer Color (Color Burn)' },
  { id: 'hardLight', label: 'Luz Fuerte (Hard Light)' },
  { id: 'softLight', label: 'Luz Suave (Soft Light)' },
  { id: 'difference', label: 'Diferencia (Difference)' },
  { id: 'exclusion', label: 'Exclusión (Exclusion)' }
];

export const MasksInspector: React.FC<MasksInspectorProps> = ({
  clip,
  onUpdateMasks,
  onUpdateChromaKey,
  onUpdateBlendMode
}) => {
  const masks = clip.masks || [];
  const chromaKey: ChromaKeyProperties = clip.chromaKey || {
    isEnabled: false,
    keyColorHex: '#00FF00',
    similarity: 0.35,
    smoothness: 0.1,
    spillSuppression: 0.6
  };
  const currentBlendMode: BlendMode = clip.blendMode || 'normal';

  const addMask = (type: 'rectangle' | 'ellipse' | 'polygon') => {
    const newMask: ClipMask = {
      id: 'mask-' + Date.now(),
      name: `Máscara ${type === 'rectangle' ? 'Rectangular' : type === 'ellipse' ? 'Circular' : 'Poligonal'}`,
      type,
      isEnabled: true,
      points: type === 'polygon' ? [
        { x: 30, y: 30 },
        { x: 70, y: 30 },
        { x: 70, y: 70 },
        { x: 30, y: 70 }
      ] : [],
      centerX: 50,
      centerY: 50,
      width: 40,
      height: 40,
      rotationDegrees: 0,
      feather: 10,
      isInverted: false,
      opacity: 1.0
    };
    onUpdateMasks([...masks, newMask]);
  };

  const removeMask = (maskId: string) => {
    onUpdateMasks(masks.filter(m => m.id !== maskId));
  };

  const updateMask = (maskId: string, updates: Partial<ClipMask>) => {
    onUpdateMasks(masks.map(m => m.id === maskId ? { ...m, ...updates } : m));
  };

  return (
    <div className="space-y-5 text-xs text-slate-300">
      {/* 1. Modo de Fusión de Capas (Blending Modes) */}
      <div className="bg-slate-900/60 p-3 rounded border border-slate-800 space-y-2">
        <div className="flex items-center gap-1.5 text-slate-200 font-semibold text-[11px] uppercase tracking-wider">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span>Modo de Fusión de Capa</span>
        </div>
        <select
          value={currentBlendMode}
          onChange={(e) => onUpdateBlendMode(e.target.value as BlendMode)}
          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:border-blue-500 focus:outline-none"
        >
          {BLEND_MODES.map(bm => (
            <option key={bm.id} value={bm.id}>{bm.label}</option>
          ))}
        </select>
      </div>

      {/* 2. Chroma Key & Pantalla Verde */}
      <div className="bg-slate-900/60 p-3 rounded border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-200 font-semibold text-[11px] uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Chroma Key (Pantalla Verde)</span>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
            <input
              type="checkbox"
              checked={chromaKey.isEnabled}
              onChange={(e) => onUpdateChromaKey({ isEnabled: e.target.checked })}
              className="rounded bg-slate-900 border-slate-700 text-emerald-500"
            />
            <span className={chromaKey.isEnabled ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
              Activar
            </span>
          </label>
        </div>

        {chromaKey.isEnabled && (
          <div className="space-y-3 pt-1 border-t border-slate-800/60">
            {/* Color Clave */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Color Clave</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={chromaKey.keyColorHex}
                  onChange={(e) => onUpdateChromaKey({ keyColorHex: e.target.value })}
                  className="w-7 h-7 rounded border border-slate-700 cursor-pointer bg-transparent"
                />
                <span className="font-mono text-[11px] text-slate-300">{chromaKey.keyColorHex}</span>
              </div>
            </div>

            {/* Similitud (Tolerance) */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Tolerancia / Similitud</span>
                <span className="font-mono text-slate-300">{Math.round(chromaKey.similarity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.8"
                step="0.01"
                value={chromaKey.similarity}
                onChange={(e) => onUpdateChromaKey({ similarity: parseFloat(e.target.value) })}
                className="w-full h-1 bg-slate-800 rounded accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Suavidad de Bordes (Smoothness) */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Suavizado de Bordes</span>
                <span className="font-mono text-slate-300">{Math.round(chromaKey.smoothness * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.4"
                step="0.01"
                value={chromaKey.smoothness}
                onChange={(e) => onUpdateChromaKey({ smoothness: parseFloat(e.target.value) })}
                className="w-full h-1 bg-slate-800 rounded accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Supresión de Reflejo (Spill Suppression) */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Supresión de Reflejo (Despill)</span>
                <span className="font-mono text-slate-300">{Math.round(chromaKey.spillSuppression * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={chromaKey.spillSuppression}
                onChange={(e) => onUpdateChromaKey({ spillSuppression: parseFloat(e.target.value) })}
                className="w-full h-1 bg-slate-800 rounded accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Máscaras Vectoriales (Shape Masks) */}
      <div className="bg-slate-900/60 p-3 rounded border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-200 font-semibold text-[11px] uppercase tracking-wider">
            <Scissors className="w-3.5 h-3.5 text-purple-400" />
            <span>Máscaras de Capa ({masks.length})</span>
          </div>

          {/* Botones para agregar formas */}
          <div className="flex gap-1">
            <button
              onClick={() => addMask('rectangle')}
              title="Agregar máscara rectangular"
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={() => addMask('ellipse')}
              title="Agregar máscara elíptica / circular"
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <Circle className="w-3 h-3" />
            </button>
            <button
              onClick={() => addMask('polygon')}
              title="Agregar máscara poligonal libre"
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <Hexagon className="w-3 h-3" />
            </button>
          </div>
        </div>

        {masks.length === 0 ? (
          <div className="py-4 text-center text-slate-500 text-[11px]">
            No hay máscaras activas en este clip. Selecciona una forma para crear una.
          </div>
        ) : (
          <div className="space-y-3">
            {masks.map((mask) => (
              <div key={mask.id} className="p-2.5 bg-slate-950/80 rounded border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={mask.isEnabled}
                      onChange={(e) => updateMask(mask.id, { isEnabled: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-purple-500"
                    />
                    <span className="text-[11px] font-medium text-slate-300">{mask.name}</span>
                  </div>
                  <button
                    onClick={() => removeMask(mask.id)}
                    className="text-slate-500 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2 pt-1">
                  {/* Calado / Feather */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400">Calado / Pluma (Feather)</span>
                      <span className="font-mono text-slate-300">{mask.feather} px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={mask.feather}
                      onChange={(e) => updateMask(mask.id, { feather: parseInt(e.target.value, 10) })}
                      className="w-full h-1 bg-slate-800 rounded accent-purple-500 cursor-pointer"
                    />
                  </div>

                  {/* Opacidad e Inversión */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px]">
                      <input
                        type="checkbox"
                        checked={mask.isInverted}
                        onChange={(e) => updateMask(mask.id, { isInverted: e.target.checked })}
                        className="rounded bg-slate-900 border-slate-700 text-purple-500"
                      />
                      <span className="text-slate-400">Invertir Máscara</span>
                    </label>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">Opacidad</span>
                      <span className="font-mono text-[10px] text-slate-300">{Math.round(mask.opacity * 100)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
