import React, { useState } from 'react';
import { 
  useEditorStore, 
  formatTimecode, 
  DesktopXtpStorageAdapter, 
  WebXtpStorageAdapter,
  INativeBinaryFileSystemBridge 
} from '@kyvora/editor-core';
import { 
  Undo2, 
  Redo2, 
  Save, 
  Download, 
  Film, 
  Clock,
  FilePlus,
  FolderOpen,
  SaveAll,
  Settings
} from 'lucide-react';

import { ExportModal } from './ExportModal';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { ConfirmCloseModal } from './ConfirmCloseModal';
import { 
  isTauriEnvironment, 
  showSaveProjectDialog, 
  showOpenProjectDialog,
  invokeTauriCommand 
} from '../utils/fileDialogs';

export const HeaderBar: React.FC = () => {
  const { 
    project, 
    currentTimeSeconds, 
    canUndo, 
    canRedo,
    isDirty,
    currentFilePath,
    undo,
    redo,
    saveProject,
    saveProjectAs,
    loadProject,
    importXtpArchive,
    initNewProject,
    updateProjectName,
    setStorageAdapter
  } = useEditorStore();

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'new' | 'open' | null>(null);

  const timecodeDisplayRef = React.useRef<HTMLSpanElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Inicializar adaptador nativo si estamos en entorno Tauri
  React.useEffect(() => {
    if (isTauriEnvironment()) {
      const desktopBridge: INativeBinaryFileSystemBridge = {
        writeBinaryFile: async (path, contents) => {
          await invokeTauriCommand('write_project_binary_file', {
            filePath: path,
            contents: Array.from(contents)
          });
        },
        readBinaryFile: async (path) => {
          const rawBytes: number[] = await invokeTauriCommand('read_project_binary_file', {
            filePath: path
          });
          return new Uint8Array(rawBytes);
        },
        exists: async () => true,
        writeTextFile: async () => {},
        readTextFile: async () => ''
      };
      setStorageAdapter(new DesktopXtpStorageAdapter(desktopBridge));
    } else {
      setStorageAdapter(new WebXtpStorageAdapter());
    }
  }, [setStorageAdapter]);

  // Suscripción transitoria de alto rendimiento para el contador de la barra superior
  React.useEffect(() => {
    if (timecodeDisplayRef.current) {
      timecodeDisplayRef.current.textContent = formatTimecode(currentTimeSeconds, project.settings.frameRate);
    }
    const unsub = useEditorStore.subscribe((state) => {
      if (timecodeDisplayRef.current) {
        timecodeDisplayRef.current.textContent = formatTimecode(state.currentTimeSeconds, state.project.settings.frameRate);
      }
    });
    return () => unsub();
  }, [project.settings.frameRate, currentTimeSeconds]);

  // Manejo de "Nuevo Proyecto"
  const handleNewProject = () => {
    if (isDirty) {
      setPendingAction('new');
      setIsConfirmModalOpen(true);
      return;
    }
    initNewProject();
  };

  // Manejo de "Guardar" (Guardado directo si ya tiene ruta, o diálogo si es la primera vez)
  const handleSave = async () => {
    if (!currentFilePath) {
      // Primer guardado: preguntar dónde guardar
      await handleSaveAs();
      return;
    }

    const res = await saveProject();
    if (res.success) {
      alert(`[Kyvora Studio] ${res.message}`);
    } else {
      alert(`[Kyvora Studio] Error al guardar proyecto: ${res.message}`);
    }
  };

  // Manejo de "Guardar Como..." (Siempre abre diálogo)
  const handleSaveAs = async () => {
    const defaultName = `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.xtp`;
    const chosenPath = await showSaveProjectDialog(defaultName);

    if (!chosenPath) {
      // El usuario canceló el diálogo: NO guardar silenciosamente ni emitir falso éxito
      return;
    }

    const res = await saveProjectAs(chosenPath);
    if (res.success) {
      alert(`[Kyvora Studio] Proyecto guardado exitosamente en: ${chosenPath}`);
    } else {
      alert(`[Kyvora Studio] Error al guardar proyecto: ${res.message}`);
    }
  };

  // Manejo de "Abrir Proyecto"
  const handleOpenProject = async () => {
    if (isDirty) {
      setPendingAction('open');
      setIsConfirmModalOpen(true);
      return;
    }
    await executeOpenProject();
  };

  const executeOpenProject = async () => {
    if (isTauriEnvironment()) {
      const chosenPath = await showOpenProjectDialog();
      if (!chosenPath) return;

      const res = await loadProject(chosenPath);
      if (res.success) {
        alert(`[Kyvora Studio] ${res.message}`);
      } else {
        alert(`[Kyvora Studio] Error al abrir proyecto: ${res.message}`);
      }
    } else {
      // En Web, usar input file HTML nativo
      fileInputRef.current?.click();
    }
  };

  const handleWebFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const res = await importXtpArchive(bytes, undefined, file.name);
      if (res.success) {
        alert(`[Kyvora Studio] ${res.message}`);
      } else {
        alert(`[Kyvora Studio] Error al importar proyecto .xtp: ${res.message}`);
      }
    } catch (err) {
      alert(`[Kyvora Studio] Error al leer archivo: ${(err as Error).message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Confirmación al descartar o guardar con cambios pendientes
  const handleSaveAndProceed = async () => {
    setIsConfirmModalOpen(false);
    await handleSave();
    if (pendingAction === 'new') {
      initNewProject();
    } else if (pendingAction === 'open') {
      await executeOpenProject();
    }
    setPendingAction(null);
  };

  const handleDiscardAndProceed = async () => {
    setIsConfirmModalOpen(false);
    if (pendingAction === 'new') {
      initNewProject();
    } else if (pendingAction === 'open') {
      await executeOpenProject();
    }
    setPendingAction(null);
  };

  return (
    <header className="h-14 bg-slate-950 border-b border-slate-800/80 px-4 flex items-center justify-between select-none">
      {/* Brand & Project Info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black tracking-wider">
            <Film className="w-5 h-5 text-blue-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100 tracking-tight text-sm">Kyvora Studio</span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/50">
                .XTP
              </span>
            </div>
          </div>
        </div>

        <div className="h-5 w-[1px] bg-slate-800" />

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={project.name}
            onChange={(e) => updateProjectName(e.target.value)}
            className="bg-transparent text-xs text-slate-300 font-medium px-2 py-1 rounded border border-transparent hover:border-slate-750 focus:border-blue-500 focus:outline-none transition-colors w-52 truncate"
            title="Haz clic para renombrar el proyecto"
          />
          {isDirty && (
            <span 
              className="text-amber-400 font-bold text-xs" 
              title="Ediciones pendientes sin guardar (*)"
            >
              *
            </span>
          )}
        </div>
      </div>

      {/* Center timecode display */}
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-md px-3 py-1">
        <Clock className="w-3.5 h-3.5 text-blue-400" />
        <span 
          ref={timecodeDisplayRef}
          className="font-mono text-xs font-semibold text-blue-300 tracking-wider"
        >
          {formatTimecode(currentTimeSeconds, project.settings.frameRate)}
        </span>
        <span className="text-[10px] text-slate-500">
          ({project.settings.frameRate} fps)
        </span>
      </div>

      {/* Action controls */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5">
          <button
            type="button"
            disabled={!canUndo}
            onClick={undo}
            title={canUndo ? "Deshacer última acción" : "Nada que deshacer"}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={redo}
            title={canRedo ? "Rehacer acción deshecha" : "Nada que rehacer"}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div className="h-5 w-[1px] bg-slate-800" />

        {/* Nuevo Proyecto */}
        <button
          type="button"
          onClick={handleNewProject}
          title="Crear un nuevo proyecto vacío"
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-700/80 text-slate-300 hover:bg-slate-850 hover:text-white transition-all shadow-sm"
        >
          <FilePlus className="w-3.5 h-3.5 text-blue-400" />
          <span>Nuevo</span>
        </button>

        {/* Abrir Proyecto */}
        <button
          type="button"
          onClick={handleOpenProject}
          title="Abrir proyecto existente (.xtp)"
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-700/80 text-slate-300 hover:bg-slate-850 hover:text-white transition-all shadow-sm"
        >
          <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
          <span>Abrir</span>
        </button>

        {/* Input file oculto para web */}
        <input 
          type="file" 
          ref={fileInputRef} 
          accept=".xtp,application/zip" 
          onChange={handleWebFileSelected} 
          className="hidden" 
        />

        {/* Guardar */}
        <button
          type="button"
          onClick={handleSave}
          title={currentFilePath ? `Guardar cambios en: ${currentFilePath}` : "Guardar Proyecto (elegir destino)"}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-700/80 text-slate-300 hover:bg-slate-850 hover:text-white transition-all shadow-sm relative"
        >
          <Save className="w-3.5 h-3.5 text-blue-400" />
          <span>Guardar</span>
          {isDirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-1 right-1" />
          )}
        </button>

        {/* Guardar Como... */}
        <button
          type="button"
          onClick={handleSaveAs}
          title="Guardar como nueva copia o elegir otra ubicación (.xtp)"
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-700/80 text-slate-300 hover:bg-slate-850 hover:text-white transition-all shadow-sm"
        >
          <SaveAll className="w-3.5 h-3.5 text-blue-400" />
          <span>Guardar como...</span>
        </button>

        <div className="h-5 w-[1px] bg-slate-800" />

        {/* Ajustes de Proyecto */}
        <button
          type="button"
          onClick={() => setIsSettingsModalOpen(true)}
          title="Ajustes de resolución, FPS y calidad de proyecto"
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-700/80 text-slate-300 hover:bg-slate-850 hover:text-white transition-all shadow-sm"
        >
          <Settings className="w-3.5 h-3.5 text-blue-400" />
          <span>Ajustes</span>
        </button>

        {/* Exportar Video */}
        <button
          type="button"
          onClick={() => setIsExportModalOpen(true)}
          title="Exportar Video (H.264 / AAC / MP4)"
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Exportar</span>
        </button>
      </div>

      <ProjectSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      <ExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
      />

      <ConfirmCloseModal
        isOpen={isConfirmModalOpen}
        projectName={project.name}
        onSaveAndProceed={handleSaveAndProceed}
        onDiscardAndProceed={handleDiscardAndProceed}
        onCancel={() => {
          setIsConfirmModalOpen(false);
          setPendingAction(null);
        }}
      />
    </header>
  );
};
