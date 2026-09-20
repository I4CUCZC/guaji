import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import { cpSync, existsSync, mkdirSync, createReadStream, statSync } from 'node:fs';
import { extname } from 'node:path';

const ROOT = __dirname;
const CONTENT = resolve(ROOT, 'content');

function contentAssetsPlugin(): Plugin {
  const mime: Record<string, string> = {
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.json': 'application/json',
    '.gif': 'image/gif',
  };

  return {
    name: 'content-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (!url.startsWith('/content/')) return next();
        const filePath = resolve(ROOT, '.' + url);
        if (!filePath.startsWith(CONTENT) || !existsSync(filePath)) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        try {
          const st = statSync(filePath);
          if (!st.isFile()) return next();
          res.setHeader('Content-Type', mime[extname(filePath)] ?? 'application/octet-stream');
          createReadStream(filePath).pipe(res);
        } catch {
          next();
        }
      });
    },
    closeBundle() {
      const dest = resolve(ROOT, 'dist', 'content');
      mkdirSync(resolve(ROOT, 'dist'), { recursive: true });
      cpSync(CONTENT, dest, { recursive: true });
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: './',
  plugins: [contentAssetsPlugin()],
  resolve: {
    alias: {
      '@core': resolve(ROOT, 'src/core'),
      '@renderer': resolve(ROOT, 'src/renderer'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(ROOT, 'index.html'),
    },
  },
});
