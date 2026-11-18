import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = fs.existsSync(path.join(process.cwd(), 'public'))
  ? path.join(process.cwd(), 'public')
  : path.join(__dirname, 'public');
const INDEX_HTML = path.join(PUBLIC_DIR, 'index.html');

export function createApp() {
  const app = express();

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'sk-pugaan-dms' });
  });

  app.use(express.static(PUBLIC_DIR, { index: 'index.html' }));

  app.use((req, res) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      return res.sendFile(INDEX_HTML);
    }
    return res.status(404).json({ error: 'Not found' });
  });

  return app;
}

const app = createApp();

const isMainModule =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL && isMainModule) {
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = '0.0.0.0';

  app.listen(PORT, HOST, () => {
    console.log(`SK Pugaan DMS server listening on http://${HOST}:${PORT}`);
  });
}

export default app;

