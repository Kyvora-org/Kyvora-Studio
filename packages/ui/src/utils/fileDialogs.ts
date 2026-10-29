/**
 * Utilidades de diálogo multiplataforma (Tauri 2 Desktop + Web) para Kyvora Studio
 */

export interface DialogFileFilter {
  name: string;
  extensions: string[];
}

export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function invokeTauriCommand<T = any>(command: string, args?: Record<string, any>): Promise<T> {
  const tauriGlobal = (window as any).__TAURI_INTERNALS__;
  if (!tauriGlobal || !tauriGlobal.invoke) {
    throw new Error('Bridge IPC de Tauri no disponible.');
  }
  return tauriGlobal.invoke(command, args);
}

/**
 * Muestra el diálogo nativo para guardar proyecto (.xtp)
 */
export async function showSaveProjectDialog(defaultFileName: string): Promise<string | null> {
  if (isTauriEnvironment()) {
    try {
      const chosen = await invokeTauriCommand<string | null>('pick_project_save_path', {
        defaultName: defaultFileName.endsWith('.xtp') ? defaultFileName : `${defaultFileName}.xtp`
      });
      return chosen || null;
    } catch (err) {
      console.error('Error en diálogo nativo de guardado:', err);
      return null;
    }
  }

  // Fallback en navegador Web: nombre propuesto por el usuario
  const prompted = window.prompt(
    'Introduce el nombre del proyecto a guardar (.xtp):',
    defaultFileName.endsWith('.xtp') ? defaultFileName : `${defaultFileName}.xtp`
  );
  if (!prompted || !prompted.trim()) return null;
  return prompted.trim().endsWith('.xtp') ? prompted.trim() : `${prompted.trim()}.xtp`;
}

/**
 * Muestra el diálogo nativo para abrir proyecto (.xtp)
 */
export async function showOpenProjectDialog(): Promise<string | null> {
  if (isTauriEnvironment()) {
    try {
      const chosen = await invokeTauriCommand<string | null>('pick_project_open_path');
      return chosen || null;
    } catch (err) {
      console.error('Error en diálogo nativo de apertura:', err);
      return null;
    }
  }
  return null;
}

/**
 * Muestra el diálogo nativo para guardar video exportado (.mp4)
 */
export async function showSaveExportDialog(defaultFileName: string): Promise<string | null> {
  if (isTauriEnvironment()) {
    try {
      const chosen = await invokeTauriCommand<string | null>('pick_export_save_path', {
        defaultName: defaultFileName.endsWith('.mp4') ? defaultFileName : `${defaultFileName}.mp4`
      });
      return chosen || null;
    } catch (err) {
      console.error('Error en diálogo nativo de exportación:', err);
      return null;
    }
  }

  // Fallback web: Prompt simple para definir el nombre de archivo antes de la descarga
  const prompted = window.prompt(
    'Introduce el nombre del archivo de video para la descarga (.mp4):',
    defaultFileName.endsWith('.mp4') ? defaultFileName : `${defaultFileName}.mp4`
  );
  if (!prompted || !prompted.trim()) return null;
  return prompted.trim().endsWith('.mp4') ? prompted.trim() : `${prompted.trim()}.mp4`;
}

/**
 * Diálogo nativo para seleccionar archivos multimedia conservando la ruta completa en disco
 */
export async function showOpenMediaDialog(): Promise<string[]> {
  if (isTauriEnvironment()) {
    try {
      const chosen = await invokeTauriCommand<string[]>('pick_media_files');
      return chosen || [];
    } catch (err) {
      console.error('Error en diálogo nativo de medios:', err);
      return [];
    }
  }
  return [];
}

/**
 * Convierte una ruta de archivo local en una URL accesible para el reproductor multimedia
 * en entorno Tauri (streaming directo desde disco sin cargar a RAM).
 */
export function getAssetSrc(filePath: string): string {
  if (isTauriEnvironment()) {
    const tauriGlobal = (window as any).__TAURI_INTERNALS__;
    if (tauriGlobal && typeof tauriGlobal.convertFileSrc === 'function') {
      return tauriGlobal.convertFileSrc(filePath);
    }
    // Protocolo de streaming nativo de Tauri 2 en Windows
    const normalized = filePath.replace(/\\/g, '/');
    return `http://asset.localhost/${encodeURI(normalized)}`;
  }
  return filePath;
}


