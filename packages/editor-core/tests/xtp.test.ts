import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { createNewProject } from '../src/model/schema';
import { 
  createXtpArchive, 
  extractXtpArchive, 
  relinkMissingMedia 
} from '../src/xtp/xtpArchive';
import { sanitizeAndValidateZipPath } from '../src/xtp/xtpSecurity';
import { 
  DesktopXtpStorageAdapter, 
  INativeBinaryFileSystemBridge 
} from '../src/xtp/xtpStorageAdapter';

describe('Formato de Proyecto XTP (.xtp)', () => {
  it('genera un paquete XTP válido con manifest.json y project.json requeridos', async () => {
    const project = createNewProject({ name: 'Cortometraje XTP' });
    const archiveBytes = await createXtpArchive(project);

    expect(archiveBytes).toBeInstanceOf(Uint8Array);
    expect(archiveBytes.length).toBeGreaterThan(100);

    // Inspeccionar el ZIP interno directamente
    const zip = new JSZip();
    const loaded = await zip.loadAsync(archiveBytes);
    expect(loaded.file('manifest.json')).not.toBeNull();
    expect(loaded.file('project.json')).not.toBeNull();

    const manifestText = await loaded.file('manifest.json')!.async('text');
    const manifest = JSON.parse(manifestText);
    expect(manifest.format).toBe('XTP');
    expect(manifest.formatVersion).toBe('1.0.0');
    expect(manifest.projectName).toBe('Cortometraje XTP');
  });

  it('empaqueta y extrae recursos multimedia embebidos dentro de media/ y miniaturas en thumbnails/', async () => {
    const project = createNewProject({ name: 'Proyecto con Medios' });
    project.assets.push({
      id: 'asset_sample_1',
      name: 'audio_bso.mp3',
      type: 'audio',
      durationInSeconds: 45,
      createdAt: new Date().toISOString()
    });

    const fakeAudioData = new TextEncoder().encode('MOCK_AUDIO_DATA_PAYLOAD_BYTE_STREAM');
    const fakeThumbData = new TextEncoder().encode('PNG_THUMBNAIL_BYTES');

    const embeddedFiles = new Map<string, Uint8Array>();
    embeddedFiles.set('asset_sample_1', fakeAudioData);

    const thumbnails = new Map<string, Uint8Array>();
    thumbnails.set('poster.png', fakeThumbData);

    const archiveBytes = await createXtpArchive(project, {
      mediaMode: 'embedded',
      embeddedFiles,
      thumbnails
    });

    const result = await extractXtpArchive(archiveBytes);
    expect(result.manifest.mediaMode).toBe('embedded');
    expect(result.embeddedMediaBuffers.has('asset_sample_1')).toBe(true);
    expect(result.thumbnails.has('thumbnails/poster.png')).toBe(true);

    const extractedAudio = result.embeddedMediaBuffers.get('asset_sample_1')!;
    expect(new TextDecoder().decode(extractedAudio)).toBe('MOCK_AUDIO_DATA_PAYLOAD_BYTE_STREAM');
  });

  it('detecta y reporta recursos multimedia externos ausentes y permite re-vincularlos', async () => {
    const project = createNewProject({ name: 'Proyecto Referenciado' });
    project.assets.push({
      id: 'asset_ext_1',
      name: 'video_clip_inexistente.mp4',
      type: 'video',
      durationInSeconds: 12,
      filePath: 'D:/ArchivosInexistentes/video_clip_inexistente.mp4',
      createdAt: new Date().toISOString()
    });

    const archiveBytes = await createXtpArchive(project, { mediaMode: 'referenced' });

    // Proveer verificador que reporta que el archivo no existe en disco
    const checkExists = async (path: string) => {
      return path.includes('RutaNuevaLocalizada');
    };

    const extraction = await extractXtpArchive(archiveBytes, checkExists);
    expect(extraction.missingMedia.length).toBe(1);
    expect(extraction.missingMedia[0].isMissing).toBe(true);
    expect(extraction.missingMedia[0].assetId).toBe('asset_ext_1');

    // Re-vincular recurso a una ruta válida
    const relinkedProject = relinkMissingMedia(
      extraction.project, 
      'asset_ext_1', 
      'C:/RutaNuevaLocalizada/video_clip_inexistente.mp4'
    );

    expect(relinkedProject.assets[0].filePath).toBe('C:/RutaNuevaLocalizada/video_clip_inexistente.mp4');
  });

  it('previene ataques de Zip-Slip y Path Traversal en entradas maliciosas', () => {
    // Casos que deben ser rechazados sin excepción
    expect(() => sanitizeAndValidateZipPath('../secret_config.json')).toThrow(/Zip-Slip/);
    expect(() => sanitizeAndValidateZipPath('../../system32/cmd.exe')).toThrow(/Zip-Slip/);
    expect(() => sanitizeAndValidateZipPath('media/../../root_secret.txt')).toThrow(/Zip-Slip/);
    expect(() => sanitizeAndValidateZipPath('/etc/passwd')).toThrow(/Ruta absoluta/);
    expect(() => sanitizeAndValidateZipPath('C:/Windows/win.ini')).toThrow(/Ruta absoluta/);
    expect(() => sanitizeAndValidateZipPath('media/malicious_script.bat')).toThrow(/seguridad/);
    expect(() => sanitizeAndValidateZipPath('media/payload.exe')).toThrow(/seguridad/);

    // Caso legítimo
    expect(sanitizeAndValidateZipPath('media/take_01.mp4')).toBe('media/take_01.mp4');
    expect(sanitizeAndValidateZipPath('thumbnails/cover.png')).toBe('thumbnails/cover.png');
  });

  it('rechaza archivos corruptos, archivos que no son ZIP o archivos sin manifest/project', async () => {
    const corruptBytes = new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44]);
    await expect(extractXtpArchive(corruptBytes)).rejects.toThrow();

    // Crear un zip sin manifest.json
    const zipWithoutManifest = new JSZip();
    zipWithoutManifest.file('project.json', '{}');
    const bytesWithoutManifest = await zipWithoutManifest.generateAsync({ type: 'uint8array' });
    await expect(extractXtpArchive(bytesWithoutManifest)).rejects.toThrow(/manifest.json/);

    // Crear un zip sin project.json
    const zipWithoutProject = new JSZip();
    zipWithoutProject.file('manifest.json', JSON.stringify({ format: 'XTP', formatVersion: '1.0.0' }));
    const bytesWithoutProject = await zipWithoutProject.generateAsync({ type: 'uint8array' });
    await expect(extractXtpArchive(bytesWithoutProject)).rejects.toThrow(/project.json/);
  });

  it('DesktopXtpStorageAdapter guarda y abre archivos binarios .xtp mediante el bridge de plataforma', async () => {
    const mockStorage = new Map<string, Uint8Array>();
    const mockBridge: INativeBinaryFileSystemBridge = {
      writeBinaryFile: async (path, content) => { mockStorage.set(path, content); },
      readBinaryFile: async (path) => {
        const data = mockStorage.get(path);
        if (!data) throw new Error('Archivo no encontrado');
        return data;
      },
      writeTextFile: async () => {},
      readTextFile: async () => '',
      exists: async (path) => mockStorage.has(path)
    };

    const adapter = new DesktopXtpStorageAdapter(mockBridge);
    const project = createNewProject({ name: 'XTP Bridge Project' });

    const saveRes = await adapter.saveProject(project, 'C:/Proyectos/test_project.xtp');
    expect(saveRes.success).toBe(true);
    expect(mockStorage.has('C:/Proyectos/test_project.xtp')).toBe(true);

    const loadRes = await adapter.loadProject('C:/Proyectos/test_project.xtp');
    expect(loadRes.success).toBe(true);
    expect(loadRes.project?.id).toBe(project.id);
    expect(loadRes.project?.name).toBe('XTP Bridge Project');
    expect(loadRes.extraction?.manifest.format).toBe('XTP');
  });
});
