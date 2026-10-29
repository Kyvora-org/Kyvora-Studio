# Kyvora Studio — Professional NLE Video Editor

Kyvora Studio es una suite de edición y postproducción de video no lineal (NLE) profesional, moderna y de alto rendimiento desarrollada por **KYVORA**. Construida sobre una arquitectura monorepo modular con aplicaciones web y de escritorio nativas para Windows (Tauri 2, Rust, React 19, TypeScript, Vite y FFmpeg 7).

---

## 🚀 Características Principales (v2.0)

### 1. Sistema Robusto de Importación Multimedia
- **Formatos de Vídeo**: MP4 (H.264, HEVC), MOV (ProRes, H.264), MKV, AVI, WebM (VP8, VP9).
- **Formatos de Audio**: MP3, WAV, AAC, M4A, OGG.
- **Formatos de Imagen**: PNG, JPG, JPEG, WebP, GIF, BMP (con soporte de secuencias temporales en línea de tiempo).
- **Extracción de Metadatos Real**: Duración precisa, resolución nativa, tasa de fotogramas (FPS), códec de origen, canales de audio y sample rate mediante FFprobe en Rust / Web Audio API.
- **Generación de Miniaturas Nativas**: Miniaturas extraídas con FFmpeg en segundo plano a 0.5s del archivo original, codificadas en base64 para previsualización inmediata.
- **Importación por Carpeta**: Escaneo recursivo o plano de directorios locales con filtrado inteligente de extensiones soportadas.
- **Deduplicación Automática**: Prevención de activos duplicados por hash SHA-256 e inspección de rutas en disco.
- **Zero-RAM Desktop Streaming**: En la aplicación de escritorio nativa, los archivos multimedia se leen directamente desde disco vía el protocolo seguro de streaming de Tauri (`asset://localhost`), eliminando el consumo excesivo de memoria RAM y la serialización JSON a través de IPC.

### 2. Motor Profesional de Exportación y Renderizado
- **Códecs de Vídeo**: H.264 (`libx264`), HEVC / H.265 (`libx265`), VP9 (`libvpx-vp9`), Apple ProRes (`prores_ks`).
- **Códecs de Audio**: AAC (`aac`), MP3 (`libmp3lame`), Opus (`libopus`), PCM (`pcm_s16le`).
- **Resoluciones Predefinidas y Personalizadas**:
  - 480p SD (854×480)
  - 720p HD (1280×720)
  - 1080p Full HD (1920×1080)
  - 1440p 2K QHD (2560×1440)
  - 2160p 4K UHD (3840×2160)
  - Resoluciones personalizadas con ancho/alto arbitrario y ajuste de paridad automático para códecs YUV420p.
- **Tasas de Fotogramas (FPS)**: 24 fps, 25 fps, 30 fps, 50 fps, 60 fps.
- **Perfiles de Calidad y Bitrate**:
  - Calidad Baja (CRF 28, preset faster, 128k audio)
  - Calidad Media (CRF 23, preset medium, 192k audio)
  - Calidad Alta (CRF 18, preset slow, 256k audio)
  - Calidad Máxima / Ultra (CRF 14, preset slower, 320k audio)
  - Bitrate personalizado en Mbps/kbps con control explícito `-b:v`.
- **Composición Multi-Pista en FFmpeg**: Generación determinista de grafos de filtros complejos (`filter_complex`) que aplican transformaciones espaciales, recorte exacto de fuentes, escalado bicúbico con letterboxing/pillarboxing automático, mapeo temporal de velocidad, transiciones, superposición de textos (`drawtext`), mezcla de canales de audio (`amix`) y normalización sonora profesional EBU R128 (`loudnorm`).
- **Diagnóstico y Telemetría Robusta**:
  - Tareas de renderizado asíncronas en hilos dedicados de Rust.
  - Registro estructurado (`export_diagnostics.log`) que sobrevive a reinicios y previene congelamiento de WebView2.
  - Cancelación limpia de procesos FFmpeg (`kill`) con liberación de descriptores y ficheros temporales.
  - Verificación post-exportación obligatoria con `ffprobe` (tamaño de archivo > 0, streams válidos de audio y vídeo).

### 3. Suite Integral de Edición No Lineal (NLE)
- **Línea de Tiempo Multi-Pista**: Pistas especializadas (`video`, `audio`, `text`, `overlay`) con controles independientes de visibilidad (ojo), bloqueo (candado) y silenciamiento (altavoz).
- **Edición Precisa de Clips**:
  - División de clips en el cabezal de reproducción (Split / `S`).
  - Duplicación de clips con desplazamiento inteligente (`Ctrl+D`).
  - Separación de audio de clips de vídeo (`Separar Audio`) creando pistas y clips de audio sincronizados.
  - Unión de clips contiguos del mismo activo de origen (`Join Clips`).
  - Desplazamiento y ajuste de inicio en línea de tiempo y fuente.
- **Control de Velocidad Dinámico**:
  - Presets rápidos (0.25x, 0.5x, 1x, 2x, 4x) y deslizador libre continuo.
  - Inversión de vídeo y audio (Reverse / reproducción hacia atrás).
  - Corrección automática de tono de audio (pitch correction) mediante `atempo`.
- **Efectos Visuales Configurables en Tiempo Real**:
  - Color Grading profesional (Temperatura, Exposición, Sombras, Luces, Contraste, Saturación, Brillo).
  - Desenfoque Gaussiano / Blur con control de radio.
  - Glow / Resplandor con color e intensidad regulable.
  - Bloom con umbral lumínico.
  - Viñeta cinematográfica ajustable (radio, suavidad, intensidad).
  - Film Grain (grano analógico) con aspereza e intensidad.
  - Pixelate (pixelado retro) con tamaño de celda.
  - Sharpen / Enfoque con realce de bordes.
  - Aberración cromática, RGB Split, Glitch y Distorsión de lente.
- **Sistema de Transiciones de Entrada y Salida**:
  - Cross Dissolve / Fundido cruzado.
  - Dip to Black / Fundido a negro.
  - Dip to White / Fundido a blanco.
  - Zoom In / Zoom Out.
  - Slide (Izquierda, Derecha, Arriba, Abajo).
  - Push, Wipe, Blur Transition y Glitch Transition.
- **Plantillas y Tipografía de Títulos**:
  - Lower Third (Tercio inferior televisivo / broadcast).
  - Cinematic Title (Tipografía con espaciado amplio y estilo cinematográfico).
  - Subtitle (Subtítulos con pastilla de contraste).
  - Cyberpunk (Estilo neón con resplandor cyan y magenta).
  - Bold Intro (Tipografía de impacto para aperturas).
  - Animaciones de entrada y salida (Fade, Slide Up, Slide Down, Zoom).
- **Herramientas de Audio Avanzadas**:
  - Deslizador de volumen (0% a 200%).
  - Ganancia en decibelios (-24 dB a +24 dB).
  - Fundido de entrada y salida (Fade In / Fade Out en segundos).
  - Normalización EBU R128 automática para cumplimiento de estándares de broadcast y streaming.
  - Visualización de formas de onda (Waveforms) en clips de audio.
- **Animación por Keyframes**:
  - Interpolación de propiedades (`scaleX`, `scaleY`, `positionX`, `positionY`, `rotationDegrees`, `opacity`).
  - Curvas de aceleración: Linear, Ease In, Ease Out, Ease In Out.

### 4. Formato de Proyecto y Archivo XTP (Schema 2.0.0)
- **Especificación `.xtp` v2.0**: Formato de paquete ZIP comprimido con manifiesto JSON criptográficamente validado (SHA-256), aislamiento seguro y prevención estricta de Path Traversal (`Zip Slip`).
- **Migración Automática**: Canalización de migración retrocompatible que actualiza sin pérdida proyectos guardados en versiones anteriores (v1.0.0 y v1.1.0) al esquema v2.0.0.
- **Relink de Medios**: Asistente automático para relocalizar y revincular activos multimedia cuyos ficheros físicos hayan sido movidos o renombrados en disco.

---

## ⌨️ Atajos de Teclado Profesionales

| Atajo | Acción |
| :--- | :--- |
| `Espacio` | Reproducir / Pausar |
| `S` | Dividir clip en cabezal (Split) |
| `Supr` / `Backspace` | Eliminar clip seleccionado |
| `Ctrl + D` | Duplicar clip seleccionado |
| `Ctrl + Z` | Deshacer (Undo) |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Rehacer (Redo) |
| `Flecha Izquierda` | Retroceder 1 fotograma (-1f) |
| `Flecha Derecha` | Avanzar 1 fotograma (+1f) |
| `Shift + Flecha Izquierda` | Retroceder 10 fotogramas (-10f) |
| `Shift + Flecha Derecha` | Avanzar 10 fotogramas (+10f) |
| `Inicio` (Home) | Ir al inicio del proyecto (00:00:00) |
| `Fin` (End) | Ir al final del proyecto |
| `Ctrl + E` | Abrir diálogo de exportación |
| `Ctrl + S` | Guardar proyecto actual |

---

## 📁 Arquitectura del Monorepo

```
Kyvora-Studio/
├── apps/
│   ├── web/               # Interfaz Web (React 19 + TypeScript + Vite + Tailwind CSS)
│   └── desktop/           # Aplicación de escritorio nativa Windows (Tauri 2 + Rust)
│       └── src-tauri/     # Backend en Rust (FFmpeg controller, media probe, dialogs, logger)
├── packages/
│   ├── ui/                # Componentes interactivos NLE (Timeline, Inspector, Viewport, MediaPanel)
│   └── editor-core/       # Estado global (Zustand), motor de render, operaciones inmutables, esquema XTP
├── docs/
│   ├── ARCHITECTURE.md    # Especificación de arquitectura y decisiones de diseño
│   └── CHANGELOG.md       # Historial de cambios y notas de versiones
├── package.json           # Scripts del workspace
├── pnpm-workspace.yaml    # Declaración de paquetes pnpm
└── tsconfig.base.json     # Configuración base estricta de TypeScript
```

---

## 🛠️ Comandos de Desarrollo

### 1. Instalación de dependencias
```bash
pnpm install
```

### 2. Ejecutar la Aplicación Web
```bash
pnpm run dev:web
```
Disponible en `http://localhost:5173`.

### 3. Ejecutar la Aplicación de Escritorio (Tauri 2)
```bash
pnpm run dev:desktop
```
O con el CLI de Tauri:
```bash
pnpm --filter @kyvora/desktop tauri dev
```

### 4. Ejecutar la Suite Completa de Pruebas (Vitest)
```bash
pnpm test
```
*Ejecuta 73 pruebas automatizadas cubriendo el motor de exportación, generación de filtergraph FFmpeg, esquemas XTP, operaciones inmutables y UI.*

### 5. Verificación de Tipos Estricta (TypeScript)
```bash
pnpm run typecheck
```

### 6. Compilación de Producción
```bash
pnpm run build
```

---

## ⚖️ Licencia
Desarrollado y mantenido por **KYVORA**. Todos los derechos reservados.
