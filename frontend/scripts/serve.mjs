// Wrapper simple para servir el build estático de Vite en producción.
// Usa `serve` (dep del frontend). Lee PORT de la env directamente desde Node
// porque la interpolación `${PORT:-8080}` en scripts de pnpm no siempre se
// expande (depende del shell que corre el script).

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '..', 'dist');
const port = String(process.env.PORT ?? '8080');

console.log(`[frontend] serve -s ${distDir} -l ${port}`);

const child = spawn('serve', ['-s', distDir, '-l', port], {
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
