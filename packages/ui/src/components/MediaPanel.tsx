import React, { useRef, useState } from 'react';
import { 
  useEditorStore, 
  importMediaFile, 
  defaultWebMediaRepository, 
  MediaImportProgress 
} from '@kyvora/editor-core';
import type { MediaAsset } from '@kyvora/editor-core';
import { 
  FolderPlus, 
  Video, 
  Music, 
  Image as ImageIcon, 
  PlusCircle, 
  HardDrive,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { isTauriEnvironment } from '../utils/fileDialogs';

export const MediaPanel: React.FC = () => {
  const { project, selectedAssetId, selectAsset, addAsset, addClipToTrack } = useEditorStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<MediaImportProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const processFileList = async (files: FileList | File[]) => {
    setErrorMessage(null);
    let errorCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const filePath = (file as any).path || (file as any).webkitRelativePath || undefined;
        const arrayBuffer = await file.arrayBuffer();
        
        let mime = file.type || '';
        if (!mime) {
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) mime = `video/${ext === 'mov' ? 'quicktime' : ext}`;
          else if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) mime = `audio/${ext}`;
          else if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
          else mime = 'application/octet-stream';
        }

        const asset = await importMediaFile(
          new Uint8Array(arrayBuffer),
          file.name,
          mime,
          {
            persistenceRepo: defaultWebMediaRepository,
            filePath: filePath || undefined,
            onProgress: (prog) => setCurrentProgress(prog)
          }
        );

        addAsset(asset);
      } catch (err) {
        errorCount++;
        setErrorMessage(`"${file.name}": ${(err as Error).message}`);
      }
    }

    setTimeout(() => {
      setCurrentProgress(null);
    }, 1500);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportNative = async () => {
    const importId = `imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const startTime = performance.now();
    console.log(`[${new Date().toISOString()}] [${importId}] [IMPORT_START] Iniciando flujo de importación nativa.`);

    if (isTauriEnvironment()) {
      try {
        console.log(`[${new Date().toISOString()}] [${importId}] [FILE_DIALOG_OPEN] Abriendo selector de archivos de Tauri...`);
        const { showOpenMediaDialog, invokeTauriCommand } = await import('../utils/fileDialogs');
        const paths = await showOpenMediaDialog();
        const dialogDuration = (performance.now() - startTime).toFixed(1);
        console.log(`[${new Date().toISOString()}] [${importId}] [FILE_DIALOG_RESOLVED] Diálogo resuelto en ${dialogDuration}ms. Rutas recibidas:`, paths);

        if (!paths || paths.length === 0) {
          console.log(`[${new Date().toISOString()}] [${importId}] [IMPORT_CANCELLED] El usuario cerró o canceló el selector sin elegir archivos.`);
          return;
        }

        console.log(`[${new Date().toISOString()}] [${importId}] [PATHS_RECEIVED] Cantidad de archivos a procesar: ${paths.length}`);
        setErrorMessage(null);
        let errorCount = 0;

        for (let idx = 0; idx < paths.length; idx++) {
          const fullPath = paths[idx];
          const fileStartTime = performance.now();
          const fileName = fullPath.replace(/\\/g, '/').split('/').pop() || 'media';
          console.log(`[${new Date().toISOString()}] [${importId}] [FILE_PROCESS_START] [${idx + 1}/${paths.length}] Archivo: "${fileName}" | Ruta: "${fullPath}"`);

          try {
            const ext = fileName.split('.').pop()?.toLowerCase() || '';
            let mime = 'video/mp4';
            if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) {
              mime = `video/${ext === 'mov' ? 'quicktime' : ext}`;
            } else if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) {
              mime = `audio/${ext}`;
            } else if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
              mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            }

            console.log(`[${new Date().toISOString()}] [${importId}] [FILE_ACCESS_START] Leyendo binario mediante read_project_binary_file...`);
            const accessStart = performance.now();
            const fileBytes = await invokeTauriCommand<number[]>('read_project_binary_file', { filePath: fullPath });
            const accessDuration = (performance.now() - accessStart).toFixed(1);
            console.log(`[${new Date().toISOString()}] [${importId}] [FILE_ACCESS_END] Leídos ${fileBytes?.length || 0} bytes en ${accessDuration}ms.`);

            const bytesArray = new Uint8Array(fileBytes);

            console.log(`[${new Date().toISOString()}] [${importId}] [MEDIA_IMPORT_START] Procesando metadatos y repositorio...`);
            const asset = await importMediaFile(
              bytesArray,
              fileName,
              mime,
              {
                persistenceRepo: defaultWebMediaRepository,
                filePath: fullPath,
                onProgress: (prog) => {
                  console.log(`[${new Date().toISOString()}] [${importId}] [MEDIA_PROGRESS] ${prog.phase} (${prog.percentage}%) - ${prog.fileName}`);
                  setCurrentProgress(prog);
                }
              }
            );
            console.log(`[${new Date().toISOString()}] [${importId}] [MEDIA_IMPORT_END] Activo generado exitosamente: ID="${asset.id}", nombre="${asset.name}", tipo="${asset.type}", duración=${asset.durationInSeconds}s`);

            console.log(`[${new Date().toISOString()}] [${importId}] [STORE_UPDATE_START] Añadiendo activo a Zustand store...`);
            const storeStart = performance.now();
            addAsset(asset);
            const storeDuration = (performance.now() - storeStart).toFixed(1);
            console.log(`[${new Date().toISOString()}] [${importId}] [STORE_UPDATE_END] Activo añadido al store en ${storeDuration}ms. Total assets actuales:`, useEditorStore.getState().project.assets.length);

            const fileTotalDuration = (performance.now() - fileStartTime).toFixed(1);
            console.log(`[${new Date().toISOString()}] [${importId}] [IMPORT_COMPLETE] Finalizado archivo "${fileName}" en ${fileTotalDuration}ms.`);
          } catch (fileErr) {
            errorCount++;
            const errMsg = (fileErr as Error).message;
            console.error(`[${new Date().toISOString()}] [${importId}] [IMPORT_ERROR] Fallo en archivo "${fileName}":`, fileErr);
            setErrorMessage(`Error importando "${fullPath.split(/[\\/]/).pop()}": ${errMsg}`);
          }
        }

        setTimeout(() => {
          setCurrentProgress(null);
        }, 1500);
        return;
      } catch (err) {
        console.error(`[${new Date().toISOString()}] [${importId}] [IMPORT_FATAL_ERROR] Excepción global en handleImportNative:`, err);
        setErrorMessage((err as Error).message);
      }
    }

    console.log(`[${new Date().toISOString()}] [${importId}] [FALLBACK_HTML_INPUT] En entorno web o fallback a input de archivo.`);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFileList(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFileList(e.dataTransfer.files);
    }
  };

  const handleAddSampleClip = (asset: MediaAsset) => {
    const targetTrack = project.tracks.find(t => t.type === (asset.type === 'audio' ? 'audio' : 'video')) || project.tracks[0];
    if (!targetTrack) return;

    const lastClip = targetTrack.clips[targetTrack.clips.length - 1];
    const startTime = lastClip ? (lastClip.startInTimelineSeconds + lastClip.durationSeconds) : 0;

    addClipToTrack(targetTrack.id, {
      assetId: asset.id,
      name: asset.name,
      startInTimelineSeconds: startTime,
      durationSeconds: asset.durationInSeconds,
      sourceStartSeconds: 0,
      color: asset.type === 'video' ? '#3B82F6' : asset.type === 'audio' ? '#10B981' : '#8B5CF6',
      effects: []
    });
  };

  return (
    <aside 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-64 shrink-0 bg-slate-900 border-r flex flex-col select-none transition-colors relative ${
        isDragging ? 'border-blue-500 bg-slate-850/80 ring-2 ring-blue-500/30' : 'border-slate-800'
      }`}
    >
      {/* Header */}
      <div className="h-10 px-3 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
          <HardDrive className="w-3.5 h-3.5 text-blue-400" />
          <span>Panel Multimedia</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">
          {project.assets.length} archivos
        </span>
      </div>

      {/* Action Import Button */}
      <div className="p-2 border-b border-slate-800 space-y-2">
        <input 
          ref={fileInputRef} 
          type="file" 
          multiple 
          accept="video/*,audio/*,image/*,.mkv,.avi,.flac" 
          onChange={handleFileChange} 
          className="hidden" 
        />
        <button
          type="button"
          onClick={handleImportNative}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-sm"
        >
          <FolderPlus className="w-4 h-4" />
          <span>Importar Archivos</span>
        </button>

        {/* Drag & Drop Hint */}
        <div className="text-[10px] text-center text-slate-500 flex items-center justify-center gap-1">
          <UploadCloud className="w-3 h-3 text-slate-400" />
          <span>O arrastra archivos aquí</span>
        </div>
      </div>

      {/* Real Progress and Error Displays */}
      {currentProgress && (
        <div className="p-2 bg-slate-950 border-b border-slate-800 text-xs">
          <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
            <span className="truncate max-w-[140px] font-medium">{currentProgress.fileName}</span>
            <span className="font-mono text-blue-400">{currentProgress.percentage}%</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-blue-500 h-full transition-all duration-200" 
              style={{ width: `${currentProgress.percentage}%` }}
            />
          </div>
          <div className="text-[9px] text-slate-500 mt-1 flex items-center gap-1">
            {currentProgress.percentage < 100 ? (
              <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-400" />
            ) : (
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
            )}
            <span className="capitalize">{currentProgress.phase}</span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-2 bg-red-950/40 border-b border-red-900/50 text-[11px] text-red-300 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-tight">{errorMessage}</div>
        </div>
      )}

      {/* Assets list with real thumbnails & stable IDs */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {project.assets.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-800 rounded-lg">
            <Video className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs text-slate-400 font-medium">Bandeja de medios vacía</p>
            <p className="text-[11px] text-slate-500 mt-1">Arrastra o importa videos, audios o fotos.</p>
          </div>
        ) : (
          project.assets.map((asset) => {
            const isSelected = selectedAssetId === asset.id;
            return (
              <div
                key={asset.id}
                onClick={() => selectAsset(asset.id)}
                className={`group p-1.5 rounded-md border text-xs flex items-center justify-between cursor-pointer transition-all ${
                  isSelected 
                    ? 'bg-blue-950/60 border-blue-500/80 text-blue-200' 
                    : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/50 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {/* Real Thumbnail or Type Icon */}
                  {asset.thumbnailUrl ? (
                    <img 
                      src={asset.thumbnailUrl} 
                      alt={asset.name} 
                      className="w-8 h-8 rounded object-cover border border-slate-800 shrink-0 bg-black"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center shrink-0">
                      {asset.type === 'video' && <Video className="w-4 h-4 text-blue-400" />}
                      {asset.type === 'audio' && <Music className="w-4 h-4 text-emerald-400" />}
                      {asset.type === 'image' && <ImageIcon className="w-4 h-4 text-purple-400" />}
                    </div>
                  )}
                  
                  <div className="min-w-0">
                    <span className="truncate block text-xs font-medium">{asset.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {asset.durationInSeconds > 0 ? `${asset.durationInSeconds.toFixed(1)}s` : ''} 
                      {asset.width && asset.height ? ` • ${asset.width}x${asset.height}` : ''}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddSampleClip(asset);
                  }}
                  title="Insertar en la línea de tiempo"
                  className="p-1 rounded hover:bg-blue-600 hover:text-white text-slate-400 opacity-80 group-hover:opacity-100 transition-opacity ml-1 shrink-0"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2 border-t border-slate-800 text-[10px] text-slate-500 bg-slate-950/30 flex items-center justify-between">
        <span>Persistencia en IndexedDB / XTP</span>
        <span className="text-slate-600">ID SHA-256</span>
      </div>
    </aside>
  );
};
