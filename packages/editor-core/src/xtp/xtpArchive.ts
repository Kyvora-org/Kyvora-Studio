import JSZip from 'jszip';
import { KyvoraProject } from '../types/project';
import { serializeProject, deserializeProject } from '../model/schema';
import { 
  XtpManifest, 
  XtpMediaEntry, 
  XtpMediaMode, 
  XTP_FORMAT_IDENTIFIER, 
  CURRENT_XTP_FORMAT_VERSION, 
  XtpExtractionResult,
  MissingMediaReport,
  XtpPackageSecurityLimits,
  DEFAULT_XTP_SECURITY_LIMITS
} from './xtpTypes';
import { sanitizeAndValidateZipPath, validateZipEntryCountAndSize } from './xtpSecurity';

export interface XtpPackageOptions {
  mediaMode?: XtpMediaMode;
  embeddedFiles?: Map<string, Uint8Array>; // Map<assetId, binaryData>
  thumbnails?: Map<string, Uint8Array>;    // Map<filename, binaryData>
}

/**
 * Empaqueta un proyecto Kyvora en un archivo binario `.xtp` (ZIP)
 */
export async function createXtpArchive(
  project: KyvoraProject,
  options?: XtpPackageOptions
): Promise<Uint8Array> {
  const zip = new JSZip();
  const mediaMode = options?.mediaMode || 'referenced';
  const embeddedFiles = options?.embeddedFiles || new Map<string, Uint8Array>();
  const thumbnails = options?.thumbnails || new Map<string, Uint8Array>();

  // 1. Construir lista de entradas de medios
  const mediaEntries: XtpMediaEntry[] = [];
  const mediaFolder = zip.folder('media');
  const thumbFolder = zip.folder('thumbnails');

  for (const asset of project.assets) {
    const isEmbedded = (mediaMode === 'embedded' || mediaMode === 'hybrid') && embeddedFiles.has(asset.id);
    let archivePath: string | undefined = undefined;

    if (isEmbedded) {
      const sanitizedFileName = `${asset.id}_${asset.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      archivePath = `media/${sanitizedFileName}`;
      const data = embeddedFiles.get(asset.id)!;
      mediaFolder?.file(sanitizedFileName, data);
    }

    mediaEntries.push({
      assetId: asset.id,
      name: asset.name,
      type: asset.type,
      isEmbedded,
      archivePath,
      externalPath: asset.filePath,
      sizeBytes: asset.fileSize
    });
  }

  // 2. Incluir miniaturas si existen
  const thumbnailPaths: string[] = [];
  for (const [name, data] of thumbnails.entries()) {
    const sanitizedName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    thumbFolder?.file(sanitizedName, data);
    thumbnailPaths.push(`thumbnails/${sanitizedName}`);
  }

  // 3. Crear el manifest.json
  const manifest: XtpManifest = {
    format: XTP_FORMAT_IDENTIFIER,
    formatVersion: CURRENT_XTP_FORMAT_VERSION,
    schemaVersion: project.schemaVersion,
    projectId: project.id,
    projectName: project.name,
    mediaMode,
    createdAt: project.createdAt,
    updatedAt: new Date().toISOString(),
    mediaEntries,
    thumbnails: thumbnailPaths
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // 4. Crear project.json (validado por serializeProject)
  const projectJson = serializeProject(project);
  zip.file('project.json', projectJson);

  // 5. Generar paquete ZIP comprimido
  const content = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  return content;
}

/**
 * Abre, valida y extrae un paquete .xtp comprobando seguridad y recursos
 */
export async function extractXtpArchive(
  archiveData: Uint8Array,
  checkExternalMediaExists?: (filePath: string) => Promise<boolean>,
  limits: XtpPackageSecurityLimits = DEFAULT_XTP_SECURITY_LIMITS
): Promise<XtpExtractionResult> {
  const zip = new JSZip();

  let loadedZip: JSZip;
  try {
    loadedZip = await zip.loadAsync(archiveData);
  } catch (err) {
    throw new Error(`Archivo XTP no válido o dañado: ${(err as Error).message}`, { cause: err });
  }

  // 1. Validar entradas contra Zip-Slip y límites de tamaño
  const fileEntries = Object.keys(loadedZip.files);
  validateZipEntryCountAndSize(fileEntries.length, archiveData.byteLength, limits);

  for (const rawName of fileEntries) {
    sanitizeAndValidateZipPath(rawName);
  }

  // 2. Comprobar presencia de manifest.json y project.json requeridos
  const manifestFile = loadedZip.file('manifest.json');
  if (!manifestFile) {
    throw new Error('Archivo XTP inválido: Falta "manifest.json" en la raíz del contenedor.');
  }

  const projectFile = loadedZip.file('project.json');
  if (!projectFile) {
    throw new Error('Archivo XTP inválido: Falta "project.json" en la raíz del contenedor.');
  }

  // 3. Extraer y validar manifest.json
  let manifest: XtpManifest;
  try {
    const manifestText = await manifestFile.async('text');
    manifest = JSON.parse(manifestText);
  } catch (err) {
    throw new Error(`Error al leer manifest.json en archivo XTP: ${(err as Error).message}`, { cause: err });
  }

  if (manifest.format !== XTP_FORMAT_IDENTIFIER) {
    throw new Error(`Formato no reconocido: Esperado "${XTP_FORMAT_IDENTIFIER}", recibido "${manifest.format}"`);
  }

  if (!manifest.formatVersion) {
    throw new Error('El manifiesto del archivo XTP no especifica formatVersion');
  }

  // 4. Extraer y validar/migrar project.json
  const projectText = await projectFile.async('text');
  const project: KyvoraProject = deserializeProject(projectText);

  // 5. Extraer buffers de medios empaquetados
  const embeddedMediaBuffers = new Map<string, Uint8Array>();
  for (const entry of manifest.mediaEntries || []) {
    if (entry.isEmbedded && entry.archivePath) {
      const file = loadedZip.file(entry.archivePath);
      if (file) {
        const buffer = await file.async('uint8array');
        embeddedMediaBuffers.set(entry.assetId, buffer);
      }
    }
  }

  // 6. Extraer miniaturas
  const thumbnails = new Map<string, Uint8Array>();
  for (const thumbPath of manifest.thumbnails || []) {
    const file = loadedZip.file(thumbPath);
    if (file) {
      const buffer = await file.async('uint8array');
      thumbnails.set(thumbPath, buffer);
    }
  }

  // 7. Comprobar disponibilidad de medios referenciados
  const missingMedia: MissingMediaReport[] = [];
  for (const asset of project.assets) {
    const entry = manifest.mediaEntries?.find(e => e.assetId === asset.id);
    const isEmbedded = entry?.isEmbedded ?? false;

    if (!isEmbedded) {
      const pathToCheck = asset.filePath || entry?.externalPath;
      if (!pathToCheck) {
        missingMedia.push({
          assetId: asset.id,
          assetName: asset.name,
          lastKnownPath: undefined,
          isMissing: true
        });
      } else if (checkExternalMediaExists) {
        const exists = await checkExternalMediaExists(pathToCheck);
        if (!exists) {
          missingMedia.push({
            assetId: asset.id,
            assetName: asset.name,
            lastKnownPath: pathToCheck,
            isMissing: true
          });
        }
      }
    }
  }

  return {
    manifest,
    project,
    missingMedia,
    embeddedMediaBuffers,
    thumbnails
  };
}

/**
 * Re-vincula la ruta externa de un recurso multimedia faltante en el proyecto
 */
export function relinkMissingMedia(
  project: KyvoraProject,
  assetId: string,
  newExternalPath: string
): KyvoraProject {
  return {
    ...project,
    assets: project.assets.map(asset => {
      if (asset.id !== assetId) return asset;
      return {
        ...asset,
        filePath: newExternalPath,
        name: newExternalPath.split(/[/\\]/).pop() || asset.name
      };
    }),
    updatedAt: new Date().toISOString()
  };
}
