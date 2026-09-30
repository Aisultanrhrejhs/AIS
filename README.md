# AIS

## MiniTube

A local-first video library with a retro video-terminal interface. Video files are stored on disk in `storage/videos`; catalog metadata is stored in `storage/catalog.json`.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

```powershell
npm install
npm run dev
```

Open the Vite URL printed by the dev server. The Express API listens on `127.0.0.1:3001`. Both development servers are managed by `npm run dev`.

For a production preview:

```powershell
npm run build
npm start
```

The production server listens on `http://localhost:3001` and serves the `dist` directory when it exists.

## Features

- Video upload to local disk with transfer progress, drag and drop, category, title, and description.
- Local video catalog, range-enabled playback, search, category filters, and infinite scrolling.
- Per-browser likes, dislikes, subscriptions, saved videos, viewing history, comments, and view counts.
- Editable local profile and a local admin dashboard.
- Direct video links using `?video=<video-id>`.

Account sessions and account records are stored in the current browser. Passwords are hashed with Web Crypto, but authentication is not server-side and is not suitable for a public deployment. Engagement metrics and comments are also browser-local; the video files and catalog are stored on the host disk. The server binds to loopback and is not exposed to the network.
