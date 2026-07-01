# Production Deployment Structure

The two apps deploy independently and on different schedules — the backend can ship a fix without an app store release, and the mobile app's build pipeline doesn't know or care how the backend is hosted, only its URL.

## Backend

Build artifact: `backend/dist/` (plain compiled JS, produced by `npm run build`). Runtime needs only `dist/`, `node_modules` (production deps), and `package.json` — `src/` and TypeScript tooling are not required at runtime.

Suggested setup:

```
backend (container or VM)
├── dist/                  # npm run build output
├── node_modules/          # npm ci --omit=dev
├── package.json
└── .env                   # injected via platform secrets, never committed
```

- **Process management**: run `node dist/server.js` behind a process manager (PM2, systemd, or the container runtime's own restart policy) — `server.ts` already does graceful shutdown on `SIGTERM`/`SIGINT`, so orchestrators that send those signals (Docker, Kubernetes, most PaaS) will drain connections cleanly.
- **Reverse proxy / TLS**: terminate HTTPS in front of the Node process (nginx, the platform's managed load balancer, or a service like Render/Railway/Fly that does this for you). The app itself serves plain HTTP on `PORT`.
- **Database**: MongoDB Atlas (or self-managed replica set) — set `MONGODB_URI` to the production connection string. Never reuse a dev database for production.
- **Secrets**: `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` must be long random values, different per environment, provided via the platform's secret manager (not baked into an image).
- **Containerizing** (if used): multi-stage Dockerfile — stage 1 installs all deps and runs `npm run build`; stage 2 copies only `dist/`, `package.json`, and runs `npm ci --omit=dev` before `CMD ["node", "dist/server.js"]`. Keeps the final image free of TypeScript/dev tooling.
- **Horizontal scaling**: the app is stateless (JWT auth, no in-memory sessions) except for the rate limiter, which is in-memory per instance — if you run multiple instances behind a load balancer, swap `express-rate-limit`'s default store for a shared one (e.g. Redis-backed) so limits apply across instances.

## Mobile

There is no server to deploy — the build pipeline produces installable binaries via **EAS Build** (Expo's hosted build service) or a local build.

```
mobile (EAS)
├── eas.json               # build profiles: development / preview / production
└── EXPO_PUBLIC_API_URL    # set per-profile, points at the matching backend environment
```

Typical `eas.json` shape (not generated yet — add when you're ready to build):

```jsonc
{
  "build": {
    "development": { "env": { "EXPO_PUBLIC_API_URL": "http://<lan-ip>:5000/api/v1" } },
    "preview":     { "env": { "EXPO_PUBLIC_API_URL": "https://staging-api.example.com/api/v1" } },
    "production":  { "env": { "EXPO_PUBLIC_API_URL": "https://api.example.com/api/v1" } }
  }
}
```

- **Android**: `eas build --platform android --profile production` produces an `.aab` for Play Store submission (or `.apk` for direct distribution/testing).
- **iOS**: `eas build --platform ios --profile production` produces an `.ipa` for TestFlight/App Store submission — requires an Apple Developer account; Expo Go is dev/test-only and is never the production distribution mechanism.
- Because `EXPO_PUBLIC_*` vars are inlined into the JS bundle at build time, **a production binary always points at one fixed backend URL** — switching backends means a new build, not a runtime config change.

## Environment matrix

| Environment | Mobile build | Backend |
|---|---|---|
| Local dev | Expo Go + `--tunnel` or LAN | `tsx watch` on your machine, local or Atlas free-tier Mongo |
| Staging | EAS `preview` profile (internal distribution) | Deployed instance pointed at a staging Mongo cluster |
| Production | EAS `production` profile, store-submitted | Deployed instance behind TLS, production Mongo cluster, real JWT secrets |

Promote backend changes through staging before production the same way you would any API; promote mobile builds by bumping `app.json`'s `version`/`runtimeVersion` and creating a new EAS build per profile.
