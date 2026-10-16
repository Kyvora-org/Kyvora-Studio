import { KyvoraProject } from '../types/project';
import { serializeProject, deserializeProject } from '../model/schema';

export interface ProjectMetadata {
  id: string;
  name: string;
  updatedAt: string;
  durationSeconds: number;
}

/**
 * Interfaz unificada de almacenamiento para Web y Desktop
 */
export interface IProjectStorageAdapter {
  readonly platform: 'web' | 'desktop';
  saveProject(project: KyvoraProject, location?: string): Promise<{ success: boolean; location: string; error?: string }>;
  loadProject(location: string): Promise<{ success: boolean; project?: KyvoraProject; error?: string }>;
  listProjects(): Promise<ProjectMetadata[]>;
  deleteProject(location: string): Promise<{ success: boolean; error?: string }>;
}

/**
 * Implementación de almacenamiento Web basada en IndexedDB
 */
export class WebIndexedDBStorageAdapter implements IProjectStorageAdapter {
  readonly platform = 'web' as const;
  private dbName = 'KyvoraStudioDB';
  private storeName = 'projects';
  private dbVersion = 1;

  private async getDB(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB no está disponible en este entorno.');
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
      request.onerror = () => reject(new Error(`Error al abrir IndexedDB: ${request.error?.message}`));
    });
  }

  async saveProject(project: KyvoraProject): Promise<{ success: boolean; location: string; error?: string }> {
    try {
      // Validar y serializar proyecto
      const json = serializeProject(project);
      const db = await this.getDB();

      return new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        const record = {
          id: project.id,
          name: project.name,
          updatedAt: project.updatedAt,
          durationSeconds: project.durationSeconds,
          payload: json
        };

        const putReq = store.put(record);

        putReq.onsuccess = () => {
          resolve({ success: true, location: project.id });
        };

        putReq.onerror = () => {
          resolve({ 
            success: false, 
            location: project.id, 
            error: putReq.error?.message || 'Error al persistir en IndexedDB' 
          });
        };
      });
    } catch (err) {
      return {
        success: false,
        location: project.id,
        error: (err as Error).message
      };
    }
  }

  async loadProject(id: string): Promise<{ success: boolean; project?: KyvoraProject; error?: string }> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const req = store.get(id);

        req.onsuccess = () => {
          if (!req.result) {
            resolve({ success: false, error: `Proyecto con id '${id}' no encontrado en almacenamiento local.` });
            return;
          }

          try {
            const project = deserializeProject(req.result.payload);
            resolve({ success: true, project });
          } catch (parseErr) {
            resolve({ success: false, error: (parseErr as Error).message });
          }
        };

        req.onerror = () => {
          resolve({ success: false, error: req.error?.message || 'Error al consultar IndexedDB' });
        };
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

        req.onerror = () => {
          resolve([]);
        };
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
 * Interfaz de bajo nivel para interactuar con el sistema de archivos (Node / Tauri)
 */
export interface INativeFileSystemBridge {
  writeTextFile(filePath: string, contents: string): Promise<void>;
  readTextFile(filePath: string): Promise<string>;
  exists(filePath: string): Promise<boolean>;
  removeFile?(filePath: string): Promise<void>;
}

/**
 * Adaptador de almacenamiento Desktop para archivos locales (.kyvora)
 */
export class DesktopLocalFileStorageAdapter implements IProjectStorageAdapter {
  readonly platform = 'desktop' as const;
  private bridge?: INativeFileSystemBridge;

  constructor(bridge?: INativeFileSystemBridge) {
    this.bridge = bridge;
  }

  public setBridge(bridge: INativeFileSystemBridge): void {
    this.bridge = bridge;
  }

  async saveProject(project: KyvoraProject, targetPath?: string): Promise<{ success: boolean; location: string; error?: string }> {
    const filePath = targetPath || `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.kyvora`;

    if (!this.bridge) {
      return {
        success: false,
        location: filePath,
        error: 'Bridge de sistema de archivos nativo no configurado en Desktop.'
      };
    }

    try {
      const serialized = serializeProject(project);
      await this.bridge.writeTextFile(filePath, serialized);
      return {
        success: true,
        location: filePath
      };
    } catch (err) {
      return {
        success: false,
        location: filePath,
        error: `Error escribiendo archivo local: ${(err as Error).message}`
      };
    }
  }

  async loadProject(filePath: string): Promise<{ success: boolean; project?: KyvoraProject; error?: string }> {
    if (!this.bridge) {
      return {
        success: false,
        error: 'Bridge de sistema de archivos nativo no configurado en Desktop.'
      };
    }

    try {
      const rawText = await this.bridge.readTextFile(filePath);
      const project = deserializeProject(rawText);
      return {
        success: true,
        project
      };
    } catch (err) {
      return {
        success: false,
        error: `Error al leer archivo de proyecto: ${(err as Error).message}`
      };
    }
  }

  async listProjects(): Promise<ProjectMetadata[]> {
    // En entorno de escritorio la lista de proyectos recientes se alimentará del índice de archivos recientes
    return [];
  }

  async deleteProject(filePath: string): Promise<{ success: boolean; error?: string }> {
    if (!this.bridge || !this.bridge.removeFile) {
      return {
        success: false,
        error: 'Operación de borrado no soportada en el bridge.'
      };
    }
    try {
      await this.bridge.removeFile(filePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
