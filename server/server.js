/**
 * Express API for Azure Blob Storage + Firebase Auth - SAFE VERSION
 */

import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import cors from 'cors';
import express from 'express';
import {
  BlobSASPermissions,
  BlobServiceClient,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import { getAdmin } from './firebaseAdmin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '../dist');

const PORT = Number(process.env.PORT ?? 8080);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';
const CONTAINER = process.env.AZURE_STORAGE_CONTAINER ?? 'files';

console.log('Current directory:', __dirname);
console.log('DIST_DIR:', DIST_DIR);
console.log('dist folder exists?', fs.existsSync(DIST_DIR));

const app = express();

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// Simple API route for testing
app.get('/api/me', (req, res) => {
  res.json({ message: "API is working", time: new Date().toISOString() });
});

// Serve static files from dist
app.use(express.static(DIST_DIR));

// Final safe catch-all for React SPA (no * wildcard)
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  console.log(`Serving index.html for path: ${req.path}`);
  res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
    if (err) {
      console.error('sendFile error:', err);
      res.status(500).send('React build not found. Size of index.html was ' + (fs.existsSync(path.join(DIST_DIR, 'index.html')) ? fs.statSync(path.join(DIST_DIR, 'index.html')).size : '0') + ' bytes');
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`📁 Serving from: ${DIST_DIR}`);
});