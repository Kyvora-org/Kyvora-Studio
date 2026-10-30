import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const desktopExePath = path.resolve(rootDir, 'apps/desktop/src-tauri/target/debug/kyvora-desktop.exe');

if (!fs.existsSync(desktopExePath)) {
  console.error('[Kyvora] Error: target/debug/kyvora-desktop.exe no encontrado en:', desktopExePath);
  process.exit(1);
}

console.log('[Kyvora Studio] 🚀 Iniciando servidor de desarrollo frontend (Vite)...');

const isWindows = process.platform === 'win32';
const pnpmCmd = isWindows ? 'pnpm.cmd' : 'pnpm';

const viteProcess = spawn(pnpmCmd, ['--filter', '@kyvora/desktop', 'dev'], {
  cwd: rootDir,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
});

viteProcess.stdout.on('data', (d) => {
  const msg = d.toString();
  if (msg.includes('Local:')) {
    console.log('[Kyvora Studio] ⚡ Servidor Vite activo en http://localhost:1420');
  }
});

viteProcess.stderr.on('data', (d) => {
  const errStr = d.toString();
  if (errStr.trim()) {
    console.error('[Vite]', errStr.trim());
  }
});

async function waitForPort(port, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://localhost:${port}`);
      if (res.ok || res.status < 500) {
        return true;
      }
    } catch {
      // Waiting for server
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Tiempo de espera agotado conectando al puerto ${port}`);
}

async function run() {
  try {
    await waitForPort(1420);
    console.log('[Kyvora Studio] 🎬 Abriendo ventana nativa de escritorio (Tauri + WebView2)...');

    const appProcess = spawn(desktopExePath, [], {
      cwd: path.resolve(rootDir, 'apps/desktop/src-tauri'),
      stdio: 'inherit',
    });

    appProcess.on('exit', (code) => {
      console.log(`[Kyvora Studio] Ventana cerrada (código ${code ?? 0}). Deteniendo Vite.`);
      try {
        viteProcess.kill('SIGTERM');
      } catch {}
      process.exit(code || 0);
    });

    process.on('SIGINT', () => {
      console.log('\n[Kyvora Studio] Deteniendo aplicación y servidor...');
      try {
        appProcess.kill();
      } catch {}
      try {
        viteProcess.kill();
      } catch {}
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      try {
        appProcess.kill();
      } catch {}
      try {
        viteProcess.kill();
      } catch {}
      process.exit(0);
    });
  } catch (err) {
    console.error('[Kyvora Studio] ❌ Fallo al iniciar:', err.message);
    try {
      viteProcess.kill();
    } catch {}
    process.exit(1);
  }
}

run();

