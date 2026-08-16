<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/47437e96-d702-4a59-8710-d4c2fbd6eff4

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deployment & Firebase Architecture

### Caching Policy & Assets
We've configured `firebase.json` for optimal performance.
- Long cache (max-age=31536000, immutable) for static assets like `.js`, `.css`, and images.
- Short/no-cache for `index.html` to ensure users always receive the latest app updates.
- Gzip and Brotli compressions are fully enabled during the Vite build step, saving bandwidth.

### Firebase Cloud Functions Gen 2
- Migrated latency-critical endpoints to Google Cloud Functions Gen 2.
- Configured region to `asia-east1` (closest to target users).
- **Production Checklist:**
  - [x] Configure Firebase Gen 2 with `minInstances: 1` to reduce cold starts.
  - [x] Configure 1GiB memory for heavier endpoints.
  - [x] Run `npm run deploy` from the `functions` directory.

### Firestore
- Added indexes inside `firestore.indexes.json` for ordering by `createdAt` DESC.
- Optimized query sizes using `limit(500)` combined with pagination in the frontend to avoid costly table scans.
- **Production Checklist:**
  - [x] Ensure indexes are fully deployed via `firebase deploy --only firestore:indexes`.

## CI & Automated Checks
- Merging PRs into `main` automatically triggers GitHub Actions.
- Steps include `eslint` auto-fix checks, `tsc` type checks, and a bundle size threshold check (fail if `server.cjs` > 250KB).
