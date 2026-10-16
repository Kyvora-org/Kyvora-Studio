# Kyvora Studio — Fase 1 (Parte 1): Núcleo de Edición, Historial y Persistencia

## 1. Alcance Implementado

1. **Modelo de Datos y Tipos Extendidos (`packages/editor-core/src/types/project.ts`)**:
   - Modelo fuertemente tipado para `KyvoraProject`, `TimelineTrack`, `TimelineClip`, `MediaAsset`.
   - Propiedades de transformación gráfica para clips (`scaleX`, `scaleY`, `positionX`, `positionY`, `rotationDegrees`, `opacity`).
   - Propiedades de audio para clips (`volume`, `isMuted`, `pan`).
   - Efectos de clip modulares (`colorAdjustment`, `blur`, `speed`).
   - Versión oficial del esquema: `CURRENT_SCHEMA_VERSION = '1.0.0'`.

2. **Validación, Migraciones y Serialización Versionada (`packages/editor-core/src/model/schema.ts`)**:
   - `createNewProject()`: Constructor de proyectos consistentes con identificadores estables y pistas iniciales.
   - `validateProjectSchema()`: Validador exhaustivo que comprueba id, dimensiones, fps > 0, estructura de pistas, clips y recursos.
   - `serializeProject()`: Serializador a JSON estructurado y validado.
   - `deserializeProject()`: Deserializador con pipeline de migraciones automáticas (`0.1.0` -> `1.0.0`).
   - `PROJECT_MIGRATIONS`: Registro extensible de migraciones hacia adelante.

3. **Operaciones Inmutables con Integridad Referencial (`packages/editor-core/src/model/operations.ts`)**:
   - `immutableAddAsset`, `immutableRemoveAsset` (limpia automáticamente clips huérfanos asociados).
   - `immutableAddTrack`, `immutableRemoveTrack`.
   - `immutableAddClip`, `immutableMoveClip` (permite mover entre pistas y alterar startSeconds de forma segura), `immutableRemoveClip`.
   - `immutableAddEffectToClip`, `immutableRemoveEffectFromClip`.
   - `immutableUpdateProjectName`, `immutableUpdateProjectDuration`.

4. **Historial Deshacer / Rehacer con Límite de Memoria (`packages/editor-core/src/history/historyManager.ts`)**:
   - Pila bidireccional consistente (`past`, `present`, `future`).
   - `maxDepth` configurable (por defecto 50 estados) con descarte FIFO de memoria para evitar saturación de RAM en proyectos grandes.
   - Invalida la rama futura tras operaciones nuevas.

5. **Persistencia Desacoplada sin Medios Simulados (`packages/editor-core/src/storage/projectStorage.ts`)**:
   - Interfaz compartida `IProjectStorageAdapter`.
   - `WebIndexedDBStorageAdapter`: Persistencia real mediante base de datos `IndexedDB` en navegador (`KyvoraStudioDB`).
   - `DesktopLocalFileStorageAdapter`: Persistencia real sobre archivos locales `.kyvora` mediante bridge de sistema de archivos nativo.

6. **Integración en Zustand Store y UI**:
   - `useEditorStore` actualizado con `undo()`, `redo()`, `saveProject()`, `loadProject()` e inserción en historial en cada mutación.
   - Botones de la barra superior ([`HeaderBar.tsx`](file:///c:/Users/elcra/OneDrive/Documentos/Kyvora-Studio/packages/ui/src/components/HeaderBar.tsx)) conectados directamente a `undo`, `redo` y `saveProject` con estados reactivos (`canUndo`, `canRedo`).
