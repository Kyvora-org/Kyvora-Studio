# Kyvora Studio — Guía de Ejecución y Distribución en Windows

Este documento detalla cómo ejecutar Kyvora Studio en modo desarrollo con un solo clic, cómo generar el ejecutable e instaladores de producción, y los requisitos necesarios para su funcionamiento autónomo en Windows.

---

## 1. Inicio Rápido en Modo Desarrollo

Para trabajar en el código con recarga en vivo (Hot Module Reloading) y Tauri en depuración:

1. Haga **doble clic** sobre el archivo:
   ```text
   Kyvora-Studio-Desarrollo.bat
   ```
2. El script verificará automáticamente:
   - Presencia de **Node.js** (v18 o superior).
   - Disponibilidad del gestor **pnpm**.
   - Compilador **Rust y Cargo**.
   - Dependencias instaladas en `node_modules`.
   - Detección de **FFmpeg** en el PATH.
3. Se iniciará el servidor Vite (`http://localhost:1420/`) y la ventana nativa de escritorio Tauri compilada.
4. Para detener la aplicación, simplemente cierre la ventana o presione `Ctrl + C` en la terminal.

---

## 2. Generar el Ejecutable e Instaladores de Producción

Para compilar la versión definitiva de escritorio lista para ser utilizada o compartida sin necesidad de abrir terminales ni servidores:

1. Haga **doble clic** sobre el archivo:
   ```text
   Kyvora-Studio-Compilar.bat
   ```
2. El script:
   - Ejecutará el empaquetado de producción de Vite (`tsc -b && vite build`) en `apps/desktop/dist`.
   - Limitará automáticamente los hilos de enlazado de Cargo (`CARGO_BUILD_JOBS=1`) para garantizar compilaciones fluidas y sin errores de memoria (OOM).
   - Generará los instaladores para Windows con WiX Toolset (MSI) y NSIS (EXE).
3. Al finalizar, la terminal permanecerá abierta mostrando el resumen exacto con las rutas de los archivos generados.

---

## 3. Ubicación de los Archivos Generados

Una vez ejecutada la compilación, encontrará los artefactos en las siguientes rutas dentro del proyecto:

| Tipo | Archivo / Ubicación | Tamaño aprox. | Descripción |
| :--- | :--- | :--- | :--- |
| **Instalador Setup (.exe)** | `apps\desktop\src-tauri\target\release\bundle\nsis\Kyvora Studio_0.1.0_x64-setup.exe` | ~2.13 MB | **Recomendado para usuarios finales**. Asistente de instalación estándar con accesos directos. |
| **Instalador MSI (.msi)** | `apps\desktop\src-tauri\target\release\bundle\msi\Kyvora Studio_0.1.0_x64_en-US.msi` | ~3.20 MB | Instalador Windows Installer para despliegue empresarial o corporativo. |
| **Ejecutable Directo (.exe)** | `apps\desktop\src-tauri\target\release\kyvora-desktop.exe` | ~9.84 MB | Binario portable compilado en Release. Puede ejecutarse directamente. |

---

## 4. Cómo Instalar y Abrir Kyvora Studio

1. Abra la carpeta `apps\desktop\src-tauri\target\release\bundle\nsis\`.
2. Ejecute `Kyvora Studio_0.1.0_x64-setup.exe`.
3. Siga los pasos del asistente de instalación de Windows. Se creará automáticamente un acceso directo en el Menú Inicio y en el Escritorio.
4. Inicie **Kyvora Studio** desde el acceso directo.
   - **Autonomía total:** La aplicación empaquetada sirve los recursos estáticos embebidos de `dist/`, funcionando de forma 100% independiente sin Antigravity, sin Node.js, sin Vite y sin ninguna consola de fondo.

---

## 5. Requisitos y Dependencias del Entorno

### Requisitos para Desarrollar o Compilar:
- **Node.js** (v18.0 o superior, probado en v22.14).
- **pnpm** (instalable con `npm install -g pnpm`).
- **Rust Toolchain**: `x86_64-pc-windows-msvc` (instalable con `rustup-init.exe` desde [rustup.rs](https://rustup.rs)).
- **Visual Studio C++ Build Tools** (componentes MSVC de Windows).
- **WiX y NSIS**: Tauri los descarga automáticamente en caché al compilar los paquetes de instalación.

### Requisitos en el Equipo del Usuario Final:
- **Windows 10 / Windows 11 (64 bits)** con Microsoft Edge WebView2 Runtime (instalado por defecto en Windows 10/11).
- **FFmpeg y FFprobe** (para Exportación Nativa y Extracción Avanzada de Metadatos):
  - Kyvora Studio detecta `ffmpeg.exe` y `ffprobe.exe` en el sistema.
  - Para que las funciones de exportación acelerada y probe nativo operen en equipos de terceros, el usuario final debe tener FFmpeg agregado al PATH del sistema, o bien colocar `ffmpeg.exe` en la misma carpeta donde se instala el ejecutable (`C:\Program Files\Kyvora Studio` o `%LOCALAPPDATA%\Programs\Kyvora Studio`).
  - Si FFmpeg no está presente, la aplicación muestra avisos claros en el modal de exportación indicando su instalación.

---

## 6. Diagnóstico y Solución de Fallos Frecuentes

1. **Error `memory allocation of ... bytes failed` al compilar con Cargo:**
   - Ocurre cuando el enlazador MSVC intenta compilar múltiples crates pesados en paralelo en equipos con RAM ajustada.
   - **Solución implementada:** `Kyvora-Studio-Compilar.bat` define automáticamente `set CARGO_BUILD_JOBS=1`, garantizando un enlazado exitoso y estable.
2. **Error `pnpm: command not found`:**
   - Asegúrese de que `C:\Users\<Usuario>\AppData\Local\npm` o la ruta de pnpm esté en la variable de entorno `PATH`.
3. **El instalador advierte sobre un editor no reconocido (SmartScreen):**
   - Es el comportamiento estándar en Windows para ejecutables nuevos que no cuentan con un certificado de firma de código digital EV (común en fases de desarrollo open source). Haga clic en *Más información* y luego en *Ejecutar de todas formas*.
