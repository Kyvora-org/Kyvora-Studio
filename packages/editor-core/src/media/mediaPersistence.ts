import { MediaStorageRecord } from './mediaTypes';

export interface IMediaPersistenceRepository {
  saveMedia(record: MediaStorageRecord): Promise<void>;
  getMedia(assetId: string): Promise<MediaStorageRecord | null>;
  hasMedia(assetId: string): Promise<boolean>;
  deleteMedia(assetId: string): Promise<void>;
  clearAll(): Promise<void>;
}

/**
 * Repositorio de persistencia en memoria (para pruebas o fallback)
 */
export class MemoryMediaPersistenceRepository implements IMediaPersistenceRepository {
  private storage = new Map<string, MediaStorageRecord>();

  async saveMedia(record: MediaStorageRecord): Promise<void> {
    this.storage.set(record.assetId, record);
  }

  async getMedia(assetId: string): Promise<MediaStorageRecord | null> {
    return this.storage.get(assetId) || null;
  }

  async hasMedia(assetId: string): Promise<boolean> {
    return this.storage.has(assetId);
  }

  async deleteMedia(assetId: string): Promise<void> {
    this.storage.delete(assetId);
  }

  async clearAll(): Promise<void> {
    this.storage.clear();
  }
}

/**
 * Repositorio persistente Web basado en IndexedDB.
 * Guarda los blobs/ArrayBuffers bajo su assetId (hash SHA-256) garantizando que tras
 * cerrar y volver a abrir la ventana o el proyecto, los medios continúen disponibles.
 */
export class IndexedDBMediaRepository implements IMediaPersistenceRepository {
  private dbName = 'KyvoraMediaDB';
  private storeName = 'media_blobs';
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
          db.createObjectStore(this.storeName, { keyPath: 'assetId' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Error al abrir base de datos de medios: ${request.error?.message}`));
    });
  }

  async saveMedia(record: MediaStorageRecord): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.put(record);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error(`Error guardando medio en IndexedDB: ${req.error?.message}`));
    });
  }

  async getMedia(assetId: string): Promise<MediaStorageRecord | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.get(assetId);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(new Error(`Error consultando medio en IndexedDB: ${req.error?.message}`));
    });
  }

  async hasMedia(assetId: string): Promise<boolean> {
    const record = await this.getMedia(assetId);
    return record !== null;
  }

  async deleteMedia(assetId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.delete(assetId);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error(`Error eliminando medio de IndexedDB: ${req.error?.message}`));
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error(`Error limpiando almacén de medios: ${req.error?.message}`));
    });
  }
}

/**
 * Repositorio de medios por defecto en Web/Escritorio (IndexedDB en navegador/webview, Memory en tests/Node)
 */
export const defaultWebMediaRepository: IMediaPersistenceRepository =
  typeof window !== 'undefined' && typeof indexedDB !== 'undefined'
    ? new IndexedDBMediaRepository()
    : new MemoryMediaPersistenceRepository();

