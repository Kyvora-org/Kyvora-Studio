# Kyvora Studio

Kyvora Studio es una suite de edición y postproducción de video moderna y de alto rendimiento, desarrollada por Kyvora. Está construida bajo una arquitectura de monorepo con aplicaciones web y de escritorio nativas para Windows.

## 🚀 Requisitos del Sistema

Para el desarrollo completo del proyecto se requiere:
- **Node.js**: v20.x o v22.x LTS (v22.14.0 probado).
- **pnpm**: v9.x o superior (v12.x probado).
- **Rust & Cargo**: v1.75+ con herramienta MSVC de C++ (rustc 1.88.0 probado).
- **Windows**: Windows 10/11 con WebView2 Runtime instalado (predeterminado en sistemas modernos).

---

## 📁 Arquitectura del Monorepo

```
Kyvora-Studio/
├── apps/
│   ├── web/               # Interfaz Web (React 19 + TypeScript + Vite + Tailwind CSS)
│   └── desktop/           # Aplicación de escritorio nativa Windows (Tauri 2 + Rust)
│       └── src-tauri/     # Código Rust y configuración de Tauri 2
├── packages/
│   ├── ui/                # Componentes compartidos de interfaz Kyvora Studio
│   └── editor-core/       # Estado global (Zustand), utilidades de timecode y modelos de datos
├── docs/
│   ├── ARCHITECTURE.md    # Documento de arquitectura detallado y decisiones técnicas
│   └── PLAN_FASE_0.md     # Registro del plan de ejecución de la Fase 0
├── package.json           # Scripts globales del workspace
├── pnpm-workspace.yaml    # Configuración de paquetes de pnpm
└── tsconfig.base.json     # Configuración base estricta de TypeScript
```

---

## 🛠️ Comandos de Desarrollo

### 1. Instalación de dependencias
```bash
pnpm install
```

### 2. Ejecutar la Aplicación Web
Inicia el servidor de desarrollo de Vite para la versión web:
```bash
pnpm run dev:web
```
Disponible en `http://localhost:5173`.

### 3. Ejecutar la Aplicación de Escritorio (Tauri)
Inicia la ventana nativa de Tauri en modo desarrollo:
```bash
pnpm run dev:desktop
```
O con el CLI nativo de Tauri:
```bash
pnpm --filter @kyvora/desktop tauri dev
```

### 4. Ejecutar Pruebas Unitarias (Vitest)
```bash
pnpm run test
```

### 5. Verificación de Tipos Estricta (TypeScript)
```bash
pnpm run typecheck
```

### 6. Compilación de Producción
```bash
pnpm run build
```

---

## 🎯 Estado de la Fase 0: Fundación

En esta fase se establecen las bases sólidas y mantenibles:
- Monorepo configurado y vinculado mediante pnpm workspaces.
- Componentes UI compartidos y modulares (`packages/ui`).
- Modelo de datos agnóstico y gestión de estado con Zustand (`packages/editor-core`).
- Tema oscuro Kyvora Studio con acentos azules (`#2563EB`).
- **Los controles que no están implementados en esta fase (guardado en disco, exportador, renderizado por hardware) se encuentran deshabilitados o rotulados con alerta explícita de "Pendiente" sin simular operaciones falsas.**
- No se han agregado módulos de nube, IA, ni FFmpeg en cumplimiento con las especificaciones de la fase inicial.
