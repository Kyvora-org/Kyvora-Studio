import React, { useRef, useState, useMemo } from 'react';
import { 
  useEditorStore, 
  importMediaFile, 
  defaultWebMediaRepository, 
  MediaImportProgress 
} from '@kyvora/editor-core';
import type { MediaAsset, MediaType } from '@kyvora/editor-core';
import { 
  FolderPlus, 
  Video, 
  Music, 
  Image as ImageIcon, 
  PlusCircle, 
  UploadCloud, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Grid, 
  List, 
  FolderOpen, 
  Trash2 
} from 'lucide-react';
import { isTauriEnvironment, invokeTauriCommand, showOpenMediaDialog } from '../utils/fileDialogs';

export const MediaPanel: React.FC = () => {
  const { 
    project, 
    selectedAssetId, 
    selectAsset, 
    addAsset, 
    removeAsset,
    addClipToTrack,
    selectClip,
    setCurrentTime,
    updateProjectDuration
  } = useEditorStore();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<MediaImportProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Filtros y vista
  const [activeTab, setActiveTab] = useState<'all' | 'video' | 'audio' | 'image'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredAssets = useMemo(() => {
    return project.assets.filter(asset => {
      const matchesTab = activeTab === 'all' || asset.type === activeTab;
      const matchesSearch = !searchQuery || asset.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [project.assets, activeTab, searchQuery]);

  // Coloca un activo en la línea de tiempo y lo selecciona para edición inmediata
  const addAssetToTimeline = (asset: MediaAsset, customStartSeconds?: number) => {
    const targetTrack = project.tracks.find(t => t.type === (asset.type === 'audio' ? 'audio' : 'video')) || project.tracks[0];
    if (!targetTrack) return;

    let startTime = customStartSeconds;
    if (startTime === undefined) {
      const lastClip = targetTrack.clips[targetTrack.clips.length - 1];
      startTime = lastClip ? (lastClip.startInTimelineSeconds + lastClip.durationSeconds) : 0;
    }

    const clipId = `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    addClipToTrack(targetTrack.id, {
      assetId: asset.id,
      name: asset.name,
      startInTimelineSeconds: startTime,
      durationSeconds: asset.durationInSeconds,
      sourceStartSeconds: 0,
      color: asset.type === 'video' ? '#0066FF' : asset.type === 'audio' ? '#10B981' : '#8B5CF6',
      effects: []
    }, clipId);

    selectClip(clipId);
    setCurrentTime(startTime);
    if (startTime + asset.durationInSeconds > project.durationSeconds) {
      updateProjectDuration(Math.ceil(startTime + asset.durationInSeconds + 5));
    }
  };

  // Añade un activo y, si la línea de tiempo está vacía, lo ubica de inmediato en Track 1
  const addAssetAndAutoPlaceOnTimeline = (asset: MediaAsset) => {
    addAsset(asset);
    selectAsset(asset.id);

    const isTimelineEmpty = project.tracks.every(t => t.clips.length === 0);
    if (isTimelineEmpty) {
      addAssetToTimeline(asset, 0);
    }
  };

  // Procesamiento en entorno Web o drag-and-drop con File API
  const processFileList = async (files: FileList | File[]) => {
    setErrorMessage(null);
    setInfoMessage(null);
    let addedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const filePath = (file as any).path || (file as any).webkitRelativePath || undefined;

        // Comprobar duplicados
        const existing = project.assets.find(
          a => (filePath && a.filePath === filePath) || (a.name === file.name && a.fileSize === file.size)
        );
        if (existing) {
          setInfoMessage(`"${file.name}" ya se encuentra en la biblioteca.`);
          continue;
        }

        const arrayBuffer = await file.arrayBuffer();
        let mime = file.type || '';
        if (!mime) {
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) mime = `video/${ext === 'mov' ? 'quicktime' : ext}`;
          else if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) mime = `audio/${ext}`;
          else if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
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

        addAssetAndAutoPlaceOnTimeline(asset);
        addedCount++;
      } catch (err) {
        setErrorMessage(`"${file.name}": ${(err as Error).message}`);
      }
    }

    if (addedCount > 0) {
      setInfoMessage(`${addedCount} archivo(s) importado(s) exitosamente.`);
    }

    setTimeout(() => {
      setCurrentProgress(null);
    }, 1500);

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  // Importación nativa en Tauri (Cero consumo innecesario de RAM: usa probe y path directo)
  const handleImportNative = async () => {
    setErrorMessage(null);
    setInfoMessage(null);

    if (isTauriEnvironment()) {
      try {
        const paths = await showOpenMediaDialog();
        if (!paths || paths.length === 0) return;

        await importNativePaths(paths);
      } catch (err) {
        setErrorMessage(`Error en importación: ${(err as Error).message}`);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  // Importar carpeta completa
  const handleImportFolder = async () => {
    setErrorMessage(null);
    setInfoMessage(null);

    if (isTauriEnvironment()) {
      try {
        const folder = await invokeTauriCommand<string | null>('pick_folder_path');
        if (!folder) return;

        const files = await invokeTauriCommand<string[]>('scan_media_folder', { folderPath: folder });
        if (!files || files.length === 0) {
          setInfoMessage('No se encontraron archivos multimedia compatibles en la carpeta seleccionada.');
          return;
        }

        await importNativePaths(files);
      } catch (err) {
        setErrorMessage(`Error importando carpeta: ${(err as Error).message}`);
      }
    } else {
      folderInputRef.current?.click();
    }
  };

  // Función núcleo de importación rápida por rutas de archivo en escritorio
  const importNativePaths = async (paths: string[]) => {
    let imported = 0;
    for (let idx = 0; idx < paths.length; idx++) {
      const fullPath = paths[idx];
      const fileName = fullPath.replace(/\\/g, '/').split('/').pop() || 'media';
      const ext = fileName.split('.').pop()?.toLowerCase() || '';

      // Comprobar si ya existe
      const existing = project.assets.find(a => a.filePath === fullPath);
      if (existing) continue;

      setCurrentProgress({
        assetId: '',
        fileName,
        percentage: Math.round(((idx + 1) / paths.length) * 100),
        phase: 'probing'
      });

      try {
        const probeRes: any = await invokeTauriCommand('probe_media_file', { filePath: fullPath });
        let thumbnail: string | undefined;

        try {
          const thumbRes = await invokeTauriCommand<string | null>('generate_media_thumbnail', {
            filePath: fullPath,
            offsetSeconds: 1.0
          });
          if (thumbRes) thumbnail = thumbRes;
        } catch {
          // Fallback sin thumbnail
        }

        let mediaType: MediaType = 'video';
        if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) {
          mediaType = 'audio';
        } else if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) {
          mediaType = 'image';
        }

        const duration = probeRes?.duration_seconds || (mediaType === 'image' ? 5 : 10);
        const assetId = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const asset: MediaAsset = {
          id: assetId,
          name: fileName,
          type: mediaType,
          durationInSeconds: duration,
          filePath: fullPath,
          width: probeRes?.width,
          height: probeRes?.height,
          frameRate: probeRes?.frame_rate,
          codecName: probeRes?.codec_name,
          audioChannels: probeRes?.audio_channels,
          sampleRate: probeRes?.sample_rate,
          thumbnailUrl: thumbnail,
          createdAt: new Date().toISOString()
        };

        addAssetAndAutoPlaceOnTimeline(asset);
        imported++;
      } catch (err) {
        setErrorMessage(`"${fileName}": ${(err as Error).message}`);
      }
    }

    setInfoMessage(`${imported} archivo(s) procesado(s) y agregado(s).`);
    setTimeout(() => {
      setCurrentProgress(null);
    }, 1200);
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // En Tauri de escritorio, extraer rutas directas para evitar cargar memoria RAM
      if (isTauriEnvironment()) {
        const paths: string[] = [];
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const p = (e.dataTransfer.files[i] as any).path;
          if (p) paths.push(p);
        }
        if (paths.length > 0) {
          await importNativePaths(paths);
          return;
        }
      }

      // En Web o cuando no hay path absoluto
      processFileList(e.dataTransfer.files);
    }
  };

  // Manejador del input de archivos oculto
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFileList(e.target.files);
    }
  };

  return (
    <aside 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-72 shrink-0 bg-[#0B0F17] border-r flex flex-col select-none transition-colors relative ${
        isDragging ? 'border-blue-500 bg-blue-950/20 ring-2 ring-blue-500/30' : 'border-slate-800'
      }`}
    >
      {/* Header Panel */}
      <div className="h-12 border-b border-slate-800 px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <FolderPlus className="w-4 h-4 text-blue-500" />
          <h2 className="text-xs font-semibold tracking-wider uppercase text-slate-200">
            Medios ({project.assets.length})
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            title={viewMode === 'grid' ? 'Cambiar a vista de lista' : 'Cambiar a vista de cuadrícula'}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            {viewMode === 'grid' ? <List className="w-3.5 h-3.5" /> : <Grid className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleImportFolder}
            title="Importar carpeta completa..."
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="p-2 border-b border-slate-800 space-y-2 shrink-0 bg-slate-950/40">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en la biblioteca..."
            className="w-full bg-slate-900 border border-slate-800 rounded pl-8 pr-2 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-1 text-[10px]">
          {(['all', 'video', 'audio', 'image'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1 rounded text-center font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab === 'all' ? 'Todos' : tab === 'video' ? 'Videos' : tab === 'audio' ? 'Audios' : 'Fotos'}
            </button>
          ))}
        </div>
      </div>

      {/* Notificaciones y Mensajes de Estado */}
      {errorMessage && (
        <div className="m-2 p-2 bg-red-950/50 border border-red-900/60 rounded text-[11px] text-red-300 flex items-start gap-1.5 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 overflow-hidden break-words text-[10px] leading-tight">{errorMessage}</div>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white">×</button>
        </div>
      )}

      {infoMessage && (
        <div className="m-2 p-2 bg-blue-950/40 border border-blue-900/50 rounded text-[11px] text-blue-300 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-[10px] truncate">{infoMessage}</span>
          </div>
          <button type="button" onClick={() => setInfoMessage(null)} className="text-blue-400 hover:text-white ml-1">×</button>
        </div>
      )}

      {/* Progreso Activo */}
      {currentProgress && (
        <div className="mx-2 mb-2 p-2 bg-slate-950 border border-slate-800 rounded text-[10px] space-y-1 shrink-0">
          <div className="flex items-center justify-between text-slate-300">
            <span className="truncate max-w-[170px]">{currentProgress.fileName}</span>
            <span className="font-mono text-blue-400 font-bold">{currentProgress.percentage}%</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-blue-500 h-full transition-all duration-200 ease-out"
              style={{ width: `${currentProgress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Lista / Grid de Activos */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredAssets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-800/80 rounded-xl m-1">
            <UploadCloud className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs font-medium text-slate-400">Arrastra archivos multimedia aquí</p>
            <p className="text-[10px] text-slate-500 mt-1 max-w-[180px]">
              MP4, MOV, MKV, WebM, MP3, WAV, AAC, PNG, JPG, WebP, BMP
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={handleImportNative}
                className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] shadow-sm transition-colors"
              >
                Elegir archivos
              </button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-2">
            {filteredAssets.map((asset) => {
              const isSelected = selectedAssetId === asset.id;
              return (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/kyvora-asset-id', asset.id);
                    e.dataTransfer.setData('text/plain', asset.id);
                  }}
                  onClick={() => selectAsset(asset.id)}
                  onDoubleClick={() => addAssetToTimeline(asset)}
                  className={`group relative rounded-lg border p-1.5 flex flex-col gap-1 cursor-grab active:cursor-grabbing transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-950/30 shadow-md ring-1 ring-blue-500/50'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="relative aspect-video bg-slate-950 rounded overflow-hidden flex items-center justify-center">
                    {asset.thumbnailUrl ? (
                      <img 
                        src={asset.thumbnailUrl} 
                        alt={asset.name} 
                        className="w-full h-full object-cover"
                      />
                    ) : asset.type === 'video' ? (
                      <Video className="w-6 h-6 text-blue-500" />
                    ) : asset.type === 'audio' ? (
                      <Music className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-purple-400" />
                    )}

                    <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 font-mono text-[9px] text-slate-200">
                      {asset.durationInSeconds > 0 ? `${asset.durationInSeconds.toFixed(1)}s` : 'IMG'}
                    </span>

                    {/* Botón flotante para insertar en línea de tiempo */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        addAssetToTimeline(asset);
                      }}
                      title="Insertar en la línea de tiempo"
                      className="absolute inset-0 bg-blue-600/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <PlusCircle className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] gap-1 px-0.5">
                    <span className="truncate text-slate-300 font-medium" title={asset.name}>
                      {asset.name}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAsset(asset.id);
                      }}
                      title="Eliminar de la biblioteca"
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-0.5 rounded transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Botón de acción rápida visible */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      addAssetToTimeline(asset);
                    }}
                    className="w-full py-1 mt-0.5 rounded bg-slate-900 hover:bg-blue-600 text-slate-300 hover:text-white text-[10px] font-medium flex items-center justify-center gap-1 border border-slate-800 transition-colors"
                  >
                    <PlusCircle className="w-3 h-3" />
                    <span>Añadir a pista</span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredAssets.map((asset) => {
              const isSelected = selectedAssetId === asset.id;
              return (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/kyvora-asset-id', asset.id);
                    e.dataTransfer.setData('text/plain', asset.id);
                  }}
                  onClick={() => selectAsset(asset.id)}
                  onDoubleClick={() => addAssetToTimeline(asset)}
                  className={`group px-2 py-1.5 rounded-md border flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-950/40 text-white'
                      : 'border-slate-800/80 bg-slate-950/30 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {asset.type === 'video' ? (
                      <Video className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    ) : asset.type === 'audio' ? (
                      <Music className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    )}
                    <span className="text-[11px] truncate font-medium" title={asset.name}>{asset.name}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] text-slate-500">
                      {asset.durationInSeconds > 0 ? `${asset.durationInSeconds.toFixed(1)}s` : 'IMG'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        addAssetToTimeline(asset);
                      }}
                      className="px-2 py-0.5 rounded bg-blue-600/80 hover:bg-blue-500 text-white text-[10px] font-medium flex items-center gap-1 transition-colors"
                      title="Añadir a la línea de tiempo"
                    >
                      <PlusCircle className="w-3 h-3" />
                      <span>Añadir</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAsset(asset.id);
                      }}
                      className="p-1 rounded hover:bg-red-950 hover:text-red-400 text-slate-500 transition-colors"
                      title="Eliminar de la biblioteca"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer de Importación */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 shrink-0 flex items-center gap-2">
        <button
          type="button"
          onClick={handleImportNative}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm transition-colors"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Importar Archivos</span>
        </button>

        <button
          type="button"
          onClick={handleImportFolder}
          title="Importar carpeta con videos e imágenes"
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition-colors"
        >
          <FolderPlus className="w-4 h-4" />
        </button>
      </div>

      {/* Hidden inputs para navegador web */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*,.mkv,.avi,.mov,.mp4,.webm,.mp3,.wav,.aac,.flac,.ogg,.m4a,.jpg,.jpeg,.png,.webp,.gif,.bmp"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard in browsers
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </aside>
  );
};
