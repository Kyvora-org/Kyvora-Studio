import React, { useState } from 'react';
import { 
  useEditorStore, 
  ExportSettings, 
  ExportResolution, 
  ExportQuality, 
  VideoCodec, 
  AudioCodec, 
  RESOLUTION_PRESETS,
  WebExportAdapter,
  defaultWebMediaRepository
} from '@kyvora/editor-core';
import { 
  Download, 
  X, 
  Film, 
  CheckCircle2, 
  AlertTriangle, 
  StopCircle,
  FolderOpen
} from 'lucide-react';
import { showSaveExportDialog, isTauriEnvironment } from '../utils/fileDialogs';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const { project } = useEditorStore();

  const getInitialPreset = (): ExportResolution => {
    const w = project.settings?.width;
    const h = project.settings?.height;
    if (w === 1280 && h === 720) return '720p';
    if (w === 1920 && h === 1080) return '1080p';
    if (w === 2560 && h === 1440) return '1440p';
    if (w === 3840 && h === 2160) return '4k';
    return 'custom';
  };

  const [preset, setPreset] = useState<ExportResolution>(getInitialPreset());
  const [customWidth, setCustomWidth] = useState<number>(project.settings?.width || 1920);
  const [customHeight, setCustomHeight] = useState<number>(project.settings?.height || 1080);
  const [fps, setFps] = useState<number>(project.settings?.frameRate || 30);
  const [quality, setQuality] = useState<ExportQuality>('high');
  const [customBitrateMbps, setCustomBitrateMbps] = useState<number>(12);
  const [vcodec, setVcodec] = useState<VideoCodec>('h264');
  const [acodec, setAcodec] = useState<AudioCodec>('aac');
  const [outputPath, setOutputPath] = useState<string>(
    `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_export.mp4`
  );

  // Sincronizar cuando se abra el modal si el proyecto cambió en el inspector
  React.useEffect(() => {
    if (isOpen) {
      const p = getInitialPreset();
      setPreset(p);
      setCustomWidth(project.settings?.width || 1920);
      setCustomHeight(project.settings?.height || 1080);
      setFps(project.settings?.frameRate || 30);
      setOutputPath(`${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_export.mp4`);
      setExportError(null);
      setIsCompleted(false);
      setProgressPct(0);
    }
  }, [isOpen, project.settings?.width, project.settings?.height, project.settings?.frameRate, project.name]);

  const [isExporting, setIsExporting] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [exportError, setExportError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [webAdapter, setWebAdapter] = useState<WebExportAdapter | null>(null);
  const [logEvents, setLogEvents] = useState<Array<{ stage: string; message: string; timestamp: string }>>([]);
  const [showLogs, setShowLogs] = useState(false);

  if (!isOpen) return null;

  const appendLog = (stage: string, message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[Export][${stage}] ${message}`);
    setLogEvents(prev => [...prev, { stage, message, timestamp }]);
    try {
      const tauriGlobal = (window as any).__TAURI_INTERNALS__;
      tauriGlobal?.invoke?.('append_export_log', { stage, message });
    } catch {
      // Ignorar fallback web
    }
  };

  const handlePickOutputPath = async () => {
    const defaultName = outputPath || `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_export.mp4`;
    const selected = await showSaveExportDialog(defaultName);
    if (selected) {
      setOutputPath(selected);
      appendLog('output_path_selected', `Ruta seleccionada: ${selected}`);
    }
  };

  const handleStartExport = async () => {
    setLogEvents([]);
    setExportError(null);
    setIsCompleted(false);
    setProgressPct(0);

    appendLog('export_requested', `Iniciando solicitud de exportación para "${project.name}"`);

    // 1. Validar línea de tiempo
    const totalClips = project.tracks.reduce((acc, t) => acc + t.clips.length, 0);
    if (totalClips === 0) {
      const err = 'La línea de tiempo no contiene ningún clip para exportar.';
      setExportError(err);
      appendLog('export_failed', err);
      return;
    }

    if (project.durationSeconds <= 0) {
      const err = 'La duración del proyecto debe ser mayor a 0 segundos.';
      setExportError(err);
      appendLog('export_failed', err);
      return;
    }

    appendLog('timeline_validated', `Validada: ${project.tracks.length} pistas, ${totalClips} clips, ${project.durationSeconds.toFixed(2)}s`);

    // 2. Comprobar / solicitar ruta de salida
    let targetPath = outputPath.trim();
    if (!targetPath) {
      const selected = await showSaveExportDialog(`${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_export.mp4`);
      if (!selected) {
        appendLog('export_aborted', 'Exportación cancelada: No se definió ruta de destino.');
        return;
      }
      targetPath = selected;
      setOutputPath(selected);
      appendLog('output_path_selected', `Ruta confirmada: ${selected}`);
    }

    setIsExporting(true);
    setProgressStatus('Preparando recursos multimedia...');

    const baseDims = RESOLUTION_PRESETS[preset] || { width: 1920, height: 1080 };
    const finalW = preset === 'custom' ? customWidth : baseDims.width;
    const finalH = preset === 'custom' ? customHeight : baseDims.height;

    const settings: ExportSettings = {
      resolutionPreset: preset,
      width: finalW % 2 !== 0 ? finalW - 1 : finalW,
      height: finalH % 2 !== 0 ? finalH - 1 : finalH,
      fps,
      quality,
      videoCodec: vcodec,
      audioCodec: acodec,
      customBitrateKbps: customBitrateMbps ? Math.round(customBitrateMbps * 1000) : undefined,
      outputPath: targetPath
    };

    try {
      const isTauri = isTauriEnvironment();

      if (isTauri) {
        const tauriGlobal = (window as any).__TAURI_INTERNALS__;
        const invokeFn = tauriGlobal?.invoke;
        if (!invokeFn) {
          throw new Error('Bridge IPC de Tauri no disponible.');
        }

        // Registrar listener de eventos de progreso de FFmpeg desde Rust
        let unlistenProgress: (() => void) | undefined = undefined;
        try {
          const tauriApi = (window as any).__TAURI__;
          const listenFn = tauriApi?.event?.listen;
          if (typeof listenFn === 'function') {
            let lastStatusUpdate = 0;
            unlistenProgress = await listenFn('export-progress', (event: any) => {
              const payload = event.payload;
              if (payload) {
                if (payload.percentage !== undefined) {
                  setProgressPct(Math.round(payload.percentage));
                }
                const now = Date.now();
                if (now - lastStatusUpdate >= 250 || payload.is_completed) {
                  lastStatusUpdate = now;
                  const fpsText = payload.fps ? `${payload.fps.toFixed(1)} fps` : '';
                  const speedText = payload.speed ? `(${payload.speed})` : '';
                  const timeText = payload.current_time_seconds !== undefined ? `${payload.current_time_seconds.toFixed(1)}s / ${payload.total_duration_seconds?.toFixed(1)}s` : '';
                  setProgressStatus(`Codificando: ${timeText} ${fpsText} ${speedText}`);
                }
              }
            });
          }
        } catch {
          // Event fallback
        }

        appendLog('ffmpeg_resolved', 'FFmpeg detectado y verificado en el sistema.');

        // 3. Staging de medios si no existen como archivos locales accesibles
        // Para cada activo en el proyecto, asegurar que tenga una ruta accesible en disco para FFmpeg
        const stagedProject = JSON.parse(JSON.stringify(project));
        for (const asset of stagedProject.assets) {
          let hasLocalPath = false;
          if (asset.filePath) {
            try {
              // Validar existencia nativa en disco SIN cargar el binario completo en la memoria JS
              const exists = await invokeFn('check_file_exists', { filePath: asset.filePath });
              if (exists) {
                hasLocalPath = true;
                appendLog('staging_media', `Medio verificado en disco: "${asset.name}" -> ${asset.filePath}`);
              } else {
                appendLog('staging_media', `Archivo no encontrado en ruta: "${asset.filePath}". Intentando fallback.`);
              }
            } catch {
              hasLocalPath = false;
            }
          }

          if (!hasLocalPath) {
            appendLog('staging_media', `Extrayendo binario de almacenamiento persistente para "${asset.name}" (ID: ${asset.id})...`);
            const stored = await defaultWebMediaRepository.getMedia(asset.id);
            if (!stored || !stored.data) {
              const reason = !stored 
                ? 'El activo no existe en el repositorio de persistencia multimedia (IndexedDB/Memoria)' 
                : 'El registro multimedia existe pero no contiene bytes binarios (data vacía)';
              throw new Error(`Error en preparación de medios: No se pudo recuperar el binario del activo "${asset.name}" (ID: ${asset.id}). Causa: ${reason}.`);
            }

            const byteLength = stored.data.byteLength || stored.data.length || 0;
            appendLog('staging_media', `Binario recuperado para "${asset.name}": ${byteLength} bytes. Creando archivo temporal para FFmpeg...`);

            const sanitizedName = asset.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
            const stagedFilePath = await invokeFn('write_temp_media_file', {
              filename: `${asset.id}_${sanitizedName}`,
              contents: stored.data instanceof Uint8Array ? Array.from(stored.data) : Array.from(new Uint8Array(stored.data))
            });

            asset.filePath = stagedFilePath;
            appendLog('staging_media', `Medio preparado con éxito en ruta temporal: ${stagedFilePath}`);
          }
        }

        const { generateRenderPlan } = await import('@kyvora/editor-core');
        const plan = generateRenderPlan(stagedProject, settings);

        appendLog('ffmpeg_started', `Iniciando proceso FFmpeg con destino: ${targetPath}`);
        setProgressStatus('Iniciando codificación con FFmpeg...');

        const res = await invokeFn('execute_ffmpeg_export', {
          request: {
            output_path: targetPath,
            duration_seconds: project.durationSeconds,
            ffmpeg_args: plan.ffmpegArgs
          }
        });

        // Limpiar archivos temporales de staging
        invokeFn('cleanup_temp_media_files').catch(() => {});
        if (unlistenProgress) unlistenProgress();

        appendLog('ffmpeg_finished', 'FFmpeg finalizó exitosamente.');
        appendLog('output_validated', String(res));

        setProgressPct(100);
        setProgressStatus(String(res));
        setIsCompleted(true);
      } else {
        // En entorno Web utilizamos WebExportAdapter con composición en Canvas y descarga de Blob
        appendLog('ffmpeg_resolved', 'Entorno Web detectado. Usando WebExportAdapter.');
        const adapter = new WebExportAdapter();
        setWebAdapter(adapter);

        const exportedBlob = await adapter.exportProjectWeb(project, settings, (p) => {
          setProgressPct(p.percentage);
          setProgressStatus(`Renderizando: Cuadro ${p.frameCurrent}/${p.totalFrames} (${p.status})`);
          appendLog('ffmpeg_progress', `Cuadro ${p.frameCurrent}/${p.totalFrames} (${p.percentage}%)`);
        });

        // Disparar descarga en navegador
        const blobUrl = URL.createObjectURL(exportedBlob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = targetPath.endsWith('.mp4') ? targetPath : `${targetPath}.mp4`;
        a.click();
        URL.revokeObjectURL(blobUrl);

        setIsCompleted(true);
        appendLog('output_validated', 'Descarga generada y validada en el navegador.');
        setProgressStatus('Exportación Web finalizada. Descarga completada.');
      }
    } catch (err) {
      const msg = (err as Error).message;
      setExportError(msg);
      appendLog('export_failed', msg);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCancel = () => {
    if (webAdapter) {
      webAdapter.cancel();
    }
    // Si es Tauri intentamos llamar cancel_export_task
    if (isTauriEnvironment()) {
      const tauriGlobal = (window as any).__TAURI_INTERNALS__;
      if (tauriGlobal?.invoke) {
        tauriGlobal.invoke('cancel_export_task').catch(() => {});
      }
    }
    setIsExporting(false);
    setProgressStatus('Exportación cancelada por el usuario.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="h-12 px-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-blue-500" />
            <h3 className="font-semibold text-sm">Exportar Video — Kyvora Studio</h3>
          </div>
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 space-y-4 text-xs">
          {/* Preset y Resolución */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">Resolución</label>
              <select
                disabled={isExporting}
                value={preset}
                onChange={(e) => setPreset(e.target.value as ExportResolution)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="1080p">1080p Full HD (1920×1080)</option>
                <option value="720p">720p HD (1280×720)</option>
                <option value="480p">480p SD (854×480)</option>
                <option value="1440p">1440p 2K QHD (2560×1440)</option>
                <option value="4k">4K Ultra HD (3840×2160)</option>
                <option value="custom">Personalizada...</option>
              </select>

              {preset === 'custom' && (
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <input
                    type="number"
                    min="320"
                    max="7680"
                    disabled={isExporting}
                    value={customWidth}
                    onChange={(e) => setCustomWidth(parseInt(e.target.value) || 1920)}
                    placeholder="Ancho"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-[11px]"
                  />
                  <input
                    type="number"
                    min="240"
                    max="4320"
                    disabled={isExporting}
                    value={customHeight}
                    onChange={(e) => setCustomHeight(parseInt(e.target.value) || 1080)}
                    placeholder="Alto"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-[11px]"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">Tasa de Cuadros (FPS)</label>
              <select
                disabled={isExporting}
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none"
              >
                <option value={24}>24 fps (Cinematográfico)</option>
                <option value={25}>25 fps (PAL / Broadcast Europeo)</option>
                <option value={30}>30 fps (Estándar)</option>
                <option value={50}>50 fps (PAL Alta Velocidad)</option>
                <option value={60}>60 fps (Fluido)</option>
              </select>
            </div>
          </div>

          {/* Calidad, Bitrate y Códec */}
          <div className="grid grid-cols-4 gap-2.5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">Calidad</label>
              <select
                disabled={isExporting}
                value={quality}
                onChange={(e) => setQuality(e.target.value as ExportQuality)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="low">Baja (CRF 28)</option>
                <option value="medium">Media (CRF 23)</option>
                <option value="high">Alta (CRF 18)</option>
                <option value="ultra">Ultra (CRF 14)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">Bitrate (Mbps)</label>
              <input
                type="number"
                min="1"
                max="120"
                disabled={isExporting}
                value={customBitrateMbps}
                onChange={(e) => setCustomBitrateMbps(Math.max(1, parseInt(e.target.value) || 12))}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 text-[11px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">Códec Video</label>
              <select
                disabled={isExporting}
                value={vcodec}
                onChange={(e) => setVcodec(e.target.value as VideoCodec)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="h264">H.264 (Universal MP4)</option>
                <option value="hevc">H.265 / HEVC</option>
                <option value="vp9">VP9 (WebM)</option>
                <option value="prores">Apple ProRes (MOV)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">Códec Audio</label>
              <select
                disabled={isExporting}
                value={acodec}
                onChange={(e) => setAcodec(e.target.value as AudioCodec)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="aac">AAC (Estéreo 48kHz)</option>
                <option value="mp3">MP3</option>
                <option value="opus">Opus (Alta fidelidad)</option>
              </select>
            </div>
          </div>

          {/* Nombre / Ruta de Salida con Selector Nativo */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-400">Ruta y Archivo de Salida</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                disabled={isExporting}
                value={outputPath}
                onChange={(e) => setOutputPath(e.target.value)}
                placeholder="Ruta o nombre del archivo .mp4"
                className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none font-mono text-[11px]"
              />
              <button
                type="button"
                disabled={isExporting}
                onClick={handlePickOutputPath}
                title="Elegir ubicación y nombre mediante diálogo nativo"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-750 text-slate-200 font-medium text-[11px] shrink-0 border border-slate-700 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                <span>Examinar...</span>
              </button>
            </div>
          </div>

          {/* Barra de Progreso y Estado */}
          {isExporting && (
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300 font-medium truncate max-w-[320px]">{progressStatus}</span>
                <span className="font-mono text-blue-400 font-bold">{progressPct}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-500 h-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {isCompleted && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-900/50 rounded-lg text-emerald-300 flex items-center gap-2 text-[11px]">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{progressStatus}</span>
            </div>
          )}

          {exportError && (
            <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-red-300 flex items-start gap-2 text-[11px]">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 whitespace-pre-wrap font-mono text-[10px] leading-relaxed max-h-36 overflow-y-auto">{exportError}</div>
            </div>
          )}

          {/* Registro estructurado de eventos de exportación */}
          {logEvents.length > 0 && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setShowLogs(!showLogs)}
                className="text-[10px] text-slate-400 hover:text-slate-200 underline font-mono flex items-center justify-between w-full"
              >
                <span>{showLogs ? '▼ Ocultar diagnóstico técnico' : '▶ Ver diagnóstico técnico'}</span>
                <span>{logEvents.length} eventos</span>
              </button>
              {showLogs && (
                <div className="p-2 bg-slate-950 border border-slate-800 rounded font-mono text-[10px] space-y-1 max-h-32 overflow-y-auto text-slate-400">
                  {logEvents.map((ev, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-slate-600">{ev.timestamp}</span>
                      <span className="text-blue-400 font-bold">[{ev.stage}]</span>
                      <span className="text-slate-300 truncate">{ev.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="h-14 px-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[10px] text-slate-500">
            Duración: {project.durationSeconds.toFixed(1)}s • MP4 H.264
          </div>

          <div className="flex items-center gap-2">
            {isExporting ? (
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-700/60 transition-colors"
              >
                <StopCircle className="w-3.5 h-3.5" />
                <span>Cancelar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="text-xs px-3 py-1.5 rounded-md bg-slate-800 text-slate-300 hover:text-white transition-colors"
              >
                Cerrar
              </button>
            )}

            {!isCompleted && !isExporting && (
              <button
                type="button"
                onClick={handleStartExport}
                className="flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Iniciar Exportación</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
