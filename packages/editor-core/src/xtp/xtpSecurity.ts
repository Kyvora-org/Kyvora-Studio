import { XtpPackageSecurityLimits, DEFAULT_XTP_SECURITY_LIMITS } from './xtpTypes';

// Extensiones prohibidas por motivos de seguridad dentro de archivos .xtp
const DISALLOWED_FILE_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.vbs', '.vbe', '.js', '.jse',
  '.wsf', '.wsh', '.ps1', '.psm1', '.scr', '.pif', '.dll', '.so', '.dylib'
]);

/**
 * Valida que una ruta de archivo dentro del ZIP sea segura y prevenga ataques de Zip-Slip (Path Traversal)
 */
export function sanitizeAndValidateZipPath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== 'string') {
    throw new Error('Ruta de entrada inválida en archivo XTP');
  }

  // Normalizar separadores a barra diagonal
  const normalized = rawPath.replace(/\\/g, '/').trim();

  // Rechazar rutas absolutas (POSIX o Windows tipo C:/ o \\server)
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized) || normalized.startsWith('//')) {
    throw new Error(`Ruta maliciosa detectada en archivo XTP (Ruta absoluta prohibida): "${rawPath}"`);
  }

  // Validar cada segmento de ruta para evitar Zip-Slip (`..`)
  const segments = normalized.split('/');
  for (const segment of segments) {
    if (segment === '..' || segment === '.') {
      throw new Error(`Ataque de Zip-Slip detectado en archivo XTP (Ruta de escape de directorio): "${rawPath}"`);
    }
  }

  // Rechazar extensiones de archivo ejecutables
  const lowerPath = normalized.toLowerCase();
  for (const ext of DISALLOWED_FILE_EXTENSIONS) {
    if (lowerPath.endsWith(ext)) {
      throw new Error(`Archivo no permitido en paquete XTP por motivos de seguridad (${ext}): "${rawPath}"`);
    }
  }

  return normalized;
}

/**
 * Valida los límites de tamaño y cantidad de entradas del archivo ZIP para evitar ataques de denegación de servicio (ZIP bombs)
 */
export function validateZipEntryCountAndSize(
  entryCount: number, 
  totalSizeBytes: number, 
  limits: XtpPackageSecurityLimits = DEFAULT_XTP_SECURITY_LIMITS
): void {
  if (entryCount > limits.maxZipEntries) {
    throw new Error(`El archivo XTP excede el límite permitido de entradas (${entryCount} > ${limits.maxZipEntries})`);
  }

  if (totalSizeBytes > limits.maxTotalSizeBytes) {
    throw new Error(`El tamaño total del archivo XTP excede el límite permitido (${(totalSizeBytes / (1024 * 1024)).toFixed(2)} MB > ${(limits.maxTotalSizeBytes / (1024 * 1024)).toFixed(2)} MB)`);
  }
}
