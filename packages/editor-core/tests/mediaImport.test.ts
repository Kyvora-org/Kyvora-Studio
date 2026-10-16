import { describe, it, expect, beforeEach } from 'vitest';
import { 
  importMediaFile, 
  detectMediaFormatSupport,
  computeStableAssetId,
  MemoryMediaPersistenceRepository,
  createXtpArchive,
  extractXtpArchive,
  createNewProject
} from '../src/index';

describe('Importación Multimedia de Kyvora Studio', () => {
  let memoryRepo: MemoryMediaPersistenceRepository;

  beforeEach(() => {
    memoryRepo = new MemoryMediaPersistenceRepository();
  });

  it('detecta formatos soportados de video, audio e imagen y señala limitaciones de contenedor', () => {
    const mp4Info = detectMediaFormatSupport('clip_4k.mp4', 'video/mp4');
    expect(mp4Info.isSupported).toBe(true);
    expect(mp4Info.mediaType).toBe('video');
    expect(mp4Info.browserLimitationNote).toBeUndefined();

    const mkvInfo = detectMediaFormatSupport('raw_footage.mkv', 'video/x-matroska');
    expect(mkvInfo.isSupported).toBe(true);
    expect(mkvInfo.mediaType).toBe('video');
    expect(mkvInfo.browserLimitationNote).toContain('FFprobe');

    const flacInfo = detectMediaFormatSupport('audio_master.flac', 'audio/flac');
    expect(flacInfo.isSupported).toBe(true);
    expect(flacInfo.mediaType).toBe('audio');

    const invalidInfo = detectMediaFormatSupport('document.docx');
    expect(invalidInfo.isSupported).toBe(false);
  });

  it('genera identificadores estables basados en contenido binario y no en rutas absolutas ni blobs', async () => {
    const content = new TextEncoder().encode('VIDEO_FRAME_DATA_1234567890');
    const id1 = await computeStableAssetId(content, 'cam1.mp4');
    const id2 = await computeStableAssetId(content, 'cam1.mp4');
    
    // Mismo contenido debe producir el mismo ID estable
    expect(id1).toBe(id2);
    expect(id1.startsWith('asset_')).toBe(true);
    expect(id1).not.toContain('blob:');
    expect(id1).not.toContain('C:');
    expect(id1).not.toContain('/');
  });

  it('importa un recurso multimedia, emite progreso, genera metadatos y persiste en repositorio', async () => {
    const samplePayload = new TextEncoder().encode('RAW_AUDIO_STREAM_BINARY_BYTES');
    const progressLog: string[] = [];

    const asset = await importMediaFile(
      samplePayload,
      'musica_fondo.mp3',
      'audio/mp3',
      {
        persistenceRepo: memoryRepo,
        onProgress: (prog) => {
          progressLog.push(`${prog.phase}:${prog.percentage}`);
        }
      }
    );

    expect(asset.id).toBeDefined();
    expect(asset.name).toBe('musica_fondo.mp3');
    expect(asset.type).toBe('audio');
    expect(asset.fileSize).toBe(samplePayload.byteLength);

    // Verificar progreso
    expect(progressLog.some(p => p.startsWith('hashing:'))).toBe(true);
    expect(progressLog.some(p => p.startsWith('storing:'))).toBe(true);
    expect(progressLog.some(p => p.startsWith('completed:100'))).toBe(true);

    // Verificar persistencia duradera en el repositorio
    const stored = await memoryRepo.getMedia(asset.id);
    expect(stored).not.toBeNull();
    expect(stored?.fileName).toBe('musica_fondo.mp3');
    expect(stored?.data.byteLength).toBe(samplePayload.byteLength);
  });

  it('rechaza archivos que exceden el límite configurado de tamaño', async () => {
    const smallPayload = new Uint8Array(100);
    const maxSizeBytes = 50; // Límite de 50 bytes

    await expect(
      importMediaFile(smallPayload, 'test.mp4', 'video/mp4', {
        maxSizeBytes,
        persistenceRepo: memoryRepo
      })
    ).rejects.toThrow(/excede el tamaño máximo/);
  });

  it('los medios persisten y siguen accesibles después de empaquetar, cerrar y reabrir un proyecto XTP', async () => {
    const project = createNewProject({ name: 'Proyecto Persistencia Real' });
    const videoData = new TextEncoder().encode('REAL_VIDEO_STREAM_BYTES_FOR_ROUNDTRIP');

    const asset = await importMediaFile(
      videoData,
      'escena_01.mp4',
      'video/mp4',
      { persistenceRepo: memoryRepo }
    );

    project.assets.push(asset);

    // Empaquetar proyecto en formato XTP en modo embebido
    const embeddedFiles = new Map<string, Uint8Array>();
    const storedMedia = await memoryRepo.getMedia(asset.id);
    embeddedFiles.set(asset.id, new Uint8Array(storedMedia!.data));

    const archiveBytes = await createXtpArchive(project, {
      mediaMode: 'embedded',
      embeddedFiles
    });

    // Simular cierre de sesión y limpieza de memoria
    await memoryRepo.clearAll();
    expect(await memoryRepo.hasMedia(asset.id)).toBe(false);

    // Reabrir proyecto desde el archivo .xtp
    const extracted = await extractXtpArchive(archiveBytes);
    expect(extracted.project.assets.length).toBe(1);
    expect(extracted.project.assets[0].id).toBe(asset.id);

    // Comprobar que los datos binarios del medio se recuperaron íntegramente
    const recoveredBuffer = extracted.embeddedMediaBuffers.get(asset.id);
    expect(recoveredBuffer).toBeDefined();
    expect(new TextDecoder().decode(recoveredBuffer)).toBe('REAL_VIDEO_STREAM_BYTES_FOR_ROUNDTRIP');
  });

  it('permite importar archivos con espacios y caracteres especiales como tildes', async () => {
    const pngData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // Cabecera PNG
    const asset = await importMediaFile(
      pngData,
      'Foto de Graduación y Celebración — 2026.png',
      'image/png',
      { persistenceRepo: memoryRepo }
    );

    expect(asset.name).toBe('Foto de Graduación y Celebración — 2026.png');
    expect(asset.type).toBe('image');
    expect(asset.id).toBeDefined();
    expect(await memoryRepo.hasMedia(asset.id)).toBe(true);
  });

  it('deduplica correctamente medios importados múltiples veces conservando el proyecto', async () => {
    const { immutableAddAsset } = await import('../src/index');
    const project = createNewProject({ name: 'Test Deduplicación' });
    const payload = new TextEncoder().encode('SAMPLE_BINARY_BYTES');

    const asset1 = await importMediaFile(payload, 'video.mp4', 'video/mp4', {
      persistenceRepo: memoryRepo,
      filePath: 'C:/Videos/video.mp4'
    });

    const p1 = immutableAddAsset(project, asset1);
    expect(p1.assets.length).toBe(1);

    // Importar de nuevo el mismo archivo
    const asset2 = await importMediaFile(payload, 'video.mp4', 'video/mp4', {
      persistenceRepo: memoryRepo,
      filePath: 'C:/Videos/video.mp4'
    });

    const p2 = immutableAddAsset(p1, asset2);
    expect(p2.assets.length).toBe(1); // No debe duplicarse en el arreglo
    expect(p2.assets[0].id).toBe(asset1.id);
  });
});

