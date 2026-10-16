# Plan de Implementación: Formato de Proyecto XTP (`.xtp`) para Kyvora Studio

## 1. Visión y Especificación de XTP
El formato **XTP** (`.xtp`) es un formato de paquete contenedor basado en ZIP para proyectos de Kyvora Studio, diseñado para interoperabilidad entre la web e instalación de escritorio (Windows).

### Estructura del Archivo `.xtp` (ZIP):
```
proyecto.xtp
├── manifest.json              # Obligatorio: versión de formato XTP, versión de esquema, metadatos y tabla de medios
├── project.json               # Obligatorio: serialización del modelo KyvoraProject (esquema validado y migrado)
├── media/                     # Opcional: recursos empaquetados directamente (videos, audios, imágenes)
│   ├── asset_1.mp4
│   └── audio_track.wav
└── thumbnails/                # Opcional: miniaturas y vistas previas
    └── project_poster.png
```

## 2. Arquitectura de Componentes a Crear

1. **Definiciones y Tipos (`packages/editor-core/src/xtp/xtpTypes.ts`)**:
   - `XtpManifest`: `format: 'XTP'`, `formatVersion: '1.0.0'`, `schemaVersion`, `mediaMode: 'embedded' | 'referenced' | 'hybrid'`, tabla de recursos multimedia con hashes, tamaños y rutas internas/externas.
   - Opciones de exportación/importación y límites de seguridad (`maxZipEntries`, `maxTotalSizeBytes`, `maxEntrySizeBytes`).

2. **Validación de Seguridad y Sanitización contra Zip-Slip (`packages/editor-core/src/xtp/xtpSecurity.ts`)**:
   - Prevención de Path Traversal (`../`, `..\\`, rutas absolutas tipo `/etc` o `C:\Windows`).
   - Límites para evitar bombas ZIP (tamaño descomprimido máximo permitido, recuento máximo de entradas).
   - Bloqueo de archivos ejecutables (`.exe`, `.bat`, `.cmd`, `.sh`, `.vbs`, etc.) dentro del paquete.

3. **Empaquetado y Desempaquetado (`packages/editor-core/src/xtp/xtpArchive.ts`)**:
   - `createXtpArchive()`: Genera el contenedor ZIP con `manifest.json`, `project.json`, `media/` y `thumbnails/`. Soporta modo empaquetado (con buffers de datos reales) y referenciado.
   - `extractXtpArchive()`: Abre el `.xtp`, valida entradas contra Zip-Slip, extrae y valida `manifest.json` y `project.json`.
   - `verifyMediaAvailability()`: Comprueba existencia de recursos externos; si faltan, genera informe de recursos ausentes y función de re-vinculación (`relinkMissingMedia()`).

4. **Adaptadores de Almacenamiento XTP para Web y Desktop (`packages/editor-core/src/storage/xtpStorageAdapter.ts`)**:
   - `WebXtpStorageAdapter`: Maneja descargas/cargas de archivos `.xtp` con `Blob` / `ArrayBuffer` y persistencia en IndexedDB.
   - `DesktopXtpStorageAdapter`: Guarda y abre directamente archivos `.xtp` en el sistema de archivos de Windows a través del bridge.

5. **Integración con `useEditorStore` y Componentes UI**:
   - Métodos `exportXtp()`, `importXtp()` y `relinkAsset()` disponibles en el store.
   - Integración con el `HeaderBar` y diálogo de advertencia de medios ausentes.

6. **Documentación Oficial (`docs/XTP_SPECIFICATION.md`)**:
   - Especificación detallada de la estructura, manifiesto, validaciones de seguridad, limitaciones y migraciones.

7. **Batería de Pruebas Unitarias (`packages/editor-core/tests/xtp.test.ts`)**:
   - Creación y apertura de paquetes XTP válidos (empaquetados y referenciados).
   - Detección y rechazo de archivos corruptos o sin `manifest.json` / `project.json`.
   - Bloqueo de ataques de Zip-Slip y entradas maliciosas con rutas relativas fuera del contenedor.
   - Detección de versiones incompatibles de formato o esquema.
   - Manejo e informe de medios faltantes y re-vinculación.
