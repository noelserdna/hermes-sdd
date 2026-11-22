// Vite sirve la web y, con un plugin propio, monta la API bajo /api tanto en desarrollo como en `vite preview`
// (ADR-DRAFT-001). El cuerpo del plugin vive en src/server/http/plugin.js.
import { defineConfig } from 'vite';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rutaPlugin = fileURLToPath(new URL('./src/server/http/plugin.js', import.meta.url));

async function montarApi(servidor) {
  if (!existsSync(rutaPlugin)) return;
  const { montarApi: montar } = await import(rutaPlugin);
  montar(servidor.middlewares);
}

const apiPlugin = () => ({
  name: 'material-montana-api',
  configureServer: (servidor) => montarApi(servidor),
  configurePreviewServer: (servidor) => montarApi(servidor),
});

export default defineConfig({
  plugins: [apiPlugin()],
  preview: { strictPort: true },
});
