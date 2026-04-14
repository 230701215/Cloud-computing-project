/**
 * Express API for Azure Blob Storage + Firebase Auth - BLOB NAME DECODE FIXED
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

const UPLOAD_SAS_MINUTES = 15;
const SHARE_READ_HOURS = 24;

// Storage Setup
let storageCache = null;

function getStorage() {
  if (storageCache) return storageCache;
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');

  const blobService = BlobServiceClient.fromConnectionString(conn);
  const parts = conn.split(';').reduce((acc, part) => {
    const [k, ...rest] = part.split('=');
    if (k && rest.length) acc[k.toLowerCase()] = rest.join('=');
    return acc;
  }, {});

  const account = parts.accountname;
  const key = parts.accountkey;
  if (!account || !key) throw new Error('Could not parse storage account');

  const credential = new StorageSharedKeyCredential(account, key);
  storageCache = { blobService, credential };
  return storageCache;
}

function userPrefix(email) {
  return `${email}/`;
}

async function ensureContainer() {
  const { blobService } = getStorage();
  const container = blobService.getContainerClient(CONTAINER);
  await container.createIfNotExists();
}

async function listUserBlobs(email) {
  const { blobService } = getStorage();
  const container = blobService.getContainerClient(CONTAINER);
  const prefix = userPrefix(email);
  const files = [];
  for await (const item of container.listBlobsFlat({ prefix })) {
    if (!item.name || item.name.endsWith('/')) continue;
    files.push({
      name: item.name,
      size: item.properties.contentLength ?? 0,
      lastModified: item.properties.lastModified?.toISOString() ?? new Date().toISOString(),
    });
  }
  return files;
}

async function deleteBlob(blobName) {
  const { blobService } = getStorage();
  const container = blobService.getContainerClient(CONTAINER);
  await container.deleteBlob(blobName);
}

function sasReadUrl(blobName, expiresOn) {
  const { blobService, credential } = getStorage();
  const container = blobService.getContainerClient(CONTAINER);
  const blob = container.getBlockBlobClient(blobName);   // Use exact name
  const startsOn = new Date(Date.now() - 5 * 60 * 1000);

  const sas = generateBlobSASQueryParameters({
    containerName: CONTAINER,
    blobName,
    permissions: BlobSASPermissions.parse('r'),
    startsOn,
    expiresOn,
    protocol: SASProtocol.Https,
  }, credential).toString();

  return `${blob.url}?${sas}`;
}

function sasWriteUrl(blobName, expiresMsFromNow) {
  const { blobService, credential } = getStorage();
  const container = blobService.getContainerClient(CONTAINER);
  const blob = container.getBlockBlobClient(blobName);
  const startsOn = new Date(Date.now() - 5 * 60 * 1000);
  const expiresOn = new Date(Date.now() + expiresMsFromNow);

  const sas = generateBlobSASQueryParameters({
    containerName: CONTAINER,
    blobName,
    permissions: BlobSASPermissions.parse('cw'),
    startsOn,
    expiresOn,
    protocol: SASProtocol.Https,
  }, credential).toString();

  return { uploadUrl: `${blob.url}?${sas}`, expiresOn };
}

// Firebase Token Verification Middleware
async function verifyFirebaseToken(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    const token = match?.[1];

    if (!token) return res.status(401).json({ error: 'Missing Authorization Bearer token' });

    const admin = getAdmin();
    const decoded = await admin.auth().verifyIdToken(token);
    if (!decoded.email) return res.status(401).json({ error: 'Token missing email' });

    req.user = decoded;
    next();
  } catch (e) {
    console.error('Token verification failed:', e);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const app = express();

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// ====================== API ROUTES ======================

app.get('/api/me', verifyFirebaseToken, (req, res) => res.json({ user: req.user }));

app.post('/api/sas-upload', verifyFirebaseToken, async (req, res) => {
  const user = req.user;
  const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName : '';
  if (!fileName) return res.status(400).json({ error: 'Invalid fileName' });

  try {
    await ensureContainer();
    const blobName = `${userPrefix(user.email)}${fileName}`;
    const { uploadUrl, expiresOn } = sasWriteUrl(blobName, UPLOAD_SAS_MINUTES * 60 * 1000);
    res.json({ uploadUrl, blobName, sasExpiresAt: expiresOn.toISOString() });
  } catch (e) {
    console.error(e);
    res.status(503).json({ error: 'Could not create upload URL' });
  }
});

app.get('/api/files', verifyFirebaseToken, async (req, res) => {
  try {
    await ensureContainer();
    const files = await listUserBlobs(req.user.email);
    res.json({ files });
  } catch (e) {
    console.error(e);
    res.status(503).json({ error: 'Could not list files', files: [] });
  }
});

app.delete('/api/files', verifyFirebaseToken, async (req, res) => {
  const user = req.user;
  const blobName = typeof req.query.name === 'string' ? req.query.name : '';
  if (!blobName) return res.status(400).json({ error: 'Missing name' });

  try {
    await ensureContainer();
    await deleteBlob(blobName);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Delete failed' });
  }
});

app.get('/api/files/download', verifyFirebaseToken, async (req, res) => {
  const user = req.user;
  const blobName = typeof req.query.name === 'string' ? req.query.name : '';
  if (!blobName) return res.status(400).json({ error: 'Missing name' });

  try {
    await ensureContainer();
    const expiresOn = new Date(Date.now() + 60 * 60 * 1000);
    const url = sasReadUrl(blobName, expiresOn);
    res.json({ url, expiresAt: expiresOn.toISOString() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Download failed' });
  }
});

// SHARE ROUTE - Decode the blobName properly
app.post('/api/share/:blobName', verifyFirebaseToken, async (req, res) => {
  let blobName = req.params.blobName;
  console.log('Share POST called with raw blobName:', blobName);

  // Decode URL-encoded blob name (this is the key fix)
  try {
    blobName = decodeURIComponent(blobName);
  } catch (e) {
    console.log('Decode failed, using as-is');
  }

  console.log('Decoded blobName for SAS:', blobName);

  if (!blobName) return res.status(400).json({ error: 'Missing blobName' });

  try {
    await ensureContainer();
    const expiresOn = new Date(Date.now() + SHARE_READ_HOURS * 60 * 60 * 1000);
    const shareUrl = sasReadUrl(blobName, expiresOn);
    res.json({ shareUrl, expiresAt: expiresOn.toISOString() });
  } catch (e) {
    console.error('Share error:', e);
    res.status(500).json({ error: 'Could not create share link' });
  }
});

// ====================== STATIC + SPA ======================

console.log('Current directory:', __dirname);
console.log('DIST_DIR:', DIST_DIR);
console.log('dist exists?', fs.existsSync(DIST_DIR));

app.use(express.static(DIST_DIR));

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    console.log('Catch-all hit for:', req.method, req.path);
    return res.status(404).json({ error: 'API route not found', path: req.path });
  }
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on port ${PORT}`);
});