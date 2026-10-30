import React from 'react';
import { 
  Keyframe, 
  KeyframeInterpolation, 
  BEZIER_PRESETS
} from '@kyvora/editor-core';
import { Activity } from 'lucide-react';

interface GraphEditorProps {
  keyframes: Keyframe[];
  selectedKeyframeId?: string;
  onUpdateKeyframe: (keyframeId: string, updates: Partial<Keyframe>) => void;
}

export const GraphEditor: React.FC<GraphEditorProps> = ({
  keyframes,
  selectedKeyframeId,
  onUpdateKeyframe
}) => {
  const activeKf = keyframes.find(k => k.id === selectedKeyframeId) || keyframes[0];

  const currentInterp: KeyframeInterpolation = activeKf?.interpolation || activeKf?.easing || 'linear';

  const setEasingPreset = (presetName: keyof typeof BEZIER_PRESETS) => {
    if (!activeKf) return;
    const points = BEZIER_PRESETS[presetName];
    onUpdateKeyframe(activeKf.id, {
      interpolation: 'bezier',
      controlPointIn: { x: points[0], y: points[1] },
      controlPointOut: { x: points[2], y: points[3] }
    });
  };

  return (
    <div className="space-y-4 text-xs text-slate-300">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          <span>Editor de Curvas Bézier (Graph Editor)</span>
        </span>
      </div>

      {/* Selector de Interpolación */}
      <div className="flex bg-slate-900 p-0.5 rounded border border-slate-800">
        {(['linear', 'easeIn', 'easeOut', 'easeInOut', 'hold'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => activeKf && onUpdateKeyframe(activeKf.id, { interpolation: mode })}
            className={`flex-1 py-1 rounded text-[10px] font-medium transition ${
              currentInterp === mode ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Lienzo SVG de la Curva */}
      <div className="relative w-full h-36 bg-slate-950 border border-slate-800 rounded p-2 overflow-hidden">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Ejes y referencias */}
          <line x1="0" y1="50" x2="100" y2="50" stroke="#1E293B" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="50" y1="0" x2="50" y2="100" stroke="#1E293B" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="0" y1="100" x2="100" y2="0" stroke="#334155" strokeWidth="0.5" strokeDasharray="1,2" />

          {/* Curva Bézier interpolada */}
          <path
            d={
              currentInterp === 'easeInOut'
                ? 'M 0 100 C 42 100, 58 0, 100 0'
                : currentInterp === 'easeIn'
                ? 'M 0 100 C 42 100, 100 100, 100 0'
                : currentInterp === 'easeOut'
                ? 'M 0 100 C 0 0, 58 0, 100 0'
                : currentInterp === 'hold'
                ? 'M 0 100 L 99 100 L 99 0 L 100 0'
                : 'M 0 100 L 100 0'
            }
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2.5"
          />

          {/* Puntos de anclaje inicial y final */}
          <circle cx="0" cy="100" r="3" fill="#60A5FA" />
          <circle cx="100" cy="0" r="3" fill="#60A5FA" />
        </svg>
      </div>

      {/* Botones Rápidos de Curvas Easing */}
      <div className="space-y-1.5">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Presets de Animación Suave</span>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => setEasingPreset('easeIn')}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 text-[10px] text-slate-300 transition"
          >
            Aceleración (In)
          </button>
          <button
            onClick={() => setEasingPreset('easeOut')}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 text-[10px] text-slate-300 transition"
          >
            Deceleración (Out)
          </button>
          <button
            onClick={() => setEasingPreset('easeInOut')}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 text-[10px] text-slate-300 transition"
          >
            Suave (In-Out)
          </button>
          <button
            onClick={() => setEasingPreset('backOut')}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 text-[10px] text-slate-300 transition col-span-3 text-center text-blue-400 font-medium"
          >
            Rebote Cinematográfico (Back Out / Overshoot)
          </button>
        </div>
      </div>
    </div>
  );
};
