import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

/**
 * Plugin de Vite para streaming de medios locales en Kyvora Studio.
 * Soporta HTTP 206 Partial Content (Accept-Ranges: bytes) para que el elemento <video>
 * pueda reproducir y realizar scrubbing instantáneo sobre cualquier archivo de video/audio
 * del disco duro sin cargarlo en memoria RAM ni sufrir fallos de CORS o rutas especiales.
 */
export function mediaStreamPlugin(): Plugin {
  return {
    name: 'kyvora-media-stream',
    configureServer(server) {
      server.middlewares.use('/@media-stream', (req, res, next) => {
        try {
          const parsedUrl = new URL(req.url || '', 'http://localhost');
          const rawPath = parsedUrl.searchParams.get('path');
          if (!rawPath) {
            res.statusCode = 400;
            res.end('Missing file path');
            return;
          }

          if (!fs.existsSync(rawPath)) {
            res.statusCode = 404;
            res.end('File not found');
            return;
          }

          const stat = fs.statSync(rawPath);
          if (!stat.isFile()) {
            res.statusCode = 400;
            res.end('Path is not a file');
            return;
          }

          const fileSize = stat.size;
          const range = req.headers.range;
          const ext = path.extname(rawPath).toLowerCase();

          const mimeTypes: Record<string, string> = {
            '.mp4': 'video/mp4',
            '.m4v': 'video/mp4',
            '.webm': 'video/webm',
            '.mov': 'video/quicktime',
            '.mkv': 'video/x-matroska',
            '.avi': 'video/x-msvideo',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.aac': 'audio/aac',
            '.ogg': 'audio/ogg',
            '.flac': 'audio/flac',
            '.m4a': 'audio/mp4',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.svg': 'image/svg+xml'
          };
          const contentType = mimeTypes[ext] || 'application/octet-stream';

          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Content-Type', contentType);
          res.setHeader('Access-Control-Allow-Origin', '*');

          if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;

            res.statusCode = 206;
            res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            res.setHeader('Content-Length', chunksize);

            const fileStream = fs.createReadStream(rawPath, { start, end });
            fileStream.on('error', () => {
              if (!res.headersSent) {
                res.statusCode = 500;
                res.end();
              }
            });
            fileStream.pipe(res);
          } else {
            res.statusCode = 200;
            res.setHeader('Content-Length', fileSize);
            const fileStream = fs.createReadStream(rawPath);
            fileStream.on('error', () => {
              if (!res.headersSent) {
                res.statusCode = 500;
                res.end();
              }
            });
            fileStream.pipe(res);
          }
        } catch (err) {
          next(err);
        }
      });
    }
  };
}

