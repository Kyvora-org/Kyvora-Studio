import { MediaAsset } from '../types/project';
import { 
  MediaProbeResult, 
  MediaImportProgress, 
  detectMediaFormatSupport 
} from './mediaTypes';
import { computeStableAssetId } from './mediaHasher';
import { probeMediaWeb } from './mediaProbeWeb';
import { IMediaPersistenceRepository, MemoryMediaPersistenceRepository } from './mediaPersistence';

export interface MediaImportOptions {
  persistenceRepo?: IMediaPersistenceRepository;
  customProbe?: (bytes: Uint8Array, fileName: string, mimeType: string) => Promise<MediaProbeResult>;
  onProgress?: (progress: MediaImportProgress) => void;
  maxSizeBytes?: number; // Por defecto: 5 GB
  filePath?: string;
}

export const DEFAULT_MAX_MEDIA_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB

/**
 * Importa un recurso multimedia validando formato, tamaño, generando ID estable por hash,
 * extrayendo metadatos, generando miniatura y persistiendo los datos de forma duradera.
 */
export async function importMediaFile(
  fileBytes: Uint8Array | ArrayBuffer,
  fileName: string,
  mimeType: string,
  options?: MediaImportOptions
): Promise<MediaAsset> {
  const bytes = fileBytes instanceof Uint8Array ? fileBytes : new Uint8Array(fileBytes);
  const sizeBytes = bytes.byteLength;
  const maxSize = options?.maxSizeBytes || DEFAULT_MAX_MEDIA_SIZE;
  const repo = options?.persistenceRepo || new MemoryMediaPersistenceRepository();

  const reportProgress = (
    phase: MediaImportProgress['phase'], 
    percentage: number, 
    assetId = '', 
    errorMessage?: string
  ) => {
    if (options?.onProgress) {
      options.onProgress({
        assetId,
        fileName,
        percentage,
        phase,
        errorMessage
      });
    }
  };

  // 1. Validar tamaño de archivo
  if (sizeBytes > maxSize) {
    const errorMsg = `El archivo "${fileName}" (${(sizeBytes / (1024 * 1024)).toFixed(1)} MB) excede el tamaño máximo permitido (${(maxSize / (1024 * 1024)).toFixed(0)} MB)`;
    reportProgress('error', 0, '', errorMsg);
    throw new Error(errorMsg);
  }

  // 2. Validar formato y compatibilidad
  const formatInfo = detectMediaFormatSupport(fileName, mimeType);
  if (!formatInfo.isSupported) {
    const errorMsg = `Formato no soportado para "${fileName}". ${formatInfo.browserLimitationNote || ''}`;
    reportProgress('error', 0, '', errorMsg);
    throw new Error(errorMsg);
  }

  // 3. Generar Identificador Estable (Hash SHA-256)
  reportProgress('hashing', 15);
  const hashStart = performance.now();
  console.log(`[${new Date().toISOString()}] [HASH_START] Iniciando hash para "${fileName}" (${sizeBytes} bytes)...`);
  const assetId = await computeStableAssetId(bytes, fileName);
  console.log(`[${new Date().toISOString()}] [HASH_END] Hash completado en ${(performance.now() - hashStart).toFixed(1)}ms. Asset ID="${assetId}"`);

  // 4. Extraer Metadatos (Probe)
  reportProgress('probing', 40, assetId);
  console.log(`[${new Date().toISOString()}] [MEDIA_PROBE_START] Iniciando extracción de metadatos (probe) para "${fileName}"...`);
  const probeStart = performance.now();
  let probeResult: MediaProbeResult;

  try {
    if (options?.customProbe) {
      probeResult = await options.customProbe(bytes, fileName, mimeType);
    } else {
      probeResult = await probeMediaWeb(bytes, fileName, mimeType);
    }
    console.log(`[${new Date().toISOString()}] [MEDIA_PROBE_END] Probe finalizado en ${(performance.now() - probeStart).toFixed(1)}ms: duración=${probeResult.durationInSeconds}s, ${probeResult.width}x${probeResult.height}, miniatura=${probeResult.thumbnailBase64 ? 'SÍ' : 'NO'}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [MEDIA_PROBE_ERROR] Error en probe tras ${(performance.now() - probeStart).toFixed(1)}ms:`, err);
    const errorMsg = `Error al procesar metadatos de "${fileName}": ${(err as Error).message}`;
    reportProgress('error', 40, assetId, errorMsg);
    throw new Error(errorMsg, { cause: err });
  }

  // 5. Persistir binario en el repositorio duradero bajo el assetId estable
  reportProgress('storing', 80, assetId);
  console.log(`[${new Date().toISOString()}] [PERSISTENCE_START] Guardando binario en repositorio duradero para "${assetId}"...`);
  const persistStart = performance.now();
  try {
    await repo.saveMedia({
      assetId,
      fileName,
      mimeType,
      fileSizeBytes: sizeBytes,
      data: bytes,
      thumbnailDataUrl: probeResult.thumbnailBase64,
      createdAt: new Date().toISOString()
    });
    console.log(`[${new Date().toISOString()}] [PERSISTENCE_END] Binario guardado en ${(performance.now() - persistStart).toFixed(1)}ms.`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [PERSISTENCE_ERROR] Error guardando binario tras ${(performance.now() - persistStart).toFixed(1)}ms:`, err);
    const errorMsg = `Fallo al persistir medio "${fileName}": ${(err as Error).message}`;
    reportProgress('error', 80, assetId, errorMsg);
    throw new Error(errorMsg, { cause: err });
  }

  reportProgress('completed', 100, assetId);

  // 6. Devolver MediaAsset con ID estable y ruta original si existe
  const mediaAsset: MediaAsset = {
    id: assetId,
    name: fileName,
    type: formatInfo.mediaType,
    durationInSeconds: probeResult.durationInSeconds,
    filePath: options?.filePath,
    fileSize: sizeBytes,
    width: probeResult.width,
    height: probeResult.height,
    thumbnailUrl: probeResult.thumbnailBase64,
    createdAt: new Date().toISOString()
  };

  return mediaAsset;
}
