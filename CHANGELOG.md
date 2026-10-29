# Changelog — Kyvora Studio

Todas las modificaciones notables realizadas en este proyecto están documentadas en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [2.0.0] — 2026-10-29

### 🚀 Reparación Integral y Expansión Profesional NLE

Esta versión representa la mayor evolución de **Kyvora Studio**, transformando la aplicación en una suite completa de edición de vídeo no lineal (NLE) profesional con motor multimedia robusto en Rust, Tauri 2 y FFmpeg 7.

#### Corregido (Reparaciones Críticas)
- **Eliminación del Cierre Inesperado y Pantalla Blanca en Exportación**:
  - Se identificó la causa raíz: saturación de memoria RAM y bloqueo de IPC en WebView2 al intentar pasar buffers completos de vídeo a través de canales serializados o llamadas síncronas.
  - Implementación de arquitectura asíncrona desacoplada en Rust mediante tareas `tokio` dedicadas (`export_video_job`), con captura no bloqueante de `stdout`/`stderr` de FFmpeg en hilos separados.
  - Creación de registro diagnóstico persistente en disco (`export_diagnostics.log`) que registra inicio, flags, parámetros, progreso y errores con capacidad de supervivencia a caídas del frontend.
  - Verificación post-exportación obligatoria con `ffprobe` que valida existencia física, tamaño mayor a 0 bytes y flujos de vídeo/audio válidos antes de notificar éxito.
- **Persistencia Real de Ajustes de Exportación**:
  - Resolución del problema donde los valores seleccionados en el panel derecho no se aplicaban al vídeo final.
  - Conexión determinista del diálogo de exportación con `generateRenderPlan`, mapeando exactamente resolución (480p hasta 4K), tasa de fotogramas (24 a 60 fps), códecs de vídeo (H.264, HEVC, VP9, ProRes), códecs de audio (AAC, MP3, Opus, PCM), factores de calidad CRF y bitrate personalizado en Mbps/kbps.

#### Añadido (Sistema de Importación)
- Soporte para todos los formatos multimedia requeridos:
  - **Vídeo**: MP4, MOV, MKV, AVI, WebM.
  - **Audio**: MP3, WAV, AAC, M4A, OGG.
  - **Imagen**: PNG, JPG, JPEG, WebP, GIF, BMP.
- Extracción de metadatos nativa en segundo plano mediante `ffprobe` en Rust y Web Audio API en navegador.
- Comando Tauri nativo `generate_media_thumbnail` que extrae miniaturas directas a 0.5s en base64 sin cargar ficheros pesados en la memoria de JavaScript.
- Diálogo de importación por carpeta (`scan_media_folder`) con filtrado de extensiones y detección de estructuras de directorios.
- Deduplicación automática de archivos por hash SHA-256 e inspección de rutas absolutas.
- Prevención de fugas de memoria en escritorio: los archivos locales usan streaming directo desde disco a través del protocolo nativo `asset://localhost`, permitiendo editar vídeos 4K pesados con 0 MB de copia en el heap de JavaScript.

#### Añadido (Edición No Lineal y Capacidades NLE)
- **Línea de Tiempo Multi-Pista**:
  - Creación de pistas dinámicas para vídeo, audio, texto y capas de efectos superpuestas (`overlay`).
  - Controles de visibilidad (`isVisible`), bloqueo (`isLocked`) y silenciamiento (`isMuted`) por pista.
  - Menú contextual en clips: División en cabezal (Split), Duplicación, Separación de audio y Eliminación.
  - Controles de transporte con avance y retroceso por fotograma individual (+1f, -1f) y bloques de 10 fotogramas (+10f, -10f).
  - Formas de onda de audio (Waveform) representadas visualmente sobre los clips sonoros.
  - Badges informativos sobre clips para FX activos, velocidad alterada y transiciones.
- **Control de Velocidad y Dirección**:
  - Control de reproducción rápida y cámara lenta (0.25x a 4x) con compensación de tono de audio (`pitchCorrection`).
  - Reproducción invertida (Reverse) en vídeo y audio (`reverse` y `areverse`).
- **Suite de Efectos Visuales Configurables (16 Efectos)**:
  - Color Grading (Brillo, Contraste, Saturación, Temperatura cálida/fría, Exposición, Sombras, Luces).
  - Desenfoque Gaussiano (Blur con radio regulable).
  - Viñeta Cinematográfica (con radio, suavidad e intensidad).
  - Grano Analógico (Film Grain con aspereza e intensidad).
  - Glow / Resplandor con selector de color hexadecimal.
  - Bloom lumínico con umbral configurable.
  - Pixelate (pixelado retro) y Sharpen (enfoque de bordes).
  - Glitch, RGB Split, Aberración Cromática y Distorsión de lente.
- **Biblioteca de Transiciones (17 Tipos)**:
  - Cross Dissolve, Dip to Black, Dip to White, Zoom In, Zoom Out, Slide (Left, Right, Up, Down), Push, Wipe, Blur Transition y Glitch Transition.
- **Módulo de Títulos y Tipografías**:
  - Plantillas profesionales: Lower Third (tercio inferior de noticias), Cinematic (tipografía elegante con espaciado amplio), Subtitle (pastilla de alto contraste), Cyberpunk (resplandor neón cyan/magenta) y Bold Intro.
  - Selector de tipografía, tamaño de fuente, color de texto y color de fondo.
  - Animaciones de entrada y salida configurables (Fade, Slide Up, Slide Down, Zoom).
- **Procesamiento de Audio**:
  - Controles de ganancia en decibelios (-24 dB a +24 dB).
  - Fundidos de audio (Fade In y Fade Out en segundos).
  - Normalización acústica profesional integrada EBU R128 (`loudnorm`) en el motor de exportación.
- **Animación por Keyframes**:
  - Sistema de fotogramas clave para animar posición, escala, rotación y opacidad con curvas Linear, Ease In, Ease Out y Ease In Out.

#### Esquema de Proyecto
- Evolución a **Schema 2.0.0** para el formato de empaquetado `.xtp`.
- Canalización de migración automática retrocompatible para proyectos v1.0.0 y v1.1.0 sin pérdida de datos.
- Función de revinculación (Relink Media) para activos movidos o renombrados en el sistema de archivos.

#### Verificación y Pruebas
- 73 pruebas automatizadas ejecutadas y superadas con éxito (100% pass rate).
- Pruebas reales de codificación de vídeo y decodificación ejecutadas con FFmpeg 7 y validadas con FFprobe en entorno de desarrollo.
