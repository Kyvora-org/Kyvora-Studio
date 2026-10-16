import React, { useState, useEffect } from 'react';
import { 
  useEditorStore, 
  validateResolution, 
  PreviewQuality,
  SUPPORTED_FRAME_RATES
} from '@kyvora/editor-core';
import { 
  Settings2, 
  X, 
  Lock, 
  Unlock, 
  Check, 
  AlertCircle, 
  SlidersHorizontal, 
  Monitor, 
  Clock 
} from 'lucide-react';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ isOpen, onClose }) => {
  const { project, updateProjectSettings } = useEditorStore();

  const [preset, setPreset] = useState<string>('custom');
  const [width, setWidth] = useState<number>(project.settings.width);
  const [height, setHeight] = useState<number>(project.settings.height);
  const [fps, setFps] = useState<number>(project.settings.frameRate);
  const [previewQuality, setPreviewQuality] = useState<PreviewQuality>(project.settings.previewQuality || 'balanced');
  const [aspectRatioLocked, setAspectRatioLocked] = useState<boolean>(project.settings.aspectRatioLocked ?? true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sincronizar estado local al abrir
  useEffect(() => {
    if (isOpen) {
      setWidth(project.settings.width);
      setHeight(project.settings.height);
      setFps(project.settings.frameRate);
      setPreviewQuality(project.settings.previewQuality || 'balanced');
      setAspectRatioLocked(project.settings.aspectRatioLocked ?? true);
      setSuccessMessage(null);

      // Determinar preset si coincide
      const w = project.settings.width;
      const h = project.settings.height;
      if (w === 1280 && h === 720) setPreset('720p');
      else if (w === 1920 && h === 1080) setPreset('1080p');
      else if (w === 2560 && h === 1440) setPreset('1440p');
      else if (w === 3840 && h === 2160) setPreset('4k');
      else setPreset('custom');
    }
  }, [isOpen, project.settings]);

  if (!isOpen) return null;

  const handlePresetSelect = (selectedPreset: string) => {
    setPreset(selectedPreset);
    setSuccessMessage(null);

    let newW = width;
    let newH = height;

    if (selectedPreset === '720p') {
      newW = 1280;
      newH = 720;
    } else if (selectedPreset === '1080p') {
      newW = 1920;
      newH = 1080;
    } else if (selectedPreset === '1440p') {
      newW = 2560;
      newH = 1440;
    } else if (selectedPreset === '4k') {
      newW = 3840;
      newH = 2160;
    }

    setWidth(newW);
    setHeight(newH);

    const validation = validateResolution(newW, newH, true);
    setValidationErrors(validation.errors);
  };

  const handleWidthChange = (valStr: string) => {
    const newW = parseInt(valStr, 10);
    setPreset('custom');
    setSuccessMessage(null);

    if (isNaN(newW)) {
      setWidth(NaN);
      setValidationErrors(['El ancho no es un número válido.']);
      return;
    }

    setWidth(newW);

    if (aspectRatioLocked && !isNaN(newW) && newW > 0) {
      const calculatedHeight = Math.round(newW / (16 / 9));
      const evenH = calculatedHeight % 2 !== 0 ? calculatedHeight + 1 : calculatedHeight;
      setHeight(evenH);
      const validation = validateResolution(newW, evenH, true);
      setValidationErrors(validation.errors);
    } else {
      const validation = validateResolution(newW, height, true);
      setValidationErrors(validation.errors);
    }
  };

  const handleHeightChange = (valStr: string) => {
    const newH = parseInt(valStr, 10);
    setPreset('custom');
    setSuccessMessage(null);

    if (isNaN(newH)) {
      setHeight(NaN);
      setValidationErrors(['El alto no es un número válido.']);
      return;
    }

    setHeight(newH);

    if (aspectRatioLocked && !isNaN(newH) && newH > 0) {
      const calculatedWidth = Math.round(newH * (16 / 9));
      const evenW = calculatedWidth % 2 !== 0 ? calculatedWidth + 1 : calculatedWidth;
      setWidth(evenW);
      const validation = validateResolution(evenW, newH, true);
      setValidationErrors(validation.errors);
    } else {
      const validation = validateResolution(width, newH, true);
      setValidationErrors(validation.errors);
    }
  };

  const handleSaveSettings = () => {
    const validation = validateResolution(width, height, true);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    if (!SUPPORTED_FRAME_RATES.includes(fps as any)) {
      setValidationErrors(['La frecuencia de fotogramas debe ser 24, 25, 30, 50 o 60 FPS.']);
      return;
    }

    updateProjectSettings({
      width,
      height,
      frameRate: fps,
      previewQuality,
      aspectRatioLocked
    });

    setSuccessMessage('Ajustes del proyecto actualizados correctamente.');
    setTimeout(() => {
      onClose();
    }, 450);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md text-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-12 px-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Settings2 className="w-4 h-4 text-blue-500" />
            <span>Configuración del Proyecto</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 text-xs">
          {/* Preset de Resolución */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-medium text-slate-300 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-blue-400" />
                <span>Resolución del Proyecto</span>
              </label>
              <button
                type="button"
                onClick={() => setAspectRatioLocked(!aspectRatioLocked)}
                className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border transition-colors ${
                  aspectRatioLocked 
                    ? 'bg-blue-950/80 border-blue-700 text-blue-300' 
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Bloquear o desbloquear proporción de aspecto"
              >
                {aspectRatioLocked ? <Lock className="w-3 h-3 text-blue-400" /> : <Unlock className="w-3 h-3" />}
                <span>{aspectRatioLocked ? '16:9 Fijo' : 'Libre'}</span>
              </button>
            </div>

            <select
              value={preset}
              onChange={(e) => handlePresetSelect(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="720p">HD — 1280 × 720 (16:9)</option>
              <option value="1080p">Full HD — 1920 × 1080 (16:9)</option>
              <option value="1440p">QHD — 2560 × 1440 (16:9)</option>
              <option value="4k">4K UHD — 3840 × 2160 (16:9)</option>
              <option value="custom">Personalizada...</option>
            </select>
          </div>

          {/* Dimensiones Ancho / Alto */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800/80">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-medium">Ancho (px, 64..7680)</span>
              <input
                type="number"
                min="64"
                max="7680"
                step="2"
                value={isNaN(width) ? '' : width}
                onChange={(e) => handleWidthChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-750 focus:border-blue-500 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-medium">Alto (px, 64..7680)</span>
              <input
                type="number"
                min="64"
                max="7680"
                step="2"
                value={isNaN(height) ? '' : height}
                onChange={(e) => handleHeightChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-750 focus:border-blue-500 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none"
              />
            </div>
          </div>

          {/* Frecuencia de Fotogramas (FPS) */}
          <div className="space-y-1.5">
            <label className="font-medium text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Frecuencia de Fotogramas (FPS)</span>
            </label>
            <select
              value={fps}
              onChange={(e) => {
                setFps(parseInt(e.target.value, 10));
                setSuccessMessage(null);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value={24}>24 FPS (Cinematográfico estándar)</option>
              <option value={25}>25 FPS (PAL / Emisión europea)</option>
              <option value={30}>30 FPS (NTSC / Web estándar)</option>
              <option value={50}>50 FPS (PAL alta fluidez)</option>
              <option value={60}>60 FPS (Máxima suavidad y gaming)</option>
            </select>
          </div>

          {/* Calidad de Previsualización */}
          <div className="space-y-1.5">
            <label className="font-medium text-slate-300 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
              <span>Calidad de Vista Previa Predeterminada</span>
            </label>
            <select
              value={previewQuality}
              onChange={(e) => {
                setPreviewQuality(e.target.value as PreviewQuality);
                setSuccessMessage(null);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="performance">Rendimiento (Prioriza fluidez y bajo consumo)</option>
              <option value="balanced">Equilibrada (Balance óptimo CPU/GPU)</option>
              <option value="high">Alta Calidad (Fidelidad completa de efectos y píxeles)</option>
            </select>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              La calidad de vista previa solo afecta al reproductor del monitor y nunca degrada la resolución ni la calidad del video exportado.
            </p>
          </div>

          {/* Alertas y Validaciones */}
          {validationErrors.length > 0 && (
            <div className="p-2.5 rounded bg-red-950/60 border border-red-800/80 text-red-300 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Validación de resolución fallida:</span>
              </div>
              <ul className="list-disc list-inside text-[10px] space-y-0.5">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {successMessage && (
            <div className="p-2.5 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-[11px] font-medium">{successMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-14 px-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-slate-750 text-slate-300 hover:bg-slate-850 hover:text-white transition-colors text-xs font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={validationErrors.length > 0 || isNaN(width) || isNaN(height)}
            onClick={handleSaveSettings}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-blue-600/20"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Aplicar y Guardar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
