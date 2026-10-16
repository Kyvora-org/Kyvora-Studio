# Plan de Implementación — Kyvora Studio: Fase 0 (Fundación)

## 1. Diagnóstico del Entorno
- **Node.js**: v22.14.0 detectado.
- **pnpm**: v12.11.2 instalado y configurado en el entorno de usuario.
- **Rust / Cargo**: rustc 1.88.0 (x86_64-pc-windows-msvc) disponible.

## 2. Estructura de Archivos a Crear

### Raíz del Monorepo
- `package.json`: Configuración raíz con scripts unificados (`dev`, `dev:web`, `dev:desktop`, `build`, `lint`, `test`).
- `pnpm-workspace.yaml`: Definición de paquetes (`apps/*`, `packages/*`).
- `tsconfig.base.json`: Configuración base de TypeScript en modo estricto.
- `.gitignore`: Ignorados estándar para Node, Vite, Rust/Cargo y Tauri.
- `README.md`: Guía de inicio rápido, arquitectura, requisitos y comandos.
- `docs/ARCHITECTURE.md`: Documento detallado de diseño de arquitectura y decisiones técnicas.

### Paquetes Compartidos (`packages/`)
- `packages/editor-core/`:
  - `package.json`
  - `tsconfig.json`
  - `src/index.ts`
  - `src/types/project.ts`: Definición de tipos de proyecto, pistas, clips, resoluciones y estados.
  - `src/store/editorStore.ts`: Store Zustand para gestión de estado del editor (playback, selección, timecode, historial).
  - `src/utils/timecode.ts`: Utilidades de formateo de frames y tiempo.
  - `tests/editorStore.test.ts`: Pruebas unitarias con Vitest.
  - `vitest.config.ts`

- `packages/ui/`:
  - `package.json`
  - `tsconfig.json`
  - `src/index.ts`
  - `src/components/HeaderBar.tsx`: Barra superior con marca Kyvora, deshacer/rehacer, guardar (deshabilitado/pendiente), exportar (deshabilitado/pendiente).
  - `src/components/MediaPanel.tsx`: Panel multimedia izquierdo con lista de assets importados y estado vacío.
  - `src/components/PreviewViewport.tsx`: Área central de visualización con canvas/marco de aspecto 16:9 y controles de reproducción.
  - `src/components/InspectorPanel.tsx`: Inspector derecho con propiedades de clip/proyecto seleccionados.
  - `src/components/Timeline.tsx`: Línea de tiempo inferior con regla de tiempo, cabezal de reproducción y pistas.
  - `src/components/AppLayout.tsx`: Contenedor principal del layout studio oscuro con acentos azules.
  - `tests/ui.test.tsx`: Pruebas de renderizado de componentes base.
  - `vitest.config.ts`

### Aplicaciones (`apps/`)
- `apps/web/`:
  - `package.json`
  - `tsconfig.json`
  - `vite.config.ts`
  - `index.html`
  - `src/main.tsx`
  - `src/App.tsx`
  - `src/index.css`: Configuración Tailwind CSS y temas Kyvora Studio (fondo oscuro `#0B0F19`, acentos azules `#2563EB` / `#3B82F6`).
  - `tailwind.config.js` y `postcss.config.js`

- `apps/desktop/`:
  - `package.json`
  - `tsconfig.json`
  - `vite.config.ts`
  - `index.html`
  - `src/main.tsx`
  - `src/App.tsx`
  - `src/index.css`
  - `src-tauri/Cargo.toml`: Tauri 2 configuración y dependencias.
  - `src-tauri/tauri.conf.json`: Configuración Tauri 2 (ventana con título 'Kyvora Studio', resolución inicial, permisos).
  - `src-tauri/src/main.rs`: Entry point de la aplicación Tauri.
  - `src-tauri/src/lib.rs`: Registro de comandos e inicialización.
  - `src-tauri/build.rs`: Script de compilación de Tauri.

## 3. Plan de Verificación
1. Instalar dependencias con `pnpm install`.
2. Ejecutar linter y comprobación de tipos: `pnpm run lint` & `pnpm run typecheck`.
3. Ejecutar pruebas unitarias: `pnpm run test` (Vitest).
4. Compilar aplicación web: `pnpm --filter @kyvora/web build`.
5. Validar configuración y compilación de Tauri: `cargo check` dentro de `apps/desktop/src-tauri`.
