# My Files

Single-page cloud file storage. Node server + any S3-compatible bucket (Cloudflare R2 recommended).
Browsers upload and download directly to the bucket via short-lived signed URLs, so there is no file size limit from this server.

## Setup (Cloudflare R2, free tier 10 GB)
1. Cloudflare dashboard > R2 > Create bucket (e.g. `my-files`).
2. R2 > Manage API tokens > Create token with **Object Read & Write** for that bucket. Copy the Access Key ID, Secret, and the S3 endpoint (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`).
3. Bucket > Settings > CORS policy: paste `cors.json`, replacing YOUR-DOMAIN.com with your site URL.
4. `cp .env.example .env` and fill it in (use a strong APP_PASSWORD).
5. `npm install && npm start`, then open http://localhost:3000.

## Deploy
Any Node host works (Render, Railway, Fly.io). Set the same variables as environment variables, start command `npm start`.
Do not use a host with a temporary disk for storage: this app doesn't write files to disk, everything lives in the bucket.
