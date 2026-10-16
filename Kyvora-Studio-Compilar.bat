@echo off
setlocal
title Kyvora Studio - Compilacion y Empaquetado de Produccion (Windows)

:: 1. Posicionarse en la raiz del proyecto sin importar desde donde se ejecuto
cd /d "%~dp0"

echo =====================================================================
echo           KYVORA STUDIO - COMPILACION DE PRODUCCION
echo =====================================================================
echo [INFO] Directorio de trabajo: %CD%
echo.

:: 2. Verificaciones previas
echo [1/4] Verificando Node.js...
where node >nul 2>&1
if errorlevel 1 goto NO_NODE
for /f "tokens=*" %%v in ('node -v') do echo       Detectado: %%v
goto CHECK_PNPM

:NO_NODE
echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
goto ERROR_EXIT

:CHECK_PNPM
echo [2/4] Verificando pnpm...
where pnpm >nul 2>&1
if errorlevel 1 goto NO_PNPM
for /f "tokens=*" %%v in ('pnpm -v') do echo       Detectado: %%v
goto CHECK_RUST

:NO_PNPM
echo [ERROR] pnpm no esta instalado globalmente.
goto ERROR_EXIT

:CHECK_RUST
echo [3/4] Verificando Rust y Cargo...
where cargo >nul 2>&1
if errorlevel 1 goto NO_RUST
for /f "tokens=*" %%v in ('cargo --version') do echo       Detectado: %%v
goto CHECK_DEPS

:NO_RUST
echo [ERROR] Rust / Cargo no esta disponible en el PATH.
goto ERROR_EXIT

:CHECK_DEPS
echo [4/4] Verificando dependencias del proyecto...
if not exist "node_modules\" goto NO_DEPS
if not exist "apps\desktop\node_modules\" goto NO_DEPS
echo       Dependencias locales verificadas.
goto START_BUILD

:NO_DEPS
echo [ERROR] La carpeta node_modules no existe. Ejecute pnpm install primero.
goto ERROR_EXIT

:START_BUILD
:: 3. Limitacion de trabajos simultaneos de Cargo para evitar errores de memoria (OOM) en enlazado MSVC
set CARGO_BUILD_JOBS=1

echo.
echo =====================================================================
echo Iniciando proceso de compilacion de produccion con Tauri...
echo (Este proceso compila el frontend con Vite y el backend con Rust en modo release)
echo =====================================================================
echo.

call pnpm run tauri:build
if errorlevel 1 goto BUILD_FAIL

echo.
echo =====================================================================
echo                 COMPILACION EXITOSA Y VALIDADA
echo =====================================================================
echo.
echo Los siguientes artefactos de produccion han sido generados:
echo.

set "EXE_FILE=apps\desktop\src-tauri\target\release\kyvora-desktop.exe"
set "MSI_DIR=apps\desktop\src-tauri\target\release\bundle\msi"
set "NSIS_DIR=apps\desktop\src-tauri\target\release\bundle\nsis"

if exist "%EXE_FILE%" goto SHOW_EXE
echo [AVISO] No se encontro el archivo ejecutable %EXE_FILE%
goto SHOW_NSIS

:SHOW_EXE
echo -- EJECUTABLE DIRECTO (PORTABLE) --
echo   Ubicacion: %CD%\%EXE_FILE%
echo.

:SHOW_NSIS
if not exist "%NSIS_DIR%" goto SHOW_MSI
echo -- INSTALADOR ESTANDAR WINDOWS (.EXE) --
for %%f in ("%NSIS_DIR%\*.exe") do echo   %%~ff
echo.

:SHOW_MSI
if not exist "%MSI_DIR%" goto SUMMARY_END
echo -- PAQUETE DE INSTALACION WINDOWS (.MSI) --
for %%f in ("%MSI_DIR%\*.msi") do echo   %%~ff
echo.

:SUMMARY_END
echo Puede distribuir o ejecutar directamente cualquiera de estos instaladores.
echo La aplicacion instalada funciona de manera autonoma, sin necesidad de Vite ni consola abierta.
echo =====================================================================
pause
exit /b 0

:BUILD_FAIL
echo.
echo [ERROR] La compilacion de Tauri fallo con errores.
goto ERROR_EXIT

:ERROR_EXIT
echo.
echo =====================================================================
echo  La compilacion no pudo completarse. Revise los errores anteriores.
echo =====================================================================
pause
exit /b 1
