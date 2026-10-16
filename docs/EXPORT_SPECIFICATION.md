# Especificación Técnica: Previsualización y Motor de Exportación en Kyvora Studio

Este documento detalla la arquitectura, el diseño y las diferencias operativas entre la previsualización interactiva y los motores de renderizado de **Kyvora Studio** para plataformas de Escritorio (Tauri 2 + FFmpeg nativo) y Web (HTML5 Canvas + Web Audio + MediaRecorder).

---

## 1. Arquitectura y Desacoplamiento

Kyvora Studio separa estrictamente la capa de **Previsualización en tiempo real** de la capa del **Motor de Renderizado/Exportación**:

```
+-----------------------------------------------------------------------------+
|                               Project Model                                 |
| (Tracks, Clips, MediaReferences, Keyframes, Supported Effects, Source Range)|
+-------------------------------------+---------------------------------------+
                                      |
            +-------------------------+-------------------------+
            |                                                   |
            v                                                   v
+-----------------------+                           +-----------------------+
|    Preview Engine     |                           |   Render Generator    |
| (Interactive Player)  |                           |     (Render Plan)     |
+-----------+-----------+                           +-----------+-----------+
            |                                                   |
    +-------+-------+                                   +-------+-------+
    |               |                                   |               |
    v               v                                   v               v
 [Web Canvas] [Desktop Player]                [Desktop FFmpeg Engine] [Web Export Adapter]
 (RAF / AudioCtx) (Tauri IPC)                   (Native Subprocess)   (MediaRecorder MP4/WebM)
```

### 1.1. Previsualización Interactiva (`PreviewEngine`)
- **Objetivo**: Respuesta inmediata a la interacción del usuario (arrastre del cabezal, recorte de clips, reproducción fluida a 60 FPS sin bloquear la interfaz).
- **Ciclo de reproducción**:
  - `requestAnimationFrame` para la sincronización temporal con reloj monotónico de alta resolución (`performance.now()`).
  - Mapeo en $O(N)$ optimizado para evaluar qué clips están activos en el tiempo $T$.
  - Manejo de saltos temporales (scrubbing/seek) y paso a paso por cuadros (frame stepping: `stepFrame(1)` / `stepFrame(-1)`).
- **Gestión de Recursos y Fugas de Memoria**:
  - Cierre explícito de contextos `AudioContext` (`close()`).
  - Liberación de referencias DOM y elementos de medios (`pause()`, `src = ''`, `load()`).
  - Revocación de URLs de objetos temporales (`URL.revokeObjectURL()`).

### 1.2. Generador de Plan de Renderizado (`generateRenderPlan`)
- **Objetivo**: Convertir la descripción declarativa del proyecto en un plan determinista de renderizado (`RenderPlan`), calculando resolución de salida, tasa de cuadros (FPS), bitrate objetivo y la cadena de filtros complejos (`filter_complex`).
- **Determinismo**: La misma línea de tiempo genera exactamente la misma secuencia de comandos y filtros reproducibles, independientemente de la carga de la CPU.

---

## 2. Motor de Exportación de Escritorio (FFmpeg Nativo)

### 2.1. Aislamiento y Seguridad en Rust (Tauri 2)
La integración con FFmpeg se realiza mediante subprocesos controlados en Rust (`apps/desktop/src-tauri/src/export_engine.rs`):
- **Validación de Rutas**: Validación estricta de rutas absolutas de entrada y salida para evitar inyección de rutas (`path traversal`) o caracteres no válidos.
- **Validación de Argumentos**: Ningún parámetro proporcionado por el usuario se interpola en una shell. Los argumentos se pasan como un vector de cadenas aisladas (`std::process::Command::new("ffmpeg").args(...)`).
- **Prevención de Ataques**: Se prohíbe la ejecución de comandos arbitrarios incrustados o filtros no validados.
- **Cancelación Atómica**: Bandera atómica thread-safe (`AtomicBool`) y terminación forzosa del subproceso hijo (`child.kill()`) si el usuario solicita cancelar la exportación.
- **Monitoreo y Progreso**: Lectura no bloqueante línea por línea de `stderr`, extrayendo `time=HH:MM:SS.ms` y `fps=...`, calculando el porcentaje completado y emitiendo eventos `export-progress` a la interfaz.

### 2.2. Pipeline de Filtros (`filter_complex`)
El generador estructura los filtros en tres etapas fundamentales:
1. **Pista de Fondo / Lienzo Base**:
   `color=s={width}x{height}:c=black:r={fps}:d={duration}[base];`
2. **Transformación de Video por Clip**:
   - Recorte en origen: `trim=start={srcStart}:end={srcEnd},setpts=PTS-STARTPTS`
   - Escala y centrado con aspecto preservado: `scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2`
   - Efectos validados (brillo, contraste, saturación): `eq=brightness={b}:contrast={c}:saturation={s}`
   - Composición en tiempo: `overlay=enable='between(t,{start},{end})'`
3. **Mezcla de Audio**:
   - Recorte temporal: `atrim=start={srcStart}:end={srcEnd},asetpts=PTS-STARTPTS`
   - Retardo para sincronización: `adelay={start_ms}|{start_ms}`
   - Mezcla final multipista: `amix=inputs={count}:duration=longest[aout]`
   - Generación de silencio en caso de no haber clips de audio: `anullsrc=r=48000:cl=stereo`

---

## 3. Adaptador de Exportación Web (`WebExportAdapter`)

Debido a que el navegador no permite ejecutar subprocesos nativos como FFmpeg sin WebAssembly pesado (que consume cientos de megabytes de RAM en dispositivos cliente), se implementa un adaptador separado basado en estándares web:

- **Composición**: `OffscreenCanvas` o `HTMLCanvasElement` renderizado cuadro a cuadro con transformaciones CSS / Canvas 2D (`filter: brightness() contrast() saturate()`).
- **Codificación**: `MediaRecorder` API capturando el stream de video (`canvas.captureStream(fps)`) y el stream de audio mezclado con `AudioContext.createMediaStreamDestination()`.
- **Formato**:
  - Preferido: `video/mp4; codecs="avc1.42E01E, mp4a.40.2"`
  - Alternativa: `video/webm; codecs=vp9,opus` o `video/webm`
- **Descarga**: Empaquetado automático en `Blob` y descarga mediante enlace dinámico.

---

## 4. Matriz de Compatibilidad y Diferencias de Rendimiento

| Característica | Motor de Escritorio (FFmpeg) | Adaptador Web (Browser APIs) |
| :--- | :--- | :--- |
| **Aceleración Hardware** | Soporte para codificación H.264 por hardware (NVENC, QSV, AMF) | Dependiente del navegador y GPU local (`MediaRecorder`) |
| **Precisión de Cuadros** | 100% determinista cuadro a cuadro | Dependiente del temporizador del navegador y carga del hilo principal |
| **Codecs soportados** | MP4 (H.264 High Profile / AAC-LC) | MP4 (H.264 en navegadores modernos) o WebM (VP9/VP8) |
| **Resoluciones** | 720p, 1080p, 1440p, 4K UHD sin límite de memoria | Recomendado hasta 1080p (4K puede provocar Out-Of-Memory en tabs) |
| **Uso de Memoria** | Subproceso aislado, memoria del SO | Heap limitado de JavaScript en el hilo de la pestaña |
| **Cancelación** | Inmediata (terminación de proceso `kill`) | Inmediata (detención de `MediaRecorder` y limpieza de streams) |

---

## 5. Efectos Visuales Soportados

Kyvora Studio garantiza una política estricta: **no se declaran efectos en la interfaz que no se exporten de manera idéntica en el archivo final**.

| Efecto | Modelo Interno | Parámetro FFmpeg | Parámetro Web Canvas |
| :--- | :--- | :--- | :--- |
| **Brillo** | `brightness` [-1.0 a 1.0] | `eq=brightness={val}` | `ctx.filter = "brightness({100 + val*100}%)"` |
| **Contraste** | `contrast` [0.0 a 2.0] | `eq=contrast={val}` | `ctx.filter = "contrast({val*100}%)"` |
| **Saturación** | `saturation` [0.0 a 2.0] | `eq=saturation={val}` | `ctx.filter = "saturate({val*100}%)"` |

*Nota: Los efectos no soportados o experimentales se encuentran deshabilitados hasta que su mapeo matemático exacto esté implementado y probado tanto en FFmpeg como en Canvas.*
