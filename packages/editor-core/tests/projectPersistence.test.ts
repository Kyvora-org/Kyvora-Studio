import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../src/store/editorStore';
import { DesktopXtpStorageAdapter, INativeBinaryFileSystemBridge } from '../src/xtp/xtpStorageAdapter';

describe('Persistencia de Proyectos y Dirty Tracking en Kyvora Studio', () => {
  beforeEach(() => {
    useEditorStore.getState().initNewProject({ name: 'Proyecto Test' });
  });

  it('inicia como no-dirty y sin ruta asignada', () => {
    const state = useEditorStore.getState();
    expect(state.isDirty).toBe(false);
    expect(state.currentFilePath).toBeNull();
  });

  it('marca isDirty en true tras cualquier modificación en la línea de tiempo o proyecto', () => {
    const store = useEditorStore.getState();
    store.updateProjectName('Nombre Modificado');
    expect(useEditorStore.getState().isDirty).toBe(true);

    store.addTrack({ name: 'Pista Audio Extra', type: 'audio', isMuted: false, isLocked: false });
    expect(useEditorStore.getState().isDirty).toBe(true);

    store.updateProjectDuration(120);
    expect(useEditorStore.getState().isDirty).toBe(true);
  });

  it('guarda con éxito y limpia isDirty actualizando la ruta activa', async () => {
    const memoryFiles = new Map<string, Uint8Array>();
    const mockBridge: INativeBinaryFileSystemBridge = {
      writeBinaryFile: async (path, contents) => { memoryFiles.set(path, contents); },
      readBinaryFile: async (path) => {
        const found = memoryFiles.get(path);
        if (!found) throw new Error('Archivo no encontrado');
        return found;
      },
      exists: async (path) => memoryFiles.has(path),
      writeTextFile: async () => {},
      readTextFile: async () => ''
    };

    const adapter = new DesktopXtpStorageAdapter(mockBridge);
    useEditorStore.getState().setStorageAdapter(adapter);

    // Modificar proyecto
    useEditorStore.getState().updateProjectName('Documental Kyvora');
    expect(useEditorStore.getState().isDirty).toBe(true);

    // Guardar Como
    const saveRes = await useEditorStore.getState().saveProjectAs('C:/Projects/Documental.xtp');
    expect(saveRes.success).toBe(true);
    expect(useEditorStore.getState().isDirty).toBe(false);
    expect(useEditorStore.getState().currentFilePath).toBe('C:/Projects/Documental.xtp');
    expect(memoryFiles.has('C:/Projects/Documental.xtp')).toBe(true);

    // Segunda modificación y guardado directo sin diálogo (reutilizando currentFilePath)
    useEditorStore.getState().updateProjectDuration(90);
    expect(useEditorStore.getState().isDirty).toBe(true);

    const directSave = await useEditorStore.getState().saveProject();
    expect(directSave.success).toBe(true);
    expect(directSave.location).toBe('C:/Projects/Documental.xtp');
    expect(useEditorStore.getState().isDirty).toBe(false);

    // Cargar el proyecto guardado y verificar integridad
    await useEditorStore.getState().loadProject('C:/Projects/Documental.xtp');
    const reloaded = useEditorStore.getState().project;
    expect(reloaded.name).toBe('Documental Kyvora');
    expect(reloaded.durationSeconds).toBe(90);
    expect(useEditorStore.getState().isDirty).toBe(false);
    expect(useEditorStore.getState().currentFilePath).toBe('C:/Projects/Documental.xtp');
  });

  it('no limpia isDirty si ocurre un fallo en la escritura del archivo', async () => {
    const failingBridge: INativeBinaryFileSystemBridge = {
      writeBinaryFile: async () => { throw new Error('Disco lleno o permiso denegado'); },
      readBinaryFile: async () => new Uint8Array(),
      exists: async () => false,
      writeTextFile: async () => {},
      readTextFile: async () => ''
    };

    const adapter = new DesktopXtpStorageAdapter(failingBridge);
    useEditorStore.getState().setStorageAdapter(adapter);

    useEditorStore.getState().updateProjectName('Proyecto Con Error');
    expect(useEditorStore.getState().isDirty).toBe(true);

    const saveRes = await useEditorStore.getState().saveProject('C:/Error.xtp');
    expect(saveRes.success).toBe(false);
    // Debe permanecer sucio (isDirty = true) para evitar pérdida accidental de datos
    expect(useEditorStore.getState().isDirty).toBe(true);
  });
});
