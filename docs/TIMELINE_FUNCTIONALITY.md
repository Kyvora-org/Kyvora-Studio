# Línea de Tiempo Funcional — Kyvora Studio

## 1. Visión y Capacidades Implementadas

La línea de tiempo de **Kyvora Studio** opera directamente sobre el modelo inmutable de datos compartido (`@kyvora/editor-core`), eliminando duplicidad de estado entre componentes y permitiendo historial completo (Deshacer / Rehacer) para cada acción de edición.

---

## 2. Funcionalidades Principales

### 2.1 Pistas de Video y Audio
- Soporte para pistas múltiples de tipo `video` y `audio`.
- Ordenación estricta y visualización diferenciada de carriles.
- Inserción de nuevas pistas dinámicamente con `+ Pista`.

### 2.2 Clips y Selección Sincronizada
- Selección de clips mediante clic directo con feedback visual (anillo de resalte azul, elevación `z-index` y sombra).
- **Sincronización con el Inspector**: Al seleccionar un clip, el panel lateral derecho muestra sus propiedades temporales (inicio, duración, nombre, pista madre).
- **Sincronización con el Monitor de Vista Previa**: El monitor central consulta en tiempo real el clip y recurso multimedia activo bajo la posición del cabezal de reproducción (`currentTimeSeconds`) y renderiza la vista correspondiente.

### 2.3 División de Clips en la Posición del Cabezal (Split at Playhead)
- **Operación Inmutable**: `immutableSplitClip(project, clipId, splitSeconds)`.
- **Reglas de Partición**: Si el cabezal se encuentra dentro del rango temporal del clip (con umbral de protección mínimo de 0.05s para evitar fragmentos vacíos), el clip original se divide en dos clips contiguos:
  - **Clip Izquierdo**: Mantiene el `id` original, con duración igual a `splitSeconds - startInTimelineSeconds`.
  - **Clip Derecho**: Genera un nuevo identificador estable con inicio en `splitSeconds`, duración complementaria y desfase de fuente recalculado: `sourceStartSeconds = originalSourceStart + firstDuration`.
- **Atajos**: Botón `Dividir` en la barra de herramientas o pulsación de la tecla `S`.

### 2.4 Recorte de Extremos (Trim Handles)
- **Operación Inmutable**: `immutableTrimClip(project, clipId, edge, newPosition, minDuration)`.
- **Recorte Inicial (`start`)**: Al arrastrar la manija izquierda, ajusta `startInTimelineSeconds`, recalcula la duración y compensa proporcionalmente el `sourceStartSeconds`.
- **Recorte Final (`end`)**: Al arrastrar la manija derecha, ajusta la duración del clip sin alterar el punto de inserción original.
- **Protección de Duración Mínima**: Impide que el usuario reduzca un clip por debajo de 0.1s para evitar duraciones negativas o clips corruptos.

### 2.5 Movimiento por Arrastre entre Pistas (Drag & Drop)
- Arrastre interactivo que convierte el desplazamiento del puntero en segundos: `deltaSeconds = deltaX / zoomLevel`.
- **Cambio de Pista**: Detecta la intersección vertical con otros carriles y reasigna el `trackId` del clip conservando todos sus atributos.

### 2.6 Ajuste Magnético Opcional (Snapping)
- Función de cálculo `findSnapTime(candidateSeconds, snapPoints, threshold)`.
- Los puntos magnéticos incluyen:
  - Posición `0.0s`.
  - Posición actual del cabezal de reproducción.
  - Puntos de inicio y finalización de todos los demás clips en la mesa de trabajo.
- Alternable en cualquier momento mediante el botón `Imán ON / OFF`.

### 2.7 Eliminación y Accesibilidad por Teclado
- Eliminación de clip mediante el botón `Eliminar` o pulsando `Delete` / `Backspace`.
- Atributos semánticos ARIA (`role="button"`, `tabIndex={0}`, `aria-label`).

---

## 3. Pruebas Unitarias Automatizadas

Se crearon las pruebas de límites en [`packages/editor-core/tests/timeline.test.ts`](file:///c:/Users/elcra/OneDrive/Documentos/Kyvora-Studio/packages/editor-core/tests/timeline.test.ts):
- Partición y recálculo de sourceStartSeconds.
- Rechazo de división fuera de límites.
- Recorte izquierdo y derecho preservando límites mínimos.
- Movimiento y reubicación entre pistas de video/audio.
- Precisión de ajuste magnético dentro y fuera del umbral.
- Deshacer y rehacer de operaciones de línea de tiempo en el store Zustand.
