# Plan de Implementación: Sistema de Importación Multimedia de Kyvora Studio

## 1. Objetivos del Sistema
- **Soporte Universal**: Importación de Video (`.mp4`, `.webm`, `.mov`, `.mkv`), Audio (`.mp3`, `.wav`, `.ogg`, `.aac`, `.flac`) e Imágenes (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`).
- **Interfaces de Entrada**: Diálogo selector de archivos nativo y zona interactiva de Drag & Drop en el panel multimedia.
- **Identificadores Estables**: Empleo de hashes criptográficos (SHA-256) calculados sobre los primeros bloques de contenido o identificadores de contenido `urn:kyvora:asset:<hash>`, evitando rutas absolutas o URLs blob efímeras como ID.
- **Inspección de Metadatos Segura**:
  - **Desktop**: Ejecución segura de `ffprobe` en Rust mediante Tauri Commands (`probe_media_file`), sanitizando rutas, con timeouts y serializando JSON estructurado (códecs, duración, ancho, alto, canales de audio, fps).
  - **Web**: Extracción nativa basada en elementos HTML5 `<video>`, `<audio>` e `Image()` con `URL.revokeObjectURL()` inmediato, registrando limitaciones conocidas (formatos dependientes de códecs del navegador como H.264/AAC/WebM vs ProRes/MKV).
- **Generación de Miniaturas**:
  - Canvas 2D en Web / primer fotograma decodificado.
  - Almacenamiento seguro en base de datos de miniaturas sin contaminar la memoria RAM.
- **Almacenamiento Persistente y Durabilidad**:
  - **Web**: `MediaStorageAdapter` basado en `IndexedDB` (`KyvoraMediaStore`) guardando los blobs/ArrayBuffers bajo el ID estable para que al recargar o reabrir el proyecto sigan disponibles sin depender de blobs revocados.
  - **Desktop**: Referencias estables relativas o hashes vinculados al almacenamiento del proyecto XTP y caché de trabajo.
- **Progreso y Notificación de Errores Reales**: Notificación visual de avance (0-100%) y desglose claro de errores de decodificación o formatos no soportados.

## 2. Archivos a Crear y Modificar

1. **`packages/editor-core/src/media/mediaTypes.ts`**:
   - `MediaProbeResult`, `MediaImportProgress`, `MediaFormatSupport`, `MediaStorageRecord`.
2. **`packages/editor-core/src/media/mediaProbeWeb.ts`**:
   - Extracción de duración, dimensiones y generación de thumbnail en navegador con APIs HTML5 (`<video>`, `<canvas>`).
3. **`packages/editor-core/src/media/mediaPersistence.ts`**:
   - `IndexedDBMediaRepository`: Almacena blobs binarios indexados por `assetId`.
   - Recuperación de streams reproducibles tras cerrar y abrir proyectos.
4. **`packages/editor-core/src/media/mediaImporter.ts`**:
   - Orquestador del flujo de importación: validación de tamaño, cálculo de ID estable SHA-256, extracción de metadatos, almacenamiento y emisión de progreso.
5. **`apps/desktop/src-tauri/src/media_probe.rs` y `lib.rs`**:
   - Comando Tauri seguro `probe_media_with_ffprobe` que invoca `ffprobe` con `-show_streams -show_format -print_format json`.
6. **`packages/ui/src/components/MediaPanel.tsx`**:
   - Drag & Drop visual interactivo, barra de progreso real, advertencias de compatibilidad y renderizado de miniaturas.
7. **`packages/editor-core/tests/mediaImport.test.ts`**:
   - Pruebas de detección de formatos, cálculo de ID estable, simulación de probe, persistencia en repositorio y reapertura de proyectos sin pérdida de medios.
