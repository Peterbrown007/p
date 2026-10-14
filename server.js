import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import { S3Client, ListObjectsV2Command, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const { S3_BUCKET, S3_REGION = 'auto', S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, APP_PASSWORD, PORT = 3000 } = process.env;
if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !APP_PASSWORD) {
  console.error('Missing env vars. Copy .env.example to .env and fill it in.'); process.exit(1);
}

const s3 = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT || undefined,
  forcePathStyle: !!S3_ENDPOINT,
  credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
});

const app = express();
app.use(express.json());
app.use(express.static('public'));

const safeEq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
app.use('/api', (req, res, next) => {
  if (!safeEq(req.get('x-password') || '', APP_PASSWORD)) return res.status(401).json({ error: 'Wrong password' });
  next();
});

const wrap = fn => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: e.message }); });
const validKey = k => typeof k === 'string' && k.length > 0 && k.length < 1000 && !k.includes('..');

app.get('/api/files', wrap(async (req, res) => {
  const files = []; let token;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: S3_BUCKET, Prefix: 'files/', ContinuationToken: token }));
    for (const o of r.Contents || []) files.push({ key: o.Key, size: o.Size, date: o.LastModified });
    token = r.NextContinuationToken;
  } while (token);
  files.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(files);
}));

// Browser uploads straight to storage with this URL, so file size is not limited by this server.
app.post('/api/upload-url', wrap(async (req, res) => {
  const name = String(req.body.name || 'file').replace(/[\/\\]/g, '_').slice(0, 200);
  const key = `files/${Date.now()}-${crypto.randomBytes(3).toString('hex')}-${name}`;
  const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: req.body.type || 'application/octet-stream' }), { expiresIn: 3600 });
  res.json({ key, url });
}));

app.get('/api/download-url', wrap(async (req, res) => {
  if (!validKey(req.query.key)) return res.status(400).json({ error: 'Bad key' });
  const name = req.query.key.replace(/^files\/\d+-[0-9a-f]{6}-/, '');
  const url = await getSignedUrl(s3, new GetObjectCommand({
    Bucket: S3_BUCKET, Key: req.query.key,
    ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
  }), { expiresIn: 300 });
  res.json({ url });
}));

app.delete('/api/files', wrap(async (req, res) => {
  if (!validKey(req.query.key)) return res.status(400).json({ error: 'Bad key' });
  await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: req.query.key }));
  res.json({ ok: true });
}));

app.listen(PORT, () => console.log(`My Files running on http://localhost:${PORT}`));
