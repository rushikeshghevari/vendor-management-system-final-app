# Monorepo Structure

```
vendor-management-system/
├── package.json          # root convenience scripts only — no shared deps, no workspaces
├── .gitignore             # repo-root-level entries only
├── mobile/                # React Native (Expo) + TypeScript app
│   ├── App.tsx
│   ├── app.json
│   ├── babel.config.js
│   ├── metro.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── package.json
│   ├── .env / .env.example
│   └── src/
│       ├── bootstrap/      # provider composition (Redux, theme, error boundary)
│       ├── components/ui/  # reusable UI components
│       ├── config/         # env.ts
│       ├── constants/
│       ├── features/auth/  # auth slice + RTK Query endpoints + screens
│       ├── hooks/
│       ├── navigation/
│       ├── providers/
│       ├── services/       # axios client, error normalizer
│       ├── store/          # Redux store, RTK Query base API
│       ├── theme/
│       ├── types/
│       └── utils/
├── backend/                # Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── app.ts          # Express app (middleware + route mounting)
│   │   ├── server.ts       # entrypoint (DB connect + listen + graceful shutdown)
│   │   ├── config/         # env.ts, db.ts
│   │   ├── constants/      # roles.ts, status.ts
│   │   ├── middleware/     # auth, rbac, validate, error, rate limiter
│   │   ├── routes/         # route aggregator
│   │   ├── modules/        # one folder per business module (model/controller/service/validation/routes)
│   │   ├── types/
│   │   └── utils/
│   ├── tsconfig.json
│   ├── package.json
│   └── .env / .env.example
└── docs/                   # this folder
```

**Why two independent `node_modules` trees instead of npm workspaces:** Expo's Metro bundler makes assumptions about where native module dependencies live relative to the app root. Hoisting dependencies into a shared root `node_modules` via npm/yarn workspaces is supported by Metro but requires extra `metro.config.js` configuration (`watchFolders`, `nodeModulesPaths`) and is a common source of "module not found" issues that have nothing to do with your code. Since the backend and mobile app don't share any runtime dependencies, keeping them fully independent removes an entire category of accidental breakage. The root `package.json` only provides `--prefix`-based convenience scripts — it installs nothing itself.

## Mobile `package.json` (key fields)

```jsonc
{
  "name": "vendor-management-system",
  "main": "index.ts",
  "scripts": {
    "start": "expo start",
    "start:tunnel": "expo start --tunnel",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "expo": "~56.0.12",
    "react": "19.2.3",
    "react-native": "0.85.3",
    "nativewind": "^4.2.6",
    "tailwindcss": "^3.4.19",
    "@react-navigation/native": "^7.3.4",
    "@react-navigation/native-stack": "^7.17.6",
    "@react-navigation/bottom-tabs": "^7.18.3",
    "@reduxjs/toolkit": "^2.12.0",
    "react-redux": "^9.3.0",
    "axios": "^1.18.1",
    "react-hook-form": "^7.80.0",
    "expo-secure-store": "~56.0.4",
    "@react-native-async-storage/async-storage": "2.2.0"
  }
}
```
Full file: [`mobile/package.json`](../mobile/package.json).

## Backend `package.json` (key fields)

```jsonc
{
  "name": "vms-backend",
  "main": "dist/server.js",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json && tsc-alias",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4.22.2",
    "mongoose": "^9.7.2",
    "jsonwebtoken": "^9.0.3",
    "bcryptjs": "^3.0.3",
    "zod": "^4.4.3",
    "helmet": "^8.2.0",
    "cors": "^2.8.6",
    "express-rate-limit": "^8.5.2",
    "express-mongo-sanitize": "^2.2.0"
  }
}
```
Full file: [`backend/package.json`](../backend/package.json).

Note: Express is pinned to v4. `express-mongo-sanitize` (and several other ecosystem middleware) mutate `req.query`, which became a read-only getter in Express 5 — using v5 breaks that middleware at runtime with no compile-time warning.

## Shared environment variable strategy

The two apps **do not share a `.env` file** — they run in different processes (one on a phone/emulator, one on a server) and have different security boundaries. Each has its own `.env` (gitignored) and `.env.example` (committed):

| | Mobile (`mobile/.env`) | Backend (`backend/.env`) |
|---|---|---|
| Loaded by | Expo's bundler, vars prefixed `EXPO_PUBLIC_*` are inlined into the JS bundle at build time | `dotenv` at process start |
| Visibility | Bundled into the app binary — **never put secrets here**, anyone can extract them from the built app | Stays on the server, never shipped to a client |
| Key variable | `EXPO_PUBLIC_API_URL` — must point at wherever `backend` is reachable from the device | `PORT`, `MONGODB_URI`, `JWT_*_SECRET`, `CORS_ORIGIN` |

The link between them is exactly one value: **`mobile`'s `EXPO_PUBLIC_API_URL` must equal the address the device can reach `backend` on.**

- Local dev, same machine, Android emulator: `http://10.0.2.2:<PORT>/api/v1`
- Local dev, physical device (same WiFi): `http://<your-LAN-IP>:<PORT>/api/v1`
- Local dev with `--tunnel` (Expo tunnel only proxies the Metro bundler, **not** your API server): point `EXPO_PUBLIC_API_URL` at your LAN IP (if device is reachable that way) or a separate tunnel for the API itself (e.g. `ngrok http <PORT>`) — full walkthrough in [IPHONE_TESTING.md](./IPHONE_TESTING.md)
- Staging/production: the deployed backend's public HTTPS URL, set via EAS build profile env (see Deployment doc)

`backend/.env` also drives `CORS_ORIGIN`, which must include whatever origin the mobile app's requests appear to come from in each environment (in React Native this is generally not origin-restricted the way a browser is, but keep it explicit rather than `*` once you have a real deployment).

## Development commands

From the repo root:

```bash
npm run install:all        # npm install in mobile/ and backend/
npm run dev:backend        # start backend with hot reload (tsx watch)
npm run dev:mobile         # start Expo dev server (LAN)
npm run dev:mobile:tunnel  # start Expo dev server with --tunnel (for iPhone/Expo Go testing)
npm run typecheck          # tsc --noEmit in both projects
```

Or work inside each project directly (equivalent, sometimes clearer):

```bash
cd backend && npm run dev
cd mobile && npx expo start --tunnel
```

Run the backend (with a reachable MongoDB) before starting the mobile app — the mobile app's RTK Query calls will fail until `EXPO_PUBLIC_API_URL` in `mobile/.env` resolves to a running backend.
