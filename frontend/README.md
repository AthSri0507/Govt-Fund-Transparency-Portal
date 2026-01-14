# Frontend (Vite + React)

Quick start:

```bash
cd frontend
npm install
npm run dev
```

Dev server proxies `/api/*` to `http://localhost:4000` (see `vite.config.js`).

Pages:
- `/login` — login form that posts to backend `/auth/login` and stores the access token in `localStorage`.
- `/` — protected home page that calls `/projects` with the token.
