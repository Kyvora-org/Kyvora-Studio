# Plan de Implementación: Motor de Vista Previa y Motor de Exportación (Desktop & Web)

## 1. Desacoplamiento de Arquitectura
Separación rigurosa de responsabilidades:
- **`PreviewEngine`**: Reproductor interactivo en tiempo real con sincronización de audio/video, búsqueda precisa (`seek`), gestión de ciclo de vida (`load`, `play`, `pause`, `destroy`) y liberación de recursos de memoria (URL blobs, buffers, canales de audio).
- **`RenderPlanGenerator`**: Convertidor agnóstico de la línea de tiempo (`KyvoraProject`) en un plan de renderizado secuencial estricto (`RenderPlan`), traduciendo pistas, recortes (`trim`), posiciones temporales, transformaciones (`scale`, `position`, `opacity`), efectos de color/brillo/contraste soportados y mezcla de canales de audio a un grafo de filtros estructurado (`filter_complex` para FFmpeg / WebCodecs o Canvas Render en web).
- **`ExportEngine` (Desktop)**: Proceso nativo seguro en Rust (Tauri 2) que valida rutas y argumentos, invoca `ffmpeg.exe`, reporta progreso granular (tiempo procesado / porcentaje / FPS) vía eventos IPC y soporta cancelación inmediata (terminación limpia del subproceso).
- **`ExportEngine` (Web)**: Adaptador de renderizado en navegador basado en `Canvas` + `MediaRecorder` o simulación por segmentos, con documentación exhaustiva de las diferencias de rendimiento, límites de códec (H.264/AAC nativo vs WebM) y compatibilidad.

## 2. Componentes a Crear y Modificar

1. **`packages/editor-core/src/render/renderPlan.ts`**:
   - `RenderSettings`: Resolución (1080p, 720p, 4K), FPS (24, 30, 60), Bitrate/Calidad (Baja, Media, Alta, Sin pérdidas), codec de video (`h264`, `hevc`), codec de audio (`aac`).
   - `RenderPlan`: Definición de inputs, capas de video compuestas (con `overlay`, `scale`, `eq=brightness:contrast`), capas de audio mezcladas (`amix`, `volume`, `pan`) y duración total.
   - Generador de argumentos de línea de comandos para FFmpeg.
2. **`packages/editor-core/src/render/previewEngine.ts`**:
   - Controlador de previsualización desacoplado con control de transporte, sincronización de frames y recolección de basura.
3. **`apps/desktop/src-tauri/src/export_engine.rs`**:
   - Subproceso de FFmpeg en Rust: validación de paths, streaming de stderr de FFmpeg para extraer `time=HH:MM:SS.ff`, cálculo de progreso porcentual y cancelación por `TaskId`/Kill switch.
   - Registro en `lib.rs` de Tauri.
4. **`packages/editor-core/src/render/webExportAdapter.ts`**:
   - Adaptador Web con `MediaRecorder` o exportación frame-by-frame en Canvas y descarga de archivo resultante.
5. **`packages/ui/src/components/ExportModal.tsx` & `HeaderBar.tsx`**:
   - Diálogo modal con selección de presets (1080p, 720p, 4K), framerate, calidad, barra de progreso real (0-100%) y botón de cancelación.
6. **`packages/editor-core/tests/renderPlan.test.ts` & `export.test.ts`**:
   - Pruebas unitarias de conversión de proyecto a plan de renderizado, cálculo de filtros `filter_complex`, límites de resolución/calidad y verificación de exportación.
7. **`docs/EXPORT_SPECIFICATION.md`**:
   - Documentación técnica del motor de renderizado, grafo de filtros, diferencias entre web y escritorio, y parámetros soportados.
