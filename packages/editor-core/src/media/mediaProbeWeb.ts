import { MediaProbeResult } from './mediaTypes';

/**
 * Inspecciona metadatos multimedia en entorno Web utilizando APIs nativas HTML5
 * (<video>, <audio>, <img>) y genera miniaturas mediante <canvas>.
 * Se revoca de inmediato cualquier URL de objeto creada tras la extracción.
 */
export async function probeMediaWeb(
  fileBytes: Uint8Array | ArrayBuffer,
  fileName: string,
  mimeType: string
): Promise<MediaProbeResult> {
  const bytes = fileBytes instanceof Uint8Array ? fileBytes : new Uint8Array(fileBytes);
  const sizeBytes = bytes.byteLength;
  const lowerName = fileName.toLowerCase();

  // Detectar categoría
  const isVideo = mimeType.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(lowerName);
  const isAudio = mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(lowerName);
  const isImage = mimeType.startsWith('image/') || /\.(png|jpe?g|webp|svg|gif)$/i.test(lowerName);

  // En entornos de Node o sin window/document o sin URL.createObjectURL (ej. pruebas o Node.js puro)
  if (
    typeof window === 'undefined' || 
    typeof document === 'undefined' || 
    typeof Blob === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return {
      formatName: mimeType || 'application/octet-stream',
      durationInSeconds: isImage ? 5 : 10,
      width: isAudio ? undefined : 1920,
      height: isAudio ? undefined : 1080,
      fileSizeBytes: sizeBytes,
      hasVideo: isVideo || isImage,
      hasAudio: isAudio || isVideo,
      thumbnailBase64: undefined
    };
  }

  const blob = new Blob([bytes as BlobPart], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);

  const revoke = () => {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Ignorar fallo de revocación
    }
  };

  try {
    if (isImage) {
      return await new Promise<MediaProbeResult>((resolve) => {
        const img = new Image();
        let isDone = false;

        const timer = setTimeout(() => {
          if (!isDone) {
            isDone = true;
            revoke();
            resolve({
              formatName: mimeType,
              durationInSeconds: 5,
              width: 1920,
              height: 1080,
              fileSizeBytes: sizeBytes,
              hasVideo: true,
              hasAudio: false,
              thumbnailBase64: undefined
            });
          }
        }, 3000);

        img.onload = () => {
          if (isDone) return;
          isDone = true;
          clearTimeout(timer);

          let thumbnailBase64: string | undefined;
          try {
            const canvas = document.createElement('canvas');
            const targetWidth = 160;
            const targetHeight = Math.round((img.naturalHeight / img.naturalWidth) * targetWidth) || 90;
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
              thumbnailBase64 = canvas.toDataURL('image/jpeg', 0.7);
            }
          } catch {
            // Ignorar fallo de miniatura
          }

          revoke();
          resolve({
            formatName: mimeType,
            durationInSeconds: 5, // Duración visual por defecto en timeline para imágenes
            width: img.naturalWidth || 1920,
            height: img.naturalHeight || 1080,
            fileSizeBytes: sizeBytes,
            hasVideo: true,
            hasAudio: false,
            thumbnailBase64
          });
        };

        img.onerror = () => {
          if (isDone) return;
          isDone = true;
          clearTimeout(timer);
          revoke();
          // Fallback con valores por defecto para no bloquear la importación
          resolve({
            formatName: mimeType,
            durationInSeconds: 5,
            width: 1920,
            height: 1080,
            fileSizeBytes: sizeBytes,
            hasVideo: true,
            hasAudio: false,
            thumbnailBase64: undefined
          });
        };

        img.src = objectUrl;
      });
    }

    if (isVideo) {
      return await new Promise<MediaProbeResult>((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        let isDone = false;

        const cleanup = () => {
          video.onloadedmetadata = null;
          video.onseeked = null;
          video.onerror = null;
          revoke();
        };

        const timer = setTimeout(() => {
          if (!isDone) {
            isDone = true;
            cleanup();
            resolve({
              formatName: mimeType,
              durationInSeconds: 10,
              width: 1920,
              height: 1080,
              fileSizeBytes: sizeBytes,
              hasVideo: true,
              hasAudio: true,
              thumbnailBase64: undefined
            });
          }
        }, 4000);

        video.onloadedmetadata = () => {
          const duration = video.duration && !isNaN(video.duration) ? video.duration : 10;
          const width = video.videoWidth || 1920;
          const height = video.videoHeight || 1080;

          // Intentar capturar miniatura en segundo 0.5 o inicio
          try {
            video.currentTime = Math.min(0.5, duration / 2);
            video.onseeked = () => {
              if (isDone) return;
              isDone = true;
              clearTimeout(timer);

              let thumbnailBase64: string | undefined;
              try {
                const canvas = document.createElement('canvas');
                const targetWidth = 160;
                const targetHeight = Math.round((height / width) * targetWidth) || 90;
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
                  thumbnailBase64 = canvas.toDataURL('image/jpeg', 0.6);
                }
              } catch {
                // Fallback sin miniatura
              }
              cleanup();
              resolve({
                formatName: mimeType,
                durationInSeconds: duration,
                width,
                height,
                fileSizeBytes: sizeBytes,
                hasVideo: true,
                hasAudio: true,
                thumbnailBase64
              });
            };
          } catch {
            // Si falla el seek, devolver inmediatamente con dimensiones
            if (!isDone) {
              isDone = true;
              clearTimeout(timer);
              cleanup();
              resolve({
                formatName: mimeType,
                durationInSeconds: duration,
                width,
                height,
                fileSizeBytes: sizeBytes,
                hasVideo: true,
                hasAudio: true,
                thumbnailBase64: undefined
              });
            }
          }
        };

        video.onerror = () => {
          if (isDone) return;
          isDone = true;
          clearTimeout(timer);
          cleanup();
          // Devolver metadatos por defecto para permitir al archivo ingresar al panel
          resolve({
            formatName: mimeType,
            durationInSeconds: 10,
            width: 1920,
            height: 1080,
            fileSizeBytes: sizeBytes,
            hasVideo: true,
            hasAudio: true,
            thumbnailBase64: undefined
          });
        };

        video.src = objectUrl;
      });
    }

    if (isAudio) {
      return await new Promise<MediaProbeResult>((resolve) => {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        let isDone = false;

        const timer = setTimeout(() => {
          if (!isDone) {
            isDone = true;
            revoke();
            resolve({
              formatName: mimeType,
              durationInSeconds: 30,
              fileSizeBytes: sizeBytes,
              hasVideo: false,
              hasAudio: true
            });
          }
        }, 3000);

        audio.onloadedmetadata = () => {
          if (isDone) return;
          isDone = true;
          clearTimeout(timer);
          const duration = audio.duration && !isNaN(audio.duration) ? audio.duration : 30;
          revoke();
          resolve({
            formatName: mimeType,
            durationInSeconds: duration,
            fileSizeBytes: sizeBytes,
            hasVideo: false,
            hasAudio: true
          });
        };

        audio.onerror = () => {
          if (isDone) return;
          isDone = true;
          clearTimeout(timer);
          revoke();
          resolve({
            formatName: mimeType,
            durationInSeconds: 30,
            fileSizeBytes: sizeBytes,
            hasVideo: false,
            hasAudio: true
          });
        };

        audio.src = objectUrl;
      });
    }

    // Default fallback
    revoke();
    return {
      formatName: mimeType,
      durationInSeconds: 10,
      fileSizeBytes: sizeBytes,
      hasVideo: false,
      hasAudio: false
    };
  } catch (err) {
    revoke();
    throw err;
  }
}
