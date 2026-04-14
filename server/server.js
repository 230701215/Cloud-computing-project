import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '../dist');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({ origin: true }));

// Serve static files from dist
app.use(express.static(DIST_DIR));

console.log('DIST_DIR:', DIST_DIR);
console.log('dist exists?', require('fs').existsSync(DIST_DIR));

// Catch-all for React
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  console.log('Serving index.html for:', req.path);
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Serving from ${DIST_DIR}`);
});