import React, { useState } from 'react';
import { 
  ColorWheels, 
  ColorCurves, 
  Lut3DConfig, 
  TimelineClip,
  getDefaultColorWheels,
  COLOR_PRESETS_CATALOG
} from '@kyvora/editor-core';
import { Activity, Eye, RotateCcw, Check } from 'lucide-react';

interface ColorGradingPanelProps {
  clip: TimelineClip;
  onUpdateWheels: (wheels: ColorWheels) => void;
  onUpdateCurves: (curves: ColorCurves) => void;
  onUpdateLut: (lut: Partial<Lut3DConfig>) => void;
}

export const ColorGradingPanel: React.FC<ColorGradingPanelProps> = ({
  clip,
  onUpdateWheels,
  onUpdateCurves,
  onUpdateLut
}) => {
  const [subTab, setSubTab] = useState<'wheels' | 'curves' | 'luts' | 'scopes'>('wheels');
  const [activeCurveChannel, setActiveCurveChannel] = useState<'master' | 'red' | 'green' | 'blue'>('master');
  const [beforeAfterMode, setBeforeAfterMode] = useState<'normal' | 'split' | 'bypass'>('normal');

  const wheels: ColorWheels = clip.colorWheels || getDefaultColorWheels();
  const curves: ColorCurves = clip.colorCurves || {
    master: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    red: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    green: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    blue: [{ x: 0, y: 0 }, { x: 1, y: 1 }]
  };
  const lut: Lut3DConfig = clip.lut3d || {
    isEnabled: false,
    name: 'Teal & Orange',
    strength: 1.0
  };

  const handleWheelChange = (
    wheelName: keyof ColorWheels,
    channel: 'r' | 'g' | 'b' | 'y',
    value: number
  ) => {
    const updated: ColorWheels = {
      ...wheels,
      [wheelName]: {
        ...wheels[wheelName],
        [channel]: Math.max(-1, Math.min(1, value))
      }
    };
    onUpdateWheels(updated);
  };

  const resetWheels = () => {
    onUpdateWheels(getDefaultColorWheels());
  };

  const applyPreset = (presetId: string) => {
    const preset = COLOR_PRESETS_CATALOG.find(p => p.id === presetId);
    if (!preset) return;
    onUpdateWheels(preset.colorWheels);
    if (preset.colorCurves) onUpdateCurves(preset.colorCurves);
    if (preset.lut) onUpdateLut(preset.lut);
  };

  return (
    <div className="space-y-4 text-xs text-slate-300">
      {/* Barra de Sub-Navegación de Color */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex bg-slate-900 p-0.5 rounded border border-slate-800">
          <button
            onClick={() => setSubTab('wheels')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
              subTab === 'wheels' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Ruedas LGG
          </button>
          <button
            onClick={() => setSubTab('curves')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
              subTab === 'curves' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Curvas RGB
          </button>
          <button
            onClick={() => setSubTab('luts')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
              subTab === 'luts' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            LUTs 3D
          </button>
          <button
            onClick={() => setSubTab('scopes')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
              subTab === 'scopes' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Scopes
          </button>
        </div>

        {/* Comparación Antes/Después */}
        <button
          onClick={() => setBeforeAfterMode(beforeAfterMode === 'normal' ? 'split' : 'normal')}
          title="Alternar comparación Antes / Después"
          className={`p-1.5 rounded border text-[11px] flex items-center gap-1 transition ${
            beforeAfterMode === 'split' 
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>A/B</span>
        </button>
      </div>

      {/* 1. Sub-Tab: Ruedas Lift / Gamma / Gain / Offset */}
      {subTab === 'wheels' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              Gradación Primaria (Lift / Gamma / Gain)
            </span>
            <button
              onClick={resetWheels}
              className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* LIFT (Sombras) */}
            <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800/80 space-y-2">
              <div className="text-[11px] font-semibold text-sky-400 flex justify-between">
                <span>Lift (Sombras)</span>
                <span className="font-mono text-[10px] text-slate-400">Y: {wheels.lift.y.toFixed(2)}</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-3 text-red-400 font-mono text-[10px]">R</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={wheels.lift.r}
                    onChange={(e) => handleWheelChange('lift', 'r', parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-slate-800 rounded accent-red-500 cursor-pointer"
                  />
                  <span className="w-7 font-mono text-[10px] text-right">{wheels.lift.r.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 text-green-400 font-mono text-[10px]">G</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={wheels.lift.g}
                    onChange={(e) => handleWheelChange('lift', 'g', parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-slate-800 rounded accent-green-500 cursor-pointer"
                  />
                  <span className="w-7 font-mono text-[10px] text-right">{wheels.lift.g.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 text-blue-400 font-mono text-[10px]">B</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={wheels.lift.b}
                    onChange={(e) => handleWheelChange('lift', 'b', parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-slate-800 rounded accent-blue-500 cursor-pointer"
                  />
                  <span className="w-7 font-mono text-[10px] text-right">{wheels.lift.b.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* GAMMA (Medios) */}
            <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800/80 space-y-2">
              <div className="text-[11px] font-semibold text-emerald-400 flex justify-between">
                <span>Gamma (Medios)</span>
                <span className="font-mono text-[10px] text-slate-400">Y: {wheels.gamma.y.toFixed(2)}</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-3 text-red-400 font-mono text-[10px]">R</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={wheels.gamma.r}
                    onChange={(e) => handleWheelChange('gamma', 'r', parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-slate-800 rounded accent-red-500 cursor-pointer"
                  />
                  <span className="w-7 font-mono text-[10px] text-right">{wheels.gamma.r.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 text-green-400 font-mono text-[10px]">G</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={wheels.gamma.g}
                    onChange={(e) => handleWheelChange('gamma', 'g', parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-slate-800 rounded accent-green-500 cursor-pointer"
                  />
                  <span className="w-7 font-mono text-[10px] text-right">{wheels.gamma.g.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 text-blue-400 font-mono text-[10px]">B</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={wheels.gamma.b}
                    onChange={(e) => handleWheelChange('gamma', 'b', parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-slate-800 rounded accent-blue-500 cursor-pointer"
                  />
                  <span className="w-7 font-mono text-[10px] text-right">{wheels.gamma.b.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* GAIN (Luces) */}
            <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800/80 space-y-2">
              <div className="text-[11px] font-semibold text-amber-400 flex justify-between">
                <span>Gain (Luces)</span>
                <span className="font-mono text-[10px] text-slate-400">Y: {wheels.gain.y.toFixed(2)}</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-3 text-red-400 font-mono text-[10px]">R</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={wheels.gain.r}
                    onChange={(e) => handleWheelChange('gain', 'r', parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-slate-800 rounded accent-red-500 cursor-pointer"
                  />
                  <span className="w-7 font-mono text-[10px] text-right">{wheels.gain.r.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 text-green-400 font-mono text-[10px]">G</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={wheels.gain.g}
                    onChange={(e) => handleWheelChange('gain', 'g', parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-slate-800 rounded accent-green-500 cursor-pointer"
                  />
                  <span className="w-7 font-mono text-[10px] text-right">{wheels.gain.g.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 text-blue-400 font-mono text-[10px]">B</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={wheels.gain.b}
                    onChange={(e) => handleWheelChange('gain', 'b', parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-slate-800 rounded accent-blue-500 cursor-pointer"
                  />
                  <span className="w-7 font-mono text-[10px] text-right">{wheels.gain.b.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* OFFSET (Global) */}
            <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800/80 space-y-2">
              <div className="text-[11px] font-semibold text-purple-400 flex justify-between">
                <span>Offset Global</span>
                <span className="font-mono text-[10px] text-slate-400">Y: {wheels.offset.y.toFixed(2)}</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-3 text-red-400 font-mono text-[10px]">R</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={wheels.offset.r}
                    onChange={(e) => handleWheelChange('offset', 'r', parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-slate-800 rounded accent-red-500 cursor-pointer"
                  />
                  <span className="w-7 font-mono text-[10px] text-right">{wheels.offset.r.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 text-green-400 font-mono text-[10px]">G</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={wheels.offset.g}
                    onChange={(e) => handleWheelChange('offset', 'g', parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-slate-800 rounded accent-green-500 cursor-pointer"
                  />
                  <span className="w-7 font-mono text-[10px] text-right">{wheels.offset.g.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 text-blue-400 font-mono text-[10px]">B</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={wheels.offset.b}
                    onChange={(e) => handleWheelChange('offset', 'b', parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-slate-800 rounded accent-blue-500 cursor-pointer"
                  />
                  <span className="w-7 font-mono text-[10px] text-right">{wheels.offset.b.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Sub-Tab: Curvas RGB & Master */}
      {subTab === 'curves' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              Curvas de Tono y Canales
            </span>
            <div className="flex bg-slate-900 rounded border border-slate-800 p-0.5">
              {(['master', 'red', 'green', 'blue'] as const).map(channel => (
                <button
                  key={channel}
                  onClick={() => setActiveCurveChannel(channel)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                    activeCurveChannel === channel
                      ? channel === 'red' ? 'bg-red-600 text-white'
                        : channel === 'green' ? 'bg-green-600 text-white'
                        : channel === 'blue' ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {channel === 'master' ? 'Lum' : channel[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Gráfico Visual de la Curva */}
          <div className="relative w-full h-44 bg-slate-950 border border-slate-800 rounded overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* Cuadrícula de referencia 4x4 */}
              <line x1="25" y1="0" x2="25" y2="100" stroke="#1E293B" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="50" y1="0" x2="50" y2="100" stroke="#334155" strokeWidth="0.5" />
              <line x1="75" y1="0" x2="75" y2="100" stroke="#1E293B" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="0" y1="25" x2="100" y2="25" stroke="#1E293B" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="#334155" strokeWidth="0.5" />
              <line x1="0" y1="75" x2="100" y2="75" stroke="#1E293B" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="0" y1="100" x2="100" y2="0" stroke="#334155" strokeWidth="0.5" strokeDasharray="1,2" />

              {/* Trazado de la curva activa */}
              <path
                d={`M 0 100 Q 25 75, 50 50 T 100 0`}
                fill="none"
                stroke={
                  activeCurveChannel === 'red' ? '#EF4444'
                    : activeCurveChannel === 'green' ? '#10B981'
                    : activeCurveChannel === 'blue' ? '#3B82F6'
                    : '#F8FAFC'
                }
                strokeWidth="2"
              />
            </svg>
          </div>
          <div className="text-[10px] text-slate-500 text-center">
            Puntos ({curves[activeCurveChannel].length}): spline hermítica adaptada al estándar de posproducción
          </div>
        </div>
      )}

      {/* 3. Sub-Tab: Biblioteca de LUTs 3D (.cube) */}
      {subTab === 'luts' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              3D LUT (.cube) Cinematic Presets
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
              <input
                type="checkbox"
                checked={lut.isEnabled}
                onChange={(e) => onUpdateLut({ isEnabled: e.target.checked })}
                className="rounded bg-slate-900 border-slate-700 text-blue-500"
              />
              <span className={lut.isEnabled ? 'text-blue-400 font-medium' : 'text-slate-500'}>
                Habilitado
              </span>
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] text-slate-400">Intensidad del LUT ({Math.round((lut.strength ?? 1) * 100)}%)</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={lut.strength ?? 1}
              onChange={(e) => onUpdateLut({ strength: parseFloat(e.target.value) })}
              className="w-full h-1 bg-slate-800 rounded accent-blue-500 cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {COLOR_PRESETS_CATALOG.map(p => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className={`p-2 rounded border text-left transition flex flex-col justify-between ${
                  lut.name === p.name 
                    ? 'bg-blue-600/20 border-blue-500 text-white' 
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="font-medium text-[11px] flex items-center justify-between">
                  <span>{p.name}</span>
                  {lut.name === p.name && <Check className="w-3 h-3 text-blue-400" />}
                </div>
                <div className="text-[9px] text-slate-500 mt-1 line-clamp-1">{p.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Sub-Tab: Scopes (Waveform, Histograma, Vectorscopio) */}
      {subTab === 'scopes' && (
        <div className="space-y-3">
          <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>Monitores de Señal de Video (Scopes)</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-950 p-2 rounded border border-slate-800 flex flex-col items-center">
              <span className="text-[10px] text-slate-400 font-medium mb-1">Histograma RGB</span>
              <div className="w-full h-20 bg-slate-900/80 rounded flex items-end justify-between px-1">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    style={{ height: `${Math.min(100, (Math.sin(i * 0.4) + 1.2) * 35)}%` }}
                    className="w-1 bg-blue-500/70 rounded-t"
                  />
                ))}
              </div>
            </div>

            <div className="bg-slate-950 p-2 rounded border border-slate-800 flex flex-col items-center">
              <span className="text-[10px] text-slate-400 font-medium mb-1">Waveform Luma</span>
              <div className="w-full h-20 bg-slate-900/80 rounded flex items-center justify-center font-mono text-[9px] text-emerald-400">
                IRE 0 - 100
              </div>
            </div>

            <div className="bg-slate-950 p-2 rounded border border-slate-800 flex flex-col items-center">
              <span className="text-[10px] text-slate-400 font-medium mb-1">Vectorscopio</span>
              <div className="w-16 h-16 rounded-full border border-slate-700 bg-slate-900/80 flex items-center justify-center font-mono text-[8px] text-purple-400">
                Cb / Cr
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
