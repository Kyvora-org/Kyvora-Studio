import React, { useState } from 'react';
import { 
  TimelineClip, 
  AudioEffectsSuite, 
  ParametricEQBand,
  getDefaultAudioSuite,
  AUDIO_PRESETS_CATALOG,
  calculateFrequencyResponse
} from '@kyvora/editor-core';
import { RotateCcw } from 'lucide-react';

interface AudioMixerPanelProps {
  clip: TimelineClip;
  onUpdateAudioSuite: (suite: Partial<AudioEffectsSuite>) => void;
}

export const AudioMixerPanel: React.FC<AudioMixerPanelProps> = ({
  clip,
  onUpdateAudioSuite
}) => {
  const [activeTab, setActiveTab] = useState<'eq' | 'dynamics' | 'spatial' | 'presets'>('eq');

  const suite: AudioEffectsSuite = clip.audioSuite || getDefaultAudioSuite();

  const updateEqBand = (bandId: string, updates: Partial<ParametricEQBand>) => {
    const newBands = suite.eqBands.map(b => b.id === bandId ? { ...b, ...updates } : b);
    onUpdateAudioSuite({ eqBands: newBands });
  };

  const applyAudioPreset = (presetId: string) => {
    const preset = AUDIO_PRESETS_CATALOG.find(p => p.id === presetId);
    if (!preset) return;
    onUpdateAudioSuite(preset.suite);
  };

  // Puntos para visualización de curva EQ (20 Hz a 20 kHz)
  const curveFreqs = [20, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000];
  const responseCurve = calculateFrequencyResponse(suite.eqBands, curveFreqs);

  return (
    <div className="space-y-4 text-xs text-slate-300">
      {/* Sub-Navegación del Suite de Audio */}
      <div className="flex bg-slate-900 p-0.5 rounded border border-slate-800">
        <button
          onClick={() => setActiveTab('eq')}
          className={`flex-1 py-1 rounded text-[11px] font-medium transition ${
            activeTab === 'eq' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          EQ 5-Bandas
        </button>
        <button
          onClick={() => setActiveTab('dynamics')}
          className={`flex-1 py-1 rounded text-[11px] font-medium transition ${
            activeTab === 'dynamics' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Dinámica
        </button>
        <button
          onClick={() => setActiveTab('spatial')}
          className={`flex-1 py-1 rounded text-[11px] font-medium transition ${
            activeTab === 'spatial' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Espacial FX
        </button>
        <button
          onClick={() => setActiveTab('presets')}
          className={`flex-1 py-1 rounded text-[11px] font-medium transition ${
            activeTab === 'presets' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Presets
        </button>
      </div>

      {/* 1. Ecualizador Paramétrico de 5 Bandas */}
      {activeTab === 'eq' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              Ecualizador Paramétrico Pro
            </span>
            <button
              onClick={() => onUpdateAudioSuite({ eqBands: getDefaultAudioSuite().eqBands })}
              className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>

          {/* Gráfico Visual de Respuesta en Frecuencia */}
          <div className="relative w-full h-24 bg-slate-950 border border-slate-800 rounded p-1 flex items-center justify-between">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* Línea central 0 dB */}
              <line x1="0" y1="50" x2="100" y2="50" stroke="#334155" strokeWidth="0.8" />
              <line x1="0" y1="25" x2="100" y2="25" stroke="#1E293B" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="0" y1="75" x2="100" y2="75" stroke="#1E293B" strokeWidth="0.5" strokeDasharray="2,2" />

              {/* Curva interpolada aproximada */}
              <polyline
                fill="none"
                stroke="#3B82F6"
                strokeWidth="2"
                points={responseCurve
                  .map((p, idx) => {
                    const x = (idx / (responseCurve.length - 1)) * 100;
                    // Y: 0 dB en 50, +12 dB en 10, -12 dB en 90
                    const y = Math.max(5, Math.min(95, 50 - (p.gainDb / 12) * 40));
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
            </svg>
          </div>

          {/* Sliders de Bandas */}
          <div className="space-y-2">
            {suite.eqBands.map((band, idx) => (
              <div key={band.id} className="bg-slate-900/60 p-2 rounded border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={band.isEnabled}
                      onChange={(e) => updateEqBand(band.id, { isEnabled: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-blue-500"
                    />
                    <span className="font-medium text-slate-300">
                      Banda {idx + 1} ({band.type})
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-blue-400">
                    {band.frequencyHz < 1000 ? `${band.frequencyHz} Hz` : `${(band.frequencyHz / 1000).toFixed(1)} kHz`} | {band.gainDb > 0 ? `+${band.gainDb.toFixed(1)}` : band.gainDb.toFixed(1)} dB
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-8">Gain</span>
                  <input
                    type="range"
                    min="-18"
                    max="18"
                    step="0.5"
                    value={band.gainDb}
                    disabled={!band.isEnabled}
                    onChange={(e) => updateEqBand(band.id, { gainDb: parseFloat(e.target.value) })}
                    className="flex-1 h-1 bg-slate-800 rounded accent-blue-500 cursor-pointer disabled:opacity-40"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Dinámica (Compresor, Limitador, Noise Gate) */}
      {activeTab === 'dynamics' && (
        <div className="space-y-4">
          {/* Compresor */}
          <div className="bg-slate-900/60 p-3 rounded border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-200 uppercase tracking-wider">
                Compresor Dinámico
              </span>
              <input
                type="checkbox"
                checked={suite.compressor.isEnabled}
                onChange={(e) => onUpdateAudioSuite({ compressor: { ...suite.compressor, isEnabled: e.target.checked } })}
                className="rounded bg-slate-900 border-slate-700 text-blue-500"
              />
            </div>

            {suite.compressor.isEnabled && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Umbral (Threshold)</span>
                  <span className="font-mono text-slate-300">{suite.compressor.thresholdDb} dB</span>
                </div>
                <input
                  type="range"
                  min="-40"
                  max="0"
                  value={suite.compressor.thresholdDb}
                  onChange={(e) => onUpdateAudioSuite({ compressor: { ...suite.compressor, thresholdDb: parseFloat(e.target.value) } })}
                  className="w-full h-1 bg-slate-800 rounded accent-blue-500"
                />

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Ratio de Compresión</span>
                  <span className="font-mono text-slate-300">{suite.compressor.ratio}:1</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={suite.compressor.ratio}
                  onChange={(e) => onUpdateAudioSuite({ compressor: { ...suite.compressor, ratio: parseFloat(e.target.value) } })}
                  className="w-full h-1 bg-slate-800 rounded accent-blue-500"
                />

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Ganancia de Compensación (Makeup)</span>
                  <span className="font-mono text-slate-300">+{suite.compressor.makeupGainDb} dB</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="0.5"
                  value={suite.compressor.makeupGainDb}
                  onChange={(e) => onUpdateAudioSuite({ compressor: { ...suite.compressor, makeupGainDb: parseFloat(e.target.value) } })}
                  className="w-full h-1 bg-slate-800 rounded accent-blue-500"
                />
              </div>
            )}
          </div>

          {/* Limitador Brickwall */}
          <div className="bg-slate-900/60 p-3 rounded border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-200 uppercase tracking-wider">
                Limitador Brickwall Antidistorsión
              </span>
              <input
                type="checkbox"
                checked={suite.limiter.isEnabled}
                onChange={(e) => onUpdateAudioSuite({ limiter: { ...suite.limiter, isEnabled: e.target.checked } })}
                className="rounded bg-slate-900 border-slate-700 text-amber-500"
              />
            </div>
            {suite.limiter.isEnabled && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Techo de Salida (Ceiling)</span>
                  <span className="font-mono text-slate-300">{suite.limiter.ceilingDb} dBFS</span>
                </div>
                <input
                  type="range"
                  min="-6"
                  max="0"
                  step="0.1"
                  value={suite.limiter.ceilingDb}
                  onChange={(e) => onUpdateAudioSuite({ limiter: { ...suite.limiter, ceilingDb: parseFloat(e.target.value) } })}
                  className="w-full h-1 bg-slate-800 rounded accent-amber-500"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Espacial FX (Reverb & Delay) */}
      {activeTab === 'spatial' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 p-3 rounded border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-200 uppercase tracking-wider">
                Reverberación de Sala
              </span>
              <input
                type="checkbox"
                checked={suite.reverb.isEnabled}
                onChange={(e) => onUpdateAudioSuite({ reverb: { ...suite.reverb, isEnabled: e.target.checked } })}
                className="rounded bg-slate-900 border-slate-700 text-purple-500"
              />
            </div>
            {suite.reverb.isEnabled && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Tamaño de Sala (Room Size)</span>
                  <span className="font-mono text-slate-300">{Math.round(suite.reverb.roomSize * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={suite.reverb.roomSize}
                  onChange={(e) => onUpdateAudioSuite({ reverb: { ...suite.reverb, roomSize: parseFloat(e.target.value) } })}
                  className="w-full h-1 bg-slate-800 rounded accent-purple-500"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Presets de Audio */}
      {activeTab === 'presets' && (
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
            Plantillas Acústicas
          </span>
          <div className="space-y-2">
            {AUDIO_PRESETS_CATALOG.map(p => (
              <button
                key={p.id}
                onClick={() => applyAudioPreset(p.id)}
                className="w-full p-2.5 rounded border border-slate-800 bg-slate-900/60 hover:border-slate-700 text-left transition flex flex-col"
              >
                <div className="font-medium text-[11px] text-slate-200 flex items-center justify-between">
                  <span>{p.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                    {p.category}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">{p.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
