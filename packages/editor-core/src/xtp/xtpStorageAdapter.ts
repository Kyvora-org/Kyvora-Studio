import { KyvoraProject } from '../types/project';
import { IProjectStorageAdapter, ProjectMetadata, INativeFileSystemBridge } from '../storage/projectStorage';
import { createXtpArchive, extractXtpArchive, XtpPackageOptions } from './xtpArchive';
import { XtpExtractionResult } from './xtpTypes';

/**
 * Adaptador de almacenamiento XTP para entorno Web (soporta descarga directa y almacenamiento en IndexedDB)
 */
export class WebXtpStorageAdapter implements IProjectStorageAdapter {
  readonly platform = 'web' as const;
  private dbName = 'KyvoraStudioDB';
  private storeName = 'xtp_projects';
  private dbVersion = 2; // Actualizado para soportar paquetes binarios XTP

  private async getDB(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB no disponible');
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`IndexedDB error: ${request.error?.message}`));
    });
  }

  async saveProject(project: KyvoraProject, location?: string, options?: XtpPackageOptions): Promise<{ success: boolean; location: string; error?: string }> {
    try {
      const archiveBytes = await createXtpArchive(project, options);
      const db = await this.getDB();

      return new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        const record = {
          id: project.id,
          name: project.name,
          updatedAt: project.updatedAt,
          durationSeconds: project.durationSeconds,
          xtpData: archiveBytes
        };

        const req = store.put(record);
        req.onsuccess = () => resolve({ success: true, location: location || project.id });
        req.onerror = () => resolve({ success: false, location: project.id, error: req.error?.message });
      });
    } catch (err) {
      return { success: false, location: project.id, error: (err as Error).message };
    }
  }

  async loadProject(id: string): Promise<{ success: boolean; project?: KyvoraProject; extraction?: XtpExtractionResult; error?: string }> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const req = store.get(id);

        req.onsuccess = async () => {
          if (!req.result || !req.result.xtpData) {
            resolve({ success: false, error: `Proyecto XTP con id '${id}' no encontrado.` });
            return;
          }

          try {
            const extraction = await extractXtpArchive(req.result.xtpData);
            resolve({ success: true, project: extraction.project, extraction });
          } catch (exErr) {
            resolve({ success: false, error: (exErr as Error).message });
          }
        };

        req.onerror = () => resolve({ success: false, error: req.error?.message });
      });
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async listProjects(): Promise<ProjectMetadata[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const req = store.getAll();

        req.onsuccess = () => {
          const list = (req.result || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            updatedAt: item.updatedAt,
            durationSeconds: item.durationSeconds
          }));
          resolve(list);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async deleteProject(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const req = store.delete(id);
        req.onsuccess = () => resolve({ success: true });
        req.onerror = () => resolve({ success: false, error: req.error?.message });
      });
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}

/**
 * Interfaz extendida para puentes de archivos binarios en Desktop
 */
export interface INativeBinaryFileSystemBridge extends INativeFileSystemBridge {
  writeBinaryFile(filePath: string, contents: Uint8Array): Promise<void>;
  readBinaryFile(filePath: string): Promise<Uint8Array>;
}

/**
 * Adaptador de almacenamiento XTP para entorno Desktop (lee y escribe archivos `.xtp` reales)
 */
export class DesktopXtpStorageAdapter implements IProjectStorageAdapter {
  readonly platform = 'desktop' as const;
  private bridge?: INativeBinaryFileSystemBridge;

  constructor(bridge?: INativeBinaryFileSystemBridge) {
    this.bridge = bridge;
  }

  public setBridge(bridge: INativeBinaryFileSystemBridge): void {
    this.bridge = bridge;
  }

  async saveProject(
    project: KyvoraProject, 
    targetPath?: string, 
    options?: XtpPackageOptions
  ): Promise<{ success: boolean; location: string; error?: string }> {
    let filePath = targetPath || `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.xtp`;
    if (!filePath.toLowerCase().endsWith('.xtp')) {
      filePath += '.xtp';
    }

    if (!this.bridge || !this.bridge.writeBinaryFile) {
      return {
        success: false,
        location: filePath,
        error: 'Bridge binario del sistema de archivos no configurado en Desktop.'
      };
    }

    try {
      const archiveBytes = await createXtpArchive(project, options);
      await this.bridge.writeBinaryFile(filePath, archiveBytes);
      return {
        success: true,
        location: filePath
      };
    } catch (err) {
      return {
        success: false,
        location: filePath,
        error: `Error al guardar paquete XTP: ${(err as Error).message}`
      };
    }
  }

  async loadProject(filePath: string): Promise<{ 
    success: boolean; 
    project?: KyvoraProject; 
    extraction?: XtpExtractionResult; 
    error?: string 
  }> {
    if (!this.bridge || !this.bridge.readBinaryFile) {
      return {
        success: false,
        error: 'Bridge binario del sistema de archivos no configurado en Desktop.'
      };
    }

    try {
      const rawBytes = await this.bridge.readBinaryFile(filePath);
      const extraction = await extractXtpArchive(
        rawBytes, 
        async (path) => this.bridge ? this.bridge.exists(path) : true
      );

      return {
        success: true,
        project: extraction.project,
        extraction
      };
    } catch (err) {
      return {
        success: false,
        error: `Error al abrir archivo XTP: ${(err as Error).message}`
      };
    }
  }

  async listProjects(): Promise<ProjectMetadata[]> {
    return [];
  }

  async deleteProject(filePath: string): Promise<{ success: boolean; error?: string }> {
    if (!this.bridge || !this.bridge.removeFile) {
      return { success: false, error: 'Borrado no soportado por bridge.' };
    }
    try {
      await this.bridge.removeFile(filePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
