# Arquitectura Técnica — Kyvora Studio

## 1. Visión General

Kyvora Studio es una estación de trabajo de edición no lineal (NLE) moderna orientada a la edición de video ágil, intuitiva y de alto rendimiento. El objetivo del sistema es permitir tanto su ejecución local como aplicación de escritorio nativa en Windows con capacidades de bajo nivel a través de Tauri 2 y Rust, como su despliegue como aplicación web progresiva aprovechando tecnologías web estándar (HTML5, Canvas/WebGL, Web Audio API y WebCodecs).

---

## 2. Decisiones de Arquitectura

### 2.1 Monorepo con `pnpm`
- **Aislamiento y reutilización**: Los paquetes `@kyvora/ui` y `@kyvora/editor-core` están desacoplados de los entornos de ejecución (`apps/web` y `apps/desktop`).
- **Eficiencia en disco y enlaces simbólicos**: `pnpm` utiliza enlaces rígidos para compartir paquetes y dependencias en el espacio de trabajo con un almacenamiento unificado.
- **Protocolo `workspace:*`**: Permite que las aplicaciones y paquetes consuman siempre las fuentes locales vivas sin requerir ciclos de publicación ficticios.

### 2.2 Desacoplamiento de Lógica (`packages/editor-core`)
- El estado y la lógica de edición no tienen ninguna dependencia de React ni del DOM.
- El estado reactivo es administrado con **Zustand** gracias a:
  - Consumo directo en componentes de React (`useEditorStore()`).
  - Capacidad de acceso y suscripción fuera de React (`useEditorStore.getState()` / `.subscribe()`), lo que facilita en fases posteriores la integración con hilos de trabajo (Web Workers) o bindings IPC de Tauri.
- Todos los cálculos temporales están basados en segundos flotantes con precisión de sub-frames y convertidos a timecodes SMPTE (`HH:MM:SS:FF`) según la tasa de cuadros (`fps`) configurada en el proyecto.

### 2.3 Sistema de Diseño y Componentes Compartidos (`packages/ui`)
- Se implementó un layout modular:
  - **`HeaderBar`**: Gestión de metadatos del proyecto, timecode maestro sincronizado y acciones globales (guardar, exportar, deshacer, rehacer).
  - **`MediaPanel`**: Bandeja de medios con soporte de importación local, categorización por tipo (video, audio, imagen) e inserción en el timeline.
  - **`PreviewViewport`**: Monitor de aspecto de video adaptable (16:9) con controles de transporte (Play/Pause, salto por frames, timeline tracking).
  - **`InspectorPanel`**: Panel contextual con pestañas automáticas para ajustes globales del proyecto o propiedades de clip/asset seleccionado.
  - **`Timeline`**: Pistas de video y audio con regla de tiempo milimétrica, cabezal interactivo (playhead) y soporte de zoom dinámico en píxeles por segundo.

### 2.4 Aplicación de Escritorio con Tauri 2 y Rust (`apps/desktop`)
- Se eligió **Tauri 2** sobre Electron debido a:
  - Huella de memoria mínima (utiliza el motor WebView2 nativo de Windows).
  - Rendimiento y seguridad en Rust para las futuras fases donde se procesarán accesos a disco, bindings multimedia nativos y aceleración de hardware.
  - Menor tamaño del binario final distribuible.

---

## 3. Modelo de Datos de Kyvora Studio

El modelo de datos central se estructura en las siguientes entidades:

```typescript
export interface KyvoraProject {
  id: string;
  schemaVersion: string;
  name: string;
  settings: ProjectSettings; // Ancho, alto, fps, timecode
  assets: MediaAsset[];      // Recursos importados en el proyecto
  tracks: TimelineTrack[];   // Pistas ordenadas (video / audio)
  durationSeconds: number;   // Duración de la mesa de trabajo
  createdAt: string;
  updatedAt: string;
}
```

---

## 4. Estrategia de Fases y Transparencia en la Interfaz

Para asegurar un desarrollo incremental confiable:
- Las acciones que requieren subsistemas de persistencia (Guardar Proyecto en archivo `.kyvora`) o motores de renderizado/codificación (Exportar Video) están identificadas visualmente con etiquetas de estado **"Pendiente"** y deshabilitadas o interceptadas con notificaciones informativas.
- No se simulan barras de progreso falsas ni operaciones artificiales.
- La Fase 0 sienta los cimientos estructurales para que la Fase 1 añada manipulación de clips (recorte, división, mover en timeline, transformaciones de video) y la Fase 2 integre el pipeline de renderizado y exportación.
