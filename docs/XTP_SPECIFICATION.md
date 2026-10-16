# Especificación del Formato de Proyecto XTP (`.xtp`) — Kyvora Studio

## 1. Naturaleza y Propósito del Formato
**XTP** (Kyvora Studio Package) con extensión de archivo `.xtp` es el formato de almacenamiento e intercambio de proyectos para **Kyvora Studio**. Está diseñado bajo una arquitectura de contenedor ZIP estándar no propietario que encapsula la estructura del proyecto, metadatos versionados y opcionalmente los activos multimedia y miniaturas asociados.

> [!NOTE]
> Este formato no utiliza esquemas criptográficos propietarios ni dependencias de software con licencias restrictivas. Su especificación se basa en estándares abiertos (ZIP PKWare, JSON UTF-8 y flujos binarios MIME estándar).

---

## 2. Estructura del Contenedor `.xtp`

Un archivo `.xtp` válido es un contenedor ZIP estructurado de la siguiente forma:

```
proyecto.xtp (archivo ZIP)
├── manifest.json              [Obligatorio] Metadatos, versiones de formato/esquema y tabla de medios
├── project.json               [Obligatorio] Modelo de datos del proyecto serializado y validado
├── media/                     [Opcional] Activos multimedia empaquetados directamente
│   ├── <assetId>_clip1.mp4
│   └── <assetId>_audio.wav
└── thumbnails/                [Opcional] Miniaturas y previsualizaciones
    └── poster.png
```

---

## 3. Especificación del Manifiesto (`manifest.json`)

El archivo `manifest.json` en la raíz del contenedor gobierna la interpretación del paquete:

```json
{
  "format": "XTP",
  "formatVersion": "1.0.0",
  "schemaVersion": "1.0.0",
  "projectId": "proj_1728954000_abcde",
  "projectName": "Mi Proyecto Cinematográfico",
  "mediaMode": "embedded",
  "createdAt": "2026-10-14T19:50:00.000Z",
  "updatedAt": "2026-10-14T19:54:00.000Z",
  "mediaEntries": [
    {
      "assetId": "asset_01",
      "name": "toma_01.mp4",
      "type": "video",
      "isEmbedded": true,
      "archivePath": "media/asset_01_toma_01.mp4",
      "sizeBytes": 15420100
    },
    {
      "assetId": "asset_02",
      "name": "banda_sonora.wav",
      "type": "audio",
      "isEmbedded": false,
      "externalPath": "C:/Audio/banda_sonora.wav",
      "sizeBytes": 8420000
    }
  ],
  "thumbnails": [
    "thumbnails/poster.png"
  ]
}
```

### Modos de Medios Soportados (`mediaMode`):
1. **`embedded`**: Todos los activos multimedia utilizados residen dentro de la carpeta `media/` del paquete `.xtp`. Es ideal para transferir proyectos completos entre equipos o compartir con colaboradores.
2. **`referenced`**: El archivo `.xtp` contiene únicamente metadatos (`manifest.json`, `project.json` y miniaturas), referenciando las rutas absolutas/relativas del sistema de archivos local (`externalPath`). Reduce al mínimo el tamaño del paquete.
3. **`hybrid`**: Modo mixto donde algunos archivos clave residen en `media/` y otros de gran tamaño se mantienen referenciados externamente.

---

## 4. Mitigaciones de Seguridad y Robustez

Kyvora Studio aplica las siguientes validaciones preventivas antes de procesar cualquier paquete `.xtp`:

1. **Prevención de Ataques de Zip-Slip (Path Traversal)**:
   - Se rechaza cualquier entrada que contenga segmentos de salto de directorio relativo (`../`, `..\\`) o rutas absolutas (`/`, `C:\`, `\\server`).
   - Todos los archivos deben extraerse estrictamente dentro del ámbito del proyecto o mapearse en memoria.

2. **Bloqueo de Archivos Ejecutables**:
   - Queda explícitamente prohibida la inclusión de archivos ejecutables o scripts dentro del paquete (`.exe`, `.bat`, `.cmd`, `.ps1`, `.vbs`, `.sh`, `.dll`, etc.). El cargador lanza una excepción y aborta la apertura.

3. **Límites de Tamaño y Prevención de Zip-Bombs**:
   - `maxZipEntries`: 1.000 entradas máximas por archivo.
   - `maxTotalSizeBytes`: 2 GB por paquete en modo por defecto.
   - `maxEntrySizeBytes`: 1 GB por archivo individual descomprimido.

4. **Aislamiento en Tiempo de Ejecución**:
   - El extractor no ejecuta ningún comando, código binario ni script del archivo importado; únicamente analiza los datos JSON y los buffers binarios de audio/video.

---

## 5. Gestión de Medios Faltantes y Re-vinculación

Si un proyecto en modo `referenced` se abre en una computadora donde las rutas originales no existen:
- El motor de importación genera un informe `MissingMediaReport[]` con los identificadores, nombres y última ruta conocida.
- El editor informa al usuario de los recursos no localizados en lugar de fallar o simular que el video está presente.
- La función `relinkMissingMedia(project, assetId, newPath)` permite al usuario reubicar el archivo en su disco y actualizar el modelo con persistencia en el historial (Undo/Redo).

---

## 6. Soporte de Migraciones Futuras

El manifiesto desacopla intencionalmente la versión del contenedor (`formatVersion`) de la versión del esquema del editor (`schemaVersion`). Esto permite:
- Actualizar el formato del contenedor (por ejemplo, soporte de metadatos adicionales o streaming parcial) sin alterar el esquema de pistas/clips.
- Abrir proyectos de versiones antiguas de Kyvora Studio mediante el registro de migraciones automáticas (`PROJECT_MIGRATIONS`), asegurando retrocompatibilidad total.
