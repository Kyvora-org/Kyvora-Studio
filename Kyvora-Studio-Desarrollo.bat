@echo off
setlocal
title Kyvora Studio - Modo Desarrollo (Tauri + React)

cd /d "%~dp0"

echo =====================================================================
echo                KYVORA STUDIO - ENTORNO DE DESARROLLO
echo =====================================================================
echo [INFO] Directorio de trabajo: %CD%
echo.

echo [1/5] Verificando Node.js...
where node >nul 2>&1
if errorlevel 1 goto NO_NODE
for /f "tokens=*" %%v in ('node -v') do echo       Detectado: %%v
goto CHECK_PNPM

:NO_NODE
echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
echo         Descarguelo desde: https://nodejs.org/
goto ERROR_EXIT

:CHECK_PNPM
echo [2/5] Verificando gestor de paquetes pnpm...
where pnpm >nul 2>&1
if errorlevel 1 goto NO_PNPM
for /f "tokens=*" %%v in ('pnpm -v') do echo       Detectado: %%v
goto CHECK_RUST

:NO_PNPM
echo [ERROR] pnpm no esta instalado globalmente.
echo         Instalelo ejecutando: npm install -g pnpm
goto ERROR_EXIT

:CHECK_RUST
echo [3/5] Verificando Rust y Cargo...
where cargo >nul 2>&1
if errorlevel 1 goto NO_RUST
for /f "tokens=*" %%v in ('cargo --version') do echo       Detectado: %%v
goto CHECK_DEPS

:NO_RUST
echo [ERROR] Rust / Cargo no esta disponible en el PATH.
echo         Kyvora Studio Desktop requiere Rust para compilar el backend Tauri.
echo         Instalelo desde: https://rustup.rs/
goto ERROR_EXIT

:CHECK_DEPS
echo [4/5] Verificando dependencias del proyecto (node_modules)...
if not exist "node_modules\" goto NO_DEPS
if not exist "apps\desktop\node_modules\" goto NO_DEPS
echo       Dependencias locales verificadas correctamente.
goto CHECK_FFMPEG

:NO_DEPS
echo [ERROR] No se encontraron las carpetas de dependencias node_modules.
echo         Ejecute primero en la terminal: pnpm install
goto ERROR_EXIT

:CHECK_FFMPEG
echo [5/5] Verificando disponibilidad de FFmpeg (para importacion y exportacion)...
where ffmpeg >nul 2>&1
if errorlevel 1 goto FFMPEG_WARN
for /f "delims=" %%f in ('where ffmpeg') do (
    echo       Detectado FFmpeg: %%f
    goto LAUNCH_APP
)

:FFMPEG_WARN
echo [AVISO] FFmpeg no se detecto en el PATH del sistema.
echo         La reproduccion y vista previa funcionaran, pero la exportacion nativa
echo         requiere que 'ffmpeg.exe' este en el PATH o en la carpeta del binario.
echo.

:LAUNCH_APP
echo.
echo =====================================================================
echo Iniciando Vite DevServer y compilando ventana de escritorio Tauri...
echo Presione Ctrl+C en esta terminal cuando desee detener la aplicacion.
echo =====================================================================
echo.

call pnpm run tauri:dev
if errorlevel 1 goto DEV_FAIL
goto SUCCESS_EXIT

:DEV_FAIL
echo.
echo [ERROR] La ejecucion de Kyvora Studio en desarrollo finalizo con errores.
goto ERROR_EXIT

:ERROR_EXIT
echo.
echo =====================================================================
echo  Ha ocurrido un error al intentar iniciar Kyvora Studio.
echo  Revise los mensajes de diagnostico anteriores.
echo =====================================================================
pause
exit /b 1

:SUCCESS_EXIT
echo.
echo [INFO] Kyvora Studio se cerro correctamente.
pause
exit /b 0
