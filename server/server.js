import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '../dist');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({ origin: true }));

console.log('Current dir:', __dirname);
console.log('DIST_DIR:', DIST_DIR);
console.log('dist exists?', fs.existsSync(DIST_DIR));

if (fs.existsSync(DIST_DIR)) {
  const indexPath = path.join(DIST_DIR, 'index.html');
  console.log('index.html exists?', fs.existsSync(indexPath));
  if (fs.existsSync(indexPath)) {
    console.log('index.html size:', fs.statSync(indexPath).size, 'bytes');
  }
}

// Serve static files
app.use(express.static(DIST_DIR));

// Catch-all
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API not found' });
  }
  const indexPath = path.join(DIST_DIR, 'index.html');
  console.log(`Attempting to serve index.html for path: ${req.path}`);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('sendFile error:', err);
      res.status(500).send(`Cannot serve index.html. Build may be broken.`);
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});