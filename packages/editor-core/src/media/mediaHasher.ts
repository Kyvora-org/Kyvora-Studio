/**
 * Calcula un hash criptográfico SHA-256 consistente sobre los datos binarios del archivo
 * para generar un identificador de activo estable, evitando rutas absolutas o URLs blob efímeras.
 */
export async function computeStableAssetId(
  fileBytes: Uint8Array | ArrayBuffer,
  fileName: string
): Promise<string> {
  const bytes = fileBytes instanceof Uint8Array ? fileBytes : new Uint8Array(fileBytes);
  
  // Para archivos muy grandes tomamos una muestra determinista de cabecera (64KB), cola (64KB) y longitud total
  const sampleLength = 64 * 1024;
  let sample: Uint8Array;

  if (bytes.length <= sampleLength * 2) {
    sample = bytes;
  } else {
    sample = new Uint8Array(sampleLength * 2 + 8);
    sample.set(bytes.subarray(0, sampleLength), 0);
    sample.set(bytes.subarray(bytes.length - sampleLength), sampleLength);
    // Añadir longitud total
    const dv = new DataView(sample.buffer, sampleLength * 2, 8);
    dv.setBigUint64(0, BigInt(bytes.length), true);
  }

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const digestBuffer = await crypto.subtle.digest('SHA-256', sample as Uint8Array<ArrayBuffer>);
      const hashArray = Array.from(new Uint8Array(digestBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return `asset_${hashHex.substring(0, 16)}`;
    } catch {
      // Fallback a hashing determinista
    }
  }

  // Fallback rápido y determinista de hash
  let h = 0x811c9dc5;
  for (let i = 0; i < sample.length; i++) {
    h ^= sample[i];
    h = Math.imul(h, 0x01000193);
  }
  const cleanName = fileName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  return `asset_${(h >>> 0).toString(16)}_${cleanName}`;
}
